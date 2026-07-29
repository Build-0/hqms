-- 2026-07-27 增量：①客訴改「部門×性質」 ②加強清潔項目表
-- 在 Supabase SQL Editor 執行一次

-- ① 部門欄（客房 / 工程其他）；原「工程投訴」性質轉為 部門=工程其他、性質=投訴
alter table complaints add column if not exists dept text not null default '客房';
update complaints set dept = '工程其他', nature = '投訴' where nature = '工程投訴';

-- ② 加強清潔項目（每日提醒 / 循環排程 / 深度清潔，app 內可編輯）
create table if not exists cleaning_items (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('daily','cycle','deep')),
  day int,
  grp text not null default '',
  text text not null,
  wrong text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- 已建表者補分組欄
alter table cleaning_items add column if not exists grp text not null default '';
alter table cleaning_items enable row level security;
create policy "auth all cleaning" on cleaning_items for all to authenticated using (true) with check (true);

-- 開放模式用（lock-mode.sql 會收回）
create policy "open cleaning" on cleaning_items for all to anon using (true) with check (true);
