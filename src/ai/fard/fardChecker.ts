/**
 * fardChecker.ts
 *
 * Pure, non-blocking Fard validation and intelligence engine.
 * Never throws exceptions, makes zero network calls, and uses
 * in-memory Fard Knowledge Base (Parts 1 + 2).
 */

import { getFardEntries, getCommon, getFardEntry } from '@/knowledge/fard/fardKb';
import type { FardEntry, FardMarker } from '@/knowledge/fard/types';
import type { FIR } from '@/lib/db/firRepo';

export interface FardElementResult {
  label: string;
  tip: string;
}

export interface FardWarning {
  code: 'FR1' | 'FR2' | 'FR3' | 'FR4' | 'FR5';
  type: 'warn' | 'info';
  message: string;
  messageEn?: string;
}

export interface FardCheckResult {
  type: FardEntry | null;
  found: { label: string }[];
  missing: FardElementResult[];
  score: {
    found: number;
    total: number;
    ratio: number;
  };
  warnings: FardWarning[];
  avoid: string[];
}

export interface CheckFardParams {
  text: string;
  typeCode?: string | null;
  fir?: Partial<FIR> | null;
}

/**
 * Normalizes Devanagari and Latin text for matching:
 * - Strips HTML tags (from rich text / DocumentEditor)
 * - Applies Unicode NFC normalization
 * - Strips zero-width and invisible characters
 * - Normalizes punctuation and whitespace
 */
