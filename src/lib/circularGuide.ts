/**
 * परिपत्र गाइड registry (owner: the 70/2013 layout is the base for every DGP परिपत्र). Add a परिपत्र = one JSON in
 * assets/circular-guides/<entry id>.json + one line in GUIDES. Rules in circularGuideCore.ts (tests scripts/test_circular_guide.ts).
 * Checklist ticks: this phone only (expo-sqlite localStorage investsuite:circ_check:<id>). Any error → no guide / empty ticks.
 */
import 'expo-sqlite/localStorage/install';
import { getLawMapData } from './law/lawMapping';
import { lawPairs, parseGuide, type CircularGuide } from './circularGuideCore';

declare const require: (p: string) => unknown;
declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;

const GUIDES: Record<string, () => unknown> = {
  'sys-circ-dg-70-2013': () => require('../../assets/circular-guides/sys-circ-dg-70-2013.json'),
};

const cache = new Map<string, CircularGuide | null>();

export function hasCircularGuide(id: string): boolean { return !!GUIDES[id]; }

export function getCircularGuide(id: string): CircularGuide | null {
  if (cache.has(id)) return cache.get(id)!;
  let g: CircularGuide | null = null;
  try { g = GUIDES[id] ? parseGuide(GUIDES[id]()) : null; } catch { g = null; }
  cache.set(id, g);
  return g;
}

/** "आज की धाराएँ" for a guide (law_map.json rev). */
export function guideLawPairs(g: CircularGuide) {
  try { return lawPairs(g.laws ?? [], getLawMapData()?.rev as never); } catch { return []; }
}

export interface GuideTicks { done: number[]; opt: boolean }
const key = (id: string) => `investsuite:circ_check:${id}`;

export function loadGuideTicks(id: string): GuideTicks {
  try {
    const v = JSON.parse((typeof localStorage !== 'undefined' && localStorage?.getItem(key(id))) || '{}');
    return { done: Array.isArray(v.done) ? v.done.filter((n: unknown) => Number.isInteger(n)) : [], opt: !!v.opt };
  } catch { return { done: [], opt: false }; }
}

export function saveGuideTicks(id: string, t: GuideTicks): void {
  try { localStorage?.setItem(key(id), JSON.stringify(t)); } catch { /* ignore */ }
}
