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

// 表單用：縮圖 + 移除 + 新增（手機會跳相機/相簿）
export function PhotoField({ label = '相片', photos, onChange }) {
  const inp = useRef()
  const [busy, setBusy] = useState(false)

  async function pick(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const urls = []
      for (const f of files) urls.push(await api.uploadPhoto(f))
      onChange([...(photos || []), ...urls])
    } catch (ex) {
      toast(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="f-row">
      <label>{label}</label>
      <div className="ph-grid">
        {(photos || []).map((p, i) => (
          <div className="ph-item" key={i}>
            <img src={p} alt="" />
            <button type="button" className="ph-rm" onClick={() => onChange(photos.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="ph-add" onClick={() => inp.current.click()} disabled={busy}>
          {busy ? '…' : '📷 ＋'}
        </button>
      </div>
      <input ref={inp} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  )
}
