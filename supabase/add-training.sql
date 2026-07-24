-- 新人教材改為可編輯：新增 training_sections 表
-- 已在運行的專案：在 SQL Editor 執行這份即可（新開的專案跑 schema.sql 已包含）
create table if not exists training_sections (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '📄',
  title text not null,
  intro text not null default '',
  steps jsonb not null default '[]',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table training_sections enable row level security;
create policy "auth all training" on training_sections for all to authenticated using (true) with check (true);

-- 開放模式用（之後上鎖時 lock-mode.sql 會收回這條）
create policy "open training" on training_sections for all to anon using (true) with check (true);

-- 建表後到 app「新人教材」頁按「匯入預設教材」即可入庫 12 章
