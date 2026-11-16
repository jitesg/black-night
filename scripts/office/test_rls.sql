-- Scenario test for docs/office-app/sql/001_init.sql (run by scripts/office/test_sql.sh). Any failed check raises.
\set ON_ERROR_STOP on
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'),  -- CM of थाना A
  ('00000000-0000-0000-0000-00000000000b'),  -- officer of A
  ('00000000-0000-0000-0000-00000000000c'),  -- CM of थाना B
  ('00000000-0000-0000-0000-00000000000d');  -- stranger

create function pg_temp.as_phone(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as
$$ begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

set role authenticated;

-- CM A makes थाना A and adds an officer
select pg_temp.as_phone('00000000-0000-0000-0000-00000000000a');
select (public.create_thana('बछरावां', 'रायबरेली', 'राम (CM)', 'cm')).id is not null as made;
select pg_temp.check(public.is_office(), 'CM is office');
create temp table t_code as select * from public.add_member('officer', 'उ0नि0 श्याम', 'उ0नि0', '9000000000');
grant select on t_code to authenticated;
select pg_temp.check((select code from t_code) ~ '^[0-9]{6}$', 'add_member gives a 6-digit code');
select pg_temp.check((select count(*) from public.member_codes) = 1, 'CM sees the code');

-- second create_thana from the same phone is refused
do $$ begin perform public.create_thana('x', 'y', 'z', 'cm'); raise exception 'FAILED: second thana allowed';
exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; raise notice 'ok: second thana refused'; end $$;

-- officer claims the code
select pg_temp.as_phone('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.claim_member('000000x') is null, 'wrong code → null');
select pg_temp.check((public.claim_member((select code from t_code))).name = 'उ0नि0 श्याम', 'officer claims the code');
select pg_temp.check(not public.is_office(), 'officer is not office');
select pg_temp.check((select count(*) from public.member_codes) = 0, 'officer sees no codes');
select pg_temp.check((select count(*) from public.members) = 2, 'officer sees the 2 members of his थाना');
-- officer cannot insert a task
do $$ begin
  insert into public.tasks(thana_id, kind, subtype, title) values (public.my_thana_id(), 'court', 'NBW', 'x');
  raise exception 'FAILED: officer inserted a task';
exception when insufficient_privilege then raise notice 'ok: officer cannot add a task'; end $$;
select public.set_push_token('ExponentPushToken[abc]');

-- CM A sends a task to the officer
select pg_temp.as_phone('00000000-0000-0000-0000-00000000000a');
insert into public.tasks(thana_id, kind, subtype, title, due_on)
  values (public.my_thana_id(), 'court', 'NBW', 'NBW — वाद सं0 12/2026', current_date + 10);
insert into public.task_assignees(task_id, member_id)
  select t.id, m.id from public.tasks t, public.members m where m.role = 'officer';
select pg_temp.check((select push_token from public.members where role = 'officer') = 'ExponentPushToken[abc]', 'office sees push token');
insert into storage.objects(bucket_id, name)
  select 'task-files', public.my_thana_id() || '/' || id || '/nbw.jpg' from public.tasks;

-- officer sees it and changes only the status
select pg_temp.as_phone('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.tasks) = 1, 'officer sees his task');
update public.task_assignees set status = 'seen';
select pg_temp.check((select status from public.task_assignees) = 'seen', 'officer sets status');
do $$ begin update public.task_assignees set member_id = member_id; raise exception 'FAILED: officer changed member_id';
exception when insufficient_privilege then raise notice 'ok: officer can change only the status'; end $$;
do $$ begin update public.tasks set title = 'x'; if found then raise exception 'FAILED: officer edited a task'; end if;
  raise notice 'ok: officer cannot edit a task';
exception when insufficient_privilege then raise notice 'ok: officer cannot edit a task'; end $$;
select pg_temp.check((select count(*) from storage.objects) = 1, 'officer sees the task file');

-- CM of another थाना sees nothing of A
select pg_temp.as_phone('00000000-0000-0000-0000-00000000000c');
select (public.create_thana('लालगंज', 'रायबरेली', 'सीता (CM)', 'cm')).id is not null as made_b;
select pg_temp.check((select count(*) from public.tasks) = 0, 'other थाना: no tasks');
select pg_temp.check((select count(*) from public.members) = 1, 'other थाना: only own member');
select pg_temp.check((select count(*) from public.task_assignees) = 0, 'other थाना: no assignees');
select pg_temp.check((select count(*) from storage.objects) = 0, 'other थाना: no files');
do $$ begin
  insert into public.task_assignees(task_id, member_id) select t.id, public.my_member_id() from public.tasks t;
  raise notice 'ok: cannot see A tasks to assign';
end $$;

-- stranger (signed in, no code) sees nothing; 10 wrong codes → blocked
select pg_temp.as_phone('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.members) = 0, 'stranger: no members');
select pg_temp.check((select count(*) from public.thanas) = 0, 'stranger: no thanas');
select public.claim_member('111111') from generate_series(1, 10);
do $$ begin perform public.claim_member('222222'); raise exception 'FAILED: no rate limit';
exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; raise notice 'ok: 11th try blocked'; end $$;

-- anon role can do nothing
reset role;
set role anon;
do $$ begin perform count(*) from public.tasks; raise exception 'FAILED: anon read tasks';
exception when insufficient_privilege then raise notice 'ok: anon cannot read'; end $$;
reset role;
select 'ALL RLS CHECKS PASSED' as result;
