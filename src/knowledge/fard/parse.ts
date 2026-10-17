import { logger } from '@/lib/logger';
import type { FardEntry, FardMarker } from './types';

function cleanField(val: string | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  return trimmed === '-' ? '' : trimmed;
}

function splitParagraphs(val: string | undefined): string[] {
  const cleaned = cleanField(val);
  if (!cleaned) return [];
  return cleaned
    .split('¶')
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitKeywords(val: string | undefined): string[] {
  const cleaned = cleanField(val);
  if (!cleaned) return [];
  return cleaned
    .split(/[¶,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMarkers(val: string | undefined): FardMarker[] {
  const cleaned = cleanField(val);
  if (!cleaned) return [];
  const groups = cleaned.split('¶').map((s) => s.trim()).filter(Boolean);
  const result: FardMarker[] = [];
  for (const g of groups) {
    const eqIdx = g.indexOf('=');
    if (eqIdx === -1) {
      result.push({ label: g.trim(), kws: [] });
    } else {
      const label = g.slice(0, eqIdx).trim();
      const kwsPart = g.slice(eqIdx + 1).trim();
      const kws = kwsPart
        .split('/')
        .map((k) => k.trim())
        .filter(Boolean);
      result.push({ label, kws });
    }
  }
  return result;
}

export function parseFardLines(rawText: string): FardEntry[] {
  if (!rawText) return [];
  const lines = rawText.split('\n');
  const entries: FardEntry[] = [];
  const seenCodes = new Set<string>();

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parts = trimmed.split(' | ');
    if (parts.length !== 12) {
      logger.warn(
        `[FardParser] Malformed line #${index + 1} skipped (expected 12 fields, got ${parts.length}):`,
        trimmed.slice(0, 60)
      );
      return;
    }

    const [
      rawCode,
      rawName,
      rawWhen,
      rawPurpose,
      rawLegal,
      rawEssentials,
      rawWording,
      rawMistakes,
      rawCourt,
      rawDocs,
      rawKeywords,
      rawMarkers,
    ] = parts;

    const code = cleanField(rawCode);
    const name = cleanField(rawName);

    if (!code || !name) {
      logger.warn(`[FardParser] Line #${index + 1} skipped (missing code or name)`);
      return;
    }

    const upperCode = code.toUpperCase();
    if (seenCodes.has(upperCode)) {
      logger.warn(`[FardParser] Duplicate code '${code}' on line #${index + 1} skipped`);
      return;
    }
    seenCodes.add(upperCode);

    entries.push({
      code,
      name,
      when: cleanField(rawWhen),
      purpose: cleanField(rawPurpose),
      legal: cleanField(rawLegal),
      essentials: splitParagraphs(rawEssentials),
      wording: splitParagraphs(rawWording),
      mistakes: splitParagraphs(rawMistakes),
      court: splitParagraphs(rawCourt),
      docs: splitParagraphs(rawDocs),
      keywords: splitKeywords(rawKeywords),
      markers: parseMarkers(rawMarkers),
    });
  });

  return entries;
}
