import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { SCORE_DIMS, SCORE_MAX } from '../data/seedData'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

// 總分等級（滿分 35）
const LEVELS = [
  { key: '優良', min: 28, color: 'var(--accent)' },
  { key: '一般', min: 21, color: 'var(--amber)' },
  { key: '需注意', min: 18, color: '#dd8844' },
  { key: '需培訓', min: 0, color: 'var(--red)' },
]
const levelOf = n => LEVELS.find(l => n >= l.min)
const levelColor = n => levelOf(n).color
// 單維度分數配色（1紅→5綠），讓七項一眼分清高低
const DIM_COLORS = { 0: '#e0e4e8', 1: '#c0564f', 2: '#dd8844', 3: '#d9b430', 4: '#7bAA4e', 5: '#2f8f43' }
const dimColor = v => DIM_COLORS[parseInt(v, 10) || 0]
const sumDims = d => SCORE_DIMS.reduce((t, k) => t + (parseInt(d[k], 10) || 0), 0)
const emptyDims = () => Object.fromEntries(SCORE_DIMS.map(k => [k, 0]))
const WEAK = 2
const weakOf = dims => SCORE_DIMS.filter(k => { const v = parseInt(dims[k], 10) || 0; return v > 0 && v <= WEAK })

export default function Scores() {
  const [attendants, setAttendants] = useState([])
  const [scores, setScores] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const [roster, setRoster] = useState(false)
  const [upload, setUpload] = useState(null) // 上傳名單面板文字
  const [newName, setNewName] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [filter, setFilter] = useState('全部') // 全部 / 等級 / 未評 / 維度名
  const [q, setQ] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [a, s] = await Promise.all([api.listAttendants(), api.listScores()])
      setAttendants(a); setScores(s); setErr('')
    } catch (ex) { setErr(ex.message); setScores([]) }
  }

  if (!scores) return <div className="note">載入中…</div>

  const active = attendants.filter(a => a.active)
  const curOf = id => scores.filter(s => s.attendant_id === id)
    .sort((x, y) => (y.date + (y.created_at || '')).localeCompare(x.date + (x.created_at || '')))[0] || null

  const people = active.map(a => {
    const cur = curOf(a.id)
    const dims = cur?.dims || {}
    const total = cur ? (cur.score != null ? cur.score : sumDims(dims)) : null
    return { a, cur, dims, total, weak: cur ? weakOf(dims) : [] }
  })

  const rated = people.filter(p => p.cur)
  const unrated = people.filter(p => !p.cur)
  const levelCount = k => rated.filter(p => levelOf(p.total).key === k).length
  const dimWeakCount = Object.fromEntries(SCORE_DIMS.map(k =>
    [k, people.filter(p => p.cur && (parseInt(p.dims[k], 10) || 0) > 0 && (parseInt(p.dims[k], 10) || 0) <= WEAK).length]))
  const maxLv = Math.max(1, ...LEVELS.map(l => levelCount(l.key)), unrated.length)

  const nameOf = a => a.name + (a.name_cn ? ` ${a.name_cn}` : '')
  const searching = q.trim().length > 0
  let shown = people
  if (searching) shown = people.filter(p => nameOf(p.a).toLowerCase().includes(q.trim().toLowerCase()) || (p.a.floor || '').toLowerCase().includes(q.trim().toLowerCase()))
  else if (filter === '未評') shown = unrated
  else if (LEVELS.some(l => l.key === filter)) shown = rated.filter(p => levelOf(p.total).key === filter)
  else if (SCORE_DIMS.includes(filter)) shown = people.filter(p => p.cur && (parseInt(p.dims[filter], 10) || 0) > 0 && (parseInt(p.dims[filter], 10) || 0) <= WEAK)
  shown = shown.slice().sort((x, y) => {
    if (!x.cur && !y.cur) return nameOf(x.a).localeCompare(nameOf(y.a))
    if (!x.cur) return 1
    if (!y.cur) return -1
    return x.total - y.total // 差的在前，方便找培訓對象
  })

  async function saveScore() {
    const f = form
    const dims = emptyDims()
    for (const k of SCORE_DIMS) dims[k] = parseInt(f.dims[k], 10) || 0
    const payload = { date: f.date || todayStr(), attendant_id: f.attendant_id, room: f.room, dims, score: sumDims(dims), inspector: f.inspector || '', note: f.note || '', photos: f.photos || [] }
    if (f.id) { await api.updateScore(f.id, payload); toast('已更新評分') }
    else { await api.addScore(payload); toast('已記錄評分') }
    setForm(null); load()
  }
  async function delScore(id) { await api.deleteScore(id); setConfirmDel(null); setOpen(null); toast('已刪除，恢復未評'); load() }
  async function addName() { const n = newName.trim(); if (!n) return; await api.addAttendant({ name: n }); setNewName(''); toast(`已加入 ${n}`); load() }

  const openForm = p => setForm(p.cur ? { ...p.cur, dims: { ...emptyDims(), ...(p.cur.dims || {}) } }
    : { date: todayStr(), attendant_id: p.a.id, room: '', dims: emptyDims(), inspector: '', note: '', photos: [] })

  // 貼上文字 → 解析 → 套用
  async function syncRoster() {
    const rows = (upload || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/\t|,/).map(s => s.trim())
      return { floor: p[0] || '', name: p[1] || '', name_cn: p[2] || '', emp_id: (p[3] || '').replace(/\D/g, '') }
    }).filter(r => r.name || r.name_cn)
    if (!rows.length) { toast('沒有解析到名單，請檢查格式'); return }
    await applyRoster(rows)
  }

  // 上傳 Excel/CSV 檔 → 自動找欄位 → 套用
  async function onRosterFile(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const data = new Uint8Array(await file.arrayBuffer())
      const wb = XLSX.read(data, { type: 'array' })
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
      // 找表頭行（含 Floor/樓/English/中文/ID 任一）
      let hi = aoa.findIndex(r => r.some(c => /floor|樓|english|chinese|中文|英文|name|姓名|\bid\b|員工/i.test(String(c))))
      if (hi < 0) hi = 0
      const hdr = aoa[hi].map(c => String(c).toLowerCase())
      const col = (...keys) => hdr.findIndex(h => keys.some(k => h.includes(k)))
      let cFloor = col('floor', '樓'), cEn = col('english', '英文'), cCn = col('chinese', '中文'), cId = col('id', '員工', '編號')
      // 找不到欄位時退回位置：樓層 英文 中文 ID
      if (cEn < 0 && cCn < 0) { cFloor = 1; cEn = 2; cCn = 3; cId = 4 }
      const rows = aoa.slice(hi + 1).map(r => ({
        floor: String(cFloor >= 0 ? r[cFloor] : '').trim(),
        name: String(cEn >= 0 ? r[cEn] : '').trim(),
        name_cn: String(cCn >= 0 ? r[cCn] : '').trim(),
        emp_id: String(cId >= 0 ? r[cId] : '').replace(/\D/g, ''),
      })).map(r => ({ ...r, name: r.name || r.name_cn })).filter(r => r.name)
      if (!rows.length) { toast('讀不到名單，請確認檔案有「英文名/中文名」欄'); return }
      await applyRoster(rows)
    } catch (ex) {
      toast('讀取失敗：' + ex.message)
    }
  }

  // 覆蓋人名/樓層，不動分數；比對員工ID（無則英文名）
  async function applyRoster(rows) {
    const keyOf = x => (x.emp_id || x.name).toLowerCase()
    const curMap = new Map(attendants.map(a => [(a.emp_id || a.name).toLowerCase(), a]))
    let add = 0, upd = 0, off = 0
    const seenKeys = new Set()
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const k = keyOf(r); seenKeys.add(k)
      const hit = curMap.get(k) || attendants.find(a => a.name.toLowerCase() === r.name.toLowerCase())
      if (hit) {
        const patch = {}
        if (r.name && r.name !== hit.name) patch.name = r.name
        if (r.name_cn !== (hit.name_cn || '')) patch.name_cn = r.name_cn
        if (r.floor !== (hit.floor || '')) patch.floor = r.floor
        if (r.emp_id && r.emp_id !== (hit.emp_id || '')) patch.emp_id = r.emp_id
        if (!hit.active) patch.active = true
        if (Object.keys(patch).length) { await api.updateAttendant(hit.id, patch); upd++ }
      } else { await api.addAttendant({ name: r.name || r.name_cn, name_cn: r.name_cn, floor: r.floor, emp_id: r.emp_id, sort_order: i }); add++ }
    }
    // 名單外的現有人員：停用（保留分數）
    for (const a of attendants) {
      if (!a.active) continue
      const k = (a.emp_id || a.name).toLowerCase()
      if (!seenKeys.has(k) && !rows.some(r => r.name.toLowerCase() === a.name.toLowerCase())) { await api.updateAttendant(a.id, { active: false }); off++ }
    }
    setUpload(null); toast(`名單已更新：新增 ${add}、更新 ${upd}、停用 ${off}`); load()
  }

  return (
    <>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}<br />請先在 Supabase SQL Editor 執行 <b>add-modules.sql</b> 及 <b>add-scoring.sql</b>。</p>
        </div>
      )}

      {/* 分數分布統計（每條可點擊篩選）*/}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>分數分布<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（{rated.length}/{people.length} 人已評 · 滿分 {SCORE_MAX}）</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="logout" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }} onClick={() => setUpload('')}>⬆ 上傳名單</button>
            <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={() => setRoster(true)}>👥 {attendants.length}</button>
          </div>
        </div>
        {LEVELS.map(l => {
          const n = levelCount(l.key)
          return (
            <div className={`bar-row click ${filter === l.key ? 'sel' : ''}`} key={l.key} onClick={() => { setQ(''); setFilter(filter === l.key ? '全部' : l.key) }}>
              <span className="name" style={{ width: 92 }}><span style={{ color: l.color, fontWeight: 800 }}>{l.key}</span> <span style={{ fontSize: 10, color: 'var(--sub)' }}>{l.min === 0 ? '<18' : l.key === '需注意' ? '18–20' : l.key === '一般' ? '21–27' : '≥28'}</span></span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxLv) * 100}%`, background: l.color }} /></div>
              <span className="num">{n}</span>
            </div>
          )
        })}
        {unrated.length > 0 && (
          <div className={`bar-row click ${filter === '未評' ? 'sel' : ''}`} onClick={() => { setQ(''); setFilter(filter === '未評' ? '全部' : '未評') }}>
            <span className="name" style={{ width: 92, color: 'var(--sub)' }}>未評分</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${(unrated.length / maxLv) * 100}%`, background: '#c3cad2' }} /></div>
            <span className="num">{unrated.length}</span>
          </div>
        )}
      </div>

      {/* 弱項維度篩選 */}
      {SCORE_DIMS.some(k => dimWeakCount[k] > 0) && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <h2 style={{ color: 'var(--red)' }}>⚠ 弱項培訓篩選<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（某項 ≤{WEAK} 分）</span></h2>
          <div className="chips">
            {SCORE_DIMS.filter(k => dimWeakCount[k] > 0).map(k => (
              <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => { setQ(''); setFilter(filter === k ? '全部' : k) }}>{k} {dimWeakCount[k]}</button>
            ))}
          </div>
        </div>
      )}

      <input className="search-inp" placeholder="🔍 搜尋房務員姓名或樓層" value={q} onChange={e => setQ(e.target.value)} />

      <div className="dim-legend">
        {SCORE_DIMS.map((k, i) => <span key={k}>{i + 1}.{k}</span>)}
      </div>

      <h2 style={{ margin: '10px 4px 10px' }}>
        {searching ? '搜尋結果' : filter === '全部' ? '房務員當前評分' : filter === '未評' ? '未評分人員' : LEVELS.some(l => l.key === filter) ? `${filter}人員` : `${filter} 需加強`}
        <span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>（{shown.length} 人）</span>
      </h2>
      {shown.length === 0 && <div className="note">沒有符合的人員</div>}
      {shown.map(p => (
        <div className="c-item" key={p.a.id}>
          <div className="c-head" onClick={() => setOpen(open === p.a.id ? null : p.a.id)}>
            {p.cur
              ? <span className="badge" style={{ background: levelColor(p.total) + '22', color: levelColor(p.total), fontSize: 13, minWidth: 30, textAlign: 'center' }}>{p.total}</span>
              : <span className="badge b-gray">未評</span>}
            {p.a.floor && <span style={{ fontSize: 11, color: 'var(--sub)', flexShrink: 0, width: 24 }}>{p.a.floor}</span>}
            <span className="sc-name">{p.a.name}{p.a.name_cn ? <span className="cn"> {p.a.name_cn}</span> : ''}</span>
            {p.cur && <span className="dim-strip">{SCORE_DIMS.map(k => <span key={k} className="dblk" style={{ background: dimColor(p.dims[k]) }} title={`${k}:${p.dims[k] || '–'}`} />)}</span>}
            <button className="row-ico" onClick={e => { e.stopPropagation(); openForm(p) }}>{p.cur ? '✏️' : '＋'}</button>
            {p.cur && <button className="row-ico del" onClick={e => { e.stopPropagation(); setConfirmDel(p.cur) }}>🗑</button>}
          </div>
          {open === p.a.id && p.cur && (
            <div className="c-body">
              <div className="dim-grid">
                {SCORE_DIMS.map(k => {
                  const v = parseInt(p.dims[k], 10) || 0
                  return (
                    <div className="dim-cell" key={k} style={{ borderColor: dimColor(v), background: dimColor(v) + '18' }}>
                      <span className="dv" style={{ color: dimColor(v) }}>{v || '–'}</span>
                      <span className="dk">{k}</span>
                    </div>
                  )
                })}
                <div className="dim-cell total"><span className="dv" style={{ color: levelColor(p.total) }}>{p.total}</span><span className="dk">總分/{SCORE_MAX}</span></div>
              </div>
              {p.weak.length > 0 && <div className="kv"><span className="k" style={{ color: 'var(--red)' }}>弱項</span><span className="v" style={{ color: 'var(--red)' }}>{p.weak.join('、')}</span></div>}
              <div className="kv"><span className="k">最近評分</span><span className="v">{p.cur.date}{p.cur.inspector ? ` · ${p.cur.inspector}` : ''}{p.cur.room ? ` · ${p.cur.room}房` : ''}</span></div>
              {p.cur.note && <div className="kv"><span className="k">針對性加強</span><span className="v">{p.cur.note}</span></div>}
              <PhotoGrid photos={p.cur.photos} />
              <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => openForm(p)}>✏️ 更新評分（變好或變壞）</button>
            </div>
          )}
        </div>
      ))}

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '更新評分' : '清潔度考核評分'}<span style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 400 }}> · 現時 {sumDims(form.dims)}/{SCORE_MAX}</span></h2>
            <div className="f-row"><label>房務員</label>
              <select value={form.attendant_id} onChange={e => setForm({ ...form, attendant_id: e.target.value })}>
                <option value="">請選擇</option>
                {active.map(a => <option key={a.id} value={a.id}>{nameOf(a)}{a.floor ? `（${a.floor}）` : ''}</option>)}
              </select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }} className="f-row"><label>日期</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div style={{ flex: 1 }} className="f-row"><label>抽查房號</label><input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="例：1016" /></div>
            </div>
            <div className="f-row"><label>抽查人</label><input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="例：Ice" /></div>
            {SCORE_DIMS.map(k => (
              <div className="f-row" key={k} style={{ marginBottom: 8 }}>
                <label style={{ marginBottom: 4 }}>{k}</label>
                <div className="score-seg">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} className="sc-btn" onClick={() => setForm({ ...form, dims: { ...form.dims, [k]: v } })}
                      style={(parseInt(form.dims[k], 10) || 0) === v ? { background: dimColor(v), borderColor: dimColor(v), color: '#fff' } : undefined}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
            <p className="note" style={{ textAlign: 'left', margin: '2px 2px 8px' }}>1差 2需改善 3一般 4良好 5優秀 · 某項 ≤2 分會列入弱項名單</p>
            <div className="f-row"><label>針對性加強（弱項培訓建議）</label><textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例：物品整齊度需加強" /></div>
            <PhotoField label="相片（問題位或示範位）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} />
            <button className="btn" onClick={saveScore} disabled={!form.attendant_id}>儲存（總分 {sumDims(form.dims)}）</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {upload != null && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setUpload(null) }}>
          <div className="sheet">
            <h2>上傳名單（覆蓋人名與樓層）</h2>
            <p className="src-note"><b>只更新人名、樓層與名單增減，不影響任何評分。</b>名單外的人會被停用（記錄保留）。系統會自動辨識 Excel 的樓層／英文名／中文名／員工ID 欄。</p>
            <label className="btn" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
              📂 選擇 Excel 檔（.xlsx / .csv）
              <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onRosterFile} />
            </label>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--sub)', margin: '10px 0 6px' }}>— 或 貼上文字 —</div>
            <textarea style={{ width: '100%', height: 120, border: '1px solid var(--line)', borderRadius: 10, padding: 10, fontSize: 13, fontFamily: 'monospace', background: 'var(--bg)' }}
              value={upload} onChange={e => setUpload(e.target.value)}
              placeholder={'從 Excel 複製整段貼上：\n3A\tJenny Lai\t賴振莉\t100672\n3B\tMoney Zeng\t曾翠華\t100971'} />
            <button className="btn ghost" onClick={syncRoster}>套用貼上的文字</button>
            <button className="btn ghost" onClick={() => setUpload(null)}>取消</button>
          </div>
        </div>
      )}

      {roster && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setRoster(false) }}>
          <div className="sheet">
            <h2>房務員名單（{attendants.length} 人）</h2>
            {attendants.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 34, fontSize: 11.5, color: 'var(--sub)', flexShrink: 0 }}>{a.floor || '—'}</span>
                <input style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', background: a.active ? 'var(--bg)' : '#eee', color: a.active ? 'var(--ink)' : 'var(--sub)' }}
                  defaultValue={nameOf(a)}
                  onBlur={async e => { const v = e.target.value.trim(); if (v && v !== nameOf(a)) { await api.updateAttendant(a.id, { name: v, name_cn: '' }); toast('已改名'); load() } }} />
                <button className="logout" style={{ color: a.active ? 'var(--sub)' : 'var(--accent)', background: '#eef1f4', flexShrink: 0 }}
                  onClick={async () => { await api.updateAttendant(a.id, { active: !a.active }); load() }}>{a.active ? '停用' : '啟用'}</button>
                <button className="logout" style={{ color: 'var(--red)', background: 'var(--red-soft)', flexShrink: 0 }}
                  onClick={async () => { try { await api.deleteAttendant(a.id); toast('已刪除'); load() } catch (ex) { toast(ex.message) } }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}
                placeholder="新房務員姓名" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addName() }} />
              <button className="btn" style={{ width: 'auto', margin: 0, padding: '9px 18px' }} onClick={addName}>加入</button>
            </div>
            <button className="btn ghost" onClick={() => setRoster(false)}>完成</button>
          </div>
        </div>
      )}
      {confirmDel && (
        <Confirm text="會刪除這筆評分，該房務員恢復為「未評」。" onConfirm={() => delScore(confirmDel.id)} onCancel={() => setConfirmDel(null)} />
      )}
    </>
  )
}
