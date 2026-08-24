-- 2026-08 主題庫與客訴分類分離：for_topics 控制哪些分類出現在主題庫
alter table categories add column if not exists for_topics boolean not null default true;
update categories set for_topics = false where name in ('床品布草','馬桶廁所','排水花灑','蟲害','設備');
