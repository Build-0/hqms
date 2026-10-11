// 把獨立網頁（舊系統）嵌入成一個模組：同源載入，保留原有功能與資料；之後可逐步改寫成原生模組
export default function Embed({ src, title }) {
  return <iframe className="embed-frame" src={src} title={title} allow="camera; clipboard-write" />
}
