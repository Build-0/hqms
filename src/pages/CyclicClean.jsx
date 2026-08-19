import { useState, useEffect } from 'react'
import * as api from '../lib/api'
import { CLEANING_SEED } from '../data/seedData'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import Confirm from '../components/Confirm'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Icon from '../components/Icon'

const SECTIONS = [
  { key: 'daily', icon: 'sun', title: '每日清潔', sub: '每天的習慣', color: '#1f7a6d' },
  { key: 'spot', icon: 'search', title: '常見錯誤／衛生點', sub: '相片對照', color: '#c0564f', hint: '以相片為主，記住這些容易漏或做錯的位置：' },
  { key: 'cycle', icon: 'calendar', title: '循環清潔', sub: '月曆排程', color: '#4a6fa5', hint: null },
  { key: 'deep', icon: 'drop', title: '深度清潔', sub: '長週期', color: '#8f7ac9', hint: '週期較長的深度項目：' },
]

export default function CyclicClean() {
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')
  const [sub, setSub] = useState(null)     // null=三圓入口；'daily'|'cycle'|'deep'
  const [form, setForm] = useState(null)   // {id?, section, day, grp, text, wrong}
  const [daySheet, setDaySheet] = useState(null) // 月曆點中的日期
  const [confirmDel, setConfirmDel] = useState(null)
  const [big, setBig] = useState(null)     // 放大檢視的相片

  useEffect(() => { load() }, [])
  async function load() {
    try {
      setItems(await api.listCleaning())
      setErr('')
    } catch (ex) {
      setErr(ex.message)
      setItems([])
    }
  }

  if (!items) return <div className="note">載入中…</div>

  const bySection = key => items.filter(i => i.section === key)
  const cycle = bySection('cycle').slice().sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
  const todayD = parseInt(todayStr().slice(8), 10)
  const daysWith = new Set(cycle.map(c => c.day))
  const todayTasks = cycle.filter(c => c.day === todayD)

  async function importSeed() {
    const rows = CLEANING_SEED.map((c, i) => ({ day: null, grp: '', wrong: '', ...c, sort_order: i }))
    try {
      await api.importSeedCleaning(rows)
    } catch {
      // grp 欄未建立時退回無分組匯入
      await api.importSeedCleaning(rows.map(({ grp, ...r }) => r))
      toast('提醒：執行 add-dept-cleaning.sql 最新版可啟用分組顯示')
    }
    toast(`已匯入 ${CLEANING_SEED.length} 個預設項目`)
    load()
  }

  async function save() {
    const f = form
    const payload = {
      section: f.section,
      text: f.text.trim(),
      wrong: (f.wrong || '').trim(),
      day: f.section === 'cycle' ? (parseInt(f.day, 10) || null) : null,
    }
    if (hasGrp()) payload.grp = (f.grp || '').trim()
    if (hasArea()) payload.area = (f.area || '').trim()
    if (hasPhotos()) payload.photos = f.photos || []
    if (hasPhotosWrong()) payload.photos_wrong = f.photos_wrong || []
    if (!payload.text) { toast('請填內容'); return }
    // 循環清潔：填了日期就綁該日；留空＝後勤/不定期項（黃字顯示）
    if (f.section === 'cycle' && (!payload.day || payload.day < 1 || payload.day > 31)) { toast('請填每月幾號（1–31）'); return }
    if (f.id) {
      await api.updateCleaning(f.id, payload)
      toast('已儲存修改')
    } else {
      await api.addCleaning({ ...payload, sort_order: items.length })
      toast('已新增項目')
    }
    setForm(null)
    load()
  }

  function hasGrp() {
    return items.length === 0 || 'grp' in items[0]
  }
  function hasPhotos() {
    return items.length === 0 || 'photos' in items[0]
  }
  function hasPhotosWrong() {
    return items.length === 0 || 'photos_wrong' in items[0]
  }
  function hasArea() {
    return items.length === 0 || 'area' in items[0]
  }
  const AREAS = ['房間', '浴室']
  const areaMeta = a => (a === '浴室' ? { e: '🚿', cls: 'bath' } : { e: '🛏️', cls: 'room' })

  // 照片格：遠+近；空則佔位。點圖放大（不觸發編輯）
  const photoCells = arr => {
    const a = arr || []
    if (!a.length) return <div className="da-ph empty">📷 待補圖（遠＋近）</div>
    return a.slice(0, 4).map((p, i) => (
      <img className="da-ph" key={i} src={p} alt="" loading="lazy"
        onClick={e => { e.stopPropagation(); setBig(p) }} />
    ))
  }
  // A 版緊湊卡：標題 + 正確(遠近) + 錯誤(遠近)
  const cardA = r => (
    <div className="da-card" key={r.id} onClick={() => openEdit(r)}>
      <div className="da-ttl">{r.text}</div>
      <div className="da-block ok">
        <div className="da-lab">✓ 正確做法</div>
        <div className="da-duo">{photoCells(r.photos)}</div>
      </div>
      <div className="da-block no">
        <div className="da-lab">✗ 錯誤做法{r.wrong ? `：${r.wrong}` : ''}</div>
        <div className="da-duo">{photoCells(r.photos_wrong)}</div>
      </div>
    </div>
  )

  // 每日清潔：類別(grp)優先橫幅 → 房間/浴室分區 → A卡
  function renderDaily(rows) {
    const cats = []
    for (const r of rows) {
      const g = (r.grp || '其他').trim() || '其他'
      let c = cats.find(x => x.g === g)
      if (!c) { c = { g, items: [] }; cats.push(c) }
      c.items.push(r)
    }
    return cats.map((cat, ci) => {
      const areas = hasArea()
        ? [...AREAS, '其他'].map(a => ({ a, items: cat.items.filter(r => (r.area || '其他') === a) })).filter(x => x.items.length)
        : [{ a: '', items: cat.items }]
      return (
        <div key={ci}>
          <div className="da-prio">
            <span className="da-rank">每日最高優先</span>
            <h3>{cat.g}</h3>
            <p>每天必做。看不見的塵，客人一摸就知道。</p>
          </div>
          {areas.map((ar, ai) => {
            const m = ar.a ? areaMeta(ar.a) : null
            return (
              <div key={ai}>
                {ar.a && (
                  <div className={`area ${m.cls}`} style={{ margin: '14px 2px 10px' }}>
                    <span className="dot">{m.e}</span><span className="nm">{ar.a}區域</span>
                    <span className="ct">{ar.items.length} 個位置</span>
                  </div>
                )}
                <div className="da-cards">{ar.items.map(cardA)}</div>
              </div>
            )
          })}
        </div>
      )
    })
  }

  // 常見錯誤／深度：grp 分組 → A卡
  function renderGrouped(rows) {
    const groups = []
    for (const r of rows) {
      const g = (r.grp || '').trim()
      const last = groups[groups.length - 1]
      if (last && last.g === g && g) last.items.push(r)
      else groups.push({ g, items: [r] })
    }
    return groups.map((gr, gi) => (
      <div key={gi} style={{ marginBottom: 14 }}>
        {gr.g && <div className="cl-grp-title">{gr.g}</div>}
        <div className="da-cards">{gr.items.map(cardA)}</div>
      </div>
    ))
  }

  function openEdit(r) {
    setForm({ ...r, day: r.day == null ? '' : String(r.day), grp: r.grp || '', area: r.area || '', photos: r.photos || [], photos_wrong: r.photos_wrong || [] })
  }

  // ── 三圓入口 ──
  if (!sub) {
    return (
      <>
        {err && (
          <div className="card" style={{ borderColor: 'var(--red)' }}>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>
              讀取失敗：{err}<br />請先在 Supabase SQL Editor 執行 <b>supabase/add-dept-cleaning.sql</b>。
            </p>
          </div>
        )}
        <div className="home-grid sub-grid">
          {SECTIONS.map(s => (
            <button className="home-item" key={s.key} onClick={() => setSub(s.key)}>
              <span className="hi-circle sm" style={{ background: s.color + '26', borderColor: 'transparent' }}><Icon name={s.icon} size={28} color={s.color} width={2.2} /></span>
              <span className="hi-label">{s.title}</span>
              <span className="hi-sub">{s.sub} · {bySection(s.key).length} 項</span>
            </button>
          ))}
        </div>
        {!err && items.length === 0 && (
          <button className="add-topic" onClick={importSeed}>⬇ 匯入預設項目</button>
        )}
        {todayTasks.length > 0 && (
          <div className="quote" style={{ marginTop: 14 }}>
            📅 今日（{todayD} 日）循環加強：{todayTasks.map(t => t.text).join('、')}
          </div>
        )}
      </>
    )
  }

  // ── 分區內頁 ──
  const sec = SECTIONS.find(s => s.key === sub)
  const rows = sub === 'cycle' ? cycle : bySection(sub)
  return (
    <>
      <button className="linky" style={{ fontSize: 13.5, margin: '0 0 8px', padding: 0 }} onClick={() => setSub(null)}>‹ 衛生與整潔</button>
      {sub === 'daily' && (
        <div className="daily-banner">💡 這不是每週或每月的深度清潔項目，而是<b>每天需要做到的「習慣」</b>。</div>
      )}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name={sec.icon} size={18} color={sec.color} /> {sec.title}</h2>
          <button className="linky" style={{ fontSize: 13 }}
            onClick={() => setForm({ section: sub, day: sub === 'cycle' ? String(todayD) : null, grp: sub === 'daily' ? '抹塵' : '', area: sub === 'daily' ? '房間' : '', text: '', wrong: '', photos: [], photos_wrong: [] })}>＋ 新增</button>
        </div>
        {sec.hint && <p className="src-note">{sec.hint}</p>}

        {sub === 'cycle' && (
          <>
            {todayTasks.length > 0 && (
              <div className="quote" style={{ marginTop: 0, marginBottom: 10 }}>
                今日（{todayD} 日）加強：{todayTasks.map(t => t.text).join('、')}
              </div>
            )}
            <div className="cal cal-full">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                const reg = cycle.filter(c => c.day === d && c.grp !== '後勤')
                const logi = cycle.filter(c => c.day === d && c.grp === '後勤')
                return (
                  <button key={d} className={`cal-d ${reg.length || logi.length ? 'has' : ''} ${d === todayD ? 'today' : ''}`}
                    onClick={() => setDaySheet(d)}>
                    <span className="dnum">{d}</span>
                    {reg.length > 0 && <span className="dtask">{reg.map(t => t.text).join('・')}</span>}
                    {logi.length > 0 && <span className="dtask logi">{logi.map(t => t.text).join('・')}</span>}
                  </button>
                )
              })}
            </div>
            <p className="note" style={{ textAlign: 'left', margin: '10px 2px 0' }}>
              ⚠️ 所有清潔並非到指定日才清潔——此排程只是說明：指定日期要「加強」該區域的清潔。點日期格可查看／編輯／新增該日項目。
              <br /><b style={{ color: 'var(--ink)' }}>主管有權利根據實際情況調整。</b>
            </p>
          </>
        )}

        {sub !== 'cycle' && rows.length === 0 && <div className="note" style={{ margin: '6px 0' }}>尚無項目，按右上「＋ 新增」</div>}
        {sub === 'daily' && renderDaily(rows)}
        {(sub === 'spot' || sub === 'deep') && renderGrouped(rows)}
      </div>

      {big && (
        <div className="lightbox" onClick={() => setBig(null)}><img src={big} alt="" /></div>
      )}

      {daySheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setDaySheet(null) }}>
          <div className="sheet">
            <h2>{daySheet} 日的加強項目</h2>
            {cycle.filter(c => c.day === daySheet).map(r => (
              <button className="cl-row" key={r.id} onClick={() => { setDaySheet(null); openEdit(r) }}
                style={r.grp === '後勤' ? { borderColor: '#f0dca8', background: '#fff5e0' } : undefined}>
                <div className="cl-main"><span style={r.grp === '後勤' ? { color: '#b7791f', fontWeight: 700 } : undefined}>{r.grp === '後勤' ? '🟡 ' : ''}{r.text}</span></div>
              </button>
            ))}
            {cycle.filter(c => c.day === daySheet).length === 0 && <div className="note" style={{ margin: '4px 0 10px' }}>此日尚無加強項目</div>}
            <button className="btn" onClick={() => { const d = daySheet; setDaySheet(null); setForm({ section: 'cycle', day: String(d), grp: '', text: '', wrong: '' }) }}>＋ 新增此日項目</button>
            <button className="btn ghost" onClick={() => setDaySheet(null)}>關閉</button>
          </div>
        </div>
      )}

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯項目' : '新增項目'}（{sec.title}）</h2>
            {form.section === 'cycle' && (
              <>
                <div className="f-row">
                  <label>類型</label>
                  <div className="seg" style={{ marginTop: 0 }}>
                    <button className={`chip ${form.grp !== '後勤' ? 'on' : ''}`} onClick={() => setForm({ ...form, grp: '' })}>🟢 一般清潔</button>
                    <button className={`chip ${form.grp === '後勤' ? 'on' : ''}`} onClick={() => setForm({ ...form, grp: '後勤' })} style={form.grp === '後勤' ? { background: '#b7791f', borderColor: '#b7791f' } : undefined}>🟡 後勤工作</button>
                  </div>
                </div>
                <div className="f-row">
                  <label>每月幾號（1–31）</label>
                  <input type="number" min="1" max="31" value={form.day || ''} onChange={e => setForm({ ...form, day: e.target.value })} placeholder="例：1" />
                </div>
              </>
            )}
            {form.section === 'daily' && hasArea() && (
              <div className="f-row">
                <label>區域</label>
                <div className="seg" style={{ marginTop: 0 }}>
                  {AREAS.map(a => {
                    const m = areaMeta(a)
                    return <button key={a} className={`chip ${form.area === a ? 'on' : ''}`} onClick={() => setForm({ ...form, area: a })}>{m.e} {a}</button>
                  })}
                </div>
              </div>
            )}
            {form.section !== 'cycle' && hasGrp() && (
              <div className="f-row">
                <label>{form.section === 'daily' ? '類別（例：抹塵）' : '分組（可留空；同分組的項目會列在同一標題下）'}</label>
                <input value={form.grp || ''} onChange={e => setForm({ ...form, grp: e.target.value })} placeholder="例：抹塵" />
              </div>
            )}
            <div className="f-row">
              <label>內容（做法說明）</label>
              <textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="例：拖鞋位置區域、衣櫃抽屜要抹塵" />
            </div>
            {form.section !== 'cycle' && (
              <div className="f-row">
                <label>錯誤做法（可留空）</label>
                <input value={form.wrong || ''} onChange={e => setForm({ ...form, wrong: e.target.value })} placeholder="例：不抹" />
              </div>
            )}
            {form.section !== 'cycle' && hasPhotos() && (
              <PhotoField label="✓ 正確做法相片（遠景＋近景，可放 GIF）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} max={4} />
            )}
            {form.section !== 'cycle' && hasPhotosWrong() && (
              <PhotoField label="✗ 錯誤做法相片（遠景＋近景，對照用）" photos={form.photos_wrong} onChange={p => setForm({ ...form, photos_wrong: p })} max={4} />
            )}
            <button className="btn" onClick={save}>儲存</button>
            {form.id && <button className="btn danger" onClick={() => setConfirmDel(form)}>🗑 刪除此項目</button>}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {confirmDel && (
        <Confirm
          text={`項目「${confirmDel.text}」會被永久刪除。`}
          onConfirm={async () => { await api.deleteCleaning(confirmDel.id); setConfirmDel(null); setForm(null); toast('已刪除項目'); load() }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  )
}
