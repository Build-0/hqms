import { useRef, useState } from 'react'
import * as api from '../lib/api'
import { toast } from '../lib/toast'

// 縮圖格 + 點開全螢幕
export function PhotoGrid({ photos }) {
  const [big, setBig] = useState(null)
  if (!photos?.length) return null
  return (
    <>
      <div className="ph-grid">
        {photos.map((p, i) => (
          <div className="ph-item" key={i} onClick={() => setBig(p)}>
            <img src={p} alt="" loading="lazy" />
          </div>
        ))}
      </div>
      {big && (
        <div className="lightbox" onClick={() => setBig(null)}>
          <img src={big} alt="" />
        </div>
      )}
    </>
  )
}

// 表單用：縮圖 + 移除 + 新增（手機會跳相機/相簿；支援 GIF 動畫）
export function PhotoField({ label = '相片', photos, onChange, max = 8 }) {
  const inp = useRef()
  const [busy, setBusy] = useState(false)
  const cur = photos || []
  const full = cur.length >= max

  async function pick(e) {
    const files = [...e.target.files].slice(0, max - cur.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const urls = []
      for (const f of files) urls.push(await api.uploadPhoto(f))
      onChange([...cur, ...urls])
    } catch (ex) {
      toast(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="f-row">
      <label>{label}<span style={{ color: 'var(--sub)', fontWeight: 400 }}> · {cur.length}/{max}</span></label>
      <div className="ph-grid">
        {cur.map((p, i) => (
          <div className="ph-item" key={i}>
            <img src={p} alt="" />
            <button type="button" className="ph-rm" onClick={() => onChange(cur.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {!full && (
          <button type="button" className="ph-add" onClick={() => inp.current.click()} disabled={busy}>
            {busy ? '…' : '📷 ＋'}
          </button>
        )}
      </div>
      <input ref={inp} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  )
}
