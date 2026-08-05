-- 2026-08 清潔度考核升級：房務員名單加資料欄、評分改七維度
alter table attendants add column if not exists name_cn text not null default '';
alter table attendants add column if not exists floor text not null default '';
alter table attendants add column if not exists emp_id text not null default '';

-- score 沿用為「總分」（滿分35）；dims 存七項各1-5；inspector 抽查人；note 作「針對性加強」
alter table scores add column if not exists dims jsonb not null default '{}';
alter table scores add column if not exists inspector text not null default '';
