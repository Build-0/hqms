import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { TRAINING } from '../data/seedData'
import { toast } from '../lib/toast'

export default function Training() {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)   // null=關閉；{...欄位, id?}=編輯/新增
  const [armed, setArmed] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      setList(await api.listTraining())
      setErr('')
    } catch (ex) {
      setErr(ex.message)
      setList([])
    }
  }

  async function importSeed() {
    await api.importSeedTraining(TRAINING.map((t, i) => ({ ...t, sort_order: i })))
    toast(`已匯入 ${TRAINING.length} 章預設教材`)
    load()
  }

  function openEdit(t) {
    setArmed(false)
    setForm(t
      ? { ...t, _steps: (t.steps || []).join('\n') }
      : { emoji: '📄', title: '', intro: '', _steps: '' })
  }

  async function save() {
    const payload = {
      emoji: form.emoji.trim() || '📄',
      title: form.title.trim() || '（未命名章節）',
      intro: form.intro.trim(),
      steps: form._steps.split('\n').map(s => s.trim()).filter(Boolean),
    }
    if (form.id) {
      await api.updateTraining(form.id, payload)
      toast('已儲存修改')
    } else {
      await api.addTraining({ ...payload, sort_order: list.length })
      toast('已新增章節')
    }
    setForm(null)
    load()
  }

  async function del() {
    if (!armed) { setArmed(true); return }
    await api.deleteTraining(form.id)
    setArmed(false); setForm(null)
    toast('已刪除章節')
    load()
  }

  const F = (label, key, Type = 'input', props = {}) => (
    <div className="f-row">
      <label>{label}</label>
      {Type === 'textarea'
        ? <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />
        : <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />}
    </div>
  )

  if (!list) return <div className="note">載入中…</div>

  return (
    <>
      <div className="src-note" style={{ margin: '2px 4px 12px' }}>
        新人基礎培訓教材，在職同事可隨時重溫。點章節展開、✏️ 編輯。
      </div>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>
            讀取教材失敗：{err}
            <br />若是資料表不存在，請先在 Supabase SQL Editor 執行 <b>supabase/add-training.sql</b>。
          </p>
        </div>
      )}
      {!err && list.length === 0 && (
        <button className="add-topic" style={{ marginBottom: 8 }} onClick={importSeed}>
          ⬇ 匯入 {TRAINING.length} 章預設教材
        </button>
      )}
      <div className="tr-grid">
        {list.map((t, i) => (
          <div className="acc" key={t.id}>
            <div className="acc-h" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <span className="acc-e">{t.emoji}</span>
              <span className="acc-t">{t.title}<br /><span className="acc-n">{(t.steps || []).length} 個要點</span></span>
              <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }}
                onClick={e => { e.stopPropagation(); openEdit(t) }}>✏️</button>
              <span style={{ color: 'var(--sub)' }}>{open === t.id ? '－' : '＋'}</span>
            </div>
            {open === t.id && (
              <div className="acc-b">
                {t.intro}
                <ol>{(t.steps || []).map((s, j) => <li key={j}>{s}</li>)}</ol>
              </div>
            )}
          </div>
        ))}
      </div>
      {!err && <button className="add-topic" onClick={() => openEdit(null)}>＋ 新增章節</button>}

      {form && (
        <div className="modal">
          <div className="sheet">
            <h2>{form.id ? '編輯章節' : '新增章節'}</h2>
            {F('圖示（一個 emoji）', 'emoji')}
            {F('章節名稱', 'title')}
            {F('開場一句', 'intro', 'input', { placeholder: '例：入房到報房的標準次序：' })}
            {F('要點（每行一項）', '_steps', 'textarea', { style: { height: 140 } })}
            <button className="btn" onClick={save}>儲存章節</button>
            {form.id && (
              <button className="btn danger" onClick={del}>
                {armed ? '再按一次確定刪除' : '🗑 刪除此章節'}
              </button>
            )}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}
    </>
  )
}
