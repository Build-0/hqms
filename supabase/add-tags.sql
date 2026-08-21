-- 2026-08 客訴多分類標籤
alter table complaints add column if not exists tags jsonb not null default '[]';
