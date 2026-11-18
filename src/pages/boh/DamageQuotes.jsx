import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'
import { PhotoField, PhotoGrid } from '../../components/Photos'

// 固定資產破損報價：客人打爛鏡、電視等固定資產時，其他部門（工程部、採購部、外判商等）報嘅價，記低作參考
const GRP_HINT = ['鏡／玻璃', '電視／電器', '家具', '地毯／地板', '衛浴設施', '燈具', '窗簾／布藝', '其他']
const DEPT_HINT = ['工程部', '採購部', '財務部', '客務部', '外判商']
const money = (n, cur) => (n == null || n === '' ? '—' : (cur === 'HKD' ? 'HKD ' : 'MOP ') + Number(n).toLocaleString())
const dateTxt = d => (d ? String(d).slice(0, 10) : '—')

export default function DamageQuotes({ edit, who }) {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState('')
  const [sheet, setSheet] = useState(null)
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => api.dbSelect('damage_quotes', { order: 'created_at' }).then(r => { setItems(r); setErr('') }).catch(ex => { setErr(ex.message); setItems(prev => prev || []) })
  useEffect(() => { load() }, [])
  if (!items) return <div className="note">載入中…</div>

  const grps = [...new Set(items.map(i => i.grp).filter(Boolean))]
  const k = q.trim().toLowerCase()
  const list = items
    .filter(i => (!grp || i.grp === grp) && (!k || ((i.name || '') + (i.grp || '') + (i.dept || '') + (i.notes || '')).toLowerCase().includes(k)))
    .sort((a, b) => String(b.quote_date || b.created_at).localeCompare(String(a.quote_date || a.created_at)))

  async function save() {
    const e = sheet
    if (!e.name.trim()) { toast('請填資產名稱'); return }
    const row = { grp: e.grp.trim(), name: e.name.trim(), dept: e.dept.trim(), price: e.price === '' ? null : Number(e.price), cur: e.cur === 'HKD' ? 'HKD' : 'MOP', quote_date: e.quote_date || null, notes: e.notes.trim(), photos: e.photos || [] }
    if (row.price != null && Number.isNaN(row.price)) { toast('報價要係數字'); return }
    try {
      if (e.id) await api.dbUpdate('damage_quotes', e.id, row)
      else await api.dbInsert('damage_quotes', { ...row, sort_order: items.length + 1, created_by: who || null })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function del() {
    if (!window.confirm('刪除呢條報價記錄？')) return
    try { await api.dbDelete('damage_quotes', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) }
  }
  const blank = () => ({ id: null, grp: grp || '', name: '', dept: '', price: '', cur: 'MOP', quote_date: todayStr(), notes: '', photos: [] })
  const reportData = () => ({
    filterText: grp || '全部',
    cols: ['資產／物品', '分類', '報價部門', '報價', '報價日期', '備註'],
    groups: [{ name: '固定資產破損報價', rows: list.map(i => ({ cells: [i.name || '—', i.grp || '—', i.dept || '—', money(i.price, i.cur), dateTxt(i.quote_date), i.notes || '—'] })) }],
  })

  return (
    <>
      <ToolBar label={`固定資產破損報價 · ${items.length} 項`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <p className="src-note" style={{ margin: '0 4px 8px', lineHeight: 1.6 }}>客人打爛鏡、電視等固定資產時，其他部門報嘅價，作為參考。</p>
      <div className="fstk">
        <input className="search-inp" placeholder="搜尋資產／部門／備註" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {grps.length > 0 && (
        <div className="chips" style={{ margin: '8px 0' }}>
          <button className={'chip' + (!grp ? ' on' : '')} onClick={() => setGrp('')}>全部（{items.length}）</button>
          {grps.map(g => <button key={g} className={'chip' + (grp === g ? ' on' : '')} onClick={() => setGrp(grp === g ? '' : g)}>{g}（{items.filter(i => i.grp === g).length}）</button>)}
        </div>
      )}
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {list.length === 0 && !err && <p className="src-note" style={{ margin: '14px 4px' }}>{items.length ? '冇符合嘅記錄。' : '暫時未有記錄。'}{edit && !items.length ? '撳右下角「＋」新增。' : ''}</p>}
      <div className="pa-grid pa-grid-an">
        {list.map(i => (
          <div className="pa-sq pa-an" key={i.id} role="button" tabIndex={0} onClick={() => edit && setSheet({ ...i, price: i.price ?? '', cur: i.cur || 'MOP', dept: i.dept || '', grp: i.grp || '', notes: i.notes || '', quote_date: i.quote_date || '', photos: i.photos || [] })} style={edit ? undefined : { cursor: 'default' }}>
            <span className="pa-sq-top"><em>{i.grp || '未分類'}</em></span>
            {(i.photos || []).length > 0 && <div className="rs-ph" onClick={e => e.stopPropagation()}><PhotoGrid photos={i.photos} /></div>}
            <b className="pa-sq-name">{i.name || '（未命名）'}</b>
            <span className="pa-sq-post">
              <span className="st-qty">{money(i.price, i.cur)}</span>
              <span className="pa-sub">{i.dept || '未註明部門'} · {dateTxt(i.quote_date)}</span>
              {i.notes && <span className="pa-sq-area">{i.notes}</span>}
            </span>
          </div>
        ))}
      </div>
      {edit && <button className="fab" onClick={() => setSheet(blank())}>＋</button>}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? (sheet.name || '編輯報價') : '新增破損報價'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
            <div className="f-row"><label>資產／物品名稱</label><input value={sheet.name} onChange={e => setSheet({ ...sheet, name: e.target.value })} placeholder="例：房間鏡（浴室大鏡）、55 吋電視" /></div>
            <div className="f-row"><label>分類</label>
              <input list="dq-grp" value={sheet.grp} onChange={e => setSheet({ ...sheet, grp: e.target.value })} placeholder="例：鏡／玻璃" />
              <datalist id="dq-grp">{[...new Set([...GRP_HINT, ...items.map(i => i.grp).filter(Boolean)])].map(x => <option key={x} value={x} />)}</datalist></div>
            <div className="f-row"><label>報價部門</label>
              <input list="dq-dept" value={sheet.dept} onChange={e => setSheet({ ...sheet, dept: e.target.value })} placeholder="例：工程部" />
              <datalist id="dq-dept">{[...new Set([...DEPT_HINT, ...items.map(i => i.dept).filter(Boolean)])].map(x => <option key={x} value={x} />)}</datalist></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>報價（{sheet.cur === 'HKD' ? '港幣' : '澳門幣'}）</label><input inputMode="decimal" value={sheet.price} onChange={e => setSheet({ ...sheet, price: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>報價日期</label><input type="date" value={sheet.quote_date || ''} onChange={e => setSheet({ ...sheet, quote_date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>貨幣</label><div className="seg" style={{ margin: 0 }}>{[['MOP', '澳門幣 MOP'], ['HKD', '港幣 HKD']].map(([c, t]) => <button key={c} className={(sheet.cur || 'MOP') === c ? 'on' : ''} onClick={() => setSheet({ ...sheet, cur: c })}>{t}</button>)}</div></div>
            <PhotoField label="相片（破損情況／報價單）" photos={sheet.photos} max={3} onChange={v => setSheet({ ...sheet, photos: v })} />
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} placeholder="例：尺寸、型號、損壞情況、含安裝與否" /></div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={del}>刪除這項</button>}
          </div>
        </div>
      )}
      {report && (
        <ReportModal title="後勤管理 · 固定資產破損報價" sub={`${grp || '全部'} · ${todayStr()}`} onClose={() => setReport(false)}>
          <ListReport data={reportData()} />
        </ReportModal>
      )}
    </>
  )
}
