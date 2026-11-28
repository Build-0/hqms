// 客戶端壓縮：手機相片動輒 3–8MB，縮到最長邊 1600px + JPEG 壓縮後約 300KB
// GIF 動畫例外：直接原樣保留（不經 canvas，否則會變靜態圖）
export function compressImage(file, maxDim = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif') {
      const reader = new FileReader()
      reader.onload = () => resolve({ blob: file, dataUrl: reader.result })
      reader.onerror = () => reject(new Error('無法讀取 GIF'))
      reader.readAsDataURL(file)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)   // 透明 PNG 先墊白底，否則 JPEG 會變黑底
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      canvas.toBlob(
        blob => (blob ? resolve({ blob, dataUrl }) : reject(new Error('圖片處理失敗'))),
        'image/jpeg', quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片')) }
    img.src = url
  })
}
