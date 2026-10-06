-- 2026-10 查房快速記錄：影相 → 揀房務員 → 揀問題標籤（不用打字）
-- 每個標籤可連結主題庫的一個主題，用來顯示「正確做法」及日後生成培訓卡。
-- 在 SQL Editor 執行一次即可（重跑不會重複）。

-- ① 問題標籤（可在 app 內增改、連結主題）
create table if not exists finding_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  dim text not null default '',                       -- 對應清潔評分七維度
  topic_id uuid references topics(id) on delete set null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ② 查房發現記錄（一個標籤一筆；同一次可揀多個標籤，共用相片）
create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  attendant_id uuid references attendants(id) on delete cascade,
  room text not null default '',
  tag_id uuid references finding_tags(id) on delete set null,
  tag text not null default '',                        -- 記錄當時的標籤名（標籤改名/刪除後仍可讀）
  photos jsonb not null default '[]',
  note text not null default '',
  inspector text not null default '',
  batch text not null default '',                      -- 同一次記錄的識別碼（多標籤共用相片）
  created_at timestamptz not null default now()
);
create index if not exists findings_att_idx on findings(attendant_id, date);
create index if not exists findings_date_idx on findings(date);

alter table finding_tags enable row level security;
alter table findings enable row level security;
drop policy if exists "auth all finding_tags" on finding_tags;
drop policy if exists "auth all findings" on findings;
create policy "auth all finding_tags" on finding_tags for all to authenticated using (true) with check (true);
create policy "auth all findings" on findings for all to authenticated using (true) with check (true);
-- 開放模式用（lock-mode.sql 會收回）
drop policy if exists "open finding_tags" on finding_tags;
drop policy if exists "open findings" on findings;
create policy "open finding_tags" on finding_tags for all to anon using (true) with check (true);
create policy "open findings" on findings for all to anon using (true) with check (true);

-- ③ 預設 15 個常見問題標籤（只在標籤表是空時匯入），並按主題名稱自動連結主題庫
insert into finding_tags (name, dim, sort_order, topic_id)
select v.name, v.dim, v.ord, (select t.id from topics t where t.title = v.topic order by t.created_at limit 1)
from (values
  ('床頭板／燈罩有塵',     '抹塵',         1,  null),
  ('桌面／電視櫃有塵',     '抹塵',         2,  null),
  ('窗台／冷氣口有塵',     '抹塵',         3,  null),
  ('床底／沙發底有雜物',   '吸塵',         4,  '退房檢查程序'),
  ('地毯邊角未吸淨',       '吸塵',         5,  null),
  ('床單起皺／四角未包好', '鋪床',         6,  '床單四角拉緊標準'),
  ('床品有毛髮／污漬',     '鋪床',         7,  '浴巾布草污漬檢查'),
  ('杯具有水漬／指紋',     '清潔器皿',     8,  null),
  ('坐廁有污漬',           '清潔器皿',     9,  '馬桶蓋板內緣與底部'),
  ('浴室／排水口有毛髮',   '清潔器皿',     10, '排水口毛髮檢查'),
  ('鏡面有水漬／手印',     '玻璃及鏡面',   11, null),
  ('淋浴屏有水垢',         '玻璃及鏡面',   12, null),
  ('備品欠缺／擺放錯',     '物品整齊度',   13, '沐浴用品補充標準'),
  ('傢俬擺位不正',         '物品整齊度',   14, null),
  ('做房車雜亂',           '做房車整潔度', 15, '工作車每日整理標準')
) as v(name, dim, ord, topic)
where not exists (select 1 from finding_tags);

select t.name, t.dim, tp.title as 連結主題 from finding_tags t left join topics tp on tp.id = t.topic_id order by t.sort_order;
