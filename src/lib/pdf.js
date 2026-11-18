// 把報告預覽直接轉成 PDF 檔（iPhone「加到主畫面」的網頁不支援 window.print，所以改為自己產生 PDF，再分享／下載）
// 做法：逐塊把畫面轉成圖片，順序排進 A4；放唔落當頁就換頁，過高嘅區塊分頁切開；每頁底部加頁碼。
const A4P = { w: 210, h: 297 }
const M = 10          // 頁邊距 mm

// 分享選單只喺手機／平板用（電腦版直接下載，唔好彈 Windows「分享」視窗）
const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const PAGE_BREAK_CLASS = 'sf-page'   // 沙發檢查表：每層一頁

// 手機常見死因：html2canvas 逐張載入跨網域相片（員工相等），有一張卡住就永遠「產生中」。
// 所以先自己逐張下載相片（每張最多 8 秒）轉成內嵌圖片，下載唔到就暫時隱藏，截圖完再還原。
async function inlineImages(rootEl) {
  const undo = []
  const imgs = [...rootEl.querySelectorAll('img')].filter(i => i.src && !i.src.startsWith('data:'))
  await Promise.all(imgs.map(async img => {
    const old = img.src, oldSet = img.getAttribute('srcset')
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000)
      const r = await fetch(old, { signal: ac.signal, cache: 'reload' }).finally(() => clearTimeout(t))
      if (!r.ok) throw new Error('img ' + r.status)
      const b = await r.blob()
      const url = await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = no; f.readAsDataURL(b) })
      img.removeAttribute('loading'); img.removeAttribute('srcset'); img.src = url
      await (img.decode ? img.decode().catch(() => {}) : Promise.resolve())
      undo.push(() => { img.src = old; if (oldSet) img.setAttribute('srcset', oldSet) })
    } catch {
      const v = img.style.visibility; img.style.visibility = 'hidden'
      undo.push(() => { img.style.visibility = v })
    }
  }))
  return () => undo.forEach(f => f())
}
// 畫面太大時降低解像度，避免 iPhone 畫布超出記憶體上限
const pickScale = el => Math.max(1, Math.min(2, Math.sqrt(9e6 / Math.max(1, el.scrollWidth * el.scrollHeight))))
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('產生逾時，請再試一次（或改用電腦保存）')), ms))])

export async function savePdf(rootEl, fileName, opts = {}) {
  // 手機版表格用「自動斷字」排版，html2canvas 會畫到文字疊埋一齊；產生期間改用固定 820px 紙張排版（同電腦版一樣）
  const paper = IS_MOBILE && !rootEl.classList.contains('rpt-paper')
  if (paper) rootEl.classList.add('rpt-paper')
  const restore = await inlineImages(rootEl)
  try { return await withTimeout(buildPdf(rootEl, fileName, opts), 90000) } finally { restore(); if (paper) rootEl.classList.remove('rpt-paper') }
}

// 轉圖：手機（iPhone）用瀏覽器自己排版嘅方式截圖（html-to-image），文字唔會疊；html2canvas 喺 iPhone 會疊字／卡死。電腦照舊用 html2canvas。
async function snap(el, html2canvas, extra = {}) {
  if (IS_MOBILE) {
    try {
      const { toCanvas } = await import('html-to-image')
      return await toCanvas(el, { pixelRatio: pickScale(el), backgroundColor: '#ffffff', skipFonts: true, cacheBust: false })
    } catch { /* 失敗就轉用 html2canvas */ }
  }
  return html2canvas(el, { scale: pickScale(el), imageTimeout: 8000, backgroundColor: '#ffffff', useCORS: true, logging: false, ...extra })
}

async function buildPdf(rootEl, fileName, opts = {}) {
  const A4 = opts.a3 ? { w: 420, h: 297 } : opts.landscape ? { w: A4P.h, h: A4P.w } : A4P
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const doc = new jsPDF({ unit: 'mm', format: opts.a3 ? 'a3' : 'a4', orientation: opts.landscape ? 'landscape' : 'portrait' })
  const innerW = A4.w - M * 2, innerH = A4.h - M * 2 - 6
  if (opts.fitOne) {
    // 一頁式：整份報告轉成一張圖，縮放至剛好放入一頁（保持比例、置中）
    const canvas = await snap(rootEl, html2canvas)
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
    const canvas = await snap(el, html2canvas, { windowWidth: Math.max(window.innerWidth, rootEl.scrollWidth + 40) })
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
