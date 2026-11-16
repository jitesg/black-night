/**
 * InvestSuite कार्यालय — pure rules (no React / Supabase). Tests: scripts/test_office_core.ts
 */

export type MemberRole = 'cm' | 'hm' | 'officer' | 'constable';

export interface OfficeMember {
  id: string;
  thana_id: string;
  role: MemberRole;
  name: string;
  rank: string | null;
  mobile: string | null;
  user_id: string | null;
  active: boolean;
  created_at?: string;
}

export interface MemberCode {
  member_id: string;
  code: string;
  expires_at: string;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  cm: 'कार्यालय मुंशी (CM)',
  hm: 'हेड मोहर्रिर (HM)',
  officer: 'अधिकारी',
  constable: 'सिपाही',
};

export const OFFICER_RANKS = ['उ0नि0', 'निरीक्षक'];

export function isOfficeRole(role: string | null | undefined): boolean {
  return role === 'cm' || role === 'hm';
}

/** "उ0नि0 श्याम सिंह" — rank in front unless the name already starts with it. */
export function memberTitle(m: Pick<OfficeMember, 'name' | 'rank'>): string {
  const name = (m.name ?? '').trim();
  const rank = (m.rank ?? '').trim();
  return rank && !name.startsWith(rank) ? `${rank} ${name}` : name;
}

/** First letters for the round avatar ("श्याम सिंह" → "श्या"): first akshara (+ its matras) of the name without rank. */
export function initials(name: string): string {
  const w = name.trim().replace(/^(उ0नि0|निरीक्षक|आरक्षी|मुख्य आरक्षी)\s+/, '').split(/\s+/)[0] ?? '';
  if (!w) return '?';
  // one akshara: a letter (+ nukta), letters joined by halant, then its vowel signs / ं ँ
  const m = /^[\u0904-\u0939\u0958-\u0961]\u093C?(?:\u094D[\u0915-\u0939]\u093C?)*[\u093E-\u094C\u0901-\u0903]*/.exec(w);
  return m ? m[0] : w.slice(0, 1).toUpperCase();
}

export type MemberState = 'joined' | 'code' | 'expired' | 'nocode';

/** joined = a phone has claimed it; code = waiting with a live code; expired / nocode → make a new code. */
export function memberState(m: Pick<OfficeMember, 'user_id'>, code: MemberCode | undefined, now = Date.now()): MemberState {
  if (m.user_id) return 'joined';
  if (!code) return 'nocode';
  return Date.parse(code.expires_at) > now ? 'code' : 'expired';
}

export const STATE_LABEL: Record<MemberState, string> = {
  joined: 'जुड़ा ✓',
  code: 'कोड भेजा',
  expired: 'कोड खत्म',
  nocode: 'कोड नहीं',
};

/** Days left on a code, rounded up (min 0). */
export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 86_400_000));
}

/** "482913" → "482 913" for reading aloud / on cards. */
export function spacedCode(code: string): string {
  const c = code.replace(/\D/g, '');
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

/** Only digits, at most 6 (the code box). */
export function cleanCode(input: string): string {
  return input.replace(/[^\d०-९]/g, '').replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))).slice(0, 6);
}

/** 10-digit Indian mobile from what was typed (+91 / 0 / spaces dropped); '' when not 10 digits. */
export function cleanMobile(input: string | null | undefined): string {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

/** The WhatsApp text that tells a person where to type their code. */
export function inviteText(role: MemberRole, code: string, thana: string, district: string): string {
  const where = isOfficeRole(role)
    ? '"InvestSuite कार्यालय" app खोलें → "कोड से जुड़ें"'
    : 'InvestSuite app खोलें → सेटिंग → "कार्यालय से जुड़ें"';
  return `${where} → कोड ${code} डालें।\nथाना ${thana}, जनपद ${district}।\nयह कोड 7 दिन तक और एक ही बार चलेगा।`;
}

/** wa.me link (opens WhatsApp); without a valid mobile WhatsApp asks whom to send to. */
export function whatsappUrl(mobile: string | null | undefined, text: string): string {
  const m = cleanMobile(mobile);
  return `https://wa.me/${m ? `91${m}` : ''}?text=${encodeURIComponent(text)}`;
}

export interface NewThanaInput { thana: string; district: string; name: string; role: string; mobile?: string }

/** Hindi error for the "नया थाना बनाएँ" form, or '' when it can be sent. */
export function newThanaError(v: NewThanaInput): string {
  if (!v.thana.trim()) return 'थाने का नाम लिखें';
  if (!v.district.trim()) return 'जनपद लिखें';
  if (!v.name.trim()) return 'अपना नाम लिखें';
  if (!isOfficeRole(v.role)) return 'पद चुनें — CM या HM';
  if (v.mobile && v.mobile.trim() && !cleanMobile(v.mobile)) return 'मोबाइल 10 अंकों का लिखें';
  return '';
}

export interface NewMemberInput { role: string; name: string; mobile?: string }

export function newMemberError(v: NewMemberInput): string {
  if (!['cm', 'hm', 'officer', 'constable'].includes(v.role)) return 'भूमिका चुनें';
  if (!v.name.trim()) return 'नाम लिखें';
  if (v.mobile && v.mobile.trim() && !cleanMobile(v.mobile)) return 'मोबाइल 10 अंकों का लिखें';
  return '';
}

/** Members in list order: office first, then officers; by name. Inactive left out. */
export function sortMembers<T extends Pick<OfficeMember, 'role' | 'name' | 'active'>>(list: T[]): T[] {
  const rank = (r: string) => (isOfficeRole(r) ? 0 : r === 'officer' ? 1 : 2);
  return list.filter((m) => m.active).sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name, 'hi'));
}

/** Supabase / network error → simple Hindi. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e ?? '');
  if (/network|fetch|timeout|failed to fetch/i.test(msg)) return 'इंटरनेट नहीं मिल रहा — नेटवर्क देखकर फिर कोशिश करें';
  if (/anonymous sign-ins are disabled/i.test(msg)) return 'Supabase में "Allow anonymous sign-ins" बंद है';
  if (/[ऀ-ॿ]/.test(msg)) return msg.replace(/^.*?:\s*/, '');
  return msg ? `गड़बड़ी: ${msg}` : 'कुछ गड़बड़ हुई — फिर कोशिश करें';
}

