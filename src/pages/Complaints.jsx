import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { DEFAULT_CATEGORIES } from '../data/seedData'
import { metaOf } from '../lib/cats'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'

const EMPTY = { date: '', room: '', category: '', nature: '投訴', guest_comment: '', actual_cause: '', correct_standard: '', improvement: '', photos: [] }

export default function Complaints() {
  const [list, setList] = useState([])
  const [cats, setCats] = useState(null)
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)   // null=關閉；{...欄位, id?}=新增/編輯
  const [ask, setAsk] = useState(null)     // 剛儲存的客訴 → 問是否設為明日重點
  const [armed, setArmed] = useState(null) // 待確認刪除的 id
  const [natureF, setNatureF] = useState('全部')
  const [catF, setCatF] = useState('全部')

  useEffect(() => { load() }, [])
  async function load() {
    const [c, k] = await Promise.all([api.listComplaints(), api.listCategories()])
    setList(c)
    setCats(k?.length ? k : DEFAULT_CATEGORIES)
  }
  const catList = cats || DEFAULT_CATEGORIES
  const m = name => metaOf(catList, name)

  const today = todayStr()
  const yesterday = addDaysStr(-1)
  const ym = today.slice(0, 7)
  const genuine = list.filter(c => c.nature !== '濫訴')
  const mGenuine = genuine.filter(c => c.date.startsWith(ym))
  const mAbuse = list.filter(c => c.nature === '濫訴' && c.date.startsWith(ym))
  const yCount = genuine.filter(c => c.date === yesterday).length
  const rCount = mGenuine.filter(c => c.recurred).length
  const rank = catList.map(k => ({ cat: k.name, n: mGenuine.filter(c => c.category === k.name).length }))
    .filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const maxN = rank[0]?.n || 1

  const shown = list
    .filter(c => natureF === '全部' || (c.nature || '投訴') === natureF)
    .filter(c => catF === '全部' || c.category === catF)

  async function save() {
    const f = form
    if (!f.date) { toast('請填日期'); return }
    const payload = {
      date: f.date, room: f.room || '—', category: f.category || catList[0]?.name || '客房清潔',
      nature: f.nature || '投訴',
      guest_comment: f.guest_comment, actual_cause: f.actual_cause,
      correct_standard: f.correct_standard, improvement: f.improvement,
      photos: f.photos || [],
    }
    if (f.id) {
      await api.updateComplaint(f.id, payload)
      toast('已儲存修改')
    } else {
      const row = await api.addComplaint({ ...payload, shared: false, check_scheduled: false, recurred: false })
      if (payload.nature === '濫訴') toast('已記錄（濫訴不會成為早會重點）')
      else setAsk(row)
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
            <div className="stat"><div className="stat-e">🔔</div><div className={`n ${yCount ? 'warn' : ''}`}>{yCount}</div><div className="l">昨日投訴</div></div>
            <div className="stat"><div className="stat-e">🗓️</div><div className="n">{mGenuine.length}</div><div className="l">本月投訴</div></div>
            <div className="stat"><div className="stat-e">🚫</div><div className="n" style={{ color: 'var(--sub)' }}>{mAbuse.length}</div><div className="l">本月濫訴</div></div>
            <div className="stat"><div className="stat-e">🔁</div><div className={`n ${rCount ? 'warn' : ''}`}>{rCount}</div><div className="l">重複發生</div></div>
          </div>

          {rank.length > 0 && (
            <div className="card">
              <h2>本月問題分類排行<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（只計投訴）</span></h2>
              {rank.map(r => {
                const mm = m(r.cat)
                return (
                  <div className="bar-row" key={r.cat}>
                    <span className="name">{mm.e} {r.cat}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.n / maxN) * 100}%`, background: mm.c }} /></div>
                    <span className="num">{r.n}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ margin: '2px 4px 8px' }}>客訴記錄</h2>
          <div className="chips" style={{ marginBottom: 6 }}>
            {['全部', '投訴', '濫訴'].map(n => (
              <button key={n} className={`chip ${natureF === n ? 'on' : ''}`} onClick={() => setNatureF(n)}>{n}</button>
            ))}
          </div>
          <div className="chips">
            <button className={`chip ${catF === '全部' ? 'on' : ''}`} onClick={() => setCatF('全部')}>全部分類</button>
            {catList.map(k => (
              <button key={k.name} className={`chip ${catF === k.name ? 'on' : ''}`} onClick={() => setCatF(k.name)}>{k.emoji} {k.name}</button>
            ))}
          </div>
          {shown.length === 0 && <div className="note">沒有符合篩選的記錄</div>}
          {shown.map(c => {
            const mm = m(c.category)
            const abuse = c.nature === '濫訴'
            return (
              <div className="c-item" key={c.id} style={abuse ? { opacity: .75 } : undefined}>
                <div className="c-head" onClick={() => { setOpen(open === c.id ? null : c.id); setArmed(null) }}>
                  <span className="badge" style={{ background: mm.s, color: mm.c }}>{mm.e} {c.category}</span>
                  {abuse && <span className="badge b-gray">🚫 濫訴</span>}
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
                      <button className={`badge ${abuse ? 'b-red' : 'b-teal'}`}
                        onClick={() => api.updateComplaint(c.id, { nature: abuse ? '投訴' : '濫訴' }).then(load)}>
                        {abuse ? '🚫 濫訴（點改回投訴）' : '✓ 投訴（點標為濫訴）'}
                      </button>
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
                    {!abuse && (
                      <button className="btn ghost" style={{ marginTop: 4 }} onClick={async () => {
                        await api.setFocus({ focus_date: addDaysStr(1), source: 'complaint', complaint_id: c.id, topic_id: null })
                        toast('已設為明日早會重點')
                      }}>📌 設為明日早會重點</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <div className="note">點狀態標籤可直接切換 · 排行與重點選題只計「投訴」，濫訴留作人群與數量統計</div>
        </div>
      </div>

      <button className="fab" onClick={() => setForm({ ...EMPTY, date: today, category: catList[0]?.name || '' })}>＋</button>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯客訴記錄' : '新增客訴記錄'}</h2>
            <div className="f-row">
              <label>性質</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['投訴', '濫訴'].map(n => (
                  <button key={n} className={`chip ${form.nature === n ? 'on' : ''}`} style={{ flex: 1, padding: '9px 0' }}
                    onClick={() => setForm({ ...form, nature: n })}>{n === '投訴' ? '✓ 投訴（真實問題）' : '🚫 濫訴（不合理）'}</button>
                ))}
              </div>
            </div>
            {F('日期', 'date', 'input', { type: 'date' })}
            {F('房號', 'room', 'input', { placeholder: '例：1208' })}
            <div className="f-row">
              <label>問題分類</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {catList.map(k => <option key={k.name} value={k.name}>{k.emoji} {k.name}</option>)}
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
