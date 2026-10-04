import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { SCORE_DIMS, SCORE_MAX } from '../data/seedData'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

// 總分等級（滿分 35）
const LEVELS = [
  { key: '優良', min: 28, color: '#1b8a5a' },
  { key: '一般', min: 21, color: '#2f6fba' },
  { key: '需注意', min: 18, color: '#e69500' },
  { key: '立刻培訓', min: 0, color: '#c62828' },
]
const levelOf = n => LEVELS.find(l => n >= l.min)
const levelColor = n => levelOf(n).color
// 單維度用星星（單色），顏色只留給總分四級，兩套不再撞色
const Stars = ({ v }) => <span className="stars"><span className="f">{'★'.repeat(v)}</span><span className="o">{'★'.repeat(5 - v)}</span></span>
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
  const [addOpen, setAddOpen] = useState(false)
  const [newAtt, setNewAtt] = useState({ emp_id: '', name_cn: '', name: '', floor: '' })
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
  async function addName() {
    const emp_id = newAtt.emp_id.trim(), name = newAtt.name.trim(), name_cn = newAtt.name_cn.trim(), floor = newAtt.floor.trim()
    if (!name && !name_cn) { toast('請填中文名或英文名'); return }
    const norm = x => String(x || '').toLowerCase().replace(/s+/g, '')
    const dup = attendants.find(a => (emp_id && a.emp_id === emp_id) || (name && norm(a.name) === norm(name)) || (name_cn && norm(a.name_cn) === norm(name_cn)))
    if (dup) { toast(`已有相同員工：${nameOf(dup)}${dup.emp_id ? ' (' + dup.emp_id + ')' : ''}`); return }
    try {
      await api.addAttendant({ name: name || name_cn, name_cn, floor, emp_id, sort_order: attendants.length })
    } catch (ex) { toast('新增失敗：' + ex.message); return }
    setNewAtt({ emp_id: '', name_cn: '', name: '', floor: '' }); setAddOpen(false)
    toast(`已新增 ${name || name_cn}`); load()
  }

  const openForm = p => setForm(p.cur ? { ...p.cur, dims: { ...emptyDims(), ...(p.cur.dims || {}) } }
    : { date: todayStr(), attendant_id: p.a.id, room: '', dims: emptyDims(), inspector: '', note: '', photos: [] })

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
            <button className="logout" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }} onClick={() => setAddOpen(true)}>＋ 新增員工</button>
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
            <span className="sc-name">{p.a.name}{p.a.name_cn ? <span className="cn"> {p.a.name_cn}</span> : ''}{p.weak.length > 0 && <span className="sc-weak">弱項：{p.weak.join('、')}</span>}</span>
            <button className="row-ico" onClick={e => { e.stopPropagation(); openForm(p) }}>{p.cur ? '✏️' : '＋'}</button>
            {p.cur && <button className="row-ico del" onClick={e => { e.stopPropagation(); setConfirmDel(p.cur) }}>🗑</button>}
          </div>
          {open === p.a.id && p.cur && (
            <div className="c-body">
              <div className="dim-grid">
                {SCORE_DIMS.map(k => {
                  const v = parseInt(p.dims[k], 10) || 0
                  return (
                    <div className="dim-cell" key={k}>
                      <span className="dv">{v ? <Stars v={v} /> : '–'}</span>
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
                      style={(parseInt(form.dims[k], 10) || 0) === v ? { background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff' } : undefined}>{v}<span style={{ fontSize: 12 }}>★</span></button>
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

      {addOpen && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setAddOpen(false) }}>
          <div className="sheet">
            <h2>新增員工</h2>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--sub)', margin: '8px 0 4px' }}>員工編號</label>
            <input style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder="例如 100672" inputMode="numeric" value={newAtt.emp_id} onChange={e => setNewAtt({ ...newAtt, emp_id: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--sub)', margin: '8px 0 4px' }}>中文姓名</label>
            <input style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder="例如 賴振莉" value={newAtt.name_cn} onChange={e => setNewAtt({ ...newAtt, name_cn: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--sub)', margin: '8px 0 4px' }}>英文姓名</label>
            <input style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder="例如 Jenny Lai" value={newAtt.name} onChange={e => setNewAtt({ ...newAtt, name: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--sub)', margin: '8px 0 4px' }}>負責樓層</label>
            <input style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder="例如 3A" value={newAtt.floor} onChange={e => setNewAtt({ ...newAtt, floor: e.target.value })} />
            <p className="src-note" style={{ marginTop: 8 }}>中文或英文姓名填一個即可；編號、樓層可留空。</p>
            <button className="btn" onClick={addName}>加入</button>
            <button className="btn ghost" onClick={() => setAddOpen(false)}>取消</button>
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
