-- InvestSuite कार्यालय — 004: an officer's phone leaves the थाना ("इस फ़ोन को कार्यालय से अलग करें" in InvestSuite).
-- Only अधिकारी / सिपाही (a CM / HM is unlinked by another CM / HM with "नया कोड"). The member row stays; the office list then
-- shows "कोड नहीं" → the office makes a new code to join again. Run once after 003; safe to run again.

create or replace function public.leave_thana()
returns void language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'पहले sign in करें'; end if;
  update members set user_id = null, push_token = null
    where user_id = auth.uid() and role in ('officer', 'constable');
end $$;

revoke execute on function public.leave_thana() from public, anon;
grant execute on function public.leave_thana() to authenticated;

select '004 पूरा' as natija;
