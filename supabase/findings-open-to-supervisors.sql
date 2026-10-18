-- 查房記錄公開透明：所有樓層主管可查看、新增、編輯全部記錄（刪除仍只限管理員）；新增「檢查時間」「最後編輯」欄位
-- 在 Supabase SQL Editor 執行一次（可重覆執行）。需先已執行 secure-lock.sql。
alter table findings add column if not exists check_time text;      -- 檢查時間（HH:MM）
alter table findings add column if not exists edited_by text;
alter table findings add column if not exists edited_at timestamptz;

drop policy if exists "sup findings read" on findings;
drop policy if exists "sup findings add" on findings;
drop policy if exists "sup findings upd" on findings;
drop policy if exists "sup findings del" on findings;
create policy "sup findings read" on findings for select to authenticated using (app_role() = 'supervisor');
create policy "sup findings add" on findings for insert to authenticated
  with check (app_role() = 'supervisor' and created_by = auth.uid());
create policy "sup findings upd" on findings for update to authenticated
  using (app_role() = 'supervisor') with check (app_role() = 'supervisor');
-- 編輯記錄時，系統會先寫入新資料再移除舊資料，所以主管需要刪除權限；介面只有管理員見到「刪除」掣
create policy "sup findings del" on findings for delete to authenticated using (app_role() = 'supervisor');
notify pgrst, 'reload schema';
