/**
 * LawLookupTool.ts
 * Dedicated tool for resolving exact legal section references and statutory
 * offence classifications from the local Law Library (BNS 2023, BNSS 2023, BSA 2023).
 *
 * SAFETY: Offline, rule-based, zero hallucination. All text and classifications
 * are loaded verbatim from official gazette data.
 */

import type { AITool } from '../AITypes';
import {
  getSection,
  getOffenceClassification,
  getSectionLabel,
  parseSectionRef,
  extractRefs,
  getLinks,
  type ActId,
  type OffenceClassificationRow,
  type LawLinksResult,
} from '@/lib/law/lawLibrary';
import { getSimple, type SimpleExplainEntry } from '@/lib/law/simpleExplain';
import { getDetailedExplain, type DetailedExplainEntry } from '@/lib/law/detailedAnalysis';
import { getCasesForSection, type CaseLawItem } from '@/lib/law/casesData';

export interface LawLookupInput {
  refs?: string[];
  text?: string;
}

export interface LawLookupSection {
  label: string;
  act: ActId;
  n: number;
  sub?: string;
  title: string;
  text: string;
  classification?: OffenceClassificationRow[];
  links?: LawLinksResult;
  simple_explanation?: SimpleExplainEntry | null;
  detailed_explanation?: DetailedExplainEntry | null;
  cases?: CaseLawItem[];
}

export interface LawLookupOutput {
  sections: LawLookupSection[];
}

export const LawLookupTool: AITool<LawLookupInput, LawLookupOutput> = {
  name: 'LawLookupTool',
  description: 'Resolves exact legal section references (BNS/BNSS/BSA) and offence classifications.',
  async execute({ refs = [], text = '' }) {
    const rawRefs: Array<{ act: ActId; n: number; sub?: string }> = [];

    // 1. Process explicit ref list
    for (const r of refs) {
      if (!r) continue;
      const parsed = parseSectionRef(r);
      if (parsed) {
        rawRefs.push(parsed);
      } else {
        const extracted = extractRefs(r);
        rawRefs.push(...extracted);
      }
    }

    // 2. Process text if provided
    if (text) {
      const parsedFromText = parseSectionRef(text);
      if (parsedFromText) {
        rawRefs.push(parsedFromText);
      }
      const extractedFromText = extractRefs(text);
      rawRefs.push(...extractedFromText);
    }

    // 3. Deduplicate references by act:n
    const seen = new Set<string>();
    const uniqueRefs: Array<{ act: ActId; n: number; sub?: string }> = [];
    for (const r of rawRefs) {
      const key = `${r.act}:${r.n}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRefs.push(r);
      }
    }

    // 4. Resolve each section from Law Library
    const sections: LawLookupSection[] = [];
    for (const r of uniqueRefs) {
      const sec = getSection(r.act, r.n);
      if (!sec) continue;

      const label = getSectionLabel(r.act, r.n, r.sub);
      const classification =
        r.act === 'BNS' ? getOffenceClassification(r.n) : undefined;
      const links = getLinks(r.act, r.n);
      const simple_explanation = getSimple(r.act, r.n);
      const detailed_explanation = getDetailedExplain(r.act, r.n);
      const cases = getCasesForSection(r.act, r.n);

      sections.push({
        label,
        act: r.act,
        n: r.n,
        sub: r.sub,
        title: sec.title,
        text: sec.text.slice(0, 1500),
        ...(classification && classification.length > 0 ? { classification } : {}),
        links,
        simple_explanation,
        detailed_explanation,
        cases,
      });
    }

    return { sections };
  },
};
