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

export default function Scores() {
  const [attendants, setAttendants] = useState([])
  const [scores, setScores] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const [roster, setRoster] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [ym, setYm] = useState(todayStr().slice(0, 7))

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

  const aOf = id => attendants.find(a => a.id === id)
  const nameOf = id => { const a = aOf(id); return a ? (a.name + (a.name_cn ? ` ${a.name_cn}` : '')) : '？' }
  const shiftYm = (v, d) => { const [y, m] = v.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}` }
  const monthLabel = `${ym.slice(0, 4)}年${parseInt(ym.slice(5), 10)}月`
  const totalOf = s => (s.score != null ? s.score : sumDims(s.dims || {}))

  const mScores = scores.filter(s => s.date.startsWith(ym))
  const active = attendants.filter(a => a.active)
  const board = active.map(a => {
    const mine = mScores.filter(s => s.attendant_id === a.id)
    return { ...a, n: mine.length, avg: mine.length ? Math.round(mine.reduce((t, s) => t + totalOf(s), 0) / mine.length) : null }
  }).filter(a => a.n > 0).sort((x, y) => y.avg - x.avg)

  async function saveScore() {
    const f = form
    if (!f.attendant_id) { toast('請選房務員'); return }
    const dims = emptyDims()
    for (const k of SCORE_DIMS) dims[k] = parseInt(f.dims[k], 10) || 0
    const payload = {
      date: f.date, attendant_id: f.attendant_id, room: f.room,
      dims, score: sumDims(dims), inspector: f.inspector || '', note: f.note || '', photos: f.photos || [],
    }
    if (f.id) { await api.updateScore(f.id, payload); toast('已儲存修改') }
    else { await api.addScore(payload); toast('已記錄評分') }
    setForm(null); load()
  }

  async function delScore(id) {
    await api.deleteScore(id)
    setConfirmDel(null); setOpen(null); toast('已刪除')
    load()
  }

  async function addName() {
    const name = newName.trim()
    if (!name) return
    await api.addAttendant({ name })
    setNewName(''); toast(`已加入 ${name}`)
    load()
  }

  const openForm = s => setForm(s
    ? { ...s, dims: { ...emptyDims(), ...(s.dims || {}) } }
    : { date: todayStr(), attendant_id: active[0]?.id || '', room: '', dims: emptyDims(), inspector: '', note: '', photos: [] })

  return (
    <>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>
            讀取失敗：{err}<br />若是資料表不存在，請先在 Supabase SQL Editor 執行 <b>supabase/add-modules.sql</b> 及 <b>add-scoring.sql</b>。
          </p>
        </div>
      )}

      <div className="card">
        <div className="month-nav" style={{ marginBottom: 10 }}>
          <button onClick={() => setYm(shiftYm(ym, -1))}>‹</button>
          <span className="m-label">{monthLabel}排行</span>
          <button onClick={() => setYm(shiftYm(ym, 1))}>›</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--sub)' }}>平均總分（滿分 {SCORE_MAX}）· {board.length} 人已評</span>
          <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={() => setRoster(true)}>👥 名單（{attendants.length}）</button>
        </div>
        {board.length === 0 && <div className="note" style={{ margin: '8px 0' }}>本月尚無評分，按右下 ＋ 記錄</div>}
        {board.map(a => (
          <div className="bar-row" key={a.id}>
            <span className="name">{a.name}{a.name_cn ? ` ${a.name_cn}` : ''}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(a.avg / SCORE_MAX) * 100}%`, background: scoreColor(a.avg) }} />
            </div>
            <span className="num" style={{ width: 62, fontSize: 11.5 }}>{a.avg}分 / {a.n}次</span>
          </div>
        ))}
      </div>

      <h2 style={{ margin: '14px 4px 10px' }}>評分記錄<span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>（{monthLabel} · {mScores.length} 筆）</span></h2>
      {mScores.length === 0 && !err && <div className="note">按右下 ＋ 記第一筆評分</div>}
      {mScores.map(s => {
        const total = totalOf(s)
        const dims = s.dims || {}
        const weak = SCORE_DIMS.filter(k => (parseInt(dims[k], 10) || 0) > 0 && (parseInt(dims[k], 10) || 0) < 3)
        return (
          <div className="c-item" key={s.id}>
            <div className="c-head" onClick={() => setOpen(open === s.id ? null : s.id)}>
              <span className="badge" style={{ background: scoreColor(total) + '22', color: scoreColor(total), fontSize: 13 }}>{total}</span>
              <span className="room">{nameOf(s.attendant_id)}</span>
              <span className="desc">{s.room && `${s.room}房 · `}{scoreLabel(total)}{weak.length ? ` · 弱項:${weak.join('/')}` : ''}</span>
              <button className="row-ico" onClick={e => { e.stopPropagation(); openForm(s) }}>✏️</button>
              <button className="row-ico del" onClick={e => { e.stopPropagation(); setConfirmDel(s) }}>🗑</button>
              <span style={{ fontSize: 11, color: 'var(--sub)' }}>{s.date.slice(5)}</span>
            </div>
            {open === s.id && (
              <div className="c-body">
                <div className="dim-grid">
                  {SCORE_DIMS.map(k => {
                    const v = parseInt(dims[k], 10) || 0
                    return (
                      <div className="dim-cell" key={k} style={v > 0 && v < 3 ? { borderColor: 'var(--red)' } : undefined}>
                        <span className="dv" style={{ color: v > 0 && v < 3 ? 'var(--red)' : 'var(--ink)' }}>{v || '–'}</span>
                        <span className="dk">{k}</span>
                      </div>
                    )
                  })}
                  <div className="dim-cell total"><span className="dv" style={{ color: scoreColor(total) }}>{total}</span><span className="dk">總分/{SCORE_MAX}</span></div>
                </div>
                <div className="kv"><span className="k">房號</span><span className="v">{s.room || '—'}</span></div>
                <div className="kv"><span className="k">抽查人</span><span className="v">{s.inspector || '—'}</span></div>
                {s.note && <div className="kv"><span className="k">針對性加強</span><span className="v">{s.note}</span></div>}
                <PhotoGrid photos={s.photos} />
              </div>
            )}
          </div>
        )
      })}

      <button className="fab" onClick={() => openForm(null)}>＋</button>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯評分' : '清潔度考核評分'}<span style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 400 }}> · 現時 {sumDims(form.dims)}/{SCORE_MAX}</span></h2>
            <div className="f-row"><label>日期</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="f-row"><label>房務員</label>
              <select value={form.attendant_id} onChange={e => setForm({ ...form, attendant_id: e.target.value })}>
                <option value="">請選擇</option>
                {active.map(a => <option key={a.id} value={a.id}>{a.name}{a.name_cn ? ` ${a.name_cn}` : ''}{a.floor ? `（${a.floor}）` : ''}</option>)}
              </select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }} className="f-row"><label>抽查房號</label>
                <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="例：1016" /></div>
              <div style={{ flex: 1 }} className="f-row"><label>抽查人</label>
                <input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="例：Ice" /></div>
            </div>
            {SCORE_DIMS.map(k => (
              <div className="f-row" key={k} style={{ marginBottom: 8 }}>
                <label style={{ marginBottom: 4 }}>{k}</label>
                <div className="score-seg">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} className={`sc-btn ${(parseInt(form.dims[k], 10) || 0) === v ? 'on' : ''} ${v < 3 ? 'low' : ''}`}
                      onClick={() => setForm({ ...form, dims: { ...form.dims, [k]: v } })}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
            <p className="note" style={{ textAlign: 'left', margin: '2px 2px 8px' }}>1差 2需改善 3一般 4良好 5優秀 · 總分低於18或單項少於3分需針對性培訓</p>
            <div className="f-row"><label>針對性加強（弱項培訓建議）</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例：物品整齊度需加強" /></div>
            <PhotoField label="相片（問題位或示範位）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} />
            <button className="btn" onClick={saveScore}>儲存（總分 {sumDims(form.dims)}）</button>
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
                  defaultValue={a.name + (a.name_cn ? ` ${a.name_cn}` : '')}
                  onBlur={async e => { const v = e.target.value.trim(); if (v && v !== (a.name + (a.name_cn ? ` ${a.name_cn}` : ''))) { await api.updateAttendant(a.id, { name: v, name_cn: '' }); toast('已改名'); load() } }} />
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
            <p className="note" style={{ textAlign: 'left', margin: '10px 2px 0' }}>已有評分記錄的人不能刪除，用「停用」讓她不再出現在選單（記錄保留）。</p>
            <button className="btn ghost" onClick={() => setRoster(false)}>完成</button>
          </div>
        </div>
      )}
      {confirmDel && (
        <Confirm
          text={`${confirmDel.date} · ${nameOf(confirmDel.attendant_id)} 的評分記錄會被永久刪除。`}
          onConfirm={() => delScore(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  )
}
