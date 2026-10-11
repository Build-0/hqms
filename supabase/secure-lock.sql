-- 資料庫真正上鎖：按角色（admin / store / clerk / supervisor）控制，匿名（沒登入）完全讀寫不到
-- 必須先執行「建立帳號」那份 SQL（建立 staff 表與 26 個帳號），並確認網站可用新登入，才執行這份。
-- 回復方法：執行 supabase/open-mode.sql 與 merge 檔的 "open all" 政策（見 supabase/secure-rollback.sql）。

-- ── 角色對照表（只可讀自己那行，不能由前端寫入）──
create table if not exists staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emp_id text unique not null,
  name text not null,
  role text not null check (role in ('admin','store','clerk','supervisor'))
);
alter table staff enable row level security;

create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from staff where user_id = auth.uid()
$$;
revoke all on function app_role() from public, anon;
grant execute on function app_role() to authenticated;

-- ── 先清掉所有舊政策（public 與相片儲存桶）──
do $do$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  for r in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual,'') || coalesce(with_check,'')) like '%photos%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $do$;

-- ── staff：登入者只讀到自己 ──
create policy "staff self" on staff for select to authenticated using (user_id = auth.uid());

-- ── 房間品質（只限管理員）──
do $do$
declare t text;
begin
  foreach t in array array['categories','attendants','scores','complaints','topics','daily_focus','training_sections','cleaning_items','finding_tags','findings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin all" on %I for all to authenticated using (app_role() = ''admin'') with check (app_role() = ''admin'')', t);
  end loop;
end $do$;

-- ── 後勤（管理員、倉管員）──
do $do$
declare t text;
begin
  foreach t in array array['boh_categories','products','vacuums','vacuum_maintenance','tools','equipment','equipment_maintenance','product_batches','stock_movements','tool_categories','equipment_types','vacuum_floors','app_config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "boh all" on %I for all to authenticated using (app_role() in (''admin'',''store'')) with check (app_role() in (''admin'',''store''))', t);
  end loop;
end $do$;

-- ── 缺陷：管理員／倉管員／文員可全部；樓層主管只可查看與新增登記 ──
alter table defect_types   enable row level security;
alter table defect_records enable row level security;
alter table defect_users   enable row level security;   -- 舊帳號表：不開放任何政策＝無人可讀寫
create policy "defect types all" on defect_types for all to authenticated
  using (app_role() in ('admin','store','clerk')) with check (app_role() in ('admin','store','clerk'));
create policy "defect types read" on defect_types for select to authenticated using (app_role() = 'supervisor');
create policy "defect rec all" on defect_records for all to authenticated
  using (app_role() in ('admin','store','clerk')) with check (app_role() in ('admin','store','clerk'));
create policy "defect rec read" on defect_records for select to authenticated using (app_role() = 'supervisor');
create policy "defect rec add" on defect_records for insert to authenticated with check (app_role() = 'supervisor');

-- ── 後勤函數：改為真正檢查角色（舊的「永遠通過」作廢）──
create or replace function _require_admin(p_password text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(app_role(), '') not in ('admin','store') then raise exception '沒有權限'; end if;
end $$;
create or replace function verify_password(p_password text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role(), '') in ('admin','store')
$$;

-- ── 相片：任何已登入員工可上傳；刪除限管理員／倉管員／文員；公開讀取保留（網址不可猜）──
create policy "photos upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos','defect-photos') and app_role() is not null);
create policy "photos delete" on storage.objects for delete to authenticated
  using (bucket_id in ('photos','defect-photos') and app_role() in ('admin','store','clerk'));

-- ── 收回匿名（沒登入）所有權限 ──
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant  select, insert, update, delete on all tables in schema public to authenticated;
grant  usage, select on all sequences in schema public to authenticated;
grant  execute on all functions in schema public to authenticated;
revoke all on staff from authenticated;
grant  select on staff to authenticated;
revoke all on defect_users from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

notify pgrst, 'reload schema';
