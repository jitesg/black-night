-- InvestSuite कार्यालय — चरण 1 database (SAMPLE / DRAFT — do not run until the owner approves)
-- Run once in Supabase → SQL Editor. Before running: Authentication → Sign In / Providers → turn ON "Anonymous sign-ins"
-- (every phone signs in anonymously; a 6-digit member code then ties that phone to one थाना member).
--
-- Who sees what (Row Level Security):
--   • कार्यालय (cm / hm)  → everything of their own थाना
--   • अधिकारी / सिपाही     → only tasks given to them (+ their own member row)
--   • Only STATUS comes back from the officer — never the आख्या text / case diary.

create extension if not exists pgcrypto;

-- ── थाना ───────────────────────────────────────────────────────────────────────
create table public.thanas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- बछरावां
  district    text not null,                 -- रायबरेली
  created_at  timestamptz not null default now()
);

-- ── सदस्य (CM / HM / अधिकारी / सिपाही) ────────────────────────────────────────
create table public.members (
  id          uuid primary key default gen_random_uuid(),
  thana_id    uuid not null references public.thanas(id) on delete cascade,
  role        text not null check (role in ('cm','hm','officer','constable')),
  name        text not null,
  rank        text,                          -- उ0नि0 / निरीक्षक / आरक्षी / मुख्य आरक्षी / होमगार्ड …
  mobile      text,
  join_code   text not null unique,          -- 6 digits, given by the office
  user_id     uuid unique references auth.users(id) on delete set null,  -- the phone that claimed the code
  push_token  text,                          -- Expo push token of that phone
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── काम (न्यायालय का कागज़ / प्रार्थना पत्र; later सूचना / ड्यूटी / तामील) ────────────
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  thana_id      uuid not null references public.thanas(id) on delete cascade,
  kind          text not null check (kind in ('court','petition','info','duty','tamil')),
  title         text not null,               -- short line for lists
  fields        jsonb not null default '{}', -- the form values (न्यायालय, वाद सं0, आवेदक …)
  received_on   date,
  due_on        date,                        -- नियत / अंतिम तिथि
  created_by    uuid references public.members(id),
  created_at    timestamptz not null default now(),
  closed        boolean not null default false
);

-- ── किसे दिया + उसकी स्थिति ─────────────────────────────────────────────────────
create table public.task_assignees (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  status      text not null default 'sent'
              check (status in ('sent','received','seen','done','not_done','returned')),
  status_note text,                          -- e.g. तामील नहीं — पता नहीं मिला
  updated_at  timestamptz not null default now(),
  primary key (task_id, member_id)
);

-- ── फ़ोटो / PDF (files live in Storage bucket "task-files") ──────────────────────
create table public.task_files (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  path        text not null,                 -- task-files/<thana>/<task>/<name>
  added_by    uuid references public.members(id),
  created_at  timestamptz not null default now()
);

-- ── helpers ─────────────────────────────────────────────────────────────────────
create or replace function public.my_member() returns public.members
language sql stable security definer set search_path = public as
$$ select * from public.members where user_id = auth.uid() and active limit 1 $$;

create or replace function public.is_office() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('cm','hm') from public.members where user_id = auth.uid() and active limit 1), false) $$;

-- First setup on the office phone: creates the थाना and the first कार्यालय member, claims it for this phone.
create or replace function public.create_thana(p_thana text, p_district text, p_name text, p_role text)
returns public.members language plpgsql security definer set search_path = public as
$$
declare t uuid; m public.members;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_role not in ('cm','hm') then raise exception 'role must be cm or hm'; end if;
  insert into thanas(name, district) values (p_thana, p_district) returning id into t;
  insert into members(thana_id, role, name, join_code, user_id)
    values (t, p_role, p_name, lpad((floor(random()*1000000))::int::text, 6, '0'), auth.uid())
    returning * into m;
  return m;
end $$;

-- A person types the 6-digit code in their app → this phone becomes that member.
create or replace function public.claim_member(p_code text)
returns public.members language plpgsql security definer set search_path = public as
$$
declare m public.members;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  update members set user_id = auth.uid()
    where join_code = p_code and active and (user_id is null or user_id = auth.uid())
    returning * into m;
  if m.id is null then raise exception 'कोड सही नहीं है या पहले ही इस्तेमाल हो चुका है'; end if;
  return m;
end $$;

-- ── Row Level Security ───────────────────────────────────────────────────────────
alter table public.thanas         enable row level security;
alter table public.members        enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_files     enable row level security;

create policy thana_read on public.thanas for select
  using (id = (public.my_member()).thana_id);

create policy members_read on public.members for select
  using (thana_id = (public.my_member()).thana_id);
create policy members_office_write on public.members for all
  using (public.is_office() and thana_id = (public.my_member()).thana_id)
  with check (public.is_office() and thana_id = (public.my_member()).thana_id);

create policy tasks_office on public.tasks for all
  using (public.is_office() and thana_id = (public.my_member()).thana_id)
  with check (public.is_office() and thana_id = (public.my_member()).thana_id);
create policy tasks_assignee_read on public.tasks for select
  using (exists (select 1 from public.task_assignees a
                 where a.task_id = tasks.id and a.member_id = (public.my_member()).id));

create policy assign_office on public.task_assignees for all
  using (public.is_office() and exists (select 1 from public.tasks t where t.id = task_id and t.thana_id = (public.my_member()).thana_id))
  with check (public.is_office() and exists (select 1 from public.tasks t where t.id = task_id and t.thana_id = (public.my_member()).thana_id));
create policy assign_self_read on public.task_assignees for select
  using (member_id = (public.my_member()).id);
create policy assign_self_status on public.task_assignees for update
  using (member_id = (public.my_member()).id)
  with check (member_id = (public.my_member()).id);

create policy files_read on public.task_files for select
  using (exists (select 1 from public.tasks t where t.id = task_id and (
           (public.is_office() and t.thana_id = (public.my_member()).thana_id)
           or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.member_id = (public.my_member()).id))));
create policy files_office_write on public.task_files for insert
  with check (public.is_office());

-- Only these are reachable through the app's API (automatic exposure was turned off when the project was made).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.thanas, public.members, public.tasks, public.task_assignees, public.task_files to authenticated;
grant execute on function public.create_thana(text,text,text,text), public.claim_member(text) to authenticated;