export function normalizeTextForMatching(str: string): string {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[।|/\\¶\[\]():;,\-!?'"`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Detects the most appropriate Fard type code from text and optional title.
 * Matching is case-insensitive, Devanagari-safe, HTML-safe.
 * Title matches count triple. Returns the code with the most keyword hits,
 * or null if no hits are found.
 */
export function detectFardType(text: string, title?: string): string | null {
  try {
    const rawText = normalizeTextForMatching(text || '');
    const rawTitle = normalizeTextForMatching(title || '');

    if (!rawText && !rawTitle) {
      return null;
    }

    const entries = getFardEntries();
    let bestCode: string | null = null;
    let maxHits = 0;

    for (const entry of entries) {
      let hits = 0;

      // Keywords specific to this Fard
      for (const kw of entry.keywords) {
        const cleanKw = normalizeTextForMatching(kw);
        if (!cleanKw) continue;

        const weight = cleanKw.length >= 4 ? 2 : 1;
        if (rawTitle && rawTitle.includes(cleanKw)) {
          hits += weight * 3; // Title counts triple
        }
        if (rawText && rawText.includes(cleanKw)) {
          hits += weight;
        }
      }

      // Also check entry name (e.g. 'फर्द बरामदगी')
      const cleanName = normalizeTextForMatching(entry.name);
      if (cleanName) {
        if (rawTitle && rawTitle.includes(cleanName)) {
          hits += 6;
        }
        if (rawText && rawText.includes(cleanName)) {
          hits += 4;
        }
      }

      if (hits > maxHits) {
        maxHits = hits;
        bestCode = entry.code;
      }
    }

    return maxHits > 0 ? bestCode : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Normalizes date string into epoch timestamp for date comparison.
 * Supports DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
 */
function parseDateStrToEpoch(dStr: string): number | null {
  try {
    const clean = dStr.trim();
    // YYYY-MM-DD
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(clean)) {
      const parts = clean.split(/[-/.]/).map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }
    // DD-MM-YYYY or DD.MM.YYYY
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(clean)) {
      const parts = clean.split(/[-/.]/).map(Number);
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
      return new Date(year, parts[1] - 1, parts[0]).getTime();
    }
    const parsed = Date.parse(clean);
    return isNaN(parsed) ? null : parsed;
  } catch (_err) {
    return null;
  }
}

/**
 * Extracts a date from memo text (e.g. 'दिनांक 5.10.2026', 'दिनांक: 05-10-2026', '2026-10-05').
 */
function extractDateFromText(text: string): number | null {
  try {
    // Look for दिनांक ...
    const dinankMatch = text.match(/दिनांक\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i);
    if (dinankMatch && dinankMatch[1]) {
      const epoch = parseDateStrToEpoch(dinankMatch[1]);
      if (epoch !== null) return epoch;
    }

    // Look for generic date pattern
    const genericMatch = text.match(/\b(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})\b/);
    if (genericMatch && genericMatch[1]) {
      const epoch = parseDateStrToEpoch(genericMatch[1]);
      if (epoch !== null) return epoch;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Helper to match an essential line as a tip for a missing marker.
 */
function findTipForMarker(
  marker: FardMarker,
  entryEssentials: string[],
  commonEssentials: string[]
): string {
  try {
    const combined = [...entryEssentials, ...commonEssentials];
    const markerLabel = marker.label.trim();

    // 1. Direct label match in essential lines
    const directMatch = combined.find((line) => line.includes(markerLabel));
    if (directMatch) return directMatch;

    // 2. Keyword match in essential lines
    for (const kw of marker.kws) {
      const trimmed = kw.trim();
      if (trimmed.length >= 2) {
        const kwMatch = combined.find((line) => line.includes(trimmed));
        if (kwMatch) return kwMatch;
      }
    }

    return markerLabel;
  } catch (_err) {
    return marker.label;
  }
}

/**
 * Parses time string like '10:30' or '11' into total minutes from midnight.
 */
function parseBajeTimeToMinutes(timeStr: string): number | null {
  try {
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 24 && m >= 0 && m < 60) {
        return h * 60 + m;
      }
    } else if (parts.length === 1) {
      const h = parseInt(parts[0], 10);
      if (!isNaN(h) && h >= 0 && h <= 24) {
        return h * 60;
      }
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Evaluates Fard elements, completeness score, mistakes to avoid, and FIR cross-checks.
 * Always returns a structured FardCheckResult, never throws.
 */
export function checkFard({ text, typeCode, fir }: CheckFardParams): FardCheckResult {
  const emptyResult: FardCheckResult = {
    type: null,
    found: [],
    missing: [],
    score: { found: 0, total: 0, ratio: 0 },
    warnings: [],
    avoid: [],
  };

  try {
    const rawText = text || '';
    const code = (typeCode || detectFardType(rawText)) || null;
    const entry = code ? (getFardEntry(code) || null) : null;
    const common = getCommon();

    if (!entry) {
      return emptyResult;
    }

    const commonMarkers = common?.markers ?? [];
    const typeMarkers = entry.markers ?? [];
    const allMarkers = [...commonMarkers, ...typeMarkers];

    const found: { label: string }[] = [];
    const missing: FardElementResult[] = [];
    const lowerText = rawText.toLowerCase();

    for (const marker of allMarkers) {
      const isFound = marker.kws.some((kw) => {
        const cleanKw = kw.trim().toLowerCase();
        return cleanKw.length > 0 && lowerText.includes(cleanKw);
      });

      if (isFound) {
        found.push({ label: marker.label });
      } else {
        const tip = findTipForMarker(marker, entry.essentials, common?.essentials ?? []);
        missing.push({ label: marker.label, tip });
      }
    }

    const total = allMarkers.length;
    const foundCount = found.length;
    const score = {
      found: foundCount,
      total,
      ratio: total > 0 ? foundCount / total : 0,
    };

    // First 3 items from type's mistakes
    const avoid = (entry.mistakes ?? []).slice(0, 3);

    // ── FIR Cross-Checks ──────────────────────────────────────────────────────
    const warnings: FardWarning[] = [];

    // FR1: fard date earlier than FIR occurrence date -> warn
    if (fir?.date_of_occurrence) {
      const firDateEpoch = parseDateStrToEpoch(fir.date_of_occurrence);
      const fardDateEpoch = extractDateFromText(rawText);
      if (firDateEpoch !== null && fardDateEpoch !== null) {
        if (fardDateEpoch < firDateEpoch) {
          warnings.push({
            code: 'FR1',
            type: 'warn',
            message: 'फर्द की तिथि एफआईआर घटना तिथि से पूर्व है।',
            messageEn: 'Fard date is earlier than FIR occurrence date.',
          });
        }
      }
    }

    // FR2: a 'धारा <number>' in text not present in fir.section -> info
    if (fir && typeof fir.section === 'string' && fir.section.trim()) {
      const firSectionStr = fir.section.replace(/\s+/g, '');
      const sectionMatches = rawText.matchAll(/(?:धारा|u\/s|sec(?:tion)?\.?)\s*([0-9]+[a-zA-Z]*)/gi);
      const reportedSections = new Set<string>();

      for (const m of sectionMatches) {
        if (m[1]) {
          const secNum = m[1].trim();
          if (!firSectionStr.includes(secNum) && !reportedSections.has(secNum)) {
            reportedSections.add(secNum);
            warnings.push({
              code: 'FR2',
              type: 'info',
              message: `धारा ${secNum} एफआईआर में दर्ज धाराओं (${fir.section}) में नहीं है।`,
              messageEn: `Section ${secNum} is not present in FIR sections (${fir.section}).`,
            });
          }
        }
      }
    }

    // FR3: for types GHATNASTHAL/NAKSHA_NAZRI: none of the FIR ghatnasthal words (>=3 chars) appear in text -> info
    if (entry.code === 'GHATNASTHAL' || entry.code === 'NAKSHA_NAZRI') {
      if (fir?.ghatnasthal && typeof fir.ghatnasthal === 'string' && fir.ghatnasthal.trim()) {
        const placeWords = fir.ghatnasthal
          .split(/[\s,./\-।|]+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 3);

        if (placeWords.length > 0) {
          const hasAnyWord = placeWords.some((w) => rawText.includes(w));
          if (!hasAnyWord) {
            warnings.push({
              code: 'FR3',
              type: 'info',
              message: `एफआईआर के घटनास्थल (${fir.ghatnasthal}) का कोई शब्द फर्द में नहीं मिला।`,
              messageEn: `None of the FIR place of occurrence keywords (${fir.ghatnasthal}) appear in the memo.`,
            });
          }
        }
      }
    }

    // FR4: 'बजे' start time later than end time (when both found) -> warn
    const timeMatches = Array.from(rawText.matchAll(/(\d{1,2}(?::\d{2})?)\s*बजे/g));
    if (timeMatches.length >= 2) {
      const t1 = parseBajeTimeToMinutes(timeMatches[0][1]);
      const t2 = parseBajeTimeToMinutes(timeMatches[1][1]);
      if (t1 !== null && t2 !== null && t1 > t2) {
        warnings.push({
          code: 'FR4',
          type: 'warn',
          message: `कार्यवाही शुरू होने का समय (${timeMatches[0][1]} बजे) समाप्त होने के समय (${timeMatches[1][1]} बजे) से बाद का है।`,
          messageEn: `Start time (${timeMatches[0][1]} hrs) is later than end time (${timeMatches[1][1]} hrs).`,
        });
      }
    }

    // FR5: witnesses mentioned as only police ranks (आरक्षी/कांस्टेबल/उपनिरीक्षक/दरोगा) and no other names -> info 'गवाह स्वतंत्र रखें'
    const mentionsWitness = /(?:गवाह|साक्षी|पंचनामा)/i.test(rawText);
    if (mentionsWitness) {
      const mentionsPoliceRank = /(?:आरक्षी|कांस्टेबल|उपनिरीक्षक|दरोगा|हेड\s*कांस्टेबल|हे\.?\s*का\.?|उ\.?\s*नि\.?)/i.test(rawText);
      // Check if civilian indicators exist (पिता, उम्र, निवासी, मोहल्ला, ग्राम, स्वतंत्र)
      const hasIndependentWitnessIndicator = /(?:स्वतंत्र|निवासी|पिता|उम्र|मोहल्ला|ग्राम|पुत्र|पुत्री|पत्नी)/i.test(rawText);
      if (mentionsPoliceRank && !hasIndependentWitnessIndicator) {
        warnings.push({
          code: 'FR5',
          type: 'info',
          message: 'गवाह स्वतंत्र रखें',
          messageEn: 'Keep witnesses independent (avoid relying solely on police personnel).',
        });
      }
    }

    return {
      type: entry,
      found,
      missing,
      score,
      warnings,
      avoid,
    };
  } catch (_err) {
    return emptyResult;
  }
}
