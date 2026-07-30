import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { DEFAULT_CATEGORIES, NATURES, DEPTS } from '../data/seedData'
import { metaOf } from '../lib/cats'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

const EMPTY = { date: '', room: '', category: '', dept: '客房', nature: '投訴', source: 'wechat', guest_comment: '', actual_cause: '', correct_standard: '', improvement: '', photos: [] }
const SOURCES = ['wechat', 'Incident report', 'Guest comment', 'FO Mail', '總機', '其他']
const DEPT_LABEL = d => (d === '工程其他' ? '工程與其他' : d)
// 規則：內容含「新鮮污漬／新鮮血漬」的新記錄一律標濫訴
const FRESH_RE = /新鮮[^，。、]{0,6}(污漬|血漬)/
const roomNum = r => { const m = String(r || '').match(/\d+/); return m ? parseInt(m[0], 10) : 99999 }
// 相容：dept 欄未建立前，由舊的 nature=工程投訴 推斷部門
const deptOf = c => c.dept || (c.nature === '工程投訴' ? '工程其他' : '客房')
const natOf = c => (c.nature === '工程投訴' ? '投訴' : (c.nature || '投訴'))
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
  const [ask, setAsk] = useState(null)      // 剛儲存的客房投訴 → 問是否設為明日重點
  const [confirmDel, setConfirmDel] = useState(null)
  const [deptF, setDeptF] = useState('全部')
  const [natureF, setNatureF] = useState('全部')
  const [catF, setCatF] = useState('全部')
  const [floorF, setFloorF] = useState('全部')
  const [srcF, setSrcF] = useState('全部')
  const [sortF, setSortF] = useState('最新')
  const [q, setQ] = useState('')
  const [ym, setYm] = useState(todayStr().slice(0, 7))

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
  const hasSource = list.length > 0 && 'source' in list[0]
  const hasDept = list.length > 0 && 'dept' in list[0]
  const mAll = list.filter(c => c.date.startsWith(ym))
  // 部門統計組
  const groups = DEPTS.map(d => {
    const mine = mAll.filter(c => deptOf(c) === d)
    return {
      d,
      y: list.filter(c => deptOf(c) === d && natOf(c) === '投訴' && c.date === yesterday).length,
      inv: mine.filter(c => natOf(c) === '投訴').length,
      ab: mine.filter(c => natOf(c) === '濫訴').length,
      total: mine.length,
    }
  })
  // 排行/樓層/選題：只計 客房×投訴；選了樓層時排行跟著樓層走
  const mCore = mAll.filter(c => deptOf(c) === '客房' && natOf(c) === '投訴')
  const floorScope = floorF === '全部' ? mCore : mCore.filter(c => {
    const f = floorOf(c.room)
    return floorF === (f === null ? '無房號' : `${f}`)
  })
  const rank = catList.map(k => ({ cat: k.name, n: floorScope.filter(c => c.category === k.name).length }))
    .filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const maxN = rank[0]?.n || 1
  // 累計統計（全部月份）
  const allCore = list.filter(c => deptOf(c) === '客房' && natOf(c) === '投訴')
  const cumRank = catList.map(k => ({ cat: k.name, n: allCore.filter(c => c.category === k.name).length }))
    .filter(r => r.n > 0).sort((a, b) => b.n - a.n)
  const maxC = cumRank[0]?.n || 1
  const floorCount = {}
  for (const c of mCore) {
    const f = floorOf(c.room)
    const key = f === null ? '無房號' : `${f}`
    floorCount[key] = (floorCount[key] || 0) + 1
  }
  const floorRank = Object.entries(floorCount).sort((a, b) => b[1] - a[1])
  const maxF = floorRank[0]?.[1] || 1
  const floors = [...new Set(mAll.map(c => { const f = floorOf(c.room); return f === null ? '無房號' : `${f}` }))]
    .sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
  const monthLabel = `${ym.slice(0, 4)}年${parseInt(ym.slice(5), 10)}月`

  const searching = q.trim().length > 0
  const base = searching
    ? list.filter(c => [c.room, c.guest_comment, c.actual_cause, c.correct_standard, c.improvement, c.category].join(' ').includes(q.trim()))
    : mAll
  const isWechat = c => (c.source || '').trim().toLowerCase() === 'wechat'
  const shown = base
    .filter(c => deptF === '全部' || deptOf(c) === deptF)
    .filter(c => natureF === '全部' || natOf(c) === natureF)
    .filter(c => srcF === '全部' || (srcF === 'wechat' ? isWechat(c) : !isWechat(c)))
    .filter(c => catF === '全部' || c.category === catF)
    .filter(c => {
      if (searching || floorF === '全部') return true
      const f = floorOf(c.room)
      return floorF === (f === null ? '無房號' : `${f}`)
    })
    .slice()
    .sort((a, b) => {
      if (sortF === '最舊') return a.date.localeCompare(b.date)
      if (sortF === '房號低→高') return roomNum(a.room) - roomNum(b.room)
      if (sortF === '房號高→低') return roomNum(b.room) - roomNum(a.room)
      return b.date.localeCompare(a.date)
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
    if (hasDept) payload.dept = f.dept || '客房'
    if (hasSource) payload.source = f.source || 'wechat'
    // 規則：新記錄含「新鮮污漬/血漬」自動標濫訴
    let autoAbuse = false
    if (!f.id && payload.nature === '投訴' && FRESH_RE.test([payload.guest_comment, payload.actual_cause, payload.improvement].join(' '))) {
      payload.nature = '濫訴'
      autoAbuse = true
    }
    if (f.id) {
      await api.updateComplaint(f.id, payload)
      toast('已儲存修改')
    } else {
      const row = await api.addComplaint({ ...payload, shared: false, check_scheduled: false, recurred: false })
      if (autoAbuse) toast('內容含「新鮮污漬/血漬」，已按規則自動標為濫訴')
      else if (payload.nature === '投訴' && (payload.dept || '客房') === '客房') setAsk(row)
      else toast('已記錄（只有客房投訴會成為早會重點）')
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
          <div className="dept-wrap">
            {groups.map(g => (
              <div className="card dept-card" key={g.d}>
                <div className="dc-head">
                  {g.d === '客房' ? '🛏️ 客房' : '🔧 工程與其他'}
                  <span className="dc-total">共 {g.total} 單</span>
                </div>
                <div className="dc-stats">
                  <div><b className={g.y ? 'warn' : ''}>{g.y}</b><span>昨日投訴</span></div>
                  <div><b>{g.inv}</b><span>當月投訴</span></div>
                  <div><b style={{ color: 'var(--sub)' }}>{g.ab}</b><span>濫訴</span></div>
                </div>
              </div>
            ))}
            <div className="dept-sum">📊 {monthLabel}全部合計 <b>{mAll.length}</b> 單</div>
          </div>

          {rank.length > 0 && (
            <div className="card">
              <h2>{monthLabel}{floorF !== '全部' ? ` · ${floorF === '無房號' ? floorF : `${floorF} 樓`}` : ''}分類排行<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（只計客房投訴）</span></h2>
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
              <h2>{monthLabel}樓層分佈<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（只計客房投訴）</span></h2>
              {floorRank.map(([f, n]) => (
                <div className="bar-row" key={f}>
                  <span className="name">{f === '無房號' ? f : `${f} 樓`}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / maxF) * 100}%`, background: 'var(--accent)' }} /></div>
                  <span className="num">{n}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h2>累計統計<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（全部月份，截至目前）</span></h2>
            <p style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>
              全部 <b style={{ fontSize: 16 }}>{list.length}</b> 單 ·
              客房投訴 <b>{allCore.length}</b> ·
              濫訴 <b style={{ color: 'var(--sub)' }}>{list.filter(c => natOf(c) === '濫訴').length}</b> ·
              工程與其他 <b style={{ color: 'var(--blue)' }}>{list.filter(c => deptOf(c) === '工程其他').length}</b>
            </p>
            {cumRank.map(r => {
              const mm = m(r.cat)
              return (
                <div className="bar-row" key={r.cat}>
                  <span className="name">{mm.e} {r.cat}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.n / maxC) * 100}%`, background: mm.c }} /></div>
                  <span className="num">{r.n}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h2 style={{ margin: '2px 4px 8px' }}>
            客訴記錄
            <span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>
              （{searching ? `搜尋全部月份 · ${shown.length} 筆` : `${monthLabel} · ${shown.length} 筆`}）
            </span>
          </h2>
          <input className="search-inp" placeholder="🔍 搜尋房號或內容（跨全部月份）" value={q} onChange={e => setQ(e.target.value)} />
          <div className="chips">
            {['全部', ...DEPTS].map(d => (
              <button key={d} className={`chip ${deptF === d ? 'on' : ''}`} onClick={() => setDeptF(d)}>{d === '工程其他' ? '🔧 工程與其他' : d === '客房' ? '🛏️ 客房' : d}</button>
            ))}
            {NATURES.map(n => (
              <button key={n} className={`chip ${natureF === n ? 'on' : ''}`} onClick={() => setNatureF(natureF === n ? '全部' : n)}>{n}</button>
            ))}
            {hasSource && ['wechat', '其它'].map(s => (
              <button key={s} className={`chip ${srcF === s ? 'on' : ''}`} onClick={() => setSrcF(srcF === s ? '全部' : s)}>{s === 'wechat' ? '💬 wechat' : '📋 其它來源'}</button>
            ))}
          </div>
          <div className="chips">
            <button className={`chip ${catF === '全部' ? 'on' : ''}`} onClick={() => setCatF('全部')}>全部分類</button>
            {catList.map(k => (
              <button key={k.name} className={`chip ${catF === k.name ? 'on' : ''}`} onClick={() => setCatF(k.name)}>{k.emoji} {k.name}</button>
            ))}
          </div>
          {!searching && floors.length > 1 && (
            <div className="chips">
              <button className={`chip ${floorF === '全部' ? 'on' : ''}`} onClick={() => setFloorF('全部')}>全部樓層</button>
              {floors.map(f => (
                <button key={f} className={`chip ${floorF === f ? 'on' : ''}`} onClick={() => setFloorF(f)}>{f === '無房號' ? f : `${f} 樓`}</button>
              ))}
            </div>
          )}
          <div className="chips">
            {['最新', '最舊', '房號低→高', '房號高→低'].map(s => (
              <button key={s} className={`chip ${sortF === s ? 'on' : ''}`} onClick={() => setSortF(s)}>
                {s.startsWith('房號') ? `🚪 ${s}` : `🕐 ${s}`}
              </button>
            ))}
          </div>
          {shown.length === 0 && <div className="note">{searching ? '搜尋不到相關記錄' : `${monthLabel}沒有符合篩選的記錄`}</div>}
          {shown.map(c => {
            const mm = m(c.category)
            const eng = deptOf(c) === '工程其他'
            const abuse = natOf(c) === '濫訴'
            return (
              <div className="c-item" key={c.id} style={abuse ? { opacity: .8 } : undefined}>
                <div className="c-head" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <span className="badge" style={{ background: mm.s, color: mm.c }}>{mm.e} {c.category}</span>
                  {eng && <span className="badge b-blue">🔧 工程</span>}
                  {abuse && <span className="badge b-gray">🚫 濫訴</span>}
                  <span className="room">{c.room}</span>
                  <span className="desc">{c.guest_comment}</span>
                  {c.photos?.length > 0 && <span className="ph-count">📷{c.photos.length}</span>}
                  <span style={{ fontSize: 11, color: 'var(--sub)' }}>{searching ? c.date : c.date.slice(5)}</span>
                </div>
                {open === c.id && (
                  <div className="c-body">
                    <div className="kv"><span className="k">客人反映</span><span className="v">{c.guest_comment}</span></div>
                    {hasSource && <div className="kv"><span className="k">來源</span><span className="v">{c.source || '—'}</span></div>}
                    <div className="kv"><span className="k">實際原因</span><span className="v">{c.actual_cause || '—'}</span></div>
                    <div className="kv"><span className="k">正確標準</span><span className="v">{c.correct_standard || '—'}</span></div>
                    <div className="kv"><span className="k">改善措施</span><span className="v">{c.improvement || '—'}</span></div>
                    <PhotoGrid photos={c.photos} />
                    {hasDept && (
                      <div className="seg">
                        {DEPTS.map(d => (
                          <button key={d} className={`chip ${deptOf(c) === d ? 'on' : ''}`}
                            onClick={() => deptOf(c) !== d && patch(c, { dept: d })}>{DEPT_LABEL(d)}</button>
                        ))}
                      </div>
                    )}
                    <div className="seg">
                      {NATURES.map(n => (
                        <button key={n} className={`chip ${natOf(c) === n ? 'on' : ''}`}
                          onClick={() => natOf(c) !== n && patch(c, { nature: n })}>{n}</button>
                      ))}
                    </div>
                    <button className={`toggle-row ${c.shared ? 'on' : ''}`} onClick={() => patch(c, { shared: !c.shared })}>
                      📣 已於早會分享<span className="tg-state">{c.shared ? '✓ 是' : '未'}</span>
                    </button>
                    <button className={`toggle-row ${c.check_scheduled ? 'on' : ''}`} onClick={() => patch(c, { check_scheduled: !c.check_scheduled })}>
                      👁 已排主管重點檢查<span className="tg-state">{c.check_scheduled ? '✓ 是' : '未'}</span>
                    </button>
                    {deptOf(c) === '客房' && natOf(c) === '投訴' && (
                      <button className="toggle-row" onClick={async () => {
                        await api.setFocus({ focus_date: addDaysStr(1), source: 'complaint', complaint_id: c.id, topic_id: null })
                        toast('已設為明日早會重點')
                      }}>📌 設為明日早會重點<span className="tg-state">›</span></button>
                    )}
                    <div className="row-actions">
                      <button className="mini-btn edit" onClick={() => setForm({ ...EMPTY, ...c, dept: deptOf(c), nature: natOf(c) })}>✏️ 編輯</button>
                      <button className="mini-btn del" onClick={() => setConfirmDel(c)}>🗑 刪除</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div className="note">排行、樓層與早會選題只計「客房 × 投訴」；濫訴與工程另計數量作參考</div>
        </div>
      </div>

      <button className="fab" onClick={() => setForm({ ...EMPTY, date: today, category: catList[0]?.name || '' })}>＋</button>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯客訴記錄' : '新增客訴記錄'}</h2>
            {hasDept && (
              <div className="f-row">
                <label>部門</label>
                <div className="seg" style={{ marginTop: 0 }}>
                  {DEPTS.map(d => (
                    <button key={d} className={`chip ${form.dept === d ? 'on' : ''}`}
                      onClick={() => setForm({ ...form, dept: d })}>{d}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="f-row">
              <label>性質</label>
              <div className="seg" style={{ marginTop: 0 }}>
                {NATURES.map(n => (
                  <button key={n} className={`chip ${form.nature === n ? 'on' : ''}`}
                    onClick={() => setForm({ ...form, nature: n })}>{n === '投訴' ? '✓ 投訴（真實問題）' : '🚫 濫訴（不合理）'}</button>
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
