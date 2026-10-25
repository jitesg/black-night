/**
 * knowledgeSearchAll.ts — one search over EVERYTHING in the कानूनी ज्ञान module:
 *   • knowledge entries (SOP, परिपत्र, UPPR, POCSO, महिला कानून, निर्णय, गाइड, नोट्स …) — searchKnowledgeAll
 *   • BNS / BNSS / BSA sections (Law library JSON)                                     — searchLaw
 *   • फर्द (fard knowledge base)                                                        — fardKb
 *   • investigation checklists (own table)                                              — checklistRepo
 *   • BNS संदर्भ IPC ↔ BNS table rows (Delhi Police handbook)                           — searchBns
 * Word-by-word, Hindi-aware (searchUtils). Section-like queries put sections first.
 */
import { searchKnowledgeAll, type KnowledgeEntry } from '@/lib/db/knowledgeRepo';
import { getAllChecklists } from '@/lib/db/checklistRepo';
import { parseBareSectionNumber, parseSectionRef, searchLaw } from '@/lib/law/lawLibrary';
import { getFardEntries } from '@/knowledge/fard/fardKb';
import { searchBns } from '@/lib/bnsRef/bnsCompare';
import { isTypoTolerant, matchesQuery, matchesQueryStrict, smartMatch } from '@/lib/searchUtils';

export type KnowledgeHitKind = 'entry' | 'law' | 'fard' | 'checklist' | 'bnsref';

export interface KnowledgeHit {
  id: string;
  kind: KnowledgeHitKind;
  title: string;
  subtitle: string;
  /** Short label shown as a chip ("BNS", "फर्द", "चेकलिस्ट" …). */
  badge: string;
  route: string;
  entry?: KnowledgeEntry;
}

export const KNOWLEDGE_HIT_COLOR: Record<KnowledgeHitKind, string> = {
  entry: '#0F766E', law: '#1D4ED8', fard: '#B45309', checklist: '#7C3AED', bnsref: '#DC2626',
};

export function isSectionLikeQuery(q: string): boolean {
  return !!(parseSectionRef(q) || parseBareSectionNumber(q) || /\b(ipc|crpc|iea)\b/i.test(q));
}

function lawHits(q: string): KnowledgeHit[] {
  try {
    return searchLaw(q, { limit: 20 }).map((r) => ({
      id: `law-${r.act}-${r.n}`, kind: 'law' as const, badge: r.act,
      title: `${r.act} धारा ${r.n} — ${r.title}`, subtitle: r.snippet || '',
      route: `/(app)/knowledge/law/${r.act}/${r.n}`,
    }));
  } catch { return []; }
}

function fardHits(q: string, typo: boolean): KnowledgeHit[] {
  try {
    return getFardEntries()
      .filter((e) => smartMatch(q, [e.name, e.purpose, e.legal, e.keywords.join(' '), e.code], typo))
      .slice(0, 15)
      .map((e) => ({
        id: `fard-${e.code}`, kind: 'fard' as const, badge: 'फर्द',
        title: e.name, subtitle: e.purpose || e.legal || '', route: `/(app)/knowledge/fard/${e.code}`,
      }));
  } catch { return []; }
}

async function checklistHits(q: string, typo: boolean): Promise<KnowledgeHit[]> {
  try {
    const all = await getAllChecklists();
    return all
      .filter((c) => smartMatch(q, [c.title, c.crime_type, c.crime_subtype, c.tags, c.description], typo))
      .slice(0, 15)
      .map((c) => ({
        id: `chk-${c.id}`, kind: 'checklist' as const, badge: 'चेकलिस्ट',
        title: c.title, subtitle: [c.crime_type, c.crime_subtype].filter(Boolean).join(' · ') || c.description || '',
        route: `/(app)/knowledge/checklists/${c.id}`,
      }));
  } catch { return []; }
}

function bnsRefHits(q: string): KnowledgeHit[] {
  try {
    const sec = isSectionLikeQuery(q);
    const rows = sec
      ? [...searchBns(q.replace(/\b(ipc|bns)\b/gi, '').replace(/धारा/g, '').trim(), /\bipc\b/i.test(q) ? 'ipc' : 'bns', 8)]
      : searchBns(q, 'title', 8).filter((r) => matchesQuery(q, r.h, r.p));
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = `${r.ipc}|${r.bns}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((r) => ({
      id: `bnsref-${r.ipc ?? ''}-${r.bns ?? ''}`, kind: 'bnsref' as const, badge: 'BNS संदर्भ',
      title: `IPC ${r.ipc || '—'} → BNS ${r.bns || '—'}${r.h ? ` — ${r.h}` : ''}`,
      subtitle: r.p ? String(r.p).slice(0, 140) : 'Delhi Police BNS Handbook',
      route: `/(app)/knowledge/bns-ref?mode=${/\bipc\b/i.test(q) ? 'ipc' : 'bns'}&q=${encodeURIComponent(r.bns || r.ipc || q)}`,
    }));
  } catch { return []; }
}

/** Everything in the knowledge module that matches the query, best groups first. */
export async function searchAllKnowledge(query: string, opts?: { typoTolerance?: boolean }): Promise<KnowledgeHit[]> {
  const q = query.trim();
  if (!q) return [];
  const typo = opts?.typoTolerance ?? isTypoTolerant();
  const [entries, checklists] = await Promise.all([
    searchKnowledgeAll(q, { typoTolerance: typo }).catch(() => [] as KnowledgeEntry[]),
    checklistHits(q, typo),
  ]);
  // English words also match Hindi by sound; when some entries match the words
  // exactly ("D.K. Basu"), keep only those so the sound match does not flood the list.
  const strict = entries.filter((e) => matchesQueryStrict(q, e.title, e.tags, e.description, e.crime_type));
  const base = strict.length ? strict : entries;
  // Entries whose title has all the words first.
  const sortedEntries = [...base].sort((a, b) => Number(!matchesQuery(q, a.title)) - Number(!matchesQuery(q, b.title)));
  const entryHits: KnowledgeHit[] = sortedEntries.map((e) => ({
    id: e.id, kind: 'entry', badge: e.category, title: e.title,
    subtitle: e.subcategory || '', route: `/(app)/knowledge/${e.id}`, entry: e,
  }));
  const law = lawHits(q);
  const fard = fardHits(q, typo);
  const bnsref = bnsRefHits(q);
  return isSectionLikeQuery(q)
    ? [...law, ...bnsref, ...entryHits, ...fard, ...checklists]
    : [...entryHits, ...fard, ...checklists, ...law, ...bnsref];
}
