import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'

// 制服布草管理：只做庫存（領用／歸還由各部門自己嘅系統處理）
// 每款制服：款式、尺碼、現有數量、最低存量（低於即標「存量低」）、存放位置、備註
export default function Uniform({ edit }) {
  const [items, setItems] = useState(null)
  const [f, setF] = useState({ low: false, q: '', cat: '' })
  const [sheet, setSheet] = useState(null)
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => api.dbSelect('uni_items', { order: 'sort_order' }).then(r => { setItems(r); setErr('') }).catch(ex => { setErr(ex.message); setItems(prev => prev || []) })
  useEffect(() => { load() }, [])
  if (!items) return <div className="note">載入中…</div>
  const nm = i => [i.name, i.size].filter(Boolean).join(' ') || '（未命名）'
  const low = i => i.min_qty > 0 && i.qty <= i.min_qty
  const list = items.filter(i => (!f.cat || (i.cat || '制服') === f.cat) && (!f.low || low(i)) && (!f.q.trim() || (nm(i) + (i.location || '')).toLowerCase().includes(f.q.trim().toLowerCase())))
  const total = items.reduce((a, i) => a + (Number(i.qty) || 0), 0)
  const lowN = items.filter(low).length

  async function save() {
    const e = sheet
    const row = { cat: e.cat || '制服', name: e.name.trim(), size: e.size.trim(), qty: Number(e.qty) || 0, min_qty: Number(e.min_qty) || 0, location: e.location.trim(), notes: e.notes.trim() }
    try {
      if (e.id) await api.dbUpdate('uni_items', e.id, row); else await api.dbInsert('uni_items', { ...row, sort_order: items.length + 1 })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function del() { try { await api.dbDelete('uni_items', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) } }
  async function adjust(i, d) {
    try { await api.dbUpdate('uni_items', i.id, { qty: Math.max(0, i.qty + d) }); load() } catch (ex) { toast(ex.message) }
  }
  const reportData = () => ({
    filterText: [f.cat, f.low ? '存量低' : ''].filter(Boolean).join('、') || '全部',
    cols: ['類別', '品項', '現有', '最低存量', '位置', '備註'],
    groups: [{ name: '制服及布草庫存', rows: list.map(i => ({ cells: [i.cat || '制服', nm(i), i.qty, i.min_qty || '—', i.location || '—', i.notes || '—'], cls: low(i) ? { 2: 'rpt-red' } : undefined })) }],
  })

  return (
    <>
      <ToolBar label={`制服庫存 · ${items.length} 款 · 共 ${total} 件`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="fstk">
        <div className="df-grid3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
          <input className="search-inp" placeholder="搜尋款式／位置" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          <button className={'chip' + (f.low ? ' on' : '')} onClick={() => setF({ ...f, low: !f.low })}>存量低（{lowN}）</button>
        </div>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {list.length === 0 && !err && <p className="src-note" style={{ margin: '14px 4px' }}>{items.length ? '冇符合嘅制服。' : '暫時未有制服。'}{edit && !items.length ? '撳右下角「＋」新增。' : ''}</p>}
      <div className="pa-grid pa-grid-an">
        {list.map(i => (
          <div className="pa-sq pa-an" key={i.id} role="button" tabIndex={0} onClick={() => edit && setSheet({ ...i })} style={edit ? undefined : { cursor: 'default' }}>
            <span className="pa-sq-top"><em>{i.location || '未設位置'}</em>{low(i) && <small className="pa-flag">存量低</small>}</span>
            <b className="pa-sq-name">{nm(i)}</b>
            <span className="pa-sq-post">
              <span className={'st-qty' + (low(i) ? ' low' : '')}>{i.qty}<small> 件{i.min_qty ? ` ／ 最低 ${i.min_qty}` : ''}</small></span>
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
      {edit && <button className="fab" onClick={() => setSheet({ id: null, name: '', size: '', qty: '', min_qty: '', location: '', notes: '' })}>＋</button>}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? nm(sheet) : '新增制服'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
            <div className="f-row"><label>款式</label><input value={sheet.name} onChange={e => setSheet({ ...sheet, name: e.target.value })} placeholder="例：房務員上衣" /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>尺碼</label><input value={sheet.size} onChange={e => setSheet({ ...sheet, size: e.target.value })} placeholder="S／M／L／42" /></div>
              <div className="f-row" style={{ flex: 1 }}><label>現有數量</label><input inputMode="numeric" value={sheet.qty} onChange={e => setSheet({ ...sheet, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>最低存量</label><input inputMode="numeric" value={sheet.min_qty} onChange={e => setSheet({ ...sheet, min_qty: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>存放位置</label><input value={sheet.location} onChange={e => setSheet({ ...sheet, location: e.target.value })} /></div>
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={del}>刪除這款制服</button>}
          </div>
        </div>
      )}
      {report && <ReportModal title="制服布草管理" sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
