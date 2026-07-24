// 客戶端壓縮：手機相片動輒 3–8MB，縮到最長邊 1000px + JPEG 壓縮後約 100KB
export function compressImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
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
