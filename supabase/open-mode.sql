-- 開放模式（設計期暫用）：未登入也可讀寫資料及上傳相片
-- ⚠️ 部署上線給同事用之前，請執行 lock-mode.sql 收回，並改用帳號登入
create policy "open complaints" on complaints for all to anon using (true) with check (true);
create policy "open topics" on topics for all to anon using (true) with check (true);
create policy "open focus" on daily_focus for all to anon using (true) with check (true);
create policy "open training" on training_sections for all to anon using (true) with check (true);
create policy "open categories" on categories for all to anon using (true) with check (true);
create policy "open attendants" on attendants for all to anon using (true) with check (true);
create policy "open scores" on scores for all to anon using (true) with check (true);
create policy "open upload photos" on storage.objects for insert to anon with check (bucket_id = 'photos');
create policy "open delete photos" on storage.objects for delete to anon using (bucket_id = 'photos');
