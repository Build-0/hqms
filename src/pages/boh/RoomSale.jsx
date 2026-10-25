import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'

// 房間可售物品：價錢／庫存表（名稱、分類、單價 MOP、現有數量、最低存量、存放位置、備註）
const GRP_HINT = ['迷你吧飲品', '零食', '日用品', '洗漱用品', '其他']
const money = n => (n == null || n === '' ? '—' : 'MOP ' + Number(n).toLocaleString())

export default function RoomSale({ edit }) {
  const [items, setItems] = useState(null)
  const [f, setF] = useState({ low: false, q: '' })
  const [sheet, setSheet] = useState(null)
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => api.dbSelect('room_sale_items', { order: 'sort_order' }).then(r => { setItems(r); setErr('') }).catch(ex => { setErr(ex.message); setItems(prev => prev || []) })
  useEffect(() => { load() }, [])
  if (!items) return <div className="note">載入中…</div>
  const low = i => i.min_qty > 0 && i.qty <= i.min_qty
  const list = items.filter(i => (!f.low || low(i)) && (!f.q.trim() || ((i.name || '') + (i.grp || '') + (i.location || '')).toLowerCase().includes(f.q.trim().toLowerCase())))
  const lowN = items.filter(low).length
  const value = items.reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.qty) || 0), 0)
  const groups = []
  list.forEach(i => { const g = i.grp || '未分類'; const x = groups.find(y => y.g === g); if (x) x.items.push(i); else groups.push({ g, items: [i] }) })
  const hasGroups = groups.some(g => g.g !== '未分類')

  async function save() {
    const e = sheet
    const row = { grp: e.grp.trim(), name: e.name.trim(), price: e.price === '' ? null : Number(e.price), qty: Number(e.qty) || 0, min_qty: Number(e.min_qty) || 0, location: e.location.trim(), notes: e.notes.trim() }
    try {
      if (e.id) await api.dbUpdate('room_sale_items', e.id, row); else await api.dbInsert('room_sale_items', { ...row, sort_order: items.length + 1 })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function del() { try { await api.dbDelete('room_sale_items', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) } }
  async function adjust(i, d) { try { await api.dbUpdate('room_sale_items', i.id, { qty: Math.max(0, i.qty + d) }); load() } catch (ex) { toast(ex.message) } }
  const reportData = () => ({
    filterText: f.low ? '只顯示存量低' : '全部',
    cols: ['分類', '品項', '單價', '現有', '最低存量', '庫存值', '位置', '備註'],
    groups: groups.map(g => ({ name: g.g, rows: g.items.map(i => ({ cells: [i.grp || '—', i.name || '—', money(i.price), i.qty, i.min_qty || '—', i.price == null ? '—' : money(i.price * i.qty), i.location || '—', i.notes || '—'], cls: low(i) ? { 3: 'rpt-red' } : undefined })) })),
  })

  return (
    <>
      <ToolBar label={`房間可售物品 · ${items.length} 項`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <p className="pa-stat">庫存總值（單價 × 現有）：{money(value)}　·　存量低 {lowN} 項</p>
      <div className="fstk">
        <div className="df-grid3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
          <input className="search-inp" placeholder="搜尋品項／分類／位置" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          <button className={'chip' + (f.low ? ' on' : '')} onClick={() => setF({ ...f, low: !f.low })}>存量低（{lowN}）</button>
        </div>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {list.length === 0 && !err && <p className="src-note" style={{ margin: '14px 4px' }}>{items.length ? '冇符合嘅品項。' : '暫時未有品項。'}{edit && !items.length ? '撳右下角「＋」新增。' : ''}</p>}
      {groups.map(g => (
        <div key={g.g}>
          {hasGroups && <div className="bh-grp">{g.g}<span>{g.items.length}</span></div>}
          <div className="pa-grid pa-grid-an">
            {g.items.map(i => (
              <div className="pa-sq pa-an" key={i.id} role="button" tabIndex={0} onClick={() => edit && setSheet({ ...i, price: i.price ?? '' })} style={edit ? undefined : { cursor: 'default' }}>
                <span className="pa-sq-top"><em>{i.location || '未設位置'}</em>{low(i) && <small className="pa-flag">存量低</small>}</span>
                <b className="pa-sq-name">{i.name || '（未命名）'}</b>
                <span className="pa-sq-post">
                  <span className="st-qty">{money(i.price)}</span>
                  <span className={'pa-hrs' + (low(i) ? ' low' : '')}>庫存 {i.qty} 件{i.min_qty ? ` ／ 最低 ${i.min_qty}` : ''}</span>
                  {i.notes && <span className="pa-sq-area">{i.notes}</span>}
                </span>
                {edit && (
                  <div className="uni-adj" onClick={e => e.stopPropagation()}>
                    <button className="mini" onClick={() => adjust(i, -1)}>－ 1</button>
                    <button className="mini" onClick={() => adjust(i, 1)}>＋ 1</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {edit && <button className="fab" onClick={() => setSheet({ id: null, grp: '', name: '', price: '', qty: '', min_qty: '', location: '', notes: '' })}>＋</button>}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? (sheet.name || '編輯品項') : '新增可售物品'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
            <div className="f-row"><label>品項名稱</label><input value={sheet.name} onChange={e => setSheet({ ...sheet, name: e.target.value })} /></div>
            <div className="f-row"><label>分類</label>
              <input list="rs-grp" value={sheet.grp} onChange={e => setSheet({ ...sheet, grp: e.target.value })} placeholder="例：迷你吧飲品" />
              <datalist id="rs-grp">{[...new Set([...GRP_HINT, ...items.map(i => i.grp).filter(Boolean)])].map(x => <option key={x} value={x} />)}</datalist></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>單價（MOP）</label><input inputMode="decimal" value={sheet.price} onChange={e => setSheet({ ...sheet, price: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>現有數量</label><input inputMode="numeric" value={sheet.qty} onChange={e => setSheet({ ...sheet, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>最低存量</label><input inputMode="numeric" value={sheet.min_qty} onChange={e => setSheet({ ...sheet, min_qty: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>存放位置</label><input value={sheet.location} onChange={e => setSheet({ ...sheet, location: e.target.value })} /></div>
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={del}>刪除這項</button>}
          </div>
        </div>
      )}
      {report && <ReportModal title="房間可售物品價錢／庫存表" sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
