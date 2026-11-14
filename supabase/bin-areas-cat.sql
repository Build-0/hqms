-- 分佈頁通用化：每個位置屬於一個分類（垃圾桶／洗手液器），並記錄故障數量同備註
alter table public.bin_areas add column if not exists cat text not null default '垃圾桶';
alter table public.bin_areas add column if not exists broken integer not null default 0;
alter table public.bin_areas add column if not exists notes text not null default '';
alter table public.bin_areas drop constraint if exists bin_areas_floor_name_key;
alter table public.bin_areas add constraint bin_areas_cat_floor_name_key unique (cat, floor, name);
