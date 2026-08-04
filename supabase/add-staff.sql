-- 2026-08-01 增量：客訴加入涉事房務員與主管
alter table complaints add column if not exists ra text not null default '';
alter table complaints add column if not exists supervisor text not null default '';
