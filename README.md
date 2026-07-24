# 房務品質管理系統（HQMS）

每日早會品質重點、客訴管理、品質主題庫、新人教材。手機瀏覽器操作為主。

## 本機試玩（示範模式）

```
npm install
npm run dev
```

開 http://localhost:5173 。未設定 Supabase 時自動進入**示範模式**：任意帳號密碼可登入，資料只存在本機瀏覽器（localStorage），主題庫已預載 25 個主題。

## 接上 Supabase（正式多人使用）

1. 到 https://supabase.com 建立新專案（免費）。
2. Dashboard → **SQL Editor** → 貼上 `supabase/schema.sql` 全部內容 → Run，
   再貼上 `supabase/seed-topics.sql` → Run（23 個預設主題入庫，重跑不會重複）。
3. Dashboard → **Authentication → Sign In / Up → Email**：關閉「Confirm email」。
4. 建立同事帳號（兩選一）：
   - Dashboard → **Authentication → Users → Add user**：email 用 `名字@hqms.local`
     格式（不需要真實信箱），設定密碼，勾選 Auto Confirm；或
   - 用腳本批量建立：見 `scripts/create-users.mjs` 開頭的說明。
   同事登入時只需輸入 `名字` 和密碼（系統自動補 @hqms.local）。
5. Dashboard → **Settings → API**：複製 Project URL 和 anon public key，
   在專案根目錄複製 `.env.example` 為 `.env` 填入。
6. 重啟 `npm run dev` 即可登入使用。

## 部署到 Vercel（讓同事手機直接開網址）

1. 專案推上 GitHub。
2. https://vercel.com → Add New Project → 選這個 repo（Vite 會自動偵測）。
3. Environment Variables 加上 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
4. Deploy 完成後把網址發給同事，加到手機主畫面即可當 app 用。

## 結構

- `src/pages/Daily.jsx` — 今日重點（昨日有客訴→客訴為題，否則主題輪替；早會提問；標記已分享）
- `src/pages/Complaints.jsx` — 客訴記錄 CRUD、統計、設為明日重點
- `src/pages/Topics.jsx` — 七大分類主題庫 CRUD（含早會提問）
- `src/pages/Training.jsx` — 新人教材（固定內容，改 `src/data/seedData.js`）
- `src/lib/api.js` — 資料層：有 .env 走 Supabase，沒有走 localStorage 示範模式
- `src/components/Photos.jsx` — 相片元件：客訴現場照/主題示範照，上傳前自動壓縮（最長邊1000px），正式模式存 Supabase Storage（schema.sql 已含 photos bucket 設定）
- `demo-static.html` — 最初的單檔靜態 demo（留作參考）
