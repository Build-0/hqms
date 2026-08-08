-- 2026-08 更多相片：每日清潔正確/錯誤對照圖、新人教材配圖
alter table cleaning_items add column if not exists photos_wrong jsonb not null default '[]';
alter table training_sections add column if not exists photos jsonb not null default '[]';
