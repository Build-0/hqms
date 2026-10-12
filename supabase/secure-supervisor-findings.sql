-- 開放「查房記錄」給樓層主管：可查看、新增，不能修改或刪除；不開放人員表現、標籤管理、其他品質資料
-- 在 Supabase SQL Editor 執行一次（可重覆執行）。需先已執行 secure-lock.sql。
drop policy if exists "sup findings read" on findings;
drop policy if exists "sup findings add" on findings;
drop policy if exists "sup tags read" on finding_tags;
drop policy if exists "sup attendants read" on attendants;
create policy "sup findings read" on findings for select to authenticated using (app_role() = 'supervisor');
create policy "sup findings add" on findings for insert to authenticated with check (app_role() = 'supervisor');
create policy "sup tags read" on finding_tags for select to authenticated using (app_role() = 'supervisor');
create policy "sup attendants read" on attendants for select to authenticated using (app_role() = 'supervisor');
notify pgrst, 'reload schema';
