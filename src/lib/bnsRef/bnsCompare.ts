/**
 * bnsCompare.ts — lazy, in-memory loader for assets/ref/bns_compare.json
 * (not stored in SQLite). Never throws.
 */
import { copilotMatches, findBns, textFor, type BnsCompareData, type BnsMode, type BnsRow, type BnsText } from './bnsCore';

let _data: BnsCompareData | null = null;
let _error: string | null = null;

export function getBnsCompare(): BnsCompareData | null {
  if (_data || _error) return _data;
  try {
    const raw = require('../../../assets/ref/bns_compare.json') as BnsCompareData;
    _data = {
      ...raw,
      rows: Array.isArray(raw?.rows) ? raw.rows : [],
      text: raw?.text && typeof raw.text === 'object' ? raw.text : {},
    };
  } catch (e) {
    _error = e instanceof Error ? e.message : String(e);
  }
  return _data;
}

export function getBnsCompareError(): string | null {
  getBnsCompare();
  return _error;
}

export function searchBns(query: string, mode: BnsMode, limit = 50): BnsRow[] {
  return findBns(getBnsCompare()?.rows ?? [], query, mode, limit);
}

export function bnsTextFor(bns: string | undefined): BnsText[] {
  return textFor(getBnsCompare(), bns);
}

export function bnsCopilotMatches(message: string): BnsRow[] {
  return copilotMatches(getBnsCompare()?.rows ?? [], message, 3);
}
