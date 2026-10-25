import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'
import { PhotoField, PhotoGrid } from '../../components/Photos'

// 報銷與遺失管理（基本版）：登記報銷／遺失、狀態跟進（待審批／已批准／已駁回／已找回）、按月統計、匯出
const KINDS = ['報銷', '遺失']
const STATUS = ['待審批', '已批准', '已駁回', '已找回']
const money = n => (n == null || n === '' ? '—' : 'MOP ' + Number(n).toLocaleString())

export default function WriteOff({ edit, who }) {
  const [rows, setRows] = useState(null)
  const [f, setF] = useState({ kind: '', status: '' })
  const [sheet, setSheet] = useState(null)
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => api.dbSelect('wo_records', { order: 'rec_date', asc: false }).then(r => { setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { load() }, [])
  if (!rows) return <div className="note">載入中…</div>
  const list = rows.filter(r => (!f.kind || r.kind === f.kind) && (!f.status || r.status === f.status))
  const month = todayStr().slice(0, 7)
  const thisM = rows.filter(r => String(r.rec_date).startsWith(month) && r.status !== '已駁回')
  const sum = k => thisM.filter(r => r.kind === k).reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const cnt = k => thisM.filter(r => r.kind === k).length

  async function save() {
    const e = sheet
    const row = { kind: e.kind, item: e.item.trim(), qty: e.qty === '' ? null : Number(e.qty), amount: e.amount === '' ? null : Number(e.amount), rec_date: e.rec_date || todayStr(), location: e.location.trim(), handler: e.handler.trim(), reason: e.reason.trim(), status: e.status, photos: e.photos, notes: e.notes.trim() }
    try {
      if (e.id) await api.dbUpdate('wo_records', e.id, row); else await api.dbInsert('wo_records', { ...row, by_name: who || '' })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function del() { try { await api.dbDelete('wo_records', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) } }
  const reportData = () => ({
    filterText: [f.kind, f.status].filter(Boolean).join('、') || '全部',
    cols: ['日期', '類型', '物品', '數量', '金額', '地點', '原因', '狀態', '經手人'],
    groups: [{ name: '報銷與遺失', rows: list.map(r => ({ cells: [r.rec_date, r.kind, r.item || '—', r.qty ?? '—', r.amount ?? '—', r.location || '—', r.reason || '—', r.status, r.handler || '—'] })) }],
  })
  const sel = (k, label, opts) => <select className="df-sel" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}><option value="">{label}</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>

  return (
    <>
      <ToolBar label={`報銷與遺失 · ${list.length} 項`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <p className="pa-stat">本月（不計已駁回）：報銷 {cnt('報銷')} 項，{money(sum('報銷'))}　·　遺失 {cnt('遺失')} 項，{money(sum('遺失'))}</p>
      <div className="fstk"><div className="df-grid3" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>{sel('kind', '類型', KINDS)}{sel('status', '狀態', STATUS)}</div></div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {list.length === 0 && !err && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有記錄。{edit ? '撳右下角「＋」新增。' : ''}</p>}
      <div className="pa-grid pa-grid-an">
        {list.map(r => (
          <div className="pa-sq pa-an" key={r.id} role="button" tabIndex={0} onClick={() => edit && setSheet({ ...r, qty: r.qty ?? '', amount: r.amount ?? '', photos: r.photos || [] })} style={edit ? undefined : { cursor: 'default' }}>
            <span className="pa-sq-top"><em>{r.rec_date}</em><small className={`pa-flag an-${r.status === '已批准' || r.status === '已找回' ? 'done' : 'todo'}`}>{r.status}</small></span>
            <b className="pa-sq-name">{r.kind} · {r.item || '（未填物品）'}</b>
            <span className="pa-sq-post">
              <span className="st-qty">{money(r.amount)}<small>{r.qty != null ? ` ／ ${r.qty} 件` : ''}</small></span>
              {r.location && <span><i className="an-lab">地點</i>{r.location}</span>}
              {r.reason && <span className="pa-sq-area">{r.reason}</span>}
            </span>
            {(r.photos || []).length > 0 && <div onClick={e => e.stopPropagation()}><PhotoGrid photos={r.photos} /></div>}
          </div>
        ))}
      </div>
      {edit && <button className="fab" onClick={() => setSheet({ id: null, kind: '報銷', item: '', qty: '', amount: '', rec_date: todayStr(), location: '', handler: '', reason: '', status: '待審批', photos: [], notes: '' })}>＋</button>}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? '編輯記錄' : '新增記錄'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
            <div className="seg" style={{ margin: '0 0 10px' }}>{KINDS.map(k => <button key={k} className={sheet.kind === k ? 'on' : ''} onClick={() => setSheet({ ...sheet, kind: k })}>{k}</button>)}</div>
            <div className="f-row"><label>物品</label><input value={sheet.item} onChange={e => setSheet({ ...sheet, item: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>數量</label><input inputMode="decimal" value={sheet.qty} onChange={e => setSheet({ ...sheet, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>金額（MOP）</label><input inputMode="decimal" value={sheet.amount} onChange={e => setSheet({ ...sheet, amount: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>日期</label><input type="date" value={sheet.rec_date} onChange={e => setSheet({ ...sheet, rec_date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>地點</label><input value={sheet.location} onChange={e => setSheet({ ...sheet, location: e.target.value })} /></div>
            <div className="f-row"><label>原因</label><input value={sheet.reason} onChange={e => setSheet({ ...sheet, reason: e.target.value })} /></div>
            <div className="f-row"><label>經手人</label><input value={sheet.handler} onChange={e => setSheet({ ...sheet, handler: e.target.value })} /></div>
            <div className="f-row"><label>狀態</label><div className="seg" style={{ margin: 0 }}>{STATUS.map(s => <button key={s} className={sheet.status === s ? 'on' : ''} onClick={() => setSheet({ ...sheet, status: s })}>{s}</button>)}</div></div>
            <PhotoField label="相片" photos={sheet.photos} max={4} onChange={v => setSheet({ ...sheet, photos: v })} />
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={del}>刪除這項記錄</button>}
          </div>
        </div>
      )}
      {report && <ReportModal title="報銷與遺失管理" sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
