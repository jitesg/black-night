-- InvestSuite कार्यालय — 001_init.sql का भाग 1/4 (टेबल). क्रम से चलाएँ: 1 → 2 → 3 → 4.
-- पूरा चिपका है तो Run के बाद नीचे एक लाइन आएगी: "भाग 1/4 पूरा".

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

select 'भाग 1/4 पूरा' as natija;
