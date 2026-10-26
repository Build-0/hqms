import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'
import { PhotoField, PhotoGrid } from '../../components/Photos'

// 報銷與遺失管理（報損總表）：
//   庫存(臺面) = 入庫合計 − 樓層 − 報損之前 − 報損本次 − 銷售／轉部門 − 丟失
//   差異       = 庫存(臺面) − 庫存(手頭)
// 登記報損／丟失／轉部門會自動加落對應品項；每月「結算」把「報損本次」滾入「報損之前」。
const KINDS = [['報損', 'wo_cur'], ['丟失', 'lost'], ['銷售／轉部門', 'sold']]
const FIELDS = [['received', '入庫合計'], ['floor_qty', '樓層'], ['wo_before', '報損之前'], ['wo_cur', '報損本次'], ['sold', '銷售／轉部門'], ['lost', '丟失'], ['stock_hand', '庫存(手頭)']]
const n = v => Number(v) || 0
const desk = i => n(i.received) - n(i.floor_qty) - n(i.wo_before) - n(i.wo_cur) - n(i.sold) - n(i.lost)
const diff = i => desk(i) - n(i.stock_hand)
const nm = i => i.name_zh || i.name_en || '（未命名）'

export default function WriteOff({ edit, who }) {
  const [items, setItems] = useState(null)
  const [recs, setRecs] = useState([])
  const [periods, setPeriods] = useState([])
  const [view, setView] = useState('ledger')
  const [f, setF] = useState({ q: '', diffOnly: false })
  const [sheet, setSheet] = useState(null)       // 品項編輯
  const [rec, setRec] = useState(null)           // 登記
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => {
    api.dbSelect('wo_items', { order: 'sort_order' }).then(r => { setItems(r); setErr('') }).catch(ex => { setErr(ex.message); setItems(prev => prev || []) })
    api.dbSelect('wo_records', { order: 'rec_date', asc: false }).then(r => setRecs(r.filter(x => x.item_id))).catch(() => setRecs([]))
    api.dbSelect('wo_periods', { order: 'created_at', asc: false }).then(setPeriods).catch(() => setPeriods([]))
  }
  useEffect(() => { load() }, [])
  if (!items) return <div className="note">載入中…</div>
  const itemOf = id => items.find(i => i.id === id)
  const list = items.filter(i => (!f.diffOnly || diff(i) !== 0) && (!f.q.trim() || ((i.name_zh || '') + (i.name_en || '')).toLowerCase().includes(f.q.trim().toLowerCase())))
  const totCur = items.reduce((a, i) => a + n(i.wo_cur), 0)
  const diffN = items.filter(i => diff(i) !== 0).length
  const last = periods[0]

  async function saveItem() {
    const e = sheet
    const row = { name_en: e.name_en.trim(), name_zh: e.name_zh.trim(), notes: (e.notes || '').trim() }
    FIELDS.forEach(([k]) => { row[k] = Math.round(n(e[k])) })
    try {
      if (e.id) await api.dbUpdate('wo_items', e.id, row); else await api.dbInsert('wo_items', { ...row, sort_order: items.length + 1 })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delItem() { try { await api.dbDelete('wo_items', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) } }

  async function addRec() {
    const it = itemOf(rec.item_id)
    if (!it) { toast('請揀品項'); return }
    const q = Math.round(n(rec.qty))
    if (q <= 0) { toast('請填數量'); return }
    const field = KINDS.find(k => k[0] === rec.kind)[1]
    try {
      await api.dbInsert('wo_records', { item_id: it.id, item: nm(it), kind: rec.kind, qty: q, rec_date: rec.rec_date || todayStr(), reason: rec.reason.trim(), handler: rec.handler.trim(), status: '已批准', photos: rec.photos, notes: rec.notes.trim(), by_name: who || '' })
      await api.dbUpdate('wo_items', it.id, { [field]: n(it[field]) + q })
      toast('已登記，總表已更新'); setRec(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delRec(r) {
    const it = itemOf(r.item_id); const field = (KINDS.find(k => k[0] === r.kind) || [])[1]
    try {
      await api.dbDelete('wo_records', r.id)
      if (it && field) await api.dbUpdate('wo_items', it.id, { [field]: Math.max(0, n(it[field]) - n(r.qty)) })
      toast('已刪除並還原總表'); load()
    } catch (ex) { toast(ex.message) }
  }
  async function settle() {
    if (!totCur) { toast('「報損本次」全部係 0，唔使結算'); return }
    if (!window.confirm(`結算本月：將全部品項嘅「報損本次」（共 ${totCur} 件）滾入「報損之前」，「報損本次」歸零。確定？`)) return
    try {
      for (const i of items.filter(x => n(x.wo_cur) > 0)) await api.dbUpdate('wo_items', i.id, { wo_before: n(i.wo_before) + n(i.wo_cur), wo_cur: 0 })
      await api.dbInsert('wo_periods', { label: todayStr(), by_name: who || '', total_cur: totCur })
      toast('已結算本月'); load()
    } catch (ex) { toast('結算失敗：' + ex.message) }
  }
  const reportData = () => ({
    filterText: f.diffOnly ? '只顯示有差異' : '全部品項',
    cols: ['品項', '入庫合計', '樓層', '報損之前', '報損本次', '銷售／轉部門', '丟失', '庫存(臺面)', '庫存(手頭)', '差異'],
    groups: [{ name: '報損總表', rows: list.map(i => ({ cells: [i.name_zh + (i.name_en ? ' ' + i.name_en : ''), i.received, i.floor_qty, i.wo_before, i.wo_cur, i.sold || '', i.lost || '', desk(i), i.stock_hand, diff(i)], cls: diff(i) !== 0 ? { 9: 'rpt-red' } : undefined })) }],
  })

  return (
    <>
      <ToolBar label={`報損總表 · ${items.length} 項`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <p className="pa-stat">本月報損 {totCur} 件　·　有差異 {diffN} 項　·　上次結算：{last ? last.label : '未有'}</p>
      <div className="seg" style={{ margin: '0 0 8px' }}>
        <button className={view === 'ledger' ? 'on' : ''} onClick={() => setView('ledger')}>總表</button>
        <button className={view === 'log' ? 'on' : ''} onClick={() => setView('log')}>登記記錄（{recs.length}）</button>
      </div>
      {edit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="btn" style={{ flex: 1, margin: 0 }} onClick={() => setRec({ item_id: items[0] ? items[0].id : '', kind: '報損', qty: '', rec_date: todayStr(), reason: '', handler: '', photos: [], notes: '' })}>＋ 登記報損／丟失／轉部門</button>
          <button className="btn ghost" style={{ flex: '0 0 32%', margin: 0 }} onClick={settle}>結算本月</button>
        </div>
      )}
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {view === 'ledger' && (
        <>
          <div className="fstk">
            <div className="df-grid3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
              <input className="search-inp" placeholder="搜尋品項（中文／英文）" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
              <button className={'chip' + (f.diffOnly ? ' on' : '')} onClick={() => setF({ ...f, diffOnly: !f.diffOnly })}>有差異（{diffN}）</button>
            </div>
          </div>
          <div className="wo-wrap">
            <table className="wo-t">
              <thead>
                <tr>
                  <th className="wo-nm">品項</th><th>入庫合計</th><th>樓層</th><th>報損之前</th><th className="c-wo">報損本次</th><th className="c-sold">銷售／轉部門</th><th>丟失</th><th className="c-calc">庫存(臺面)</th><th>庫存(手頭)</th><th className="c-calc">差異</th>
                </tr>
              </thead>
              <tbody>
                {list.map(i => (
                  <tr key={i.id} onClick={() => edit && setSheet({ ...i })} className={edit ? 'click' : ''}>
                    <td className="wo-nm"><b>{i.name_zh || i.name_en}</b>{i.name_zh && i.name_en && <small>{i.name_en}</small>}</td>
                    <td>{i.received || ''}</td><td>{i.floor_qty || ''}</td><td>{i.wo_before || ''}</td>
                    <td className="c-wo">{i.wo_cur || ''}</td><td className="c-sold">{i.sold || ''}</td><td>{i.lost || ''}</td>
                    <td className={'c-calc' + (desk(i) < 0 ? ' neg' : '')}>{desk(i)}</td><td>{i.stock_hand || ''}</td>
                    <td className={'c-calc' + (diff(i) !== 0 ? ' neg' : '')}>{diff(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>冇符合嘅品項。</p>}
          {edit && <button className="fab" onClick={() => setSheet({ id: null, name_en: '', name_zh: '', received: '', floor_qty: '', wo_before: '', wo_cur: '', sold: '', lost: '', stock_hand: '', notes: '' })}>＋</button>}
        </>
      )}
      {view === 'log' && (
        <>
          {recs.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有登記記錄。</p>}
          {recs.map(r => (
            <div className="pa-log pa-log-col" key={r.id}>
              <div className="pa-log-row">
                <b>{r.rec_date}</b>
                <span>{itemOf(r.item_id) ? nm(itemOf(r.item_id)) : r.item} · <b style={{ color: r.kind === '報損' ? '#b3342a' : r.kind === '丟失' ? '#6b7785' : '#245a9e' }}>{r.kind}</b> ×{r.qty}{r.reason ? ' · ' + r.reason : ''}{r.handler ? ' · 經手：' + r.handler : ''}</span>
                {edit && <button className="mini danger" onClick={() => delRec(r)}>刪除</button>}
              </div>
              {(r.photos || []).length > 0 && <div className="pa-ba"><PhotoGrid photos={r.photos} /></div>}
            </div>
          ))}
        </>
      )}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? nm(sheet) : '新增品項'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={saveItem}>儲存</button></span></div>
            <div className="f-row"><label>中文名</label><input value={sheet.name_zh} onChange={e => setSheet({ ...sheet, name_zh: e.target.value })} /></div>
            <div className="f-row"><label>英文名／規格</label><input value={sheet.name_en} onChange={e => setSheet({ ...sheet, name_en: e.target.value })} /></div>
            <div className="wo-grid">
              {FIELDS.map(([k, t]) => <div className="f-row" key={k}><label>{t}</label><input inputMode="numeric" value={sheet[k]} onChange={e => setSheet({ ...sheet, [k]: e.target.value })} /></div>)}
            </div>
            <p className="pa-stat" style={{ marginTop: 6 }}>庫存(臺面) <b>{desk(sheet)}</b>　·　差異 <b style={{ color: diff(sheet) !== 0 ? '#b3342a' : undefined }}>{diff(sheet)}</b>（自動計算）</p>
            <div className="f-row"><label>備註</label><input value={sheet.notes || ''} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={delItem}>刪除這個品項</button>}
          </div>
        </div>
      )}
      {rec && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setRec(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>登記報損／丟失／轉部門</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setRec(null)}>取消</button><button className="mini pri" onClick={addRec}>儲存</button></span></div>
            <div className="seg" style={{ margin: '0 0 10px' }}>{KINDS.map(([k]) => <button key={k} className={rec.kind === k ? 'on' : ''} onClick={() => setRec({ ...rec, kind: k })}>{k}</button>)}</div>
            <div className="f-row"><label>品項</label><select value={rec.item_id} onChange={e => setRec({ ...rec, item_id: e.target.value })}>{items.map(i => <option key={i.id} value={i.id}>{nm(i)}（臺面 {desk(i)}）</option>)}</select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>數量</label><input inputMode="numeric" value={rec.qty} onChange={e => setRec({ ...rec, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>日期</label><input type="date" value={rec.rec_date} onChange={e => setRec({ ...rec, rec_date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>原因</label><input value={rec.reason} onChange={e => setRec({ ...rec, reason: e.target.value })} /></div>
            <div className="f-row"><label>經手人</label><input value={rec.handler} onChange={e => setRec({ ...rec, handler: e.target.value })} /></div>
            <PhotoField label="相片" photos={rec.photos} max={4} onChange={v => setRec({ ...rec, photos: v })} />
            <div className="f-row"><label>備註（可留空）</label><input value={rec.notes} onChange={e => setRec({ ...rec, notes: e.target.value })} /></div>
          </div>
        </div>
      )}
      {report && <ReportModal landscape title="報銷與遺失管理 · 報損總表" sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
