-- 房務資訊：可編輯內容（每個分頁一行，沒有記錄就用程式內預設）
create table if not exists public.hskp_pages (id text primary key, html text not null, updated_at timestamptz default now(), updated_by text);
alter table public.hskp_pages enable row level security;
create policy "hskp sel" on public.hskp_pages for select to public using (COALESCE(ov('hskp'), 'edit') <> 'none');
create policy "hskp ins" on public.hskp_pages for insert to public with check (COALESCE(ov('hskp'), 'edit') = 'edit');
create policy "hskp upd" on public.hskp_pages for update to public using (COALESCE(ov('hskp'), 'edit') = 'edit') with check (COALESCE(ov('hskp'), 'edit') = 'edit');
create policy "hskp del" on public.hskp_pages for delete to public using (COALESCE(ov('hskp'), 'edit') = 'edit');
grant select, insert, update, delete on public.hskp_pages to anon, authenticated;
