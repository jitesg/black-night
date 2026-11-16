/**
 * InvestSuite side of the कार्यालय link: what this phone is joined to, kept on the phone (so सेटिंग shows it without
 * internet). Set after a successful code, cleared on "अलग करें" or when the server says the phone is no longer a member.
 */
import 'expo-sqlite/localStorage/install';

const KEY = 'investsuite:karyalay_link';

export interface OfficerLink {
  thana: string;
  district: string;
  name: string;
  rank: string | null;
  office: string[];   // "संजय (CM)"
  joinedAt: string;   // ISO
}

export function getOfficerLink(): OfficerLink | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfficerLink) : null;
  } catch { return null; }
}

export function setOfficerLink(link: OfficerLink | null): void {
  try {
    if (link) localStorage.setItem(KEY, JSON.stringify(link));
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable — the card just shows "जुड़ें" */ }
}
