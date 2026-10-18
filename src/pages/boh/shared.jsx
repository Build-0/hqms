import { useEffect, useRef, useState } from 'react'
import * as api from '../../lib/api'
import { compressImage } from '../../lib/image'
import { toast } from '../../lib/toast'

// 相片很大（資料表內嵌 base64）：列表先不載入，之後分批背景載入並快取
const cache = new Map()
export function useImages(table, ids) {
  const [, bump] = useState(0)
  const key = ids.join(',')
  useEffect(() => {
    let dead = false
    const need = ids.filter(id => !cache.has(table + id))
    ;(async () => {
      for (let i = 0; i < need.length && !dead; i += 6) {
        const chunk = need.slice(i, i + 6)
        try {
          const rows = await api.dbSelectIn(table, 'id,image', chunk)
          for (const id of chunk) cache.set(table + id, (rows.find(r => r.id === id) || {}).image || '')
          if (!dead) bump(n => n + 1)
        } catch { break }
      }
    })()
    return () => { dead = true }
  }, [table, key])
  return id => cache.get(table + id)
}
export const setCachedImage = (table, id, v) => cache.set(table + id, v || '')

export function Thumb({ src, fallback = '📦', size = 64 }) {
  return (
    <div className={`bh-thumb ${src ? 'has-img' : 'no-img'}`} style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span>{fallback}</span>}
    </div>
  )
}

// 表單相片欄位：選相 → 壓縮 → 預覽 → 可移除
export function ImageField({ value, onChange, fallback }) {
  const inp = useRef()
  const [busy, setBusy] = useState(false)
  async function pick(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file) return
    setBusy(true)
    try { onChange((await compressImage(file, 900, 0.7)).dataUrl) } catch (ex) { toast(ex.message) }
    setBusy(false)
  }
  return (
    <div className="f-row">
      <label>相片</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Thumb src={value} fallback={fallback} size={72} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" className="btn ghost" style={{ margin: 0 }} onClick={() => inp.current.click()} disabled={busy}>{busy ? '處理中…' : value ? '更換相片' : '選擇相片'}</button>
          {value && <button type="button" className="linky" style={{ textAlign: 'left' }} onClick={() => onChange('')}>移除相片</button>}
        </div>
        <input ref={inp} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  )
}

export const num = v => (v === '' || v == null ? 0 : parseInt(v, 10) || 0)
export const today = () => new Date().toISOString().slice(0, 10)
export const daysUntil = d => (d ? Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) / 86400000) : null)

// 簡單的名稱清單管理（工具分類／設備類型／吸塵機位置）
export function ListManager({ title, table, rows, onClose, onChanged, usedBy }) {
  const [name, setName] = useState('')
  async function add() {
    const n = name.trim(); if (!n) return
    if (rows.some(r => r.name === n)) { toast('已有相同名稱'); return }
    try { await api.dbInsert(table, { name: n, sort_order: (rows.length ? Math.max(...rows.map(r => r.sort_order || 0)) : 0) + 1 }); setName(''); onChanged() } catch (ex) { toast('新增失敗：' + ex.message) }
  }
  async function rename(r, v) {
    v = v.trim(); if (!v || v === r.name) return
    try { await api.dbUpdate(table, r.id, { name: v }); if (usedBy) await usedBy(r.name, v); onChanged(); toast('已改名') } catch (ex) { toast('改名失敗：' + ex.message) }
  }
  async function del(r) {
    try { await api.dbDelete(table, r.id); onChanged() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }
  return (
    <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <h2>{title}</h2>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="df-sel" defaultValue={r.name} onBlur={e => rename(r, e.target.value)} />
            <button className="mini danger" onClick={() => del(r)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="df-sel" placeholder="新增名稱" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
          <button className="btn" style={{ width: 'auto', padding: '0 18px', margin: 0 }} onClick={add}>新增</button>
        </div>
        <button className="btn ghost" onClick={onClose}>完成</button>
      </div>
    </div>
  )
}
