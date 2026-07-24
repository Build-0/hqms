import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { CATS, seedTopics } from '../data/seedData'
import { catMeta } from '../lib/cats'
import { addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'

const EMPTY = { category: '', title: '', why: '', correct_steps: [], mistakes: [], supervisor_check: '', reminder: '', question: '', answer: '', photos: [] }

export default function Topics() {
  const [topics, setTopics] = useState(null)
  const [cat, setCat] = useState('客房清潔')
  const [view, setView] = useState(null)   // 檢視中的主題
  const [showA, setShowA] = useState(false)
  const [form, setForm] = useState(null)   // 編輯/新增表單
  const [armed, setArmed] = useState(false)

  useEffect(() => { load() }, [])
  async function load() { setTopics(await api.listTopics()) }

  if (!topics) return <div className="note">載入中…</div>
  const inCat = topics.filter(t => t.category === cat)

  async function importSeed() {
    await api.importSeedTopics(seedTopics.map((t, i) => ({ ...t, sort_order: i })))
    toast(`已匯入 ${seedTopics.length} 個預設主題`)
    load()
  }

  async function save() {
    const f = form
    const payload = {
      category: f.category || cat,
      title: f.title.trim() || '（未命名主題）',
      why: f.why.trim(),
      correct_steps: f._ok.split('\n').map(s => s.trim()).filter(Boolean),
      mistakes: f._bad.split('\n').map(s => s.trim()).filter(Boolean),
      supervisor_check: f.supervisor_check.trim(),
      reminder: f.reminder.trim(),
      question: f.question.trim(),
      answer: f.answer.trim(),
      photos: f.photos || [],
    }
    if (f.id) {
      await api.updateTopic(f.id, payload)
      toast('已儲存修改')
    } else {
      await api.addTopic(payload)
      setCat(payload.category)
      toast('已新增主題')
    }
    setForm(null); setView(null)
    load()
  }

  async function del() {
    if (!armed) { setArmed(true); return }
    await api.deleteTopic(view.id)
    setArmed(false); setView(null)
    toast('已刪除主題')
    load()
  }

  async function setTomorrow(t) {
    await api.setFocus({ focus_date: addDaysStr(1), source: 'topic', topic_id: t.id, complaint_id: null })
    setView(null)
    toast(`已設為明日早會重點：${t.title}`)
  }

  function openEdit(t) {
    setForm(t
      ? { ...t, _ok: (t.correct_steps || []).join('\n'), _bad: (t.mistakes || []).join('\n') }
      : { ...EMPTY, category: cat, _ok: '', _bad: '' })
    setView(null)
  }

  const F = (label, key, Type = 'input', props = {}) => (
    <div className="f-row">
      <label>{label}</label>
      {Type === 'textarea'
        ? <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />
        : <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />}
    </div>
  )

  const vm = view ? catMeta(view.category) : null

  return (
    <>
      <div className="chips">
        {CATS.map(c => (
          <button key={c} className={`chip ${c === cat ? 'on' : ''}`} onClick={() => setCat(c)}>
            {catMeta(c).e} {c}<span style={{ opacity: .6 }}> {topics.filter(t => t.category === c).length}</span>
          </button>
        ))}
      </div>

      {topics.length === 0 && (
        <button className="add-topic" style={{ marginBottom: 8 }} onClick={importSeed}>⬇ 匯入 {seedTopics.length} 個預設主題</button>
      )}
      <div className="t-grid">
        {inCat.map(t => {
          const m = catMeta(t.category)
          return (
            <div className="t-item" key={t.id} onClick={() => { setView(t); setShowA(false); setArmed(false) }}>
              <div className="t-ico" style={{ background: m.s }}>{m.e}</div>
              <div className="t-mid">
                <div className="tt">{t.title}</div>
                {t.question && <div className="q-prev">🎤 {t.question}</div>}
              </div>
              <span className="arrow">›</span>
            </div>
          )
        })}
      </div>
      <button className="add-topic" onClick={() => openEdit(null)}>＋ 新增主題</button>
      <div className="note">主題持續累積，形成酒店專屬品質知識庫</div>

      {view && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="badge" style={{ background: vm.s, color: vm.c }}>{vm.e} {view.category}</span>
              <span style={{ fontSize: 12, color: 'var(--sub)', cursor: 'pointer', padding: '4px 8px' }} onClick={() => setView(null)}>✕ 關閉</span>
            </div>
            <h2 style={{ fontSize: 17 }}>{view.title}</h2>
            <div className="sec">
              {view.why && <p className="lead" style={{ marginTop: 4 }}>{view.why}</p>}
              <PhotoGrid photos={view.photos} />
              <div className="okbad">
                {view.correct_steps?.length > 0 && (
                  <div className="panel good">
                    <div className="p-title">✓ 正確做法</div>
                    {view.correct_steps.map((x, i) => <div className="step" key={i}><span className="n">{i + 1}</span>{x}</div>)}
                  </div>
                )}
                {view.mistakes?.length > 0 && (
                  <div className="panel badp">
                    <div className="p-title">✗ 常見錯誤</div>
                    {view.mistakes.map((x, i) => <div className="bad-item" key={i}><span className="x">✗</span>{x}</div>)}
                  </div>
                )}
              </div>
              {view.supervisor_check && (
                <div className="panel checkp">
                  <div className="p-title">👁 主管重點檢查</div>
                  <div className="check-item"><span className="dot">✓</span>{view.supervisor_check}</div>
                </div>
              )}
              {view.reminder && <div className="quote">{view.reminder}</div>}
              {view.question && (
                <div className="qa">
                  <div className="q-emoji">🎤</div>
                  <div style={{ flex: 1 }}>
                    <div className="q-label">早會提問</div>
                    <div className="q-text">問：{view.question}</div>
                    {showA
                      ? <div className="a-text"><b>答：</b>{view.answer || '（未設定）'}</div>
                      : <button className="a-btn" onClick={() => setShowA(true)}>顯示答案</button>}
                  </div>
                </div>
              )}
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setTomorrow(view)}>📌 設為明日早會重點</button>
            <div className="row-actions">
              <button className="done-btn" style={{ margin: 0 }} onClick={() => openEdit(view)}>✏️ 編輯</button>
              <button className="btn danger" style={{ margin: 0, width: 'auto', flex: 1 }} onClick={del}>
                {armed ? '再按一次確定刪除' : '🗑 刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal">
          <div className="sheet">
            <h2>{form.id ? '編輯主題' : '新增主題'}</h2>
            <div className="f-row">
              <label>分類</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {F('主題名稱', 'title')}
            {F('為什麼重要', 'why', 'textarea')}
            {F('正確做法（每行一項）', '_ok', 'textarea', { style: { height: 80 } })}
            {F('常見錯誤（每行一項）', '_bad', 'textarea')}
            {F('主管重點檢查', 'supervisor_check')}
            {F('一句提醒', 'reminder')}
            {F('早會提問', 'question', 'input', { placeholder: '用嚟抽問同事、加強記憶' })}
            {F('提問答案', 'answer')}
            <PhotoField label="示範相片（正確做法）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} />
            <button className="btn" onClick={save}>儲存主題</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}
    </>
  )
}
