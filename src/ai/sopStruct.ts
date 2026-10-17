/**
 * In-memory lazy cached loader for structured SOP data (Task L30).
 * Sourced from assets/seed/sop_struct_1.json (31 SOPs, b1/b2)
 * and assets/seed/sop_struct_2.json (5 SOPs, b3).
 */

import { useMemo } from 'react';
import sopStruct1Data from '../../assets/seed/sop_struct_1.json';
import sopStruct2Data from '../../assets/seed/sop_struct_2.json';

export interface SopLawRef {
  old: string;
  new: string[];
}

export interface SopCircRef {
  n: string;
  id: string | null;
}

export interface SopFig {
  id: string;
  cap: string;
  sens?: boolean;
}

export interface SopBlock {
  k: string;
  h?: string;
  pg?: string;
  label?: string;
  t?: string;
  title?: string;
  note?: string;
  items?: any[];
  fields?: any[];
  rows?: any[];
  rowimgs?: any[];
  sections?: any[];
  tables?: any[];
  do?: string[];
  dont?: string[];
  steps?: string[];
  seize?: string[];
  transport?: string[];
  figs?: SopFig[];
  imgs?: SopFig[];
  img?: string;
  [key: string]: any;
}

export interface SopStruct {
  id: string;
  no: string | number;
  title: string;
  en: string;
  crime: string;
  kw: string[];
  src: 'b1' | 'b2' | 'b3';
  pages?: string;
  kid: string;
  nsteps?: number;
  laws: SopLawRef[];
  circ?: SopCircRef[];
  blocks: SopBlock[];
}

let _cachedList: SopStruct[] | null = null;
let _cachedById: Map<string, SopStruct> | null = null;
let _cachedByKid: Map<string, SopStruct> | null = null;
let _disabledForFallback = false;

function ensureLoaded(): void {
  if (_disabledForFallback) {
    _cachedList = [];
    _cachedById = new Map();
    _cachedByKid = new Map();
    return;
  }
  if (_cachedList && _cachedById && _cachedByKid) return;

  const list: SopStruct[] = [];
  const byId = new Map<string, SopStruct>();
  const byKid = new Map<string, SopStruct>();

  const raw1 = (sopStruct1Data as any)?.sops || [];
  const raw2 = (sopStruct2Data as any)?.sops || [];

  for (const item of [...raw1, ...raw2]) {
    if (!item || !item.id) continue;
    const s: SopStruct = {
      id: String(item.id),
      no: item.no ?? '',
      title: String(item.title || ''),
      en: String(item.en || ''),
      crime: String(item.crime || ''),
      kw: Array.isArray(item.kw) ? item.kw : [],
      src: (item.src === 'b3' ? 'b3' : item.src === 'b2' ? 'b2' : 'b1') as 'b1' | 'b2' | 'b3',
      pages: item.pages ? String(item.pages) : undefined,
      kid: String(item.kid || ''),
      nsteps: typeof item.nsteps === 'number' ? item.nsteps : undefined,
      laws: Array.isArray(item.laws) ? item.laws : [],
      circ: Array.isArray(item.circ) ? item.circ : undefined,
      blocks: Array.isArray(item.blocks) ? item.blocks : [],
    };

    list.push(s);
    byId.set(s.id, s);
    if (s.kid) {
      byKid.set(s.kid, s);
    }
  }

  _cachedList = list;
  _cachedById = byId;
  _cachedByKid = byKid;
}

/**
 * Get structured SOP by SOP id (e.g. 'sop-up-b2-19')
 */
export function getById(id: string): SopStruct | null {
  ensureLoaded();
  if (!id) return null;
  return _cachedById?.get(id) || null;
}

/**
 * Get structured SOP by Knowledge ID (e.g. 'sys-sop-up-b2-19')
 */
export function getByKid(kid: string): SopStruct | null {
  ensureLoaded();
  if (!kid) return null;
  return _cachedByKid?.get(kid) || null;
}

/**
 * Get all loaded structured SOPs (36 total)
 */
export function getAll(): SopStruct[] {
  ensureLoaded();
  return _cachedList ? [..._cachedList] : [];
}

/**
 * Internal helper for testing fallback when struct is absent.
 */
export function setFallbackMode(disabled: boolean): void {
  _disabledForFallback = disabled;
  _cachedList = null;
  _cachedById = null;
  _cachedByKid = null;
}

/**
 * Safe custom hook for structured SOP data.
 * ALWAYS runs unconditionally; returns SopStruct or null if loading/absent.
 */
export function useSopStruct(idOrKid: string | null | undefined): SopStruct | null {
  return useMemo(() => {
    if (!idOrKid) return null;
    return getByKid(idOrKid) || getById(idOrKid) || null;
  }, [idOrKid]);
}
