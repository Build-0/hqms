import { useState, useEffect } from 'react'
import * as api from '../lib/api'
import { CLEANING_SEED } from '../data/seedData'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import Confirm from '../components/Confirm'

const SECTIONS = [
  { key: 'daily', icon: '🧹', title: '每日清潔', sub: '提醒', color: '#1f7a6d', hint: '除日常標準外，每天都要做到：' },
  { key: 'cycle', icon: '📅', title: '循環清潔', sub: '月曆排程', color: '#4a6fa5', hint: null },
  { key: 'deep', icon: '🧽', title: '深度清潔', sub: '長週期', color: '#8f7ac9', hint: '週期較長的深度項目：' },
]

export default function CyclicClean() {
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')
  const [sub, setSub] = useState(null)     // null=三圓入口；'daily'|'cycle'|'deep'
  const [form, setForm] = useState(null)   // {id?, section, day, grp, text, wrong}
  const [confirmDel, setConfirmDel] = useState(null)

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
    if (!payload.text) { toast('請填內容'); return }
    if (f.section === 'cycle' && (!payload.day || payload.day < 1 || payload.day > 31)) { toast('日期請填 1–31'); return }
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

  // 每日/深度：同名分組聚合顯示，「以上錯誤做法」只顯示一次
  function renderGrouped(rows) {
    const groups = []
    for (const r of rows) {
      const g = (r.grp || '').trim()
      const last = groups[groups.length - 1]
      if (last && last.g === g && g) last.items.push(r)
      else groups.push({ g, items: [r] })
    }
    return groups.map((gr, gi) => {
      if (gr.g) {
        const wrongs = [...new Set(gr.items.map(r => (r.wrong || '').trim()).filter(Boolean))]
        return (
          <div key={gi} style={{ marginBottom: 12 }}>
            <div className="cl-grp-title">{gr.g}：</div>
            {gr.items.map(r => (
              <button className="cl-row" key={r.id} onClick={() => openEdit(r)}>
                <div className="cl-main"><span>{r.text}</span></div>
              </button>
            ))}
            {wrongs.length > 0 && <div className="cl-wrong" style={{ margin: '2px 4px 0' }}>✗ 以上錯誤做法：{wrongs.join('、')}</div>}
          </div>
        )
      }
      return gr.items.map(r => (
        <button className="cl-row" key={r.id} onClick={() => openEdit(r)}>
          <div className="cl-main"><span>{r.text}</span></div>
          {r.wrong && <div className="cl-wrong">✗ 錯誤做法：{r.wrong}</div>}
        </button>
      ))
    })
  }

  function openEdit(r) {
    setForm({ ...r, day: r.day == null ? '' : String(r.day), grp: r.grp || '' })
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
              <span className="hi-circle sm" style={{ background: s.color + '1a', borderColor: s.color + '55' }}>{s.icon}</span>
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
      <button className="linky" style={{ fontSize: 13.5, margin: '0 0 8px', padding: 0 }} onClick={() => setSub(null)}>‹ 加強清潔</button>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{sec.icon} {sec.title}{sec.key === 'daily' && '（提醒）'}</h2>
          <button className="linky" style={{ fontSize: 13 }}
            onClick={() => setForm({ section: sub, day: sub === 'cycle' ? String(todayD) : null, grp: '', text: '', wrong: '' })}>＋ 新增</button>
        </div>
        {sec.hint && <p className="src-note">{sec.hint}</p>}

        {sub === 'cycle' && (
          <>
            {todayTasks.length > 0 && (
              <div className="quote" style={{ marginTop: 0, marginBottom: 10 }}>
                今日（{todayD} 日）加強：{todayTasks.map(t => t.text).join('、')}
              </div>
            )}
            <div className="cal">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <div key={d} className={`cal-d ${daysWith.has(d) ? 'has' : ''} ${d === todayD ? 'today' : ''}`}>{d}</div>
              ))}
            </div>
          </>
        )}

        {rows.length === 0 && <div className="note" style={{ margin: '6px 0' }}>尚無項目，按右上「＋ 新增」</div>}
        {sub === 'cycle'
          ? rows.map(r => (
            <button className="cl-row" key={r.id} onClick={() => openEdit(r)}>
              <div className="cl-main">
                <span className="cl-day">{r.day} 日</span>
                <span>{r.text}</span>
              </div>
            </button>
          ))
          : renderGrouped(rows)}

        {sub === 'cycle' && (
          <p className="note" style={{ textAlign: 'left', margin: '10px 2px 0' }}>
            ⚠️ 所有清潔並非到指定日才清潔——此排程只是說明：指定日期要「加強」該區域的清潔。
          </p>
        )}
      </div>

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯項目' : '新增項目'}（{sec.title}）</h2>
            {form.section === 'cycle' && (
              <div className="f-row">
                <label>每月幾號加強（1–31）</label>
                <input type="number" min="1" max="31" value={form.day || ''} onChange={e => setForm({ ...form, day: e.target.value })} />
              </div>
            )}
            {form.section !== 'cycle' && hasGrp() && (
              <div className="f-row">
                <label>分組（可留空；同分組的項目會列在同一標題下）</label>
                <input value={form.grp || ''} onChange={e => setForm({ ...form, grp: e.target.value })} placeholder="例：抹塵" />
              </div>
            )}
            <div className="f-row">
              <label>內容</label>
              <textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="例：浴缸邊全面除漬" />
            </div>
            {form.section !== 'cycle' && (
              <div className="f-row">
                <label>錯誤做法（可留空；同分組會合併為「以上錯誤做法」）</label>
                <input value={form.wrong || ''} onChange={e => setForm({ ...form, wrong: e.target.value })} placeholder="例：不抹" />
              </div>
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
