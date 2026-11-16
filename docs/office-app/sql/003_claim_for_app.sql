-- InvestSuite कार्यालय — 003: a code is claimed only by the right app (run once after 001; safe to run again).
-- कार्यालय app accepts only CM / HM codes, InvestSuite only अधिकारी / सिपाही codes. A code typed in the wrong app is
-- NOT used up (the person can still type it in the right app) and the app says which app it belongs to.
-- Result: {status: 'ok' | 'wrong' | 'other_app', role, member_id}.

create or replace function public.claim_member_for(p_code text, p_app text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare mid uuid; r text;
begin
  if auth.uid() is null then raise exception 'पहले sign in करें'; end if;
  if p_app not in ('office', 'officer') then raise exception 'गलत app'; end if;
  if (select count(*) from claim_attempts where user_id = auth.uid() and tried_at > now() - interval '1 hour') >= 10 then
    raise exception 'बहुत बार गलत कोड — 1 घंटे बाद फिर कोशिश करें';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'यह फ़ोन पहले से जुड़ा है'; end if;
  select c.member_id, x.role into mid, r from member_codes c join members x on x.id = c.member_id
    where c.code = p_code and c.expires_at > now() and x.active and x.user_id is null;
  if mid is null then
    insert into claim_attempts(user_id) values (auth.uid());
    return jsonb_build_object('status', 'wrong');
  end if;
  if (p_app = 'office') <> (r in ('cm', 'hm')) then
    insert into claim_attempts(user_id) values (auth.uid());   -- counted, so codes can't be probed this way
    return jsonb_build_object('status', 'other_app', 'role', r);
  end if;
  update members set user_id = auth.uid() where id = mid;
  delete from member_codes where member_id = mid;
  return jsonb_build_object('status', 'ok', 'role', r, 'member_id', mid);
end $$;

revoke execute on function public.claim_member_for(text, text) from public, anon;
grant execute on function public.claim_member_for(text, text) to authenticated;

select '003 पूरा' as natija;
