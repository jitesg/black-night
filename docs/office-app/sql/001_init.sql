-- InvestSuite कार्यालय — चरण 1 database (v2, tested on a local Postgres 16 with Supabase-like auth / storage stubs:
-- scripts/office/test_sql.sh). Run ONCE in Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run again: tables use "if not exists", policies / functions are dropped and made again.
--
-- Before running: Authentication → Sign In / Providers → "Allow anonymous sign-ins" = ON
-- (every phone signs in anonymously; a 6-digit member code then ties that phone to one थाना member).
--
-- Who sees what (Row Level Security):
--   • कार्यालय (cm / hm)  → everything of their own थाना, incl. the member codes
--   • अधिकारी / सिपाही     → only tasks given to them, the names of their थाना's members (never the codes)
--   • From the officer only STATUS comes back (received / seen / done / removed …) — never the आख्या text or case diary.

create extension if not exists pgcrypto;

-- ── थाना ───────────────────────────────────────────────────────────────────────
create table if not exists public.thanas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- बछरावां
  district    text not null,                 -- रायबरेली
  created_at  timestamptz not null default now()
);

-- ── सदस्य (CM / HM / अधिकारी / सिपाही) — no codes here (members can read this table) ─────────
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  thana_id    uuid not null references public.thanas(id) on delete cascade,
  role        text not null check (role in ('cm','hm','officer','constable')),
  name        text not null,
  rank        text,                          -- उ0नि0 / निरीक्षक / आरक्षी / मुख्य आरक्षी …
  mobile      text,
  user_id     uuid unique references auth.users(id) on delete set null,  -- the phone that claimed the code
  push_token  text,                          -- Expo push token of that phone
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists members_thana on public.members(thana_id);

-- ── जोड़ने का कोड (only the कार्यालय can read it) ─────────────────────────────────────
create table if not exists public.member_codes (
  member_id   uuid primary key references public.members(id) on delete cascade,
  code        text not null unique check (code ~ '^[0-9]{6}$'),
  expires_at  timestamptz not null default now() + interval '7 days'
);

-- Wrong-code tries (a phone gets 10 wrong tries an hour).
create table if not exists public.claim_attempts (
  user_id     uuid not null,
  tried_at    timestamptz not null default now()
);
create index if not exists claim_attempts_user on public.claim_attempts(user_id, tried_at);

-- ── काम (न्यायालय का कागज़ / प्रार्थना पत्र; later सूचना / ड्यूटी / तामील) ────────────
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  thana_id      uuid not null references public.thanas(id) on delete cascade,
  kind          text not null check (kind in ('court','petition','info','duty','tamil')),
  subtype       text not null,               -- प्रकार: NBW / सम्मन / जनता दर्शन / RL … (counts + filters)
  title         text not null,               -- short line for lists
  fields        jsonb not null default '{}', -- the form values (न्यायालय, वाद सं0, आवेदक …)
  received_on   date,
  due_on        date,                        -- नियत / अंतिम तिथि
  created_by    uuid references public.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),   -- office edits → officer's app shows 🔔
  closed        boolean not null default false
);
create index if not exists tasks_thana_kind_subtype on public.tasks(thana_id, kind, subtype);

-- ── किसे दिया + उसकी स्थिति ─────────────────────────────────────────────────────
create table if not exists public.task_assignees (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  status      text not null default 'sent'
              check (status in ('sent','received','seen','done','not_done','returned','removed')),
              -- removed = अधिकारी ने अपने फ़ोन से हटाया
  status_note text,                          -- e.g. तामील नहीं — पता नहीं मिला
  updated_at  timestamptz not null default now(),
  primary key (task_id, member_id)
);
create index if not exists task_assignees_member on public.task_assignees(member_id);

-- ── फ़ोटो / PDF (files in Storage bucket "task-files", path <thana_id>/<task_id>/<name>) ──
create table if not exists public.task_files (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  path        text not null,
  name        text,
  mime        text,
  added_by    uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists task_files_task on public.task_files(task_id);

-- ── helpers ─────────────────────────────────────────────────────────────────────
create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from public.members where user_id = auth.uid() and active limit 1 $$;

create or replace function public.my_thana_id() returns uuid
language sql stable security definer set search_path = public as
$$ select thana_id from public.members where user_id = auth.uid() and active limit 1 $$;

create or replace function public.is_office() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('cm','hm') from public.members where user_id = auth.uid() and active limit 1), false) $$;

-- Policy helpers (security definer, so a policy on tasks never reads task_assignees through ITS policy and loops).
create or replace function public.task_in_my_thana(p_task uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.tasks where id = p_task and thana_id = public.my_thana_id()) $$;

