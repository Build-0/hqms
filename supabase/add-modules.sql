-- 2026-07-24 增量：可編輯分類、客訴性質（投訴/濫訴）、房務員清潔評分
-- 已在運行的專案：在 SQL Editor 執行這一份即可

-- ① 分類改為資料表（可增改名稱/圖示/顏色）
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '📋',
  color text not null default '#7a8894',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into categories (name, emoji, color, sort_order)
select * from (values
  ('客房清潔','🛏️','#1f7a6d',0),('浴室','🚿','#4a6fa5',1),('服務','🛎️','#b07d2e',2),
  ('安全','⛑️','#c0564f',3),('遺留物','🎒','#8f7ac9',4),('工具','🧰','#54808c',5),('工作間','🧺','#5f9e63',6)
) as v(name, emoji, color, sort_order)
where not exists (select 1 from categories);

-- ② 客訴性質：投訴（真正要對待的問題）/ 濫訴（記錄人群與數量作參考）
alter table complaints add column if not exists nature text not null default '投訴';

-- ③ 房務員名單與清潔評分
create table if not exists attendants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  attendant_id uuid not null references attendants(id) on delete cascade,
  room text not null default '',
  score int not null,
  note text not null default '',
  photos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table attendants enable row level security;
alter table scores enable row level security;
create policy "auth all categories" on categories for all to authenticated using (true) with check (true);
create policy "auth all attendants" on attendants for all to authenticated using (true) with check (true);
create policy "auth all scores" on scores for all to authenticated using (true) with check (true);

-- 開放模式用（lock-mode.sql 會收回）
create policy "open categories" on categories for all to anon using (true) with check (true);
create policy "open attendants" on attendants for all to anon using (true) with check (true);
create policy "open scores" on scores for all to anon using (true) with check (true);
