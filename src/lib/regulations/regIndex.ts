/**
 * regIndex.ts — UP Police Regulations sidecar (assets/reg/reg_index.json).
 * Loaded once on first use and kept in memory.
 */
import {
  joinSidecar, mergeIndexes, neighbours, orderedIds, progress,
  type RegAct, type RegChapter, type RegIndexData, type RegPara,
} from './regCore';

let _index: RegIndexData | null = null;
let _loadError: string | null = null;

function check(data: RegIndexData | null | undefined, name: string): RegIndexData {
  if (!data || typeof data.paras !== 'object' || !Array.isArray(data.chapters)) {
    throw new Error(`${name} has an unexpected shape`);
  }
  return data;
}

/**
 * All sidecars (UP Police Regulations + POCSO Act) merged into one map
 * keyed by row id — row ids never collide. A broken file is skipped.
 */
export function getRegIndex(): RegIndexData | null {
  if (_index) return _index;
  const parts: RegIndexData[] = [];
  const errors: string[] = [];
  try {
    parts.push(check(require('../../../assets/reg/reg_index.json') as RegIndexData, 'reg_index.json'));
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  try {
    parts.push(check(require('../../../assets/reg/pocso_index.json') as RegIndexData, 'pocso_index.json'));
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (errors.length) {
    _loadError = errors.join('; ');
    console.warn('[regIndex] load problem:', _loadError);
  }
  _index = parts.length ? mergeIndexes(...parts) : null;
  return _index;
}

export function getRegIndexError(): string | null {
  getRegIndex();
  return _loadError;
}

export function getRegPara(rowId: string): RegPara | null {
  return joinSidecar(getRegIndex(), rowId);
}

export function getRegNeighbours(rowId: string): { prev: string | null; next: string | null } {
  return neighbours(getRegIndex(), rowId);
}

export function getRegOrder(act?: RegAct): string[] {
  return orderedIds(getRegIndex(), act);
}

export function getRegChapters(act: RegAct = 'uppr'): RegChapter[] {
  const all = getRegIndex()?.chapters ?? [];
  return all.filter((c) => (act === 'pocso' ? c.part === 'POCSO' : c.part !== 'POCSO'));
}

export function getRegProgress(act: RegAct = 'uppr'): { done: number; total: number } {
  return progress(getRegIndex(), act);
}

export function isRegulationId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('sys-reg-');
}

export const PART_TITLES: Record<string, string> = {
  I: 'भाग I',
  II: 'भाग II',
  III: 'भाग III',
  IV: 'भाग IV',
};
