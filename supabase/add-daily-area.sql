-- 2026-08 每日清潔：加「區域」欄（房間/浴室），配合「類別（抹塵）＞區域＞清潔點」的分層顯示
alter table cleaning_items add column if not exists area text not null default '';