create or replace function public.task_is_mine(p_task uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.task_assignees where task_id = p_task and member_id = public.my_member_id()) $$;

-- Storage file <thana_id>/<task_id>/<file>: office of that थाना, or the person the task was given to.
create or replace function public.task_file_visible(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare parts text[] := string_to_array(p_name, '/'); t public.tasks;
begin
  if array_length(parts, 1) is distinct from 3 then return false; end if;
  begin
    select * into t from public.tasks where id = parts[2]::uuid and thana_id = parts[1]::uuid;
  exception when invalid_text_representation then return false;
  end;
  if t.id is null then return false; end if;
  return (public.is_office() and t.thana_id = public.my_thana_id()) or public.task_is_mine(t.id);
end $$;

-- A new unused 6-digit code.
create or replace function public.new_join_code() returns text
language plpgsql volatile security definer set search_path = public as
$$
declare c text;
begin
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from member_codes where code = c);
  end loop;
  return c;
end $$;

-- First setup on the office phone: makes the थाना and the first कार्यालय member, tied to this phone.
create or replace function public.create_thana(p_thana text, p_district text, p_name text, p_role text)
returns public.members language plpgsql security definer set search_path = public as
$$
declare t uuid; m public.members;
begin
  if auth.uid() is null then raise exception 'पहले sign in करें'; end if;
  if p_role not in ('cm','hm') then raise exception 'role cm या hm होना चाहिए'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'यह फ़ोन पहले से एक थाने से जुड़ा है'; end if;
  if coalesce(trim(p_thana), '') = '' or coalesce(trim(p_district), '') = '' or coalesce(trim(p_name), '') = '' then
    raise exception 'थाना, जनपद और नाम भरें';
  end if;
  insert into thanas(name, district) values (trim(p_thana), trim(p_district)) returning id into t;
  insert into members(thana_id, role, name, user_id) values (t, p_role, trim(p_name), auth.uid()) returning * into m;
  return m;
end $$;

-- कार्यालय adds a member (अधिकारी / सिपाही / another CM-HM) → returns the member's 6-digit code.
create or replace function public.add_member(p_role text, p_name text, p_rank text default null, p_mobile text default null)
returns table (member_id uuid, code text) language plpgsql security definer set search_path = public as
$$
declare m uuid; c text;
begin
  if not is_office() then raise exception 'यह काम सिर्फ़ कार्यालय कर सकता है'; end if;
  if p_role not in ('cm','hm','officer','constable') then raise exception 'गलत role'; end if;
  insert into members(thana_id, role, name, rank, mobile) values (my_thana_id(), p_role, trim(p_name), p_rank, p_mobile)
    returning id into m;
  c := new_join_code();
  insert into member_codes(member_id, code) values (m, c);
  return query select m, c;
end $$;

-- A new code for a member (lost phone / code expired); the old phone is unlinked.
create or replace function public.reset_member_code(p_member uuid)
returns text language plpgsql security definer set search_path = public as
$$
declare c text;
begin
  if not is_office() or not exists (select 1 from members where id = p_member and thana_id = my_thana_id()) then
    raise exception 'यह काम सिर्फ़ उसी थाने का कार्यालय कर सकता है';
  end if;
  if p_member = my_member_id() then raise exception 'अपना कोड नहीं बदल सकते'; end if;
  update members set user_id = null, push_token = null where id = p_member;
  c := new_join_code();
  insert into member_codes(member_id, code) values (p_member, c)
    on conflict (member_id) do update set code = excluded.code, expires_at = now() + interval '7 days';
  return c;
end $$;

-- A person types the 6-digit code in their app → this phone becomes that member (code used once, then deleted).
-- Wrong / expired code → returns NULL (not an error, so the wrong try is counted); the app says "कोड सही नहीं है".
drop function if exists public.claim_member(text);
create function public.claim_member(p_code text)
returns public.members language plpgsql security definer set search_path = public as
$$
declare mid uuid; m public.members;
begin
  if auth.uid() is null then raise exception 'पहले sign in करें'; end if;
  if (select count(*) from claim_attempts where user_id = auth.uid() and tried_at > now() - interval '1 hour') >= 10 then
    raise exception 'बहुत बार गलत कोड — 1 घंटे बाद फिर कोशिश करें';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'यह फ़ोन पहले से जुड़ा है'; end if;
  select c.member_id into mid from member_codes c join members x on x.id = c.member_id
    where c.code = p_code and c.expires_at > now() and x.active and x.user_id is null;
  if mid is null then
    insert into claim_attempts(user_id) values (auth.uid());
    return null;
  end if;
  update members set user_id = auth.uid() where id = mid returning * into m;
  delete from member_codes where member_id = mid;
  return m;
