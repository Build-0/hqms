import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'

const scoreColor = n => (n >= 90 ? 'var(--accent)' : n >= 80 ? 'var(--amber)' : 'var(--red)')

export default function Scores() {
  const [attendants, setAttendants] = useState([])
  const [scores, setScores] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)     // 展開的評分記錄 id
  const [form, setForm] = useState(null)     // 評分表單
  const [roster, setRoster] = useState(false)// 名單管理面板
  const [newName, setNewName] = useState('')
  const [armed, setArmed] = useState(null)

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

  const nameOf = id => attendants.find(a => a.id === id)?.name || '？'
  const ym = todayStr().slice(0, 7)
  const mScores = scores.filter(s => s.date.startsWith(ym))
  const active = attendants.filter(a => a.active)
  const board = active.map(a => {
    const mine = mScores.filter(s => s.attendant_id === a.id)
    return { ...a, n: mine.length, avg: mine.length ? Math.round(mine.reduce((t, s) => t + s.score, 0) / mine.length) : null }
  }).sort((x, y) => (y.avg ?? -1) - (x.avg ?? -1))

  async function saveScore() {
    const f = form
    if (!f.attendant_id) { toast('請選房務員'); return }
    const n = parseInt(f.score, 10)
    if (isNaN(n) || n < 0 || n > 100) { toast('分數請填 0–100'); return }
    const payload = { date: f.date, attendant_id: f.attendant_id, room: f.room, score: n, note: f.note, photos: f.photos || [] }
    if (f.id) { await api.updateScore(f.id, payload); toast('已儲存修改') }
    else { await api.addScore(payload); toast('已記錄評分') }
    setForm(null); load()
  }

  async function delScore(id) {
    if (armed !== id) { setArmed(id); return }
    await api.deleteScore(id)
    setArmed(null); setOpen(null); toast('已刪除')
    load()
  }

  async function addName() {
    const name = newName.trim()
    if (!name) return
    await api.addAttendant({ name })
    setNewName(''); toast(`已加入 ${name}`)
    load()
  }

  return (
    <>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>
            讀取失敗：{err}<br />若是資料表不存在，請先在 Supabase SQL Editor 執行 <b>supabase/add-modules.sql</b>。
          </p>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>本月排行（{active.length} 人）</h2>
          <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={() => setRoster(true)}>👥 名單</button>
        </div>
        {board.length === 0 && <div className="note" style={{ margin: '8px 0' }}>先按右上「👥 名單」加入房務員</div>}
        {board.map(a => (
          <div className="bar-row" key={a.id}>
            <span className="name">{a.name}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: a.avg === null ? '0%' : `${a.avg}%`, background: a.avg === null ? '#ccc' : scoreColor(a.avg) }} />
            </div>
            <span className="num" style={{ width: 56, fontSize: 11.5 }}>{a.avg === null ? '未評' : `${a.avg}分/${a.n}次`}</span>
          </div>
        ))}
      </div>

      <h2 style={{ margin: '14px 4px 10px' }}>評分記錄</h2>
      {scores.length === 0 && !err && <div className="note">按右下 ＋ 記第一筆評分</div>}
      {scores.map(s => (
        <div className="c-item" key={s.id}>
          <div className="c-head" onClick={() => { setOpen(open === s.id ? null : s.id); setArmed(null) }}>
            <span className="badge" style={{ background: scoreColor(s.score) + '22', color: scoreColor(s.score), fontSize: 13 }}>{s.score}</span>
            <span className="room">{nameOf(s.attendant_id)}</span>
            <span className="desc">{s.room && `${s.room} 房 · `}{s.note}</span>
            <span style={{ fontSize: 11, color: 'var(--sub)' }}>{s.date.slice(5)}</span>
          </div>
          {open === s.id && (
            <div className="c-body">
              <div className="kv"><span className="k">日期</span><span className="v">{s.date}</span></div>
              <div className="kv"><span className="k">房號</span><span className="v">{s.room || '—'}</span></div>
              <div className="kv"><span className="k">備註</span><span className="v">{s.note || '—'}</span></div>
              <PhotoGrid photos={s.photos} />
              <div className="row-actions">
                <button className="done-btn" style={{ margin: 0 }}
                  onClick={() => setForm({ ...s, score: String(s.score) })}>✏️ 編輯</button>
                <button className="btn danger" style={{ margin: 0, width: 'auto', flex: 1 }} onClick={() => delScore(s.id)}>
                  {armed === s.id ? '再按一次確定刪除' : '🗑 刪除'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="fab" onClick={() => setForm({ date: todayStr(), attendant_id: active[0]?.id || '', room: '', score: '', note: '', photos: [] })}>＋</button>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯評分' : '記錄清潔評分'}</h2>
            <div className="f-row"><label>日期</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="f-row"><label>房務員</label>
              <select value={form.attendant_id} onChange={e => setForm({ ...form, attendant_id: e.target.value })}>
                <option value="">請選擇</option>
                {active.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div className="f-row"><label>房號</label>
              <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="抽查的房號" /></div>
            <div className="f-row"><label>分數（0–100）</label>
              <input type="number" min="0" max="100" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} /></div>
            <div className="f-row"><label>備註（扣分原因/表現）</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例：排水口有毛髮 -5，床鋪標準" /></div>
            <PhotoField label="相片（問題位或示範位）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} />
            <button className="btn" onClick={saveScore}>儲存</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {roster && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setRoster(false) }}>
          <div className="sheet">
            <h2>房務員名單</h2>
            {attendants.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', background: a.active ? 'var(--bg)' : '#eee', color: a.active ? 'var(--ink)' : 'var(--sub)' }}
                  defaultValue={a.name}
                  onBlur={async e => { const v = e.target.value.trim(); if (v && v !== a.name) { await api.updateAttendant(a.id, { name: v }); toast('已改名'); load() } }} />
                <button className="logout" style={{ color: a.active ? 'var(--sub)' : 'var(--accent)', background: '#eef1f4', flexShrink: 0 }}
                  onClick={async () => { await api.updateAttendant(a.id, { active: !a.active }); load() }}>
                  {a.active ? '停用' : '啟用'}
                </button>
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
    </>
  )
}
