-- InvestSuite कार्यालय — 001_init.sql का भाग 2/4 (फ़ंक्शन — भाग 1). क्रम से चलाएँ: 1 → 2 → 3 → 4.
-- पूरा चिपका है तो Run के बाद नीचे एक लाइन आएगी: "भाग 2/4 पूरा".

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

select 'भाग 2/4 पूरा' as natija;
