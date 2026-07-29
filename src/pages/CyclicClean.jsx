import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { CLEANING_SEED } from '../data/seedData'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/toast'
import Confirm from '../components/Confirm'

const SECTIONS = [
  { key: 'daily', icon: '🧹', title: '每日清潔（提醒）', hint: '除日常標準外，每天都要做到：' },
  { key: 'cycle', icon: '📅', title: '循環清潔', hint: null },
  { key: 'deep', icon: '🧽', title: '深度清潔', hint: '週期較長的深度項目：' },
]

export default function CyclicClean() {
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null)   // {id?, section, day, text, wrong}
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
    await api.importSeedCleaning(CLEANING_SEED.map((c, i) => ({ day: null, wrong: '', ...c, sort_order: i })))
    toast(`已匯入 ${CLEANING_SEED.length} 個預設項目`)
    load()
  }

  async function save() {
    const f = form
    const payload = { section: f.section, text: f.text.trim(), wrong: (f.wrong || '').trim(), day: f.section === 'cycle' ? (parseInt(f.day, 10) || null) : null }
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

  return (
    <>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>
            讀取失敗：{err}<br />若是資料表不存在，請先在 Supabase SQL Editor 執行 <b>supabase/add-dept-cleaning.sql</b>。
          </p>
        </div>
      )}
      {!err && items.length === 0 && (
        <button className="add-topic" style={{ marginBottom: 10 }} onClick={importSeed}>⬇ 匯入預設項目</button>
      )}

      {!err && SECTIONS.map(sec => {
        const rows = sec.key === 'cycle' ? cycle : bySection(sec.key)
        return (
          <div className="card" key={sec.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>{sec.icon} {sec.title}</h2>
              <button className="linky" style={{ fontSize: 13 }}
                onClick={() => setForm({ section: sec.key, day: sec.key === 'cycle' ? String(todayD) : null, text: '', wrong: '' })}>＋ 新增</button>
            </div>
            {sec.hint && <p className="src-note">{sec.hint}</p>}

            {sec.key === 'cycle' && (
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
            {rows.map(r => (
              <button className="cl-row" key={r.id} onClick={() => setForm({ ...r, day: r.day == null ? '' : String(r.day) })}>
                <div className="cl-main">
                  {sec.key === 'cycle' && <span className="cl-day">{r.day} 日</span>}
                  <span>{r.text}</span>
                </div>
                {r.wrong && <div className="cl-wrong">✗ 錯誤做法：{r.wrong}</div>}
              </button>
            ))}

            {sec.key === 'cycle' && (
              <p className="note" style={{ textAlign: 'left', margin: '10px 2px 0' }}>
                ⚠️ 所有清潔並非到指定日才清潔——此排程只是說明：指定日期要「加強」該區域的清潔。
              </p>
            )}
          </div>
        )
      })}

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯項目' : '新增項目'}（{SECTIONS.find(s => s.key === form.section)?.title}）</h2>
            {form.section === 'cycle' && (
              <div className="f-row">
                <label>每月幾號加強（1–31）</label>
                <input type="number" min="1" max="31" value={form.day || ''} onChange={e => setForm({ ...form, day: e.target.value })} />
              </div>
            )}
            <div className="f-row">
              <label>內容</label>
              <textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="例：浴缸邊全面除漬" />
            </div>
            {form.section !== 'cycle' && (
              <div className="f-row">
                <label>錯誤做法（可留空）</label>
                <input value={form.wrong || ''} onChange={e => setForm({ ...form, wrong: e.target.value })} placeholder="例：不抹／原封不動只抹週邊" />
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
