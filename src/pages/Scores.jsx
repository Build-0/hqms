import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { SCORE_DIMS, SCORE_MAX } from '../data/seedData'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

// 滿分 35：≥28 優良、21–27 一般、18–20 需注意、<18 需培訓
const scoreColor = n => (n >= 28 ? 'var(--accent)' : n >= 21 ? 'var(--amber)' : 'var(--red)')
const scoreLabel = n => (n >= 28 ? '優良' : n >= 21 ? '一般' : n >= 18 ? '需注意' : '需培訓')
const sumDims = d => SCORE_DIMS.reduce((t, k) => t + (parseInt(d[k], 10) || 0), 0)
const emptyDims = () => Object.fromEntries(SCORE_DIMS.map(k => [k, 0]))
const WEAK = 2 // 某項 ≤2 視為弱項
const weakOf = dims => SCORE_DIMS.filter(k => { const v = parseInt(dims[k], 10) || 0; return v > 0 && v <= WEAK })

export default function Scores() {
  const [attendants, setAttendants] = useState([])
  const [scores, setScores] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const [roster, setRoster] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [filter, setFilter] = useState('全部') // 全部 / 弱項 / 未評 / 維度名

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [a, s] = await Promise.all([api.listAttendants(), api.listScores()])
      setAttendants(a); setScores(s); setErr('')
    } catch (ex) {
      setErr(ex.message); setScores([])
    }
  }

  if (!scores) return <div className="note">載入中…</div>

  const active = attendants.filter(a => a.active)
  // 每位房務員的「當前評分」＝最新一筆
  const curOf = id => scores
    .filter(s => s.attendant_id === id)
    .sort((x, y) => (y.date + (y.created_at || '')).localeCompare(x.date + (x.created_at || '')))[0] || null

  const people = active.map(a => {
    const cur = curOf(a.id)
    const dims = cur?.dims || {}
    const total = cur ? (cur.score != null ? cur.score : sumDims(dims)) : null
    return { a, cur, dims, total, weak: cur ? weakOf(dims) : [] }
  })

  const weakPeople = people.filter(p => p.weak.length > 0)
  const unrated = people.filter(p => !p.cur)
  // 各維度弱項人數（用於維度篩選籤）
  const dimWeakCount = Object.fromEntries(SCORE_DIMS.map(k =>
    [k, people.filter(p => p.cur && (parseInt(p.dims[k], 10) || 0) > 0 && (parseInt(p.dims[k], 10) || 0) <= WEAK).length]))

  let shown = people
  if (filter === '弱項') shown = weakPeople
  else if (filter === '未評') shown = unrated
  else if (SCORE_DIMS.includes(filter)) shown = people.filter(p => p.cur && (parseInt(p.dims[filter], 10) || 0) > 0 && (parseInt(p.dims[filter], 10) || 0) <= WEAK)
  // 排序：有弱項優先、再按總分升序（差的在前）、未評墊底
  shown = shown.slice().sort((x, y) => {
    if (!x.cur && !y.cur) return 0
    if (!x.cur) return 1
    if (!y.cur) return -1
    if ((y.weak.length > 0) !== (x.weak.length > 0)) return y.weak.length - x.weak.length
    return x.total - y.total
  })

  async function saveScore() {
    const f = form
    const dims = emptyDims()
    for (const k of SCORE_DIMS) dims[k] = parseInt(f.dims[k], 10) || 0
    const payload = {
      date: f.date || todayStr(), attendant_id: f.attendant_id, room: f.room,
      dims, score: sumDims(dims), inspector: f.inspector || '', note: f.note || '', photos: f.photos || [],
    }
    if (f.id) { await api.updateScore(f.id, payload); toast('已更新評分') }
    else { await api.addScore(payload); toast('已記錄評分') }
    setForm(null); load()
  }

  async function delScore(id) {
    await api.deleteScore(id)
    setConfirmDel(null); setOpen(null); toast('已刪除，恢復為未評')
    load()
  }

  async function addName() {
    const name = newName.trim()
    if (!name) return
    await api.addAttendant({ name })
    setNewName(''); toast(`已加入 ${name}`)
    load()
  }

  // 對某房務員評分：載入其當前評分（修改），無則新建
  const openForm = p => setForm(p.cur
    ? { ...p.cur, dims: { ...emptyDims(), ...(p.cur.dims || {}) } }
    : { date: todayStr(), attendant_id: p.a.id, room: '', dims: emptyDims(), inspector: '', note: '', photos: [] })

  const nameOf = a => a.name + (a.name_cn ? ` ${a.name_cn}` : '')

  return (
    <>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>
            讀取失敗：{err}<br />若是資料表不存在，請先在 Supabase SQL Editor 執行 <b>add-modules.sql</b> 及 <b>add-scoring.sql</b>。
          </p>
        </div>
      )}

      {/* 弱項總覽 */}
      <div className="card" style={{ borderColor: weakPeople.length ? 'var(--red)' : 'var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: weakPeople.length ? 'var(--red)' : 'var(--ink)' }}>
            ⚠ 需針對性培訓 · {weakPeople.length} 人
          </h2>
          <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={() => setRoster(true)}>👥 名單（{attendants.length}）</button>
        </div>
        <p className="src-note" style={{ margin: '6px 0 8px' }}>任一項 ≤{WEAK} 分即列為弱項。點下方維度籤，篩出該項需加強的人。</p>
        <div className="chips">
          <button className={`chip ${filter === '全部' ? 'on' : ''}`} onClick={() => setFilter('全部')}>全部 {people.length}</button>
          <button className={`chip ${filter === '弱項' ? 'on' : ''}`} onClick={() => setFilter('弱項')} style={filter !== '弱項' && weakPeople.length ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}>⚠ 有弱項 {weakPeople.length}</button>
          {unrated.length > 0 && <button className={`chip ${filter === '未評' ? 'on' : ''}`} onClick={() => setFilter('未評')}>未評 {unrated.length}</button>}
          {SCORE_DIMS.filter(k => dimWeakCount[k] > 0).map(k => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{k} {dimWeakCount[k]}</button>
          ))}
        </div>
      </div>

      <h2 style={{ margin: '14px 4px 10px' }}>
        {filter === '全部' ? '房務員當前評分' : filter === '弱項' ? '有弱項人員' : filter === '未評' ? '未評分人員' : `${filter} 需加強`}
        <span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>（{shown.length} 人 · 滿分 {SCORE_MAX}）</span>
      </h2>
      {shown.length === 0 && <div className="note">{filter === '全部' ? '按右上「👥 名單」加人，或點某人 ＋ 評分' : '沒有符合的人員'}</div>}
      {shown.map(p => (
        <div className="c-item" key={p.a.id}>
          <div className="c-head" onClick={() => setOpen(open === p.a.id ? null : p.a.id)}>
            {p.cur
              ? <span className="badge" style={{ background: scoreColor(p.total) + '22', color: scoreColor(p.total), fontSize: 13 }}>{p.total}</span>
              : <span className="badge b-gray">未評</span>}
            {p.a.floor && <span style={{ fontSize: 11, color: 'var(--sub)', flexShrink: 0 }}>{p.a.floor}</span>}
            <span className="room" style={{ fontSize: 14 }}>{p.a.name}</span>
            <span className="desc">{p.a.name_cn}{p.cur ? ` · ${scoreLabel(p.total)}` : ''}{p.weak.length ? ` · ⚠${p.weak.join('/')}` : ''}</span>
            <button className="row-ico" onClick={e => { e.stopPropagation(); openForm(p) }}>{p.cur ? '✏️' : '＋'}</button>
            {p.cur && <button className="row-ico del" onClick={e => { e.stopPropagation(); setConfirmDel(p.cur) }}>🗑</button>}
          </div>
          {open === p.a.id && p.cur && (
            <div className="c-body">
              <div className="dim-grid">
                {SCORE_DIMS.map(k => {
                  const v = parseInt(p.dims[k], 10) || 0
                  const low = v > 0 && v <= WEAK
                  return (
                    <div className="dim-cell" key={k} style={low ? { borderColor: 'var(--red)', background: 'var(--red-soft)' } : undefined}>
                      <span className="dv" style={{ color: low ? 'var(--red)' : 'var(--ink)' }}>{v || '–'}</span>
                      <span className="dk">{k}</span>
                    </div>
                  )
                })}
                <div className="dim-cell total"><span className="dv" style={{ color: scoreColor(p.total) }}>{p.total}</span><span className="dk">總分/{SCORE_MAX}</span></div>
              </div>
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
              <div style={{ flex: 1 }} className="f-row"><label>日期</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div style={{ flex: 1 }} className="f-row"><label>抽查房號</label>
                <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="例：1016" /></div>
            </div>
            <div className="f-row"><label>抽查人</label>
              <input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="例：Ice" /></div>
            {SCORE_DIMS.map(k => (
              <div className="f-row" key={k} style={{ marginBottom: 8 }}>
                <label style={{ marginBottom: 4 }}>{k}</label>
                <div className="score-seg">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} className={`sc-btn ${(parseInt(form.dims[k], 10) || 0) === v ? 'on' : ''} ${v <= WEAK ? 'low' : ''}`}
                      onClick={() => setForm({ ...form, dims: { ...form.dims, [k]: v } })}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
            <p className="note" style={{ textAlign: 'left', margin: '2px 2px 8px' }}>1差 2需改善 3一般 4良好 5優秀 · 某項 ≤2 分會列入弱項名單</p>
            <div className="f-row"><label>針對性加強（弱項培訓建議）</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例：物品整齊度需加強" /></div>
            <PhotoField label="相片（問題位或示範位）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} />
            <button className="btn" onClick={saveScore} disabled={!form.attendant_id}>儲存（總分 {sumDims(form.dims)}）</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
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
                placeholder="新房務員姓名" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addName() }} />
              <button className="btn" style={{ width: 'auto', margin: 0, padding: '9px 18px' }} onClick={addName}>加入</button>
            </div>
            <p className="note" style={{ textAlign: 'left', margin: '10px 2px 0' }}>已有評分記錄的人不能刪除，用「停用」讓她不再顯示（記錄保留）。</p>
            <button className="btn ghost" onClick={() => setRoster(false)}>完成</button>
          </div>
        </div>
      )}
      {confirmDel && (
        <Confirm
          text={`會刪除這筆評分，該房務員恢復為「未評」。`}
          onConfirm={() => delScore(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  )
}
