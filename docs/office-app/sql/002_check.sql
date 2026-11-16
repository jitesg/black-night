-- InvestSuite कार्यालय — setup check. Run AFTER 001_init.sql (SQL Editor → New query → paste → Run).
-- Every row should say "ठीक"; send a screenshot of the result.
select 'टेबल (7)' as jaanch,
       case when count(*) = 7 then 'ठीक' else 'कमी: ' || (7 - count(*))::text || ' टेबल नहीं बनी' end as natija
  from pg_tables where schemaname = 'public'
   and tablename in ('thanas','members','member_codes','claim_attempts','tasks','task_assignees','task_files')
union all
select 'सुरक्षा (RLS) चालू',
       case when bool_and(rowsecurity) then 'ठीक' else 'नहीं — 001 फिर से चलाएँ' end
  from pg_tables where schemaname = 'public'
   and tablename in ('thanas','members','member_codes','claim_attempts','tasks','task_assignees','task_files')
union all
select 'फ़ंक्शन (कोड से जुड़ना आदि)',
       case when count(*) >= 5 then 'ठीक' else 'नहीं — 001 फिर से चलाएँ' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('create_thana','add_member','reset_member_code','claim_member','set_push_token')
union all
select 'फ़ाइल रखने की जगह (task-files)',
       case when exists (select 1 from storage.buckets where id = 'task-files' and not public) then 'ठीक' else 'नहीं बनी' end
union all
select 'तुरंत सूचना (Realtime)',
       case when (select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename in ('tasks','task_assignees')) = 2 then 'ठीक' else 'नहीं जुड़ा' end;
