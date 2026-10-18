/**
 * sopExplain.ts — teacher-style "समझें" (explainer) layer for SOPs (Task L32).
 *
 * Data: bundled assets/seed/sop_explain_*.json, keyed by SOP id. Files are
 * merged in order (later files win per SOP), loaded lazily on first use and
 * cached. To add more, put the file in assets/seed and add it to FILES below
 * (React Native bundles only files it can see statically).
 *
 * phases[].steps are 1-based indexes into sop_index.json steps[] of the same
 * SOP (step id "<sopId>.s<n>").
 */
import { useMemo } from 'react';
import { getById as getIndexById, type SopStep } from './sopIndex';

export interface SopPhase {
  t: string;        // title
  ic: string;       // emoji
  time: string;     // time chip
  goal: string;
  steps: number[];  // 1-based booklet step indexes
  how: string[];
  why: string;
  err: string[];
  tip: string;
}

export interface SopLawUpdate { old: string; new: string; note: string }
export interface SopMistake { m: string; r: string }
export interface SopQA { q: string; a: string }

export interface SopExplain {
  tl: string;                    // "30 सेकंड में"
  why: string;
  when: string;
  mem: string;                   // याद-सूत्र, "a → b → c"
  phases: SopPhase[];
  upd: SopLawUpdate[];
  anno: Record<string, string>;  // booklet step n -> teacher note
  story?: { t: string; b: string };
  mist: SopMistake[];
  qa: SopQA[];
}

function loadFiles(): unknown[] {
  // Add future sop_explain_<n>.json files here.
  return [
    require('../../assets/seed/sop_explain_1.json'),
  ];
}

let _cache: Map<string, SopExplain> | null = null;

function ensureLoaded(): Map<string, SopExplain> {
  if (_cache) return _cache;
  const map = new Map<string, SopExplain>();
  try {
    for (const file of loadFiles()) {
      const explain = (file as { explain?: Record<string, SopExplain> })?.explain;
      if (!explain || typeof explain !== 'object') continue;
      for (const [sopId, data] of Object.entries(explain)) {
        if (data && Array.isArray(data.phases)) {
          map.set(sopId, {
            ...data,
            phases: data.phases ?? [],
            upd: data.upd ?? [],
            anno: data.anno ?? {},
            mist: data.mist ?? [],
            qa: data.qa ?? [],
          });
        }
      }
    }
  } catch (err) {
    console.warn('[sopExplain] failed to load explainer data:', err);
  }
  _cache = map;
  return map;
}

/** Resolves a knowledge row id (sys-sop-…) or SOP id to the SOP id. */
function toSopId(idOrKid: string): string {
  if (!idOrKid) return '';
  return getIndexById(idOrKid)?.id ?? idOrKid;
}

export function getExplain(idOrKid: string | null | undefined): SopExplain | null {
  if (!idOrKid) return null;
  return ensureLoaded().get(toSopId(idOrKid)) ?? null;
}

export function hasExplain(idOrKid: string | null | undefined): boolean {
  return getExplain(idOrKid) !== null;
}

export function useSopExplain(idOrKid: string | null | undefined): SopExplain | null {
  return useMemo(() => getExplain(idOrKid), [idOrKid]);
}

/** Booklet steps of a phase, in the phase's order (skips bad indexes). */
export function phaseSteps(phase: SopPhase, steps: SopStep[]): { n: number; step: SopStep }[] {
  return phase.steps
    .filter((n) => n >= 1 && n <= steps.length)
    .map((n) => ({ n, step: steps[n - 1] }));
}

/** Splits the याद-सूत्र "a → b → c" into its parts. */
export function memParts(mem: string): string[] {
  return (mem || '').split('→').map((s) => s.trim()).filter(Boolean);
}
