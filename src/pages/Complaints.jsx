import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { DEFAULT_CATEGORIES, NATURES } from '../data/seedData'
import { metaOf } from '../lib/cats'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

const EMPTY = { date: '', room: '', category: '', nature: '投訴', source: 'wechat', guest_comment: '', actual_cause: '', correct_standard: '', improvement: '', photos: [] }
const natureBadge = n => (n === '濫訴' ? { t: '🚫 濫訴', cls: 'b-gray' } : n === '工程投訴' ? { t: '🔧 工程', cls: 'b-blue' } : null)
const SOURCES = ['wechat', 'Incident report', 'Guest comment', '總機', '其他']
// 房號 → 樓層（1208→12樓、320→3樓；無房號→null）
const floorOf = room => {
  const m = String(room || '').match(/\d{3,4}/)
  if (!m) return null
  return m[0].length === 4 ? parseInt(m[0].slice(0, 2), 10) : parseInt(m[0].slice(0, 1), 10)
}
const shiftYm = (ym, d) => {
  const [y, m] = ym.split('-').map(Number)
  const t = new Date(y, m - 1 + d, 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

export default function Complaints() {
  const [list, setList] = useState([])
  const [cats, setCats] = useState(null)
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)    // null=關閉；{...欄位, id?}=新增/編輯
  const [ask, setAsk] = useState(null)      // 剛儲存的投訴 → 問是否設為明日重點
  const [confirmDel, setConfirmDel] = useState(null) // 待確認刪除的記錄
  const [natureF, setNatureF] = useState('全部')
  const [catF, setCatF] = useState('全部')
  const [floorF, setFloorF] = useState('全部')
  const [ym, setYm] = useState(todayStr().slice(0, 7))

  useEffect(() => { load() }, [])
  async function load() {
    const [c, k] = await Promise.all([api.listComplaints(), api.listCategories()])
    setList(c)
    setCats(k?.length ? k : DEFAULT_CATEGORIES)
  }
  const catList = cats || DEFAULT_CATEGORIES
  const m = name => metaOf(catList, name)
  const natureOf = c => c.nature || '投訴'

  const today = todayStr()
  const yesterday = addDaysStr(-1)
  const hasSource = list.length > 0 && 'source' in list[0]
  const mAll = list.filter(c => c.date.startsWith(ym))       // 選中月份的全部記錄
  const mGenuine = mAll.filter(c => natureOf(c) === '投訴')
  const yCount = list.filter(c => natureOf(c) === '投訴' && c.date === yesterday).length
  const rCount = mGenuine.filter(c => c.recurred).length
  const rank = catList.map(k => ({ cat: k.name, n: mGenuine.filter(c => c.category === k.name).length }))
    .filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const maxN = rank[0]?.n || 1
  // 樓層分佈（只計投訴）
  const floorCount = {}
  for (const c of mGenuine) {
    const f = floorOf(c.room)
    const key = f === null ? '無房號' : `${f}`
    floorCount[key] = (floorCount[key] || 0) + 1
  }
  const floorRank = Object.entries(floorCount)
    .sort((a, b) => b[1] - a[1])
  const maxF = floorRank[0]?.[1] || 1
  const floors = [...new Set(mAll.map(c => { const f = floorOf(c.room); return f === null ? '無房號' : `${f}` }))]
    .sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
  const monthLabel = `${ym.slice(0, 4)}年${parseInt(ym.slice(5), 10)}月`

  const shown = mAll
    .filter(c => natureF === '全部' || natureOf(c) === natureF)
    .filter(c => catF === '全部' || c.category === catF)
    .filter(c => {
      if (floorF === '全部') return true
      const f = floorOf(c.room)
      return floorF === (f === null ? '無房號' : `${f}`)
    })

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
    if (hasSource) payload.source = f.source || 'wechat'
    if (f.id) {
      await api.updateComplaint(f.id, payload)
      toast('已儲存修改')
    } else {
      const row = await api.addComplaint({ ...payload, shared: false, check_scheduled: false, recurred: false })
      if (payload.nature === '投訴') setAsk(row)
      else toast(`已記錄（${payload.nature}不會成為早會重點）`)
    }
    setForm(null)
    load()
  }

  async function patch(c, p) {
    await api.updateComplaint(c.id, p)
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
          <div className="month-nav">
            <button onClick={() => { setYm(shiftYm(ym, -1)); setFloorF('全部') }}>‹</button>
            <span className="m-label">{monthLabel}</span>
            <button onClick={() => { setYm(shiftYm(ym, 1)); setFloorF('全部') }}>›</button>
          </div>
          <div className="stats">
            <div className="stat"><div className="stat-e">🔔</div><div className={`n ${yCount ? 'warn' : ''}`}>{yCount}</div><div className="l">昨日投訴</div></div>
            <div className="stat"><div className="stat-e">🗓️</div><div className="n">{mGenuine.length}</div><div className="l">當月投訴</div></div>
            <div className="stat"><div className="stat-e">🚫</div><div className="n" style={{ color: 'var(--sub)' }}>{mAll.filter(c => natureOf(c) === '濫訴').length}</div><div className="l">濫訴</div></div>
            <div className="stat"><div className="stat-e">🔧</div><div className="n" style={{ color: 'var(--blue)' }}>{mAll.filter(c => natureOf(c) === '工程投訴').length}</div><div className="l">工程投訴</div></div>
            <div className="stat"><div className="stat-e">🔁</div><div className={`n ${rCount ? 'warn' : ''}`}>{rCount}</div><div className="l">重複發生</div></div>
          </div>

          {rank.length > 0 && (
            <div className="card">
              <h2>{monthLabel}分類排行<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（只計投訴）</span></h2>
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

          {floorRank.length > 0 && (
            <div className="card">
              <h2>{monthLabel}樓層分佈<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（只計投訴，點列表上方樓層籤可篩選）</span></h2>
              {floorRank.map(([f, n]) => (
                <div className="bar-row" key={f}>
                  <span className="name">{f === '無房號' ? f : `${f} 樓`}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxF) * 100}%`, background: 'var(--accent)' }} /></div>
                  <span className="num">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ margin: '2px 4px 8px' }}>客訴記錄<span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>（{monthLabel} · {shown.length} 筆）</span></h2>
          <div className="chips">
            {['全部', ...NATURES].map(n => (
              <button key={n} className={`chip ${natureF === n ? 'on' : ''}`} onClick={() => setNatureF(n)}>{n}</button>
            ))}
          </div>
          <div className="chips">
            <button className={`chip ${catF === '全部' ? 'on' : ''}`} onClick={() => setCatF('全部')}>全部分類</button>
            {catList.map(k => (
              <button key={k.name} className={`chip ${catF === k.name ? 'on' : ''}`} onClick={() => setCatF(k.name)}>{k.emoji} {k.name}</button>
            ))}
          </div>
          {floors.length > 1 && (
            <div className="chips">
              <button className={`chip ${floorF === '全部' ? 'on' : ''}`} onClick={() => setFloorF('全部')}>全部樓層</button>
              {floors.map(f => (
                <button key={f} className={`chip ${floorF === f ? 'on' : ''}`} onClick={() => setFloorF(f)}>{f === '無房號' ? f : `${f} 樓`}</button>
              ))}
            </div>
          )}
          {shown.length === 0 && <div className="note">{monthLabel}沒有符合篩選的記錄</div>}
          {shown.map(c => {
            const mm = m(c.category)
            const nb = natureBadge(natureOf(c))
            return (
              <div className="c-item" key={c.id} style={nb ? { opacity: .8 } : undefined}>
                <div className="c-head" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <span className="badge" style={{ background: mm.s, color: mm.c }}>{mm.e} {c.category}</span>
                  {nb && <span className={`badge ${nb.cls}`}>{nb.t}</span>}
                  <span className="room">{c.room}</span>
                  <span className="desc">{c.guest_comment}</span>
                  {c.photos?.length > 0 && <span className="ph-count">📷{c.photos.length}</span>}
                  <span style={{ fontSize: 11, color: 'var(--sub)' }}>{c.date.slice(5)}</span>
                </div>
                {open === c.id && (
                  <div className="c-body">
                    <div className="kv"><span className="k">客人反映</span><span className="v">{c.guest_comment}</span></div>
                    {hasSource && <div className="kv"><span className="k">來源</span><span className="v">{c.source || '—'}</span></div>}
                    <div className="kv"><span className="k">實際原因</span><span className="v">{c.actual_cause || '—'}</span></div>
                    <div className="kv"><span className="k">正確標準</span><span className="v">{c.correct_standard || '—'}</span></div>
                    <div className="kv"><span className="k">改善措施</span><span className="v">{c.improvement || '—'}</span></div>
                    <PhotoGrid photos={c.photos} />
                    <div className="seg">
                      {NATURES.map(n => (
                        <button key={n} className={`chip ${natureOf(c) === n ? 'on' : ''}`}
                          onClick={() => natureOf(c) !== n && patch(c, { nature: n })}>{n}</button>
                      ))}
                    </div>
                    <button className={`toggle-row ${c.shared ? 'on' : ''}`} onClick={() => patch(c, { shared: !c.shared })}>
                      📣 已於早會分享<span className="tg-state">{c.shared ? '✓ 是' : '未'}</span>
                    </button>
                    <button className={`toggle-row ${c.check_scheduled ? 'on' : ''}`} onClick={() => patch(c, { check_scheduled: !c.check_scheduled })}>
                      👁 已排主管重點檢查<span className="tg-state">{c.check_scheduled ? '✓ 是' : '未'}</span>
                    </button>
                    <button className={`toggle-row ${c.recurred ? 'warn' : ''}`} onClick={() => patch(c, { recurred: !c.recurred })}>
                      🔁 曾再次發生<span className="tg-state">{c.recurred ? '⚠ 是' : '否'}</span>
                    </button>
                    {natureOf(c) === '投訴' && (
                      <button className="toggle-row" onClick={async () => {
                        await api.setFocus({ focus_date: addDaysStr(1), source: 'complaint', complaint_id: c.id, topic_id: null })
                        toast('已設為明日早會重點')
                      }}>📌 設為明日早會重點<span className="tg-state">›</span></button>
                    )}
                    <div className="row-actions">
                      <button className="mini-btn edit" onClick={() => setForm({ ...EMPTY, ...c })}>✏️ 編輯</button>
                      <button className="mini-btn del" onClick={() => setConfirmDel(c)}>🗑 刪除</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div className="note">排行與早會選題只計「投訴」；濫訴、工程投訴另計數量作參考</div>
        </div>
      </div>

      <button className="fab" onClick={() => setForm({ ...EMPTY, date: today, category: catList[0]?.name || '' })}>＋</button>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯客訴記錄' : '新增客訴記錄'}</h2>
            <div className="f-row">
              <label>性質</label>
              <div className="seg" style={{ marginTop: 0 }}>
                {NATURES.map(n => (
                  <button key={n} className={`chip ${form.nature === n ? 'on' : ''}`}
                    onClick={() => setForm({ ...form, nature: n })}>{n}</button>
                ))}
              </div>
            </div>
            {F('日期', 'date', 'input', { type: 'date' })}
            {F('房號', 'room', 'input', { placeholder: '例：1208' })}
            {hasSource && (
              <div className="f-row">
                <label>來源</label>
                <select value={form.source || 'wechat'} onChange={e => setForm({ ...form, source: e.target.value })}>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="f-row">
              <label>問題分類</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {catList.map(k => <option key={k.name} value={k.name}>{k.emoji} {k.name}</option>)}
              </select>
            </div>
            {F('客人反映內容', 'guest_comment', 'textarea', { placeholder: '客人說了什麼…' })}
            {F('實際原因', 'actual_cause', 'textarea', { placeholder: '查證後的真正原因…' })}
            {F('正確標準', 'correct_standard', 'textarea', { placeholder: '應該怎麼做…' })}
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

      {confirmDel && (
        <Confirm
          text={`${confirmDel.date} · ${confirmDel.room} 房「${confirmDel.guest_comment}」的記錄會被永久刪除。`}
          onConfirm={async () => { await api.deleteComplaint(confirmDel.id); setConfirmDel(null); setOpen(null); toast('已刪除記錄'); load() }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  )
}
