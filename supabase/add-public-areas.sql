-- 公共地區管理：員工、崗位、任務代碼、24 小時時段、改動紀錄（目前只限管理員）
create table if not exists pa_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default '外判' check (kind in ('HSKP','外判','主管')),
  gender text not null default '',
  nationality text not null default '',
  langs jsonb not null default '[]',          -- 粵語／普通話／英語…
  phone text not null default '',
  notes text not null default '',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists pa_posts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- 崗1…崗17
  sort_order int not null default 0,
  staff_id uuid references pa_staff(id) on delete set null,
  grp text not null default '',              -- 商場／前區／後區／深度清潔／管理支援
  work_area text not null default '',
  start_time text not null default '',       -- HH:MM
  end_time text not null default '',
  break_text text not null default '',
  notes text not null default '',
  flag text not null default '',             -- 待確認 等標記
  active boolean not null default true
);
create table if not exists pa_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  cat text not null default '',
  short text not null default '',
  detail text not null default '',
  note text not null default '',
  flag text not null default '',
  sort_order int not null default 0,
  active boolean not null default true
);
create table if not exists pa_slots (
  id bigserial primary key,
  post_id uuid not null references pa_posts(id) on delete cascade,
  slot int not null check (slot between 0 and 47),   -- 0 = 00:00–00:30
  task text not null default '',
  unique (post_id, slot)
);
create table if not exists pa_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  by_name text not null default '',
  what text not null default '',
  detail jsonb
);
do $do$
declare t text;
begin
  foreach t in array array['pa_staff','pa_posts','pa_tasks','pa_slots','pa_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "pa admin" on %I', t);
    execute format('create policy "pa admin" on %I for all to authenticated using (app_role() = ''admin'') with check (app_role() = ''admin'')', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $do$;
grant usage, select on sequence pa_slots_id_seq, pa_log_id_seq to authenticated;
notify pgrst, 'reload schema';

-- ── 之後加入（已由 Supabase 連接器執行）──
alter table pa_staff add column if not exists rest_kind text not null default '';
alter table pa_staff add column if not exists rest_weekdays jsonb not null default '[]';
alter table pa_staff add column if not exists rest_dates jsonb not null default '[]';
alter table pa_staff add column if not exists old_name text not null default '';
alter table pa_tasks add column if not exists short_en text not null default '';
alter table pa_tasks add column if not exists detail_en text not null default '';
alter table pa_posts add column if not exists work_area_en text not null default '';
-- 公眾主管：旗標（角色仍是 supervisor），可讀取 pa_* 表
alter table staff add column if not exists pub_sup boolean not null default false;
create or replace function is_pubsup() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select pub_sup from staff where user_id = auth.uid()), false)
$$;
revoke all on function is_pubsup() from public, anon;
grant execute on function is_pubsup() to authenticated;
do $do$
declare t text;
begin
  foreach t in array array['pa_staff','pa_posts','pa_tasks','pa_slots'] loop
    execute format('drop policy if exists "pa pubsup read" on %I', t);
    execute format('create policy "pa pubsup read" on %I for select to authenticated using (is_pubsup())', t);
  end loop;
end $do$;