end $$;

-- The app saves this phone's Expo push token.
create or replace function public.set_push_token(p_token text)
returns void language sql security definer set search_path = public as
$$ update members set push_token = p_token where user_id = auth.uid() $$;

-- Office edits a task → updated_at moves (officer's app shows 🔔); status change → its updated_at.
create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
drop trigger if exists task_assignees_touch on public.task_assignees;
create trigger task_assignees_touch before update on public.task_assignees for each row execute function public.touch_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────────
alter table public.thanas         enable row level security;
alter table public.members        enable row level security;
alter table public.member_codes   enable row level security;
alter table public.claim_attempts enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_files     enable row level security;

drop policy if exists thana_read on public.thanas;
create policy thana_read on public.thanas for select using (id = public.my_thana_id());

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (thana_id = public.my_thana_id());
drop policy if exists members_office_update on public.members;
create policy members_office_update on public.members for update
  using (public.is_office() and thana_id = public.my_thana_id())
  with check (public.is_office() and thana_id = public.my_thana_id());

drop policy if exists codes_office_read on public.member_codes;
create policy codes_office_read on public.member_codes for select
  using (public.is_office() and exists (select 1 from public.members x where x.id = member_id and x.thana_id = public.my_thana_id()));

drop policy if exists tasks_office on public.tasks;
create policy tasks_office on public.tasks for all
  using (public.is_office() and thana_id = public.my_thana_id())
  with check (public.is_office() and thana_id = public.my_thana_id());
drop policy if exists tasks_assignee_read on public.tasks;
create policy tasks_assignee_read on public.tasks for select
  using (public.task_is_mine(id));

drop policy if exists assign_office on public.task_assignees;
create policy assign_office on public.task_assignees for all
  using (public.is_office() and public.task_in_my_thana(task_id))
  with check (public.is_office() and public.task_in_my_thana(task_id)
              and exists (select 1 from public.members x where x.id = member_id and x.thana_id = public.my_thana_id()));
drop policy if exists assign_self_read on public.task_assignees;
create policy assign_self_read on public.task_assignees for select using (member_id = public.my_member_id());
drop policy if exists assign_self_status on public.task_assignees;
create policy assign_self_status on public.task_assignees for update
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

drop policy if exists files_read on public.task_files;
create policy files_read on public.task_files for select
  using ((public.is_office() and public.task_in_my_thana(task_id)) or public.task_is_mine(task_id));
drop policy if exists files_office_write on public.task_files;
create policy files_office_write on public.task_files for all
  using (public.is_office() and public.task_in_my_thana(task_id))
  with check (public.is_office() and public.task_in_my_thana(task_id));

-- ── What the app may touch (automatic exposure is off in this project) ──────────────────
revoke all on public.thanas, public.members, public.member_codes, public.claim_attempts,
              public.tasks, public.task_assignees, public.task_files from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.thanas, public.members, public.member_codes to authenticated;
grant update (name, rank, mobile, active) on public.members to authenticated;          -- office only (policy)
grant select, insert, update, delete on public.tasks, public.task_files to authenticated;
grant select, insert, delete on public.task_assignees to authenticated;
grant update (status, status_note) on public.task_assignees to authenticated;          -- officer: only the status
revoke execute on all functions in schema public from public, anon;
grant execute on function public.my_member_id(), public.my_thana_id(), public.is_office(),
  public.task_in_my_thana(uuid), public.task_is_mine(uuid), public.task_file_visible(text),
  public.create_thana(text,text,text,text), public.add_member(text,text,text,text),
  public.reset_member_code(uuid), public.claim_member(text), public.set_push_token(text) to authenticated;

-- ── Storage: bucket "task-files" (private), path <thana_id>/<task_id>/<file> ────────────
insert into storage.buckets (id, name, public) values ('task-files', 'task-files', false) on conflict (id) do nothing;

drop policy if exists task_files_read on storage.objects;
create policy task_files_read on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and public.task_file_visible(name));
drop policy if exists task_files_office_write on storage.objects;
create policy task_files_office_write on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and public.is_office() and (storage.foldername(name))[1] = public.my_thana_id()::text);
drop policy if exists task_files_office_delete on storage.objects;
create policy task_files_office_delete on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and public.is_office() and (storage.foldername(name))[1] = public.my_thana_id()::text);

-- ── Realtime: apps hear new tasks / status changes at once ──────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.task_assignees; exception when duplicate_object then null; end;
end $$;
