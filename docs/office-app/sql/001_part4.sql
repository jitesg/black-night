-- InvestSuite कार्यालय — 001_init.sql का भाग 4/4 (सुरक्षा नियम, फ़ाइल जगह, Realtime). क्रम से चलाएँ: 1 → 2 → 3 → 4.
-- पूरा चिपका है तो Run के बाद नीचे एक लाइन आएगी: "भाग 4/4 पूरा".

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

select 'भाग 4/4 पूरा' as natija;
