-- 上鎖：收回開放模式的匿名權限，回到「必須登入」
-- 執行後記得把 .env 的 VITE_OPEN_MODE 移除或改 0，並用 Dashboard/腳本建立同事帳號
drop policy if exists "open complaints" on complaints;
drop policy if exists "open topics" on topics;
drop policy if exists "open focus" on daily_focus;
drop policy if exists "open training" on training_sections;
drop policy if exists "open categories" on categories;
drop policy if exists "open attendants" on attendants;
drop policy if exists "open scores" on scores;
drop policy if exists "open cleaning" on cleaning_items;
drop policy if exists "open upload photos" on storage.objects;
drop policy if exists "open delete photos" on storage.objects;
