import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 建置時間戳，用於顯示版本 + 提示更新
const BUILD = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Hong_Kong', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')

export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  // 相對路徑：讓 build 出來的檔案放在 GitHub Pages 的子路徑（/repo名/）也能正常載入
  base: './',
})
