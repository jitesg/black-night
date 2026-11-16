-- InvestSuite कार्यालय — 001_init.sql का भाग 3/4 (फ़ंक्शन — भाग 2). क्रम से चलाएँ: 1 → 2 → 3 → 4.
-- पूरा चिपका है तो Run के बाद नीचे एक लाइन आएगी: "भाग 3/4 पूरा".

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

select 'भाग 3/4 पूरा' as natija;
