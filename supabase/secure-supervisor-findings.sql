-- 開放「查房記錄」給樓層主管：只可新增、只可查看「自己記錄」的內容，不能修改或刪除；
-- 不開放人員表現、標籤管理、其他品質資料。在 Supabase SQL Editor 執行一次（可重覆執行）。需先已執行 secure-lock.sql。

-- 記錄是誰建立的（新增時資料庫自動填入登入者，前端不能偽造）
alter table findings add column if not exists created_by uuid default auth.uid();

drop policy if exists "sup findings read" on findings;
drop policy if exists "sup findings add" on findings;
drop policy if exists "sup tags read" on finding_tags;
drop policy if exists "sup attendants read" on attendants;
create policy "sup findings read" on findings for select to authenticated
  using (app_role() = 'supervisor' and created_by = auth.uid());
create policy "sup findings add" on findings for insert to authenticated
  with check (app_role() = 'supervisor' and created_by = auth.uid());
create policy "sup tags read" on finding_tags for select to authenticated using (app_role() = 'supervisor');
create policy "sup attendants read" on attendants for select to authenticated using (app_role() = 'supervisor');
notify pgrst, 'reload schema';
