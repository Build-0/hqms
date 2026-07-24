-- 房務品質管理系統 HQMS — 在 Supabase Dashboard → SQL Editor 執行一次
create extension if not exists pgcrypto;

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

-- 每日品質重點（自動選題結果與早會分享狀態）
create table if not exists daily_focus (
  focus_date date primary key,
  source text not null check (source in ('complaint','topic')),
  complaint_id uuid references complaints(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  shared_at timestamptz
);

-- RLS：登入的同事都可讀寫（帳號由管理者手動建立）
alter table complaints enable row level security;
alter table topics enable row level security;
alter table daily_focus enable row level security;

create policy "auth all complaints" on complaints for all to authenticated using (true) with check (true);
create policy "auth all topics" on topics for all to authenticated using (true) with check (true);
create policy "auth all focus" on daily_focus for all to authenticated using (true) with check (true);

-- 相片儲存：公開讀取的 photos bucket（客訴現場照、主題示範照）
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "auth upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "auth delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos');
create policy "public read photos" on storage.objects for select using (bucket_id = 'photos');

-- 25 個預設主題不用 SQL 匯入：登入後到「主題庫」按「匯入預設主題」即可
