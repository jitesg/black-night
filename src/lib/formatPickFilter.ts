/**
 * ⚙︎ filter of the "प्रारूप चुनें" screens (owner, sample approved — GD / प्रार्थना पत्र / न्यायालय / निरोधात्मक): built from the
 * screen's own list, so every option has a count and a screen never offers a choice it cannot show.
 *   प्रकार  — format types in the list (only when there are 2+), or "<this paper> वाले" / "बाकी" when the screen
 *            puts this paper's formats first (`first`);
 *   दिखाएँ — सभी / ⭐ पसंदीदा / 🕘 हाल में उपयोग (newest first);
 *   स्रोत   — सभी / 🛡 System / 👤 मेरे बनाए.
 * Pure — tests scripts/test_format_pick_filter.ts.
 */

export interface PickFormat {
  id: string;
  format_type: string;
  source?: string | null;
  is_favorite?: number | boolean | null;
  last_used_at?: number | null;
}

export interface PickGroupOption { value: string; label: string }
export interface PickGroup { key: 'type' | 'show' | 'source'; label: string; options: PickGroupOption[]; allCount: number }
export type PickValues = Partial<Record<PickGroup['key'], string | null | undefined>>;

/** "This paper's" formats (shown first by the screen) — e.g. न्यायालय NBW: the formats tagged NBW. */
export interface PickFirst { ids: ReadonlySet<string>; label: string }

const FIRST = '__first';
const REST = '__rest';

const isSystem = (f: PickFormat) => f.source === 'system';

/** The filter groups for this list (`typeLabel` = the app's Hindi name of a format_type). */
export function pickFilterGroups(list: readonly PickFormat[], typeLabel: (type: string) => string, first?: PickFirst): PickGroup[] {
  const groups: PickGroup[] = [];
  if (first && first.ids.size && list.some((f) => !first.ids.has(f.id))) {
    const inFirst = list.filter((f) => first.ids.has(f.id)).length;
    if (inFirst) {
      groups.push({
        key: 'type', label: 'प्रकार', allCount: list.length,
        options: [
          { value: FIRST, label: `${first.label} (${inFirst})` },
          { value: REST, label: `बाकी (${list.length - inFirst})` },
        ],
      });
    }
  } else {
    const counts = new Map<string, number>();
    for (const f of list) counts.set(f.format_type, (counts.get(f.format_type) ?? 0) + 1);
    if (counts.size > 1) {
      groups.push({
        key: 'type', label: 'प्रकार', allCount: list.length,
        options: [...counts.entries()].map(([type, n]) => ({ value: type, label: `${typeLabel(type)} (${n})` })),
      });
    }
  }
  const fav = list.filter((f) => !!f.is_favorite).length;
  const recent = list.filter((f) => f.last_used_at != null).length;
  groups.push({
    key: 'show', label: 'दिखाएँ', allCount: list.length,
    options: [{ value: 'fav', label: `⭐ पसंदीदा (${fav})` }, { value: 'recent', label: `🕘 हाल में उपयोग (${recent})` }],
  });
  const sys = list.filter(isSystem).length;
  groups.push({
    key: 'source', label: 'स्रोत', allCount: list.length,
    options: [{ value: 'system', label: `🛡 System (${sys})` }, { value: 'mine', label: `👤 मेरे बनाए (${list.length - sys})` }],
  });
  return groups;
}

/** The list after the chosen filters (order kept; "हाल में उपयोग" = newest use first). */
export function applyPickFilters<T extends PickFormat>(list: readonly T[], values: PickValues, first?: PickFirst): T[] {
  let out = [...list];
  const type = values.type;
  if (type === FIRST && first) out = out.filter((f) => first.ids.has(f.id));
  else if (type === REST && first) out = out.filter((f) => !first.ids.has(f.id));
  else if (type) out = out.filter((f) => f.format_type === type);
  if (values.source === 'system') out = out.filter(isSystem);
  else if (values.source === 'mine') out = out.filter((f) => !isSystem(f));
  if (values.show === 'fav') out = out.filter((f) => !!f.is_favorite);
  else if (values.show === 'recent') {
    out = out.filter((f) => f.last_used_at != null).sort((a, b) => (b.last_used_at ?? 0) - (a.last_used_at ?? 0));
  }
  return out;
}
