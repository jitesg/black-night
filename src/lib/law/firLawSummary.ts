/**
 * firLawSummary.ts
 * Generates official, rule-based statutory summaries for BNS sections cited in FIRs.
 *
 * SAFETY: Zero hallucination, offline. Classification data comes directly
 * from the BNSS First Schedule official gazette text.
 */

import type { FIR } from '@/lib/db/firRepo';
import {
  getOffenceClassification,
  extractRefs,
  parseSectionRef,
  type OffenceClassificationRow,
} from './lawLibrary';

export interface FIRSectionSummaryItem {
  label: string;
  n: number;
  sub?: string;
  isMulti: boolean;
  cognizable: string;
  bailable: string;
  court: string;
  allNonCognizable: boolean;
  bnss35NoticeEligible: boolean;
}

/**
 * Checks if punishment text specifies imprisonment of up to 7 years with fine/both and is cognizable.
 */
function isNoticeEligibleRow(row: OffenceClassificationRow): boolean {
  const isCog =
    /cognizable/i.test(row.cognizable) && !/non-cognizable/i.test(row.cognizable);
  if (!isCog) return false;

  const p = row.punishment ?? '';
  if (!/imprisonment\s+(?:which\s+may\s+extend\s+to|for)/i.test(p)) return false;
  if (!/(?:fine|both)/i.test(p)) return false;

  const m = p.match(
    /(?:imprisonment\s+(?:which\s+may\s+extend\s+to|for)?\s*)(\d+)\s*(year|month|day)/i
  );
  if (!m) return false;

  const val = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('year') && val > 7) return false;

  return true;
}

/**
 * Checks if all rows for a section satisfy BNSS 35(3) notice conditions.
 */
function checkBnss35NoticeEligible(rows: OffenceClassificationRow[]): boolean {
  if (rows.length === 0) return false;
  return rows.every(isNoticeEligibleRow);
}

/**
 * Builds the official statutory summary for BNS sections cited in an FIR.
 */
export function buildFIRLawSummary(fir?: FIR | null): string {
  if (!fir || !fir.section || !fir.section.trim()) {
    return '';
  }

  const rawSec = fir.section.trim();

  // 1. Temporal & Act check: If FIR is IPC-era, SKIP BNS matching
  const hasIPCMention = /ipc|आईपीसी|भा\.?दं\.?सं/i.test(rawSec);

  // Check FIR date / incident date (cutoff: 2024-07-01)
  const rawAny = fir as unknown as Record<string, unknown>;
  const dateCandidates = [
    typeof fir.date_of_information === 'string' ? fir.date_of_information : null,
    typeof fir.date_of_occurrence === 'string' ? fir.date_of_occurrence : null,
    typeof rawAny.date_of_registration === 'string' ? rawAny.date_of_registration : null,
    typeof rawAny.fir_date === 'string' ? rawAny.fir_date : null,
    fir.created_at ? new Date(fir.created_at).toISOString().slice(0, 10) : null,
  ].filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d));

  const isPreBNSDate = dateCandidates.some((d) => d < '2024-07-01');

  if (hasIPCMention || isPreBNSDate) {
    return '\n\n**धाराओं का आधिकारिक सार:**\nIPC की धाराएँ: BNS मिलान उपलब्ध नहीं';
  }

  // 2. Parse section numbers from fir.section
  const sectionTokens: Array<{ n: number; sub?: string; label: string }> = [];
  const seenKeys = new Set<string>();

  // Explicit refs e.g. "BNS 103(1)"
  const explicitRefs = extractRefs(rawSec);
  for (const r of explicitRefs) {
    if (r.act === 'BNS') {
      const key = `${r.n}:${r.sub || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        sectionTokens.push({
          n: r.n,
          sub: r.sub?.replace(/[()]/g, ''),
          label: `BNS ${r.n}${r.sub ? `(${r.sub.replace(/[()]/g, '')})` : ''}`,
        });
      }
    }
  }

  // Also parse comma / slash / space separated numbers like "303(2), 351(2)" or "103(1), 238"
  const tokens = rawSec.split(/[,;\/\s]+/).filter(Boolean);
  for (const tok of tokens) {
    const singleParsed = parseSectionRef(tok);
    if (singleParsed && singleParsed.act === 'BNS') {
      const key = `${singleParsed.n}:${singleParsed.sub || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        sectionTokens.push({
          n: singleParsed.n,
          sub: singleParsed.sub?.replace(/[()]/g, ''),
          label: `BNS ${singleParsed.n}${singleParsed.sub ? `(${singleParsed.sub.replace(/[()]/g, '')})` : ''}`,
        });
      }
      continue;
    }

    const numMatch = tok.match(/(?:धारा|sec(?:tion)?)?\s*(\d+)(?:\(([^)]+)\))?/i);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      const sub = numMatch[2] ? numMatch[2].trim() : undefined;
      const key = `${n}:${sub || ''}`;
      if (!seenKeys.has(key) && n > 0 && n <= 358) {
        seenKeys.add(key);
        sectionTokens.push({
          n,
          sub,
          label: `BNS ${n}${sub ? `(${sub})` : ''}`,
        });
      }
    }
  }

  if (sectionTokens.length === 0) {
    return '';
  }

  // 3. Assemble classification blocks
  const lines: string[] = ['\n\n**धाराओं का आधिकारिक सार:**'];

  for (const sec of sectionTokens) {
    const allRows = getOffenceClassification(sec.n);
    if (allRows.length === 0) {
      lines.push(`• **${sec.label}**: वर्गीकरण विवरण उपलब्ध नहीं`);
      continue;
    }

    // Match exact sub-section row if specified, or first row
    const targetSecStr = sec.sub ? `${sec.n}(${sec.sub})` : String(sec.n);
    const matchedRow =
      allRows.find((r) => String(r.sec).trim() === targetSecStr) || allRows[0];

    const isMulti =
      allRows.length > 1 ||
      Boolean(matchedRow.variants && matchedRow.variants.length > 1) ||
      matchedRow.cognizable.includes('Non-cognizable.');

    const multiTag = isMulti ? ' (कई उप-धाराएँ)' : '';
    const cog = matchedRow.cognizable.trim().replace(/\.$/, '');
    const bail = matchedRow.bailable.trim().replace(/\.$/, '');
    const court = matchedRow.court.trim().replace(/\.$/, '');

    lines.push(
      `• **${sec.label}**${multiTag} | संज्ञेय: ${cog} | जमानती: ${bail} | न्यायालय: ${court}`
    );

    // Derived hint 1: ALL rows non-cognizable
    const allNonCog = allRows.every((r) => {
      const rowNonCog =
        /non-cognizable|असंज्ञेय/i.test(r.cognizable) &&
        !/^cognizable\b/i.test(r.cognizable.trim());
      const variantsNonCog =
        !r.variants ||
        r.variants.every((v) => /non-cognizable|असंज्ञेय/i.test(v.cognizable || ''));
      return rowNonCog && variantsNonCog;
    });

    if (allNonCog) {
      lines.push(
        '  ↳ ℹ️ असंज्ञेय — बिना वारंट गिरफ्तारी नहीं (अनुसूची I की टिप्पणी देखें)'
      );
    }

    // Derived hint 2: BNSS 35(3) notice
    if (checkBnss35NoticeEligible(allRows)) {
      lines.push(
        '  ↳ ℹ️ BNSS 35(3) के अंतर्गत नोटिस पर विचार करें (धारा 35 पढ़ें)'
      );
    }
  }

  return lines.join('\n');
}
