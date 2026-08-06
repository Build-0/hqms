-- 2026-08 增量：衛生與整潔的清潔項目可配示範相片
alter table cleaning_items add column if not exists photos jsonb not null default '[]';
