import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 相對路徑：讓 build 出來的檔案放在 GitHub Pages 的子路徑（/repo名/）也能正常載入
  base: './',
})
