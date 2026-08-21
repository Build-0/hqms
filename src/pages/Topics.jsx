import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { DEFAULT_CATEGORIES, seedTopics } from '../data/seedData'
import { metaOf, COLOR_CHOICES } from '../lib/cats'
import { addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'

const EMPTY = { category: '', title: '', why: '', correct_steps: [], mistakes: [], supervisor_check: '', reminder: '', question: '', answer: '', photos: [] }

export default function Topics() {
  const [topics, setTopics] = useState(null)
  const [cats, setCats] = useState(null)
  const [cat, setCat] = useState('')
  const [view, setView] = useState(null)     // 檢視中的主題
  const [showA, setShowA] = useState(false)
  const [form, setForm] = useState(null)     // 主題編輯表單
  const [confirmDel, setConfirmDel] = useState(null)     // 待確認刪除的主題
  const [confirmDelCat, setConfirmDelCat] = useState(null) // 待確認刪除的分類
  const [mgr, setMgr] = useState(false)      // 分類管理面板
  const [catForm, setCatForm] = useState(null) // 分類編輯表單 {id?, name, emoji, color, _old}

  useEffect(() => { load() }, [])
  async function load() {
    const [t, k] = await Promise.all([api.listTopics(), api.listCategories()])
    setTopics(t)
    const kk = k?.length ? k : DEFAULT_CATEGORIES
    setCats(kk)
    setCat(prev => (prev && kk.some(x => x.name === prev) ? prev : kk[0]?.name || ''))
  }

  if (!topics || !cats) return <div className="note">載入中…</div>
  const canEditCats = !!cats[0]?.id
  const inCat = topics.filter(t => t.category === cat)
  const m = name => metaOf(cats, name)

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

  async function delTopic(t) {
    await api.deleteTopic(t.id)
    setConfirmDel(null); setView(null)
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

  async function saveCat() {
    const f = catForm
    const payload = { name: f.name.trim(), emoji: f.emoji.trim() || '📋', color: f.color }
    if (!payload.name) { toast('請填分類名稱'); return }
    try {
      if (f.id) {
        await api.updateCategory(f.id, payload, f._old)
        toast('已儲存（既有主題與客訴已同步改名）')
      } else {
        await api.addCategory({ ...payload, sort_order: cats.length })
        toast('已新增分類')
      }
      setCatForm(null)
      load()
    } catch (ex) { toast(ex.message) }
  }

  async function delCat(k) {
    try {
      await api.deleteCategory(k.id, k.name)
      toast('已刪除分類')
      setConfirmDelCat(null); setCatForm(null)
      load()
    } catch (ex) { setConfirmDelCat(null); toast(ex.message) }
  }

  const F = (label, key, Type = 'input', props = {}) => (
    <div className="f-row">
      <label>{label}</label>
      {Type === 'textarea'
        ? <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />
        : <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />}
    </div>
  )

  const vm = view ? m(view.category) : null

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 4px 6px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sub)' }}>分類</span>
        <button className="linky" style={{ fontSize: 13 }} onClick={() => setMgr(true)}>⚙️ 編輯分類</button>
      </div>
      <div className="chips">
        {cats.map(k => (
          <button key={k.name} className={`chip ${k.name === cat ? 'on' : ''}`} onClick={() => setCat(k.name)}>
            {k.emoji} {k.name}<span style={{ opacity: .6 }}> {topics.filter(t => t.category === k.name).length}</span>
          </button>
        ))}
      </div>

      {topics.length === 0 && (
        <button className="add-topic" style={{ marginBottom: 8 }} onClick={importSeed}>⬇ 匯入 {seedTopics.length} 個預設主題</button>
      )}
      <div className="t-grid">
        {inCat.map(t => {
          const mm = m(t.category)
          return (
            <div className="t-item" key={t.id} onClick={() => { setView(t); setShowA(false); setArmed(false) }}>
              <div className="t-ico" style={{ background: mm.s }}>{mm.e}</div>
              <div className="t-mid">
                <div className="tt">{t.title}</div>
                {t.question && <div className="q-prev">🎤 {t.question}</div>}
              </div>
              <span className="arrow">›</span>
            </div>
          )
        })}
      </div>
      <div className="note">主題持續累積，形成酒店專屬品質知識庫 · 按右下 ＋ 新增</div>
      <button className="fab" onClick={() => openEdit(null)}>＋</button>

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
            <div className="f-row" style={{ marginTop: 10, marginBottom: 6 }}>
              <label>移動到分類</label>
              <select value={view.category} onChange={async e => { const to = e.target.value; if (to !== view.category) { await api.updateTopic(view.id, { category: to }); toast(`已移到「${to}」`); setCat(to); setView({ ...view, category: to }); load() } }}>
                {cats.map(k => <option key={k.name} value={k.name}>{k.emoji} {k.name}</option>)}
              </select>
            </div>
            <div className="row-actions">
              <button className="mini-btn edit" onClick={() => openEdit(view)}>✏️ 編輯</button>
              <button className="mini-btn del" onClick={() => setConfirmDel(view)}>🗑 刪除</button>
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
                {cats.map(k => <option key={k.name} value={k.name}>{k.emoji} {k.name}</option>)}
              </select>
            </div>
            {F('主題名稱', 'title')}
            {F('為什麼重要', 'why', 'textarea')}
            {F('正確做法（每行一項）', '_ok', 'textarea', { style: { height: 80 } })}
            {F('常見錯誤（每行一項）', '_bad', 'textarea')}
            {F('主管重點檢查', 'supervisor_check')}
            {F('一句提醒', 'reminder')}
            {F('早會提問', 'question', 'input', { placeholder: '用來抽問同事、加強記憶' })}
            {F('提問答案', 'answer')}
            <PhotoField label="示範相片（正確做法，可放 GIF 動作示範）" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} max={4} />
            <button className="btn" onClick={save}>儲存主題</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {mgr && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setMgr(false) }}>
          <div className="sheet">
            <h2>管理分類</h2>
            {!canEditCats && (
              <p className="src-note">目前顯示的是內建預設分類。要啟用增改功能，請先在 Supabase SQL Editor 執行 <b>supabase/add-modules.sql</b>。</p>
            )}
            {cats.map(k => (
              <div key={k.name} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <div className="t-ico" style={{ background: k.color + '22' }}>{k.emoji}</div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{k.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--sub)' }}>{topics.filter(t => t.category === k.name).length} 主題</span>
                {canEditCats && (
                  <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }}
                    onClick={() => setCatForm({ ...k, _old: k.name })}>✏️</button>
                )}
              </div>
            ))}
            {canEditCats && (
              <button className="add-topic" onClick={() => setCatForm({ name: '', emoji: '📋', color: COLOR_CHOICES[7] })}>＋ 新增分類</button>
            )}
            <button className="btn ghost" onClick={() => setMgr(false)}>完成</button>
          </div>
        </div>
      )}

      {catForm && (
        <div className="modal">
          <div className="sheet">
            <h2>{catForm.id ? '編輯分類' : '新增分類'}</h2>
            <div className="f-row"><label>名稱</label>
              <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="例：設施維修" /></div>
            <div className="f-row"><label>圖示（一個 emoji）</label>
              <input value={catForm.emoji} onChange={e => setCatForm({ ...catForm, emoji: e.target.value })} /></div>
            <div className="f-row"><label>顏色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLOR_CHOICES.map(c => (
                  <button key={c} onClick={() => setCatForm({ ...catForm, color: c })}
                    style={{ width: 34, height: 34, borderRadius: 10, background: c, cursor: 'pointer', border: catForm.color === c ? '3px solid var(--ink)' : '3px solid transparent' }} />
                ))}
              </div>
            </div>
            <button className="btn" onClick={saveCat}>儲存分類</button>
            {catForm.id && (
              <button className="btn danger" onClick={() => setConfirmDelCat(catForm)}>🗑 刪除（僅限沒有主題/客訴使用時）</button>
            )}
            <button className="btn ghost" onClick={() => setCatForm(null)}>取消</button>
          </div>
        </div>
      )}

      {confirmDel && (
        <Confirm
          text={`主題「${confirmDel.title}」會被永久刪除。`}
          onConfirm={() => delTopic(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {confirmDelCat && (
        <Confirm
          text={`分類「${confirmDelCat.name}」會被刪除（仍有主題或客訴使用時將無法刪除）。`}
          onConfirm={() => delCat(confirmDelCat)}
          onCancel={() => setConfirmDelCat(null)}
        />
      )}
    </>
  )
}
