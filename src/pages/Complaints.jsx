import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { CATS } from '../data/seedData'
import { catMeta } from '../lib/cats'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'

const EMPTY = { date: '', room: '', category: '客房清潔', guest_comment: '', actual_cause: '', correct_standard: '', improvement: '', photos: [] }

export default function Complaints() {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)   // null=關閉；{...欄位, id?}=新增/編輯
  const [ask, setAsk] = useState(null)     // 剛儲存的客訴 → 問是否設為明日重點
  const [armed, setArmed] = useState(null) // 待確認刪除的 id

  useEffect(() => { load() }, [])
  async function load() { setList(await api.listComplaints()) }

  const today = todayStr()
  const yesterday = addDaysStr(-1)
  const ym = today.slice(0, 7)
  const mList = list.filter(c => c.date.startsWith(ym))
  const yCount = list.filter(c => c.date === yesterday).length
  const rCount = mList.filter(c => c.recurred).length
  const rank = CATS.map(cat => ({ cat, n: mList.filter(c => c.category === cat).length }))
    .filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const maxN = rank[0]?.n || 1

  async function save() {
    const f = form
    if (!f.date) { toast('請填日期'); return }
    const payload = {
      date: f.date, room: f.room || '—', category: f.category,
      guest_comment: f.guest_comment, actual_cause: f.actual_cause,
      correct_standard: f.correct_standard, improvement: f.improvement,
      photos: f.photos || [],
    }
    if (f.id) {
      await api.updateComplaint(f.id, payload)
      toast('已儲存修改')
    } else {
      const row = await api.addComplaint({ ...payload, shared: false, check_scheduled: false, recurred: false })
      setAsk(row)
    }
    setForm(null)
    load()
  }

  async function toggle(c, key) {
    await api.updateComplaint(c.id, { [key]: !c[key] })
    load()
  }

  async function del(id) {
    if (armed !== id) { setArmed(id); return }
    await api.deleteComplaint(id)
    setArmed(null); setOpen(null)
    toast('已刪除記錄')
    load()
  }

  async function askDone(yes) {
    if (yes) {
      await api.setFocus({ focus_date: addDaysStr(1), source: 'complaint', complaint_id: ask.id, topic_id: null })
      toast('已設為明日早會重點')
    } else {
      toast('已儲存至客訴記錄')
    }
    setAsk(null)
  }

  const F = (label, key, Type = 'input', props = {}) => (
    <div className="f-row">
      <label>{label}</label>
      {Type === 'textarea'
        ? <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />
        : <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />}
    </div>
  )

  return (
    <>
      <div className="cx-grid">
        <div>
          <div className="stats">
            <div className="stat"><div className="stat-e">🔔</div><div className={`n ${yCount ? 'warn' : ''}`}>{yCount}</div><div className="l">昨日客訴</div></div>
            <div className="stat"><div className="stat-e">🗓️</div><div className="n">{mList.length}</div><div className="l">本月客訴</div></div>
            <div className="stat"><div className="stat-e">🔁</div><div className={`n ${rCount ? 'warn' : ''}`}>{rCount}</div><div className="l">重複發生</div></div>
          </div>

          {rank.length > 0 && (
            <div className="card">
              <h2>本月問題分類排行</h2>
              {rank.map(r => {
                const m = catMeta(r.cat)
                return (
                  <div className="bar-row" key={r.cat}>
                    <span className="name">{m.e} {r.cat}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.n / maxN) * 100}%`, background: m.c }} /></div>
                    <span className="num">{r.n}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ margin: '2px 4px 10px' }}>客訴記錄</h2>
          {list.length === 0 && <div className="note">暫無記錄，按右下 ＋ 新增第一宗</div>}
          {list.map(c => {
            const m = catMeta(c.category)
            return (
              <div className="c-item" key={c.id}>
                <div className="c-head" onClick={() => { setOpen(open === c.id ? null : c.id); setArmed(null) }}>
                  <span className="badge" style={{ background: m.s, color: m.c }}>{m.e} {c.category}</span>
                  <span className="room">{c.room}</span>
                  <span className="desc">{c.guest_comment}</span>
                  {c.photos?.length > 0 && <span className="ph-count">📷{c.photos.length}</span>}
                  <span style={{ fontSize: 11, color: 'var(--sub)' }}>{c.date.slice(5)}</span>
                </div>
                {open === c.id && (
                  <div className="c-body">
                    <div className="kv"><span className="k">客人反映</span><span className="v">{c.guest_comment}</span></div>
                    <div className="kv"><span className="k">實際原因</span><span className="v">{c.actual_cause || '—'}</span></div>
                    <div className="kv"><span className="k">正確標準</span><span className="v">{c.correct_standard || '—'}</span></div>
                    <div className="kv"><span className="k">改善措施</span><span className="v">{c.improvement || '—'}</span></div>
                    <PhotoGrid photos={c.photos} />
                    <div className="flags">
                      <button className={`badge ${c.shared ? 'b-teal' : 'b-gray'}`} onClick={() => toggle(c, 'shared')}>{c.shared ? '✓ 已早會分享' : '未分享'}</button>
                      <button className={`badge ${c.check_scheduled ? 'b-teal' : 'b-gray'}`} onClick={() => toggle(c, 'check_scheduled')}>{c.check_scheduled ? '✓ 已排重點檢查' : '未排檢查'}</button>
                      <button className={`badge ${c.recurred ? 'b-red' : 'b-teal'}`} onClick={() => toggle(c, 'recurred')}>{c.recurred ? '⚠ 曾再次發生' : '未再發生'}</button>
                    </div>
                    <div className="row-actions">
                      <button className="done-btn" style={{ margin: 0 }} onClick={() => setForm({ ...EMPTY, ...c })}>✏️ 編輯</button>
                      <button className="btn danger" style={{ margin: 0, width: 'auto', flex: 1 }} onClick={() => del(c.id)}>
                        {armed === c.id ? '再按一次確定刪除' : '🗑 刪除'}
                      </button>
                    </div>
                    <button className="btn ghost" style={{ marginTop: 4 }} onClick={async () => {
                      await api.setFocus({ focus_date: addDaysStr(1), source: 'complaint', complaint_id: c.id, topic_id: null })
                      toast('已設為明日早會重點')
                    }}>📌 設為明日早會重點</button>
                  </div>
                )}
              </div>
            )
          })}
          <div className="note">點狀態標籤可直接切換 · 統計即時更新</div>
        </div>
      </div>

      <button className="fab" onClick={() => setForm({ ...EMPTY, date: today })}>＋</button>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯客訴記錄' : '新增客訴記錄'}</h2>
            {F('日期', 'date', 'input', { type: 'date' })}
            {F('房號', 'room', 'input', { placeholder: '例：1208' })}
            <div className="f-row">
              <label>問題分類</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {F('客人反映內容', 'guest_comment', 'textarea', { placeholder: '客人說了什麼…' })}
            {F('實際原因', 'actual_cause', 'textarea', { placeholder: '查證後的真正原因…' })}
            {F('正確標準', 'correct_standard', 'textarea', { placeholder: '應該怎樣做…' })}
            {F('改善措施', 'improvement', 'textarea', { placeholder: '採取了什麼行動…' })}
            <PhotoField label="現場相片（早會展示用）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} />
            <button className="btn" onClick={save}>儲存</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {ask && (
        <div className="modal">
          <div className="sheet center">
            <h2 style={{ marginBottom: 6 }}>已儲存 ✓</h2>
            <p style={{ fontSize: 13.5, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 14 }}>
              要把這宗客訴設為<b style={{ color: 'var(--ink)' }}>明日早會的品質重點</b>嗎？系統會自動產生重點卡及早會提問。
            </p>
            <button className="btn" onClick={() => askDone(true)}>設為明日重點</button>
            <button className="btn ghost" onClick={() => askDone(false)}>先不用</button>
          </div>
        </div>
      )}
    </>
  )
}
