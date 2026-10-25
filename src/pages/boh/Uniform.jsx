import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'

// 制服房管理（基本版）：制服庫存、員工領用／歸還記錄、未歸還一覽、低存量提示
export default function Uniform({ edit, who }) {
  const [items, setItems] = useState(null)
  const [issues, setIssues] = useState([])
  const [view, setView] = useState('stock')        // stock 庫存／log 領用記錄／out 未歸還
  const [sheet, setSheet] = useState(null)         // 庫存編輯
  const [rec, setRec] = useState(null)             // 新增領用／歸還
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => {
    api.dbSelect('uni_items', { order: 'sort_order' }).then(r => { setItems(r); setErr('') }).catch(ex => { setErr(ex.message); setItems(prev => prev || []) })
    api.dbSelect('uni_issues', { order: 'issue_date', asc: false }).then(setIssues).catch(() => setIssues([]))
  }
  useEffect(() => { load() }, [])
  if (!items) return <div className="note">載入中…</div>
  const nm = i => [i.name, i.size].filter(Boolean).join(' ') || '（未命名）'
  const itemOf = id => items.find(i => i.id === id)
  const low = i => i.min_qty > 0 && i.qty <= i.min_qty
  // 未歸還：員工 × 制服，領用數 − 歸還數 > 0
  const out = (() => {
    const m = {}
    issues.forEach(l => { const k = l.staff_name + '|' + l.item_id; m[k] = (m[k] || 0) + (l.action === '歸還' ? -l.qty : l.qty) })
    return Object.entries(m).filter(([, n]) => n > 0).map(([k, n]) => { const [staff, id] = k.split('|'); return { staff, item: itemOf(id), n } }).filter(x => x.item).sort((a, b) => a.staff.localeCompare(b.staff))
  })()

  async function saveItem() {
    const e = sheet
    const row = { name: e.name.trim(), size: e.size.trim(), qty: Number(e.qty) || 0, min_qty: Number(e.min_qty) || 0, location: e.location.trim(), notes: e.notes.trim() }
    try {
      if (e.id) await api.dbUpdate('uni_items', e.id, row); else await api.dbInsert('uni_items', { ...row, sort_order: items.length + 1 })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delItem() { try { await api.dbDelete('uni_items', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) } }
  async function addRec() {
    const it = itemOf(rec.item_id)
    if (!it) { toast('請揀制服'); return }
    if (!rec.staff_name.trim()) { toast('請填員工姓名'); return }
    const q = Math.max(1, Number(rec.qty) || 1)
    try {
      await api.dbInsert('uni_issues', { item_id: it.id, staff_name: rec.staff_name.trim(), action: rec.action, qty: q, issue_date: rec.issue_date || todayStr(), by_name: who || '', notes: rec.notes.trim() })
      await api.dbUpdate('uni_items', it.id, { qty: Math.max(0, it.qty + (rec.action === '歸還' ? q : -q)) })
      toast('已記錄'); setRec(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delIssue(l) {
    const it = itemOf(l.item_id)
    try {
      await api.dbDelete('uni_issues', l.id)
      if (it) await api.dbUpdate('uni_items', it.id, { qty: Math.max(0, it.qty + (l.action === '歸還' ? -l.qty : l.qty)) })
      toast('已刪除並還原庫存'); load()
    } catch (ex) { toast(ex.message) }
  }
  const reportData = () => view === 'out'
    ? { filterText: '未歸還制服', cols: ['員工', '制服', '數量'], groups: [{ name: '未歸還', rows: out.map(o => ({ cells: [o.staff, nm(o.item), o.n] })) }] }
    : { filterText: '制服庫存', cols: ['制服', '現有', '最低存量', '位置', '備註'], groups: [{ name: '制服庫存', rows: items.map(i => ({ cells: [nm(i), i.qty, i.min_qty || '—', i.location || '—', i.notes || '—'], cls: low(i) ? { 1: 'rpt-red' } : undefined })) }] }

  return (
    <>
      <ToolBar label={`制服房管理 · ${items.length} 款`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="seg" style={{ margin: '0 0 10px' }}>
        <button className={view === 'stock' ? 'on' : ''} onClick={() => setView('stock')}>庫存</button>
        <button className={view === 'log' ? 'on' : ''} onClick={() => setView('log')}>領用記錄</button>
        <button className={view === 'out' ? 'on' : ''} onClick={() => setView('out')}>未歸還（{out.length}）</button>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {view === 'stock' && (
        <>
          {items.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有制服。{edit ? '撳右下角「＋」新增。' : ''}</p>}
          <div className="pa-grid pa-grid-an">
            {items.map(i => (
              <button className="pa-sq pa-an" key={i.id} onClick={() => edit && setSheet({ ...i })} style={edit ? undefined : { cursor: 'default' }}>
                <span className="pa-sq-top"><em>{i.location || '未設位置'}</em>{low(i) && <small className="pa-flag">存量低</small>}</span>
                <b className="pa-sq-name">{nm(i)}</b>
                <span className="pa-sq-post"><span className={'st-qty' + (low(i) ? ' low' : '')}>{i.qty}<small> 件{i.min_qty ? ` ／ 最低 ${i.min_qty}` : ''}</small></span>{i.notes && <span className="pa-sq-area">{i.notes}</span>}</span>
              </button>
            ))}
          </div>
          {edit && <button className="fab" onClick={() => setSheet({ id: null, name: '', size: '', qty: '', min_qty: '', location: '', notes: '' })}>＋</button>}
        </>
      )}
      {view === 'log' && (
        <>
          {edit && <button className="btn" style={{ marginBottom: 10 }} onClick={() => setRec({ item_id: items[0] ? items[0].id : '', staff_name: '', action: '領用', qty: 1, issue_date: todayStr(), notes: '' })}>＋ 記錄領用／歸還</button>}
          {issues.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有記錄。</p>}
          {issues.map(l => (
            <div className="pa-log" key={l.id}><b>{l.issue_date}</b><span>{l.staff_name} · <b style={{ color: l.action === '歸還' ? '#17624f' : '#8a5a00' }}>{l.action}</b> {itemOf(l.item_id) ? nm(itemOf(l.item_id)) : '（已刪除）'} ×{l.qty}{l.notes ? ' · ' + l.notes : ''}</span>{edit && <button className="mini danger" onClick={() => delIssue(l)}>刪除</button>}</div>
          ))}
        </>
      )}
      {view === 'out' && (
        <>
          {out.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>冇未歸還嘅制服。</p>}
          {out.map(o => <div className="pa-log" key={o.staff + o.item.id}><b>{o.staff}</b><span>{nm(o.item)}</span><b>×{o.n}</b></div>)}
        </>
      )}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? nm(sheet) : '新增制服'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={saveItem}>儲存</button></span></div>
            <div className="f-row"><label>款式</label><input value={sheet.name} onChange={e => setSheet({ ...sheet, name: e.target.value })} placeholder="例：房務員上衣" /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>尺碼</label><input value={sheet.size} onChange={e => setSheet({ ...sheet, size: e.target.value })} placeholder="S／M／L／42" /></div>
              <div className="f-row" style={{ flex: 1 }}><label>現有數量</label><input inputMode="numeric" value={sheet.qty} onChange={e => setSheet({ ...sheet, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>最低存量</label><input inputMode="numeric" value={sheet.min_qty} onChange={e => setSheet({ ...sheet, min_qty: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>存放位置</label><input value={sheet.location} onChange={e => setSheet({ ...sheet, location: e.target.value })} /></div>
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={delItem}>刪除這款制服</button>}
          </div>
        </div>
      )}
      {rec && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setRec(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>記錄領用／歸還</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setRec(null)}>取消</button><button className="mini pri" onClick={addRec}>儲存</button></span></div>
            <div className="seg" style={{ margin: '0 0 10px' }}>{['領用', '歸還'].map(a => <button key={a} className={rec.action === a ? 'on' : ''} onClick={() => setRec({ ...rec, action: a })}>{a}</button>)}</div>
            <div className="f-row"><label>制服</label><select value={rec.item_id} onChange={e => setRec({ ...rec, item_id: e.target.value })}>{items.map(i => <option key={i.id} value={i.id}>{nm(i)}（現有 {i.qty}）</option>)}</select></div>
            <div className="f-row"><label>員工姓名</label><input value={rec.staff_name} onChange={e => setRec({ ...rec, staff_name: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>數量</label><input inputMode="numeric" value={rec.qty} onChange={e => setRec({ ...rec, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>日期</label><input type="date" value={rec.issue_date} onChange={e => setRec({ ...rec, issue_date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註（可留空）</label><input value={rec.notes} onChange={e => setRec({ ...rec, notes: e.target.value })} /></div>
          </div>
        </div>
      )}
      {report && <ReportModal title="制服房管理" sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
