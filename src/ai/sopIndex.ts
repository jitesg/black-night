/**
 * sopIndex.ts
 *
 * In-memory cached index for 36 Standard Operating Procedures (SOPs).
 * Loaded lazily from bundled asset assets/seed/sop_index.json.
 * Provides:
 * - getAll(): SopIndexEntry[]
 * - getById(idOrKid: string): SopIndexEntry | null
 * - search(query: string, limit?: number): SopIndexEntry[]
 * - getSopStepCount(idOrKid: string): number
 */

import { useMemo } from 'react';
import sopIndexData from '../../assets/seed/sop_index.json';

// ── Stop-words for SOP Index search (Hindi / Hinglish / English) ─────────────
const STOP_WORDS = new Set([
  'ne', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein', 'par', 'pe',
  'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'thii', 'thaa',
  'kiya', 'kar', 'kare', 'karein', 'karta', 'karti', 'karte', 'kiye',
  'hua', 'hui', 'hue', 'gaya', 'gayi', 'gaye', 'raha', 'rahi', 'rahe',
  'liya', 'diya', 'le', 'de', 'di', 'hoga', 'hogi',
  'aur', 'ya', 'bhi', 'to', 'tak', 'parantu',
  'ek', 'aadmi', 'vyakti', 'person', 'log', 'logon', 'man', 'woman',
  'kisi', 'kisko', 'kise', 'usne', 'unhone', 'unhe', 'use', 'unka', 'unke', 'unki',
  'uska', 'uske', 'uski', 'mera', 'meri', 'mere', 'apna', 'apne', 'apni',
  'yeh', 'ye', 'voh', 'woh', 'wo',
  'kuch', 'koi', 'kya', 'kyon', 'kyun', 'kaha', 'kahan', 'kaise', 'kab',
  'matter', 'incident', 'case', 'baat',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'is', 'was', 'were', 'are', 'been', 'has', 'have', 'had', 'do', 'does', 'did'
]);

function normalizeHinglishToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/ch+/g, 'ch')
    .replace(/sh/g, 's')
    .replace(/([a-z])\1+/g, '$1');
}

export interface SopStep {
  id: string;
  t: string;
  must?: number;
  dont?: number;
  g?: string;
}

export interface SopLaw {
  old: string;
  new: string[];
}

export interface SopCircular {
  n: string;
  id: string | null;
}

export interface SopIndexEntry {
  id: string;
  kid: string;
  title: string;
  en: string;
  crime: string;
  src: string;
  kw: string[];
  laws: SopLaw[];
  circ: SopCircular[];
  steps: SopStep[];
}

interface SopIndexBundle {
  version: number;
  sops: SopIndexEntry[];
}

let _cachedSops: SopIndexEntry[] | null = null;
let _cachedMap: Map<string, SopIndexEntry> | null = null;

function _loadIndex(): SopIndexEntry[] {
  if (_cachedSops) return _cachedSops;
  try {
    const bundle = sopIndexData as unknown as SopIndexBundle;
    _cachedSops = bundle.sops || [];
    _cachedMap = new Map();
    for (const sop of _cachedSops) {
      _cachedMap.set(sop.id, sop);
      _cachedMap.set(sop.kid, sop);
    }
    return _cachedSops;
  } catch (err) {
    console.warn('[sopIndex] Failed to parse sop_index.json:', err);
    _cachedSops = [];
    _cachedMap = new Map();
    return [];
  }
}

/**
 * Return all SOP index entries.
 */
export function getAll(): SopIndexEntry[] {
  return _loadIndex();
}

/**
 * Find SOP by index id (e.g. 'sop-up-b2-01') or knowledge row id ('sys-sop-up-b2-01').
 */
export function getById(idOrKid: string): SopIndexEntry | null {
  _loadIndex();
  return _cachedMap?.get(idOrKid) ?? null;
}

/**
 * Return step count for an SOP, or 0 if not found.
 */
export function getSopStepCount(idOrKid: string): number {
  const sop = getById(idOrKid);
  return sop ? sop.steps.length : 0;
}

/**
 * Search SOPs using token match on title, en, crime, kw, steps.t
 * with Hindi + Hinglish normalization.
 */
export function search(query: string, limit = 5): SopIndexEntry[] {
  const sops = _loadIndex();
  if (!query || !query.trim()) return sops.slice(0, limit);

  const rawTokens = query
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F/-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const normalizedTokens = rawTokens.map(normalizeHinglishToken);

  if (normalizedTokens.length === 0) {
    return [];
  }

  const scored: Array<{ sop: SopIndexEntry; score: number }> = [];

  for (const sop of sops) {
    let score = 0;
    const titleNorm = normalizeHinglishToken(sop.title.toLowerCase());
    const enNorm = normalizeHinglishToken(sop.en.toLowerCase());
    const crimeNorm = normalizeHinglishToken(sop.crime.toLowerCase());
    const kwNorm = sop.kw.map((k) => normalizeHinglishToken(k.toLowerCase()));

    for (let i = 0; i < normalizedTokens.length; i++) {
      const tok = normalizedTokens[i];
      const rawTok = rawTokens[i];

      // Exact title match (highest weight)
      if (titleNorm.includes(tok) || sop.title.toLowerCase().includes(rawTok)) {
        score += 35;
      }
      // English title match
      if (enNorm.includes(tok) || sop.en.toLowerCase().includes(rawTok)) {
        score += 30;
      }
      // Crime type match
      if (crimeNorm.includes(tok) || sop.crime.toLowerCase().includes(rawTok)) {
        score += 25;
      }
      // Keyword match
      if (kwNorm.some((k) => k === tok || k.includes(tok))) {
        score += 20;
      }
      // Steps match
      const stepMatch = sop.steps.some((st) => {
        const t = st.t.toLowerCase();
        return t.includes(rawTok) || normalizeHinglishToken(t).includes(tok);
      });
      if (stepMatch) {
        score += 10;
      }
      // Law match
      const lawMatch = sop.laws.some(
        (l) => l.old.toLowerCase().includes(rawTok) || l.new.some((n) => n.toLowerCase().includes(rawTok))
      );
      if (lawMatch) {
        score += 15;
      }
    }

    if (score > 0) {
      scored.push({ sop, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.sop);
}

/**
 * Safe custom hook for SOP Index data.
 * ALWAYS runs unconditionally; returns SopIndexEntry or null if loading/absent.
 */
export function useSopIndex(idOrKid: string | null | undefined): SopIndexEntry | null {
  return useMemo(() => {
    if (!idOrKid) return null;
    return getById(idOrKid) || null;
  }, [idOrKid]);
}
