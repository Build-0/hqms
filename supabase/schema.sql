-- 房務品質管理系統 HQMS — 在 Supabase Dashboard → SQL Editor 執行一次
create extension if not exists pgcrypto;

-- 分類（可在 app 內增改）
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '📋',
  color text not null default '#7a8894',
  for_complaints boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 房務員名單與清潔評分
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

-- 客訴記錄
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  room text not null default '',
  category text not null,
  guest_comment text not null default '',
  actual_cause text not null default '',
  correct_standard text not null default '',
  improvement text not null default '',
  shared boolean not null default false,
  check_scheduled boolean not null default false,
  recurred boolean not null default false,
  nature text not null default '投訴',
  dept text not null default '客房',
  photos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 品質主題庫（含早會提問）
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  why text not null default '',
  correct_steps jsonb not null default '[]',
  mistakes jsonb not null default '[]',
  supervisor_check text not null default '',
  reminder text not null default '',
  question text not null default '',
  answer text not null default '',
  sort_order int not null default 0,
  photos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 新人教材章節（可在 app 內編輯）
create table if not exists training_sections (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '📄',
  title text not null,
  intro text not null default '',
  steps jsonb not null default '[]',
  photos jsonb not null default '[]',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 加強清潔項目（每日提醒 / 循環排程 / 深度清潔）
create table if not exists cleaning_items (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('daily','spot','cycle','deep')),
  day int,
  grp text not null default '',
  text text not null,
  wrong text not null default '',
  photos jsonb not null default '[]',
  photos_wrong jsonb not null default '[]',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 每日品質重點（自動選題結果與早會分享狀態）
create table if not exists daily_focus (
  focus_date date primary key,
  source text not null check (source in ('complaint','topic')),
  complaint_id uuid references complaints(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  source2 text,
  complaint_id2 uuid references complaints(id) on delete set null,
  topic_id2 uuid references topics(id) on delete set null,
  shared_at timestamptz
);

-- RLS：登入的同事都可讀寫（帳號由管理者手動建立）
alter table complaints enable row level security;
alter table topics enable row level security;
alter table daily_focus enable row level security;
alter table training_sections enable row level security;
alter table categories enable row level security;
alter table attendants enable row level security;
alter table scores enable row level security;

create policy "auth all complaints" on complaints for all to authenticated using (true) with check (true);
create policy "auth all topics" on topics for all to authenticated using (true) with check (true);
create policy "auth all focus" on daily_focus for all to authenticated using (true) with check (true);
create policy "auth all training" on training_sections for all to authenticated using (true) with check (true);
create policy "auth all categories" on categories for all to authenticated using (true) with check (true);
create policy "auth all attendants" on attendants for all to authenticated using (true) with check (true);
create policy "auth all scores" on scores for all to authenticated using (true) with check (true);
alter table cleaning_items enable row level security;
create policy "auth all cleaning" on cleaning_items for all to authenticated using (true) with check (true);

-- 預設 7 個分類（空表才插入）
insert into categories (name, emoji, color, sort_order, for_complaints)
select * from (values
  ('房間','🛏️','#1f7a6d',0,true),('浴室','🚿','#4a6fa5',1,true),('床品布草','🛌','#2e86ab',2,true),
  ('遺留物','🎒','#8f7ac9',3,true),('蟲害','🐛','#7d9440',4,true),('設備','🔌','#5b6ee1',5,true),
  ('安全','⛑️','#c0564f',6,true),('服務','🛎️','#b07d2e',7,true),('工作間','🧺','#5f9e63',8,true),
  ('工具','🧰','#54808c',9,false)
) as v(name, emoji, color, sort_order, for_complaints)
where not exists (select 1 from categories);

-- 相片儲存：公開讀取的 photos bucket（客訴現場照、主題示範照）
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "auth upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "auth delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos');
create policy "public read photos" on storage.objects for select using (bucket_id = 'photos');

-- 25 個預設主題不用 SQL 匯入：登入後到「主題庫」按「匯入預設主題」即可
