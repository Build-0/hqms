import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'
import { ReportModal, DefectReport } from '../components/Reports'
import { PERMS, canExport, EXPORT_MSG } from '../lib/accounts'

// 房間缺陷登記（原「房間缺陷登記系統」改寫為原生模組）
const SEVERITY = [
  { value: 'high', label: '嚴重', cls: 'b-red', color: '#c62828' },
  { value: 'medium', label: '中度', cls: 'b-amber', color: '#e69500' },
  { value: 'low', label: '輕微', cls: 'b-teal', color: '#2f6fba' },
]
const STATUS = [
  { value: 'pending', label: '待處理', cls: 'b-red' },
  { value: 'processing', label: '處理中', cls: 'b-amber' },
  { value: 'done', label: '已修復', cls: 'b-teal' },
]
const FLOORS = Array.from({ length: 10 }, (_, i) => String(i + 3))
const ROOMS = Array.from({ length: 82 }, (_, i) => String(i + 1).padStart(2, '0'))
const sevOf = v => SEVERITY.find(s => s.value === v) || { label: v || '—', cls: 'b-gray' }
const stOf = v => STATUS.find(s => s.value === v) || { label: v || '—', cls: 'b-gray' }
const regDate = d => d.register_date || (d.created_at || '').slice(0, 10)
const EMPTY = () => ({ floor: '3', roomNum: '01', type: '', severity: 'medium', note: '', photos: [], registerDate: todayStr(), fixedDate: '' })

