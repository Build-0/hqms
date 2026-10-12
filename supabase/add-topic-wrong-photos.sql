-- 培訓主題庫：加入「錯誤做法」相片欄（正確做法相片沿用 photos）
alter table topics add column if not exists photos_wrong jsonb not null default '[]';
notify pgrst, 'reload schema';
