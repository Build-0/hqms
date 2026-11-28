import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as api from '../lib/api'
import { toast } from '../lib/toast'

// 全螢幕睇相：撳相放大 3 倍（可拖動睇細節），再撳還原；撳黑色位或 ✕ 關閉
export function Lightbox({ src, onClose }) {
  const box = useRef()
  const [zoom, setZoom] = useState(false)
  function tap(e) {
    e.stopPropagation()
    if (zoom) { setZoom(false); return }
    const r = e.currentTarget.getBoundingClientRect()
    const nat = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 1
    const w = Math.min(r.width, r.height * nat), h = w / nat   // 相片實際顯示範圍（object-fit:contain）
    const fx = (e.clientX - r.left - (r.width - w) / 2) / w
    const fy = (e.clientY - r.top - (r.height - h) / 2) / h
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) { onClose(); return }   // 撳相外面嘅黑色位＝關閉
    setZoom(true)
    requestAnimationFrame(() => {
      const b = box.current
      if (!b) return
      b.scrollLeft = fx * b.scrollWidth - b.clientWidth / 2
      b.scrollTop = fy * b.scrollHeight - b.clientHeight / 2
    })
  }
  return createPortal(
    <div className="lightbox" onClick={e => { e.stopPropagation(); onClose() }}>
      <div className={'lb-scroll' + (zoom ? ' zoom' : '')} ref={box}><img src={src} alt="" onClick={tap} /></div>
      <button type="button" className="lb-x" aria-label="關閉">✕</button>
      <span className="lb-tip">{zoom ? '拖動睇細節 · 撳相還原' : '撳相放大'}</span>
    </div>, document.body)
}

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
      {big && <Lightbox src={big} onClose={() => setBig(null)} />}
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
