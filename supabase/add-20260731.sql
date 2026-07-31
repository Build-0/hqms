-- 2026-07-31 增量：每日雙主題 + 分類適用範圍
-- ① 每日重點第二主題（刪除引用的客訴/主題時只清空該槽，不刪整日記錄）
alter table daily_focus add column if not exists source2 text;
alter table daily_focus add column if not exists complaint_id2 uuid references complaints(id) on delete set null;
alter table daily_focus add column if not exists topic_id2 uuid references topics(id) on delete set null;

-- ② 分類適用範圍：工具只用於主題庫，不出現在客訴的分類選項
alter table categories add column if not exists for_complaints boolean not null default true;
update categories set for_complaints = false where name = '工具';
