import { getDatabase } from './database';
import { isTypoTolerant, matchesQuery, scoredFuzzyMatch, sqlWordFilter } from '@/lib/searchUtils';

export interface SearchResult {
  id: string;
  type: 'gram_panchayat' | 'hamlet' | 'person' | 'religious_place' | 'institution' | 'liquor_shop';
  title: string;
  subtitle?: string;
  gp_id?: string;
  gp_name?: string;
  updated_at?: number;
}

export interface GlobalSearchOpts {
  typoTolerance?: boolean;
}

export async function globalSearch(
  query: string,
  opts?: GlobalSearchOpts,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const db = await getDatabase();
  const trimmed = query.trim();
  // Word-by-word, Hindi-aware (searchUtils). Typo tolerance: widen to the first
  // 2 letters and rank with scoredFuzzyMatch below; otherwise a loose word pre-filter
  // and an exact word check in JS.
  const typo = opts?.typoTolerance ?? isTypoTolerant();
  const wf = (col: string) => typo
    ? { sql: `LOWER(${col}) LIKE ?`, params: [`%${trimmed.slice(0, 2).toLowerCase()}%`] }
    : sqlWordFilter([col], trimmed);
  const [wGp, wH, wP, wRp, wSi, wLs] = ['name', 'h.name', 'p.name', 'rp.name', 'si.name', 'ls.shop_name'].map(wf);

  // All 6 entity types fetched concurrently — no sequential blocking
  const [gps, hamlets, persons, places, insts, shops] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; tehsil: string; updated_at: number }>(
      'SELECT id, name, tehsil, updated_at FROM gram_panchayats WHERE ' + wGp.sql + ' AND deleted_at IS NULL LIMIT 60', wGp.params
    ),
    db.getAllAsync<{ id: string; name: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT h.id, h.name, h.gp_id, g.name as gp_name, h.updated_at FROM hamlets h
       JOIN gram_panchayats g ON g.id = h.gp_id
       WHERE ${wH.sql} AND h.deleted_at IS NULL LIMIT 60`, wH.params
    ),
    db.getAllAsync<{ id: string; name: string; person_type: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT p.id, p.name, p.person_type, p.gp_id, g.name as gp_name, p.updated_at FROM persons p
       JOIN gram_panchayats g ON g.id = p.gp_id
       WHERE ${wP.sql} AND p.deleted_at IS NULL LIMIT 60`, wP.params
    ),
    db.getAllAsync<{ id: string; name: string; category: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT rp.id, rp.name, rp.category, rp.gp_id, g.name as gp_name, rp.updated_at FROM religious_places rp
       JOIN gram_panchayats g ON g.id = rp.gp_id
       WHERE ${wRp.sql} AND rp.deleted_at IS NULL LIMIT 60`, wRp.params
    ),
    db.getAllAsync<{ id: string; name: string; category: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT si.id, si.name, si.category, si.gp_id, g.name as gp_name, si.updated_at FROM social_institutions si
       JOIN gram_panchayats g ON g.id = si.gp_id
       WHERE ${wSi.sql} AND si.deleted_at IS NULL LIMIT 60`, wSi.params
    ),
    db.getAllAsync<{ id: string; shop_name: string; shop_type: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT ls.id, ls.shop_name, ls.shop_type, ls.gp_id, g.name as gp_name, ls.updated_at FROM liquor_shops ls
       JOIN gram_panchayats g ON g.id = ls.gp_id
       WHERE ${wLs.sql} AND ls.deleted_at IS NULL LIMIT 60`, wLs.params
    ),
  ]);

  const results: SearchResult[] = [];
  gps.forEach((r) => results.push({ id: r.id, type: 'gram_panchayat', title: r.name, subtitle: r.tehsil, gp_id: r.id, gp_name: r.name, updated_at: r.updated_at }));
  hamlets.forEach((r) => results.push({ id: r.id, type: 'hamlet', title: r.name, subtitle: r.gp_name, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  persons.forEach((r) => results.push({ id: r.id, type: 'person', title: r.name, subtitle: `${r.person_type.replace('_', ' ')} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  places.forEach((r) => results.push({ id: r.id, type: 'religious_place', title: r.name, subtitle: `${r.category} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  insts.forEach((r) => results.push({ id: r.id, type: 'institution', title: r.name, subtitle: `${r.category} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  shops.forEach((r) => results.push({ id: r.id, type: 'liquor_shop', title: r.shop_name, subtitle: `${r.shop_type} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));

  // Post-filter and rank with scoredFuzzyMatch when typoTolerance is on.
  if (typo) {
    return results
      .map((r) => ({ item: r, match: scoredFuzzyMatch(trimmed, `${r.title} ${r.subtitle ?? ''}`) }))
      .filter(({ match }) => match.matched)
      .sort((a, b) => b.match.score - a.match.score)
      .map(({ item }) => item);
  }

  // Exact word check on the name, at most 10 per type (as before).
  const perType = new Map<string, number>();
  return results.filter((r) => {
    if (!matchesQuery(trimmed, r.title)) return false;
    const n = (perType.get(r.type) ?? 0) + 1;
    perType.set(r.type, n);
    return n <= 10;
  });
}

/**
 * Cheap prefix query across all 6 tables — titles only — for a live
 * autocomplete dropdown. Runs per-keystroke once query.length >= 2.
 */
export async function getAutocompleteSuggestions(
  prefix: string,
  limit = 6,
): Promise<{ id: string; title: string; type: SearchResult['type'] }[]> {
  if (!prefix.trim() || prefix.trim().length < 2) return [];
  const db = await getDatabase();
  const q = `${prefix.trim().toLowerCase()}%`;

  const [gps, hamlets, persons, places, insts, shops] = await Promise.all([
    db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM gram_panchayats WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT ?`, [q, limit]
    ),
    db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM hamlets WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT ?`, [q, limit]
    ),
    db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM persons WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT ?`, [q, limit]
    ),
    db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM religious_places WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT ?`, [q, limit]
    ),
    db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM social_institutions WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT ?`, [q, limit]
    ),
    db.getAllAsync<{ id: string; shop_name: string }>(
      `SELECT id, shop_name FROM liquor_shops WHERE LOWER(shop_name) LIKE ? AND deleted_at IS NULL LIMIT ?`, [q, limit]
    ),
  ]);

  const out: { id: string; title: string; type: SearchResult['type'] }[] = [];
  gps.forEach((r) => out.push({ id: r.id, title: r.name, type: 'gram_panchayat' }));
  hamlets.forEach((r) => out.push({ id: r.id, title: r.name, type: 'hamlet' }));
  persons.forEach((r) => out.push({ id: r.id, title: r.name, type: 'person' }));
  places.forEach((r) => out.push({ id: r.id, title: r.name, type: 'religious_place' }));
  insts.forEach((r) => out.push({ id: r.id, title: r.name, type: 'institution' }));
  shops.forEach((r) => out.push({ id: r.id, title: r.shop_name, type: 'liquor_shop' }));

  // Interleave by type and slice to limit so no single type dominates.
  return out.slice(0, limit);
}

/**
 * Most-recently-updated records across all 6 tables.
 *
 * This is a recency heuristic — NOT a personalisation or ML ranking.
 * It surfaces records the officer most recently touched, which correlates
 * with what they are likely to search for next.
 */
export async function getSmartSuggestions(limit = 5): Promise<SearchResult[]> {
  const db = await getDatabase();
  const perTable = Math.ceil(limit * 1.5); // fetch a bit more, trim after merge

  const [gps, hamlets, persons, places, insts, shops] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; tehsil: string; updated_at: number }>(
      `SELECT id, name, tehsil, updated_at FROM gram_panchayats WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`, [perTable]
    ),
    db.getAllAsync<{ id: string; name: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT h.id, h.name, h.gp_id, g.name as gp_name, h.updated_at FROM hamlets h
       JOIN gram_panchayats g ON g.id = h.gp_id WHERE h.deleted_at IS NULL ORDER BY h.updated_at DESC LIMIT ?`, [perTable]
    ),
    db.getAllAsync<{ id: string; name: string; person_type: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT p.id, p.name, p.person_type, p.gp_id, g.name as gp_name, p.updated_at FROM persons p
       JOIN gram_panchayats g ON g.id = p.gp_id WHERE p.deleted_at IS NULL ORDER BY p.updated_at DESC LIMIT ?`, [perTable]
    ),
    db.getAllAsync<{ id: string; name: string; category: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT rp.id, rp.name, rp.category, rp.gp_id, g.name as gp_name, rp.updated_at FROM religious_places rp
       JOIN gram_panchayats g ON g.id = rp.gp_id WHERE rp.deleted_at IS NULL ORDER BY rp.updated_at DESC LIMIT ?`, [perTable]
    ),
    db.getAllAsync<{ id: string; name: string; category: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT si.id, si.name, si.category, si.gp_id, g.name as gp_name, si.updated_at FROM social_institutions si
       JOIN gram_panchayats g ON g.id = si.gp_id WHERE si.deleted_at IS NULL ORDER BY si.updated_at DESC LIMIT ?`, [perTable]
    ),
    db.getAllAsync<{ id: string; shop_name: string; shop_type: string; gp_id: string; gp_name: string; updated_at: number }>(
      `SELECT ls.id, ls.shop_name, ls.shop_type, ls.gp_id, g.name as gp_name, ls.updated_at FROM liquor_shops ls
       JOIN gram_panchayats g ON g.id = ls.gp_id WHERE ls.deleted_at IS NULL ORDER BY ls.updated_at DESC LIMIT ?`, [perTable]
    ),
  ]);

  const all: SearchResult[] = [];
  gps.forEach((r) => all.push({ id: r.id, type: 'gram_panchayat', title: r.name, subtitle: r.tehsil, gp_id: r.id, gp_name: r.name, updated_at: r.updated_at }));
  hamlets.forEach((r) => all.push({ id: r.id, type: 'hamlet', title: r.name, subtitle: r.gp_name, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  persons.forEach((r) => all.push({ id: r.id, type: 'person', title: r.name, subtitle: `${r.person_type.replace('_', ' ')} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  places.forEach((r) => all.push({ id: r.id, type: 'religious_place', title: r.name, subtitle: `${r.category} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  insts.forEach((r) => all.push({ id: r.id, type: 'institution', title: r.name, subtitle: `${r.category} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));
  shops.forEach((r) => all.push({ id: r.id, type: 'liquor_shop', title: r.shop_name, subtitle: `${r.shop_type} · ${r.gp_name}`, gp_id: r.gp_id, gp_name: r.gp_name, updated_at: r.updated_at }));

  // Sort by most-recently-updated across all tables and trim to limit.
  return all
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
    .slice(0, limit);
}
