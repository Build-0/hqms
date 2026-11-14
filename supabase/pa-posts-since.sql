-- 公共地區崗位：上崗日期（員工由幾時開始做呢個崗位）
alter table public.pa_posts add column if not exists since date;
