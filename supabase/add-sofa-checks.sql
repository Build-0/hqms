-- 大床梳化檢查總表：記錄「已確認無問題」的房間（有問題嘅房間由缺陷記錄自動對應，不在此表）
-- 在 Supabase SQL Editor 執行一次（可重覆執行）。需先已執行 secure-lock.sql。
create table if not exists sofa_checks (
  id bigserial primary key,
  room text not null unique,
  ok_by text not null default '',
  ok_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
alter table sofa_checks enable row level security;
drop policy if exists "sofa admin" on sofa_checks;
drop policy if exists "sofa sup read" on sofa_checks;
drop policy if exists "sofa sup add" on sofa_checks;
drop policy if exists "sofa staff read" on sofa_checks;
-- 管理員：全部權限
create policy "sofa admin" on sofa_checks for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
-- 樓層主管：可查看全部確認記錄、可新增確認（自己名義）；不能刪改
create policy "sofa sup read" on sofa_checks for select to authenticated using (app_role() = 'supervisor');
create policy "sofa sup add" on sofa_checks for insert to authenticated
  with check (app_role() = 'supervisor' and created_by = auth.uid());
-- 倉管員、文員：只可查看
create policy "sofa staff read" on sofa_checks for select to authenticated using (app_role() in ('store','clerk'));
grant select, insert, update, delete on sofa_checks to authenticated;
grant usage, select on sequence sofa_checks_id_seq to authenticated;
revoke all on sofa_checks from anon;
notify pgrst, 'reload schema';
