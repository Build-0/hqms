import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { DEFAULT_CATEGORIES, NATURES } from '../data/seedData'
import { metaOf } from '../lib/cats'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

const EMPTY = { date: '', room: '', category: '', nature: '投訴', guest_comment: '', actual_cause: '', correct_standard: '', improvement: '', photos: [] }
const natureBadge = n => (n === '濫訴' ? { t: '🚫 濫訴', cls: 'b-gray' } : n === '工程投訴' ? { t: '🔧 工程', cls: 'b-blue' } : null)

export default function Complaints() {
  const [list, setList] = useState([])
  const [cats, setCats] = useState(null)
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)    // null=關閉；{...欄位, id?}=新增/編輯
  const [ask, setAsk] = useState(null)      // 剛儲存的投訴 → 問是否設為明日重點
  const [confirmDel, setConfirmDel] = useState(null) // 待確認刪除的記錄
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
  const natureOf = c => c.nature || '投訴'

  const today = todayStr()
  const yesterday = addDaysStr(-1)
  const ym = today.slice(0, 7)
  const mAll = list.filter(c => c.date.startsWith(ym))
  const genuine = list.filter(c => natureOf(c) === '投訴')
  const mGenuine = genuine.filter(c => c.date.startsWith(ym))
  const yCount = genuine.filter(c => c.date === yesterday).length
  const rCount = mGenuine.filter(c => c.recurred).length
  const rank = catList.map(k => ({ cat: k.name, n: mGenuine.filter(c => c.category === k.name).length }))
    .filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const maxN = rank[0]?.n || 1

  const shown = list
    .filter(c => natureF === '全部' || natureOf(c) === natureF)
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
          <div className="stats">
            <div className="stat"><div className="stat-e">🔔</div><div className={`n ${yCount ? 'warn' : ''}`}>{yCount}</div><div className="l">昨日投訴</div></div>
            <div className="stat"><div className="stat-e">🗓️</div><div className="n">{mGenuine.length}</div><div className="l">本月投訴</div></div>
            <div className="stat"><div className="stat-e">🚫</div><div className="n" style={{ color: 'var(--sub)' }}>{mAll.filter(c => natureOf(c) === '濫訴').length}</div><div className="l">濫訴</div></div>
            <div className="stat"><div className="stat-e">🔧</div><div className="n" style={{ color: 'var(--blue)' }}>{mAll.filter(c => natureOf(c) === '工程投訴').length}</div><div className="l">工程投訴</div></div>
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
          {shown.length === 0 && <div className="note">沒有符合篩選的記錄</div>}
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
