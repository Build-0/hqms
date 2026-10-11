-- 緊急回復：重新開放（只在上鎖後網站出問題時用）。會令資料庫再次任何人可讀寫。
do $do$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'staff' loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open all" on %I', t);
    execute format('create policy "open all" on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant all on %I to anon, authenticated', t);
  end loop;
end $do$;
grant usage on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
create or replace function _require_admin(p_password text) returns void language plpgsql as $$ begin return; end $$;
create or replace function verify_password(p_password text) returns boolean language sql as $$ select true $$;
drop policy if exists "photos upload" on storage.objects;
drop policy if exists "photos delete" on storage.objects;
create policy "open photos" on storage.objects for all to anon, authenticated
  using (bucket_id in ('photos','defect-photos')) with check (bucket_id in ('photos','defect-photos'));
notify pgrst, 'reload schema';
