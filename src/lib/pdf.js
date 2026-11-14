// 把報告預覽直接轉成 PDF 檔（iPhone「加到主畫面」的網頁不支援 window.print，所以改為自己產生 PDF，再分享／下載）
// 做法：逐塊把畫面轉成圖片，順序排進 A4；放唔落當頁就換頁，過高嘅區塊分頁切開；每頁底部加頁碼。
const A4P = { w: 210, h: 297 }
const M = 10          // 頁邊距 mm

// 分享選單只喺手機／平板用（電腦版直接下載，唔好彈 Windows「分享」視窗）
const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const PAGE_BREAK_CLASS = 'sf-page'   // 沙發檢查表：每層一頁

export async function savePdf(rootEl, fileName, opts = {}) {
  const A4 = opts.a3 ? { w: 420, h: 297 } : opts.landscape ? { w: A4P.h, h: A4P.w } : A4P
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const doc = new jsPDF({ unit: 'mm', format: opts.a3 ? 'a3' : 'a4', orientation: opts.landscape ? 'landscape' : 'portrait' })
  const innerW = A4.w - M * 2, innerH = A4.h - M * 2 - 6
  if (opts.fitOne) {
    // 一頁式：整份報告轉成一張圖，縮放至剛好放入一頁（保持比例、置中）
    const canvas = await html2canvas(rootEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
    const bw = A4.w - M * 2, bh = A4.h - M * 2
    const k = Math.min(bw / canvas.width, bh / canvas.height)
    const w = canvas.width * k, h = canvas.height * k
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (A4.w - w) / 2, M, w, h)
    return deliver(doc.output('blob'), fileName)
  }
  const blocks = [...rootEl.children].filter(el => !el.classList.contains('rpt-noprint') && el.offsetHeight > 0)
  let y = M, first = true, pages = 1
  const addCanvas = (canvas, forceNew) => {
    const h = (canvas.height / canvas.width) * innerW
    if (forceNew && !first) { doc.addPage(); pages++; y = M }
    if (!forceNew && y + h > M + innerH && y > M) { doc.addPage(); pages++; y = M }
    if (h <= innerH - (y - M) + 0.5) { doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, innerW, h); y += h + 2; first = false; return }
    // 區塊比一頁高：切成多頁
    const pxPerMm = canvas.width / innerW
    let off = 0
    while (off < canvas.height) {
      const avail = (M + innerH - y) * pxPerMm
      const sliceH = Math.min(canvas.height - off, Math.floor(avail))
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = sliceH
      c.getContext('2d').drawImage(canvas, 0, off, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, innerW, sliceH / pxPerMm)
      off += sliceH
      if (off < canvas.height) { doc.addPage(); pages++; y = M } else y += sliceH / pxPerMm + 2
    }
    first = false
  }
  for (const el of blocks) {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: Math.max(window.innerWidth, rootEl.scrollWidth + 40) })
    addCanvas(canvas, el.classList.contains(PAGE_BREAK_CLASS))
  }
  doc.setFontSize(8); doc.setTextColor(130)
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.text(`${i} / ${pages}`, A4.w / 2, A4.h - 6, { align: 'center' }) }
  return deliver(doc.output('blob'), fileName)
}

// 交付 PDF：手機用分享選單；報告長、產生耗時太耐時 iPhone 會拒絕自動彈分享（要再撳一下），
// 呢個情況同埋手機「下載」唔work 嘅情況，都交返個檔案俾畫面，由用戶再撳一下分享／開啟。
async function deliver(blob, fileName) {
  const file = new File([blob], fileName.replace(/[\\/:*?"<>|]/g, '-') + '.pdf', { type: 'application/pdf' })
  if (IS_MOBILE) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: fileName }); return 'shared' } catch (e) { if (e && e.name === 'AbortError') return 'cancel' }
    }
    return { pending: file }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return 'download'
}

// 用戶撳掣後先分享（有新嘅撳掣動作，iPhone 就肯彈分享選單）；分享唔到就喺新分頁開 PDF
export async function sharePending(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') }); return 'shared' } catch (e) { if (e && e.name === 'AbortError') return 'cancel' }
  }
  openPdf(file); return 'opened'
}
export function openPdf(file) {
  const url = URL.createObjectURL(file)
  const w = window.open(url, '_blank')
  if (!w) location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}
