-- Minimal Supabase look-alike for testing docs/office-app/sql/*.sql on a plain Postgres (scripts/office/test_sql.sh).
-- auth.uid() reads the setting request.jwt.claim.sub (set per test "phone").
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant execute on function storage.foldername(text) to authenticated;

create publication supabase_realtime;
