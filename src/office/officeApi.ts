/**
 * InvestSuite कार्यालय — talks to the owner's Supabase project (docs/office-app/sql/001 + 003).
 * Every phone signs in anonymously (session kept in expo-sqlite localStorage); a member row with this phone's user id
 * says who it is. All reads / writes go through Row Level Security on the server.
 */
import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { OFFICE_SUPABASE_KEY, OFFICE_SUPABASE_URL } from './config';
import { cleanMobile, type MemberCode, type MemberRole, type OfficeMember } from './officeCore';

let _client: SupabaseClient | null = null;

export function officeClient(): SupabaseClient {
  _client ??= createClient(OFFICE_SUPABASE_URL, OFFICE_SUPABASE_KEY, {
    auth: {
      storage: localStorage,
      storageKey: 'investsuite-karyalay-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/** This phone's user id — signs in anonymously the first time. */
export async function ensureSession(): Promise<string> {
  const sb = officeClient();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: d, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  if (!d.user) throw new Error('sign in failed');
  return d.user.id;
}

export interface Thana { id: string; name: string; district: string }

export interface Me { member: OfficeMember; thana: Thana }

/** Who this phone is (null = not joined yet). */
export async function getMe(): Promise<Me | null> {
  const uid = await ensureSession();
  const sb = officeClient();
  const { data: member, error } = await sb.from('members').select('*').eq('user_id', uid).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!member) return null;
  const { data: thana, error: e2 } = await sb.from('thanas').select('id, name, district').eq('id', member.thana_id).single();
  if (e2) throw e2;
  return { member: member as OfficeMember, thana: thana as Thana };
}

export async function createThana(input: { thana: string; district: string; name: string; role: 'cm' | 'hm'; mobile?: string }): Promise<void> {
  await ensureSession();
  const sb = officeClient();
  const { data, error } = await sb.rpc('create_thana', {
    p_thana: input.thana.trim(), p_district: input.district.trim(), p_name: input.name.trim(), p_role: input.role,
  });
  if (error) throw error;
  const mobile = cleanMobile(input.mobile);
  const id = (data as OfficeMember | null)?.id;
  if (mobile && id) await sb.from('members').update({ mobile }).eq('id', id);
}

export type ClaimResult = { status: 'ok' | 'wrong' | 'other_app'; role?: MemberRole };

/** Join with a 6-digit code (003: only CM / HM codes are taken by the कार्यालय app). */
export async function claimCode(code: string, app: 'office' | 'officer'): Promise<ClaimResult> {
  await ensureSession();
  const { data, error } = await officeClient().rpc('claim_member_for', { p_code: code, p_app: app });
  if (error) throw error;
  return data as ClaimResult;
}

export interface MemberRow extends OfficeMember { code?: MemberCode }

/** Members of my थाना with their codes (codes come back only for the कार्यालय). */
export async function listMembers(): Promise<MemberRow[]> {
  const sb = officeClient();
  const [{ data: members, error }, { data: codes }] = await Promise.all([
    sb.from('members').select('*').eq('active', true),
    sb.from('member_codes').select('member_id, code, expires_at'),
  ]);
  if (error) throw error;
  const byId = new Map((codes ?? []).map((c) => [c.member_id as string, c as MemberCode]));
  return (members ?? []).map((m) => ({ ...(m as OfficeMember), code: byId.get(m.id as string) }));
}

export async function addMember(input: { role: MemberRole; name: string; rank?: string; mobile?: string }): Promise<{ memberId: string; code: string }> {
  const { data, error } = await officeClient().rpc('add_member', {
    p_role: input.role, p_name: input.name.trim(), p_rank: input.rank?.trim() || null, p_mobile: cleanMobile(input.mobile) || null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { member_id: string; code: string };
  return { memberId: row.member_id, code: row.code };
}

/** New code (lost phone / expired): the old phone is unlinked. */
export async function resetCode(memberId: string): Promise<string> {
  const { data, error } = await officeClient().rpc('reset_member_code', { p_member: memberId });
  if (error) throw error;
  return data as string;
}

/** Remove from the थाना (kept in history, can't log in any more). */
export async function removeMember(memberId: string): Promise<void> {
  const { error } = await officeClient().from('members').update({ active: false }).eq('id', memberId);
  if (error) throw error;
}

export async function updateMember(memberId: string, patch: { name?: string; rank?: string | null; mobile?: string | null }): Promise<void> {
  const { error } = await officeClient().from('members').update(patch).eq('id', memberId);
  if (error) throw error;
}

/** InvestSuite: this officer's phone leaves the थाना (004 leave_thana). */
export async function leaveThana(): Promise<void> {
  await ensureSession();
  const { error } = await officeClient().rpc('leave_thana');
  if (error) throw error;
}

/** Names of the कार्यालय (CM / HM) of my थाना — "संजय (CM)". */
export async function officeNames(): Promise<string[]> {
  const { data, error } = await officeClient().from('members').select('name, role').in('role', ['cm', 'hm']).eq('active', true);
  if (error) throw error;
  return (data ?? []).map((m) => `${m.name} (${String(m.role).toUpperCase()})`);
}