export default function Defects({ session, init }) {
  // edit＝可編輯全部；register＝只可新增登記與查看
  const full = !session || PERMS[session.role].defect === 'edit'
  const [list, setList] = useState(null)
  const [types, setTypes] = useState([])
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('list')
  const [f, setF] = useState({ search: '', floor: '', status: init?.status || '', severity: '', type: '' })
  const [sortBy, setSortBy] = useState('date-desc')
  const [form, setForm] = useState(null)       // 新增／編輯表單
  const [view, setView] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [d, t] = await Promise.all([api.listDefects(), api.listDefectTypes()])
      setList(d); setTypes(t.map(x => x.name)); setErr('')
    } catch (ex) { setErr(ex.message); setList([]) }
  }

  const shown = useMemo(() => (list || []).filter(d => {
    if (f.floor && d.floor !== f.floor) return false
    if (f.status && d.status !== f.status) return false
    if (f.severity && d.severity !== f.severity) return false
    if (f.type && d.type !== f.type) return false
    const q = f.search.trim()
    if (q && !(d.room || '').includes(q) && !(d.note || '').includes(q) && !(d.created_by_name || '').toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'room-asc') return (parseInt(a.room) || 0) - (parseInt(b.room) || 0)
    if (sortBy === 'room-desc') return (parseInt(b.room) || 0) - (parseInt(a.room) || 0)
    const x = regDate(a) + (a.created_at || ''), y = regDate(b) + (b.created_at || '')
    return sortBy === 'date-asc' ? x.localeCompare(y) : y.localeCompare(x)
  }), [list, f, sortBy])

  if (!list) return <div className="note">載入中…</div>

  function openNew() { setForm({ ...EMPTY(), id: null }) }
  function openEdit(d) {
    setForm({ id: d.id, floor: d.floor || '3', roomNum: (d.room || '').slice(-2) || '01', type: d.type || '', severity: d.severity || 'medium', note: d.note || '', photos: d.photos || [], registerDate: d.register_date || '', fixedDate: d.fixed_date || '', status: d.status })
    setView(null)
  }
  async function save() {
    if (!form.type) { toast('請選擇缺陷類型'); return }
    setSaving(true)
    try {
      const room = `${form.floor}${form.roomNum}`
      if (form.id) {
        await api.updateDefect(form.id, { room, floor: form.floor, type: form.type, severity: form.severity, note: form.note, photos: form.photos, register_date: form.registerDate || null, fixed_date: form.fixedDate || null, updated_at: new Date().toISOString() })
        toast('已儲存修改')
      } else {
        await api.addDefect({ room, floor: form.floor, type: form.type, severity: form.severity, status: 'pending', note: form.note, photos: form.photos, created_by: session ? (session.id || session.name) : '', created_by_name: session ? session.name : '', register_date: form.registerDate || todayStr() })
        toast('已登記缺陷')
      }
      setForm(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
    setSaving(false)
  }
  async function setStatus(d, status) {
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'done' && !d.fixed_date) patch.fixed_date = todayStr()
    if (d.status === 'done' && status !== 'done') patch.fixed_date = null
    try { await api.updateDefect(d.id, patch); setView(v => (v && v.id === d.id ? { ...v, ...patch } : v)); load() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  async function del(d) {
    try { await api.deleteDefect(d.id); toast('已刪除'); setConfirmDel(null); setView(null); load() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }
  function exportCsv() {
    if (!canExport()) { toast(EXPORT_MSG); return }
    const rows = shown.map(d => [d.room, `${d.floor}F`, d.type, sevOf(d.severity).label, stOf(d.status).label, (d.note || '').replace(/"/g, '""'), regDate(d), d.fixed_date || '', d.created_by_name || '', new Date(d.created_at).toLocaleString('zh-TW')])
    const csv = '﻿' + [['房號', '樓層', '缺陷類型', '嚴重程度', '狀態', '備註', '登記日期', '修復日期', '登記人', '建立時間'], ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `缺陷記錄_${todayStr()}.csv`; a.click()
  }
  const pick = (k, v) => { setF({ search: '', floor: '', status: '', severity: '', type: '', [k]: v }); setTab('list') }

  const sel = (key, label, opts) => (
    <select className="df-sel" value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })}>
      <option value="">{label}</option>
      {opts.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  )

  return (
    <div className="df-wrap">
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}

      {full && (
        <div className="chips" style={{ marginBottom: 6 }}>
          {[['list', '缺陷列表'], ['stats', '統計'], ['types', '類型設定']].map(([k, t]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}
          <button className="chip" onClick={() => setReport(true)}>📄 匯出</button>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="card" style={{ padding: 12 }}>
            <input className="search-inp" placeholder="🔍 搜尋房號、備註、登記人" value={f.search} onChange={e => setF({ ...f, search: e.target.value })} />
            <div className="df-grid">
              {sel('floor', '所有樓層', FLOORS.map(x => ({ v: x, t: `${x} 樓` })))}
              {sel('status', '所有狀態', STATUS.map(s => ({ v: s.value, t: s.label })))}
              {sel('severity', '所有程度', SEVERITY.map(s => ({ v: s.value, t: s.label })))}
              {sel('type', '所有類型', types.map(t => ({ v: t, t })))}
            </div>
            <div className="df-bar">
              <span>共 <b>{shown.length}</b> 筆</span>
              <select className="df-sel sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="date-desc">日期 新→舊</option><option value="date-asc">日期 舊→新</option>
                <option value="room-asc">房號 低→高</option><option value="room-desc">房號 高→低</option>
              </select>
              <button className="linky" onClick={load}>🔄 重新載入</button>
              {full && shown.length > 0 && <button className="linky" onClick={exportCsv}>⬇ CSV</button>}
            </div>
          </div>

          {shown.length === 0 && <div className="note">{list.length === 0 ? '還沒有缺陷記錄，按右下 ＋ 開始登記' : '沒有符合條件的記錄'}</div>}
          {shown.map(d => {
            const sv = sevOf(d.severity), st = stOf(d.status)
            return (
              <div className="c-item" key={d.id}>
                <div className="df-card" onClick={() => setView(d)}>
                  <div className="df-main">
                    <div className="df-top"><b className="df-room">{d.room}</b><span className={`badge ${sv.cls}`}>{sv.label}</span><span className={`badge ${st.cls}`}>{st.label}</span></div>
                    <div className="df-type">{d.type}</div>
                    {d.note && <div className="df-note">{d.note}</div>}
                    <div className="df-meta">{d.created_by_name} · {regDate(d)}{d.photos?.length > 0 && ` · 📷${d.photos.length}`}</div>
                  </div>
                  {d.photos?.[0] && <img className="df-thumb" src={d.photos[0]} alt="" loading="lazy" />}
                </div>
                {full && (
                  <div className="df-act">
                    <select className="df-sel sm" value={d.status} onChange={e => setStatus(d, e.target.value)}>
                      {STATUS.map(s => <option key={s.value} value={s.value}>狀態：{s.label}</option>)}
                    </select>
                    <button className="linky" onClick={() => openEdit(d)}>✎ 編輯</button>
                    <button className="linky" style={{ color: 'var(--red)' }} onClick={() => setConfirmDel(d)}>🗑 刪除</button>
                  </div>
                )}
              </div>
            )
          })}
          <button className="fab" onClick={openNew}>＋</button>
        </>
      )}

      {tab === 'stats' && full && <Stats list={list} types={types} pick={pick} />}
      {tab === 'types' && full && <Types types={types} reload={load} />}

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯缺陷記錄' : '新增缺陷登記'}</h2>
            <div className="f-row"><label>房號 *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="df-sel" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })}>{FLOORS.map(x => <option key={x} value={x}>{x} 樓</option>)}</select>
                <select className="df-sel" value={form.roomNum} onChange={e => setForm({ ...form, roomNum: e.target.value })}>{ROOMS.map(x => <option key={x} value={x}>{x} 號房</option>)}</select>
              </div>
              <div className="df-hint">已選房號 <b>{form.floor}{form.roomNum}</b></div>
            </div>
            <div className="f-row"><label>缺陷類型 *</label>
              <select className="df-sel" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="">請選擇</option>{types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="f-row"><label>嚴重程度 *</label>
              <div className="df-sev">{SEVERITY.map(s => <button key={s.value} className={form.severity === s.value ? 'on' : ''} style={form.severity === s.value ? { background: s.color, borderColor: s.color, color: '#fff' } : undefined} onClick={() => setForm({ ...form, severity: s.value })}>{s.label}</button>)}</div>
            </div>
            {full && <div className="f-row"><label>登記日期</label><input type="date" value={form.registerDate} onChange={e => setForm({ ...form, registerDate: e.target.value })} /></div>}
            {full && form.id && form.status === 'done' && <div className="f-row"><label>修復日期</label><input type="date" value={form.fixedDate} onChange={e => setForm({ ...form, fixedDate: e.target.value })} /></div>}
            <div className="f-row"><label>備註</label><textarea rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="補充說明（選填）" /></div>
            <PhotoField label="相片（最多 5 張）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} max={5} />
            <button className="btn" disabled={saving} onClick={save}>{saving ? '儲存中…' : form.id ? '儲存修改' : '確認登記'}</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {view && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ margin: 0, flex: 1 }}>{view.room} 房</h2>
              <span className={`badge ${sevOf(view.severity).cls}`}>{sevOf(view.severity).label}</span>
              <span className={`badge ${stOf(view.status).cls}`}>{stOf(view.status).label}</span>
            </div>
            <div className="kv"><span className="k">缺陷類型</span><span className="v">{view.type}</span></div>
            <div className="kv"><span className="k">備註</span><span className="v">{view.note || '無'}</span></div>
            <div className="kv"><span className="k">登記日期</span><span className="v">{regDate(view) || '—'}</span></div>
            {view.status === 'done' && view.fixed_date && <div className="kv"><span className="k">修復日期</span><span className="v">{view.fixed_date}</span></div>}
            <div className="kv"><span className="k">登記人</span><span className="v">{view.created_by_name}（{view.created_by}）</span></div>
            <PhotoGrid photos={view.photos} />
            {full && (
              <div className="f-row" style={{ marginTop: 10 }}><label>更改狀態</label>
                <select className="df-sel" value={view.status} onChange={e => setStatus(view, e.target.value)}>{STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
              </div>
            )}
            {full && <button className="btn ghost" onClick={() => openEdit(view)}>✎ 編輯</button>}
            <button className="btn ghost" onClick={() => setView(null)}>關閉</button>
          </div>
        </div>
      )}

      {confirmDel && <Confirm text={`會刪除 ${confirmDel.room} 房「${confirmDel.type}」這筆缺陷記錄。`} onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />}

      {report && (
        <ReportModal title="缺陷管理報告" sub={todayStr()} onClose={() => setReport(false)}>
          <DefectReport data={{ defects: list, severity: SEVERITY, status: STATUS }} />
        </ReportModal>
      )}
    </div>
  )
}

function Stats({ list, types, pick }) {
  const total = list.length
  const bars = (rows, color, key) => rows.map(r => (
    <div className="bar-row click" key={r.k} onClick={() => pick(key, r.v)}>
      <span className="name">{r.k}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${total ? (r.n / total) * 100 : 0}%`, background: r.color || color }} /></div>
      <span className="num">{r.n}</span>
    </div>
  ))
  const typeSet = [...new Set([...types, ...list.map(d => d.type)])].filter(Boolean)
  const byUser = {}
  for (const d of list) byUser[d.created_by_name || '—'] = (byUser[d.created_by_name || '—'] || 0) + 1
  return (
    <>
      <p className="note" style={{ textAlign: 'left', margin: '2px 4px 8px' }}>點任何一項可跳到已篩選的列表</p>
      <div className="df-kpis">
        <div className="df-kpi"><b>{total}</b><span>總記錄</span></div>
        {STATUS.map(s => <div className="df-kpi" key={s.value} onClick={() => pick('status', s.value)}><b>{list.filter(d => d.status === s.value).length}</b><span>{s.label}</span></div>)}
      </div>
      <div className="card"><h2>按嚴重程度</h2>{bars(SEVERITY.map(s => ({ k: s.label, v: s.value, n: list.filter(d => d.severity === s.value).length, color: s.color })), '', 'severity')}</div>
      <div className="card"><h2>按樓層</h2>{bars(FLOORS.map(x => ({ k: `${x} 樓`, v: x, n: list.filter(d => d.floor === x).length })), 'var(--accent)', 'floor')}</div>
      <div className="card"><h2>按缺陷類型</h2>{bars(typeSet.map(t => ({ k: t, v: t, n: list.filter(d => d.type === t).length })).sort((a, b) => b.n - a.n), 'var(--accent)', 'type')}</div>
      <div className="card"><h2>按登記人</h2>{Object.entries(byUser).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
        <div className="bar-row" key={k}><span className="name">{k}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${total ? (n / total) * 100 : 0}%`, background: 'var(--sub)' }} /></div><span className="num">{n}</span></div>
      ))}</div>
    </>
  )
}

function Types({ types, reload }) {
  const [name, setName] = useState('')
  const [del, setDel] = useState(null)
  async function add() {
    const n = name.trim()
    if (!n) return
    if (types.includes(n)) { toast('已有相同類型'); return }
    try { await api.addDefectType(n); setName(''); reload() } catch (ex) { toast('新增失敗：' + ex.message) }
  }
  async function remove(t) {
    try { await api.deleteDefectType(t); setDel(null); reload() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }
  return (
    <div className="card">
      <h2>缺陷類型（{types.length}）</h2>
      <p className="src-note">刪除類型不會影響已登記的記錄，只是之後登記時揀唔到。</p>
      {types.map(t => (
        <div className="df-type-row" key={t}><span>{t}</span><button className="logout" style={{ color: 'var(--red)', background: 'var(--red-soft)' }} onClick={() => setDel(t)}>✕</button></div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input className="search-inp" style={{ margin: 0 }} placeholder="新增類型，例：11.牆身破損" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button className="btn" style={{ width: 'auto', padding: '0 18px', margin: 0 }} onClick={add}>新增</button>
      </div>
      {del && <Confirm text={`刪除類型「${del}」？`} onConfirm={() => remove(del)} onCancel={() => setDel(null)} />}
    </div>
  )
}
