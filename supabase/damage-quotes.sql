-- 固定資產破損報價（後勤管理）+ 收緊 hskp_pages 權限（冇逐項權限記錄時，只有管理員／開發者預設可編輯）
-- 見 Supabase migration: hskp_pages_tighten_and_damage_quotes
create table if not exists public.damage_quotes (
  id uuid primary key default gen_random_uuid(),
  grp text not null default '', name text not null, dept text not null default '',
  price numeric, cur text not null default 'MOP', quote_date date,
  notes text not null default '', photos jsonb not null default '[]'::jsonb,
  sort_order int not null default 0, created_at timestamptz not null default now(), created_by text
);
alter table public.damage_quotes enable row level security;
-- 權限：逐項 dmgquote；冇設定時 開發者／管理員／倉管員 = 編輯，其他 = 無
