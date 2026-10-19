/**
 * regIndex.ts — UP Police Regulations sidecar (assets/reg/reg_index.json).
 * Loaded once on first use and kept in memory.
 */
import {
  joinSidecar, neighbours, orderedIds, progress,
  type RegChapter, type RegIndexData, type RegPara,
} from './regCore';

let _index: RegIndexData | null = null;
let _loadError: string | null = null;

export function getRegIndex(): RegIndexData | null {
  if (_index || _loadError) return _index;
  try {
    const data = require('../../../assets/reg/reg_index.json') as RegIndexData;
    if (!data || typeof data.paras !== 'object' || !Array.isArray(data.chapters)) {
      throw new Error('reg_index.json has an unexpected shape');
    }
    _index = data;
  } catch (e) {
    _loadError = e instanceof Error ? e.message : String(e);
    console.warn('[regIndex] load failed:', _loadError);
  }
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

export function getRegOrder(): string[] {
  return orderedIds(getRegIndex());
}

export function getRegChapters(): RegChapter[] {
  return getRegIndex()?.chapters ?? [];
}

export function getRegProgress(): { done: number; total: number } {
  return progress(getRegIndex());
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
