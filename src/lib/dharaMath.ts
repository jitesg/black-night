/**
 * dharaMath.ts — अग्रिम विवेचना धारा from the old sections and the added / removed ones (owner):
 *   joinDhara('281/125(b)/106(1) BNS', '118(1) BNS')  → '281/125(b)/106(1)/118(1) BNS'
 *   minusDhara('281/125(b)/106(1) BNS', '106(1) BNS') → '281/125(b) BNS'
 * Same Act suffix (BNS / बीएनएस / IPC …) → one list; different Acts → "A व B" (join) / '' (minus: unsure → not printed).
 * Pure — tests: scripts/test_template_adi.ts
 */
interface Parsed { nums: string[]; act: string }

function parse(s: string): Parsed {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  // act = the words after the last section number ("BNS", "बीएनएस", "भा0ना0सं0" …)
  const m = /^(.*?[0-9A-Za-z)\]])\s*([^\d/()]*)$/.exec(t);
  const body = (m ? m[1] : t).trim();
  const act = (m ? m[2] : '').trim();
  const nums = body.split('/').map((x) => x.trim()).filter(Boolean);
  return { nums, act };
}

const key = (n: string) => n.replace(/\s+/g, '').toLowerCase();

export function joinDhara(oldSec: string, added: string): string {
  const a = parse(oldSec);
  const b = parse(added);
  if (!a.nums.length) return String(added ?? '').trim();
  if (!b.nums.length) return String(oldSec ?? '').trim();
  if (a.act && b.act && a.act !== b.act) return `${String(oldSec).trim()} व ${String(added).trim()}`;
  const seen = new Set(a.nums.map(key));
  const nums = [...a.nums, ...b.nums.filter((n) => !seen.has(key(n)))];
  const act = a.act || b.act;
  return `${nums.join('/')}${act ? ` ${act}` : ''}`;
}

export function minusDhara(oldSec: string, removed: string): string {
  const a = parse(oldSec);
  const b = parse(removed);
  if (!a.nums.length || !b.nums.length) return '';
  if (a.act && b.act && a.act !== b.act) return '';
  const drop = new Set(b.nums.map(key));
  const left = a.nums.filter((n) => !drop.has(key(n)));
  if (!left.length || left.length === a.nums.length) return '';
  return `${left.join('/')}${a.act ? ` ${a.act}` : ''}`;
}
