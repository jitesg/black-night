/**
 * NaturalLanguageQueryEngine.ts
 * Translates officer natural language queries into structured FIR searches.
 * Executes via existing repository methods only — never accesses DB directly.
 *
 * SAFETY: Read-only. Never modifies investigation data.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { NLQIntent, NLQResult } from './L5Types';

// ── Intent patterns ───────────────────────────────────────────────────────────

interface IntentPattern {
  intent: NLQIntent;
  keywords: string[];
  check: (ctx: InvestigationContext) => boolean;
  relevanceNote: (ctx: InvestigationContext) => string;
}

const PATTERNS: IntentPattern[] = [
  {
    intent: 'find-firs-with-pending-medical',
    keywords: ['medical', 'doctor', 'hospital', 'examination', 'injury', 'hurt', 'पीड़ित', 'चिकित्सा'],
    check: (ctx) => {
      const hasVictim = !!ctx.fir?.complainant_name;
      const medDone   = ctx.karyvahi.completed.some(
        (k) => k.name.toLowerCase().includes('medical') || k.name.toLowerCase().includes('doctor')
      );
      return hasVictim && !medDone;
    },
    relevanceNote: () => 'Medical examination pending for victim.',
  },
  {
    intent: 'find-firs-nearing-charge-sheet-deadline',
    keywords: ['charge sheet', 'chargesheet', 'deadline', 'challan', 'चालान', 'अभियोग'],
    check: (ctx) =>
      ctx.overdueItems.some(
        (o) => o.module.toLowerCase().includes('charge') || o.title.toLowerCase().includes('charge sheet')
      ) || (Date.now() - (ctx.fir?.created_at ?? 0)) > 50 * 86_400_000,
    relevanceNote: (ctx) => {
      const days = Math.floor((Date.now() - (ctx.fir?.created_at ?? 0)) / 86_400_000);
      return `FIR is ${days} days old — approaching charge sheet deadline.`;
    },
  },
  {
    intent: 'find-firs-without-case-diary',
    keywords: ['case diary', 'diary', 'roznama', 'roznamcha', 'रोजनामचा', 'केस डायरी'],
    check: (ctx) => ctx.caseDiaries.length === 0,
    relevanceNote: () => 'No case diary entries found.',
  },
  {
    intent: 'find-firs-by-crime-type',
    keywords: ['ndps', 'murder', 'theft', 'robbery', 'rape', 'fraud', 'assault', 'kidnapping', 'pocso', 'sc/st', 'sc st', 'चोरी', 'हत्या', 'अपहरण'],
    check: (ctx) => !!ctx.fir?.crime_type,
    relevanceNote: (ctx) => `Crime type: ${ctx.fir?.crime_type ?? '—'}.`,
  },
  {
    intent: 'find-firs-with-custody',
    keywords: ['custody', 'arrest', 'detained', 'remand', 'graft', 'हिरासत', 'गिरफ्तार'],
    check: (ctx) =>
      ctx.karyvahi.all.some(
        (k) => k.name.toLowerCase().includes('arrest') || k.name.toLowerCase().includes('गिरफ्तार')
      ),
    relevanceNote: () => 'Accused in custody.',
  },
  {
    intent: 'find-firs-with-pending-fsl',
    keywords: ['fsl', 'forensic', 'laboratory', 'examine', 'exhibit', 'फॉरेंसिक', 'प्रयोगशाला'],
    check: (ctx) => {
      const seized = ctx.karyvahi.all.some(
        (k) => k.name.toLowerCase().includes('seizure') || k.name.toLowerCase().includes('muddemal')
      );
      const fslDone = ctx.karyvahi.completed.some(
        (k) => k.name.toLowerCase().includes('fsl') || k.name.toLowerCase().includes('forensic')
      );
      return seized && !fslDone;
    },
    relevanceNote: () => 'Seized material pending FSL examination.',
  },
  {
    intent: 'find-firs-by-officer',
    keywords: ['officer', 'io', 'investigating officer', 'assigned', 'अधिकारी'],
    check: (ctx) => !!ctx.officer?.name,
    relevanceNote: (ctx) => `Assigned to: ${ctx.officer?.name ?? '—'}.`,
  },
  {
    intent: 'find-recent-firs',
    keywords: ['recent', 'last 30 days', 'new', 'latest', 'today', 'this week', 'हाल', 'ताजा'],
    check: (ctx) =>
      ctx.fir ? (Date.now() - ctx.fir.created_at) < 30 * 86_400_000 : false,
    relevanceNote: () => 'Registered within last 30 days.',
  },
  {
    intent: 'find-firs-with-default-bail-risk',
    keywords: ['bail', 'default bail', 'anticipatory', 'जमानत', 'डिफॉल्ट जमानत'],
    check: (ctx) =>
      ctx.overdueItems.some(
        (o) => o.module.toLowerCase().includes('bail') || o.title.toLowerCase().includes('bail')
      ),
    relevanceNote: () => 'Default bail risk identified.',
  },
  {
    intent: 'find-firs-with-overdue-court',
    keywords: ['court', 'hearing', 'next date', 'compliance', 'न्यायालय', 'तारीख'],
    check: (ctx) =>
      ctx.courtDocs.some((d) => {
        if (!d.deadline_date) return false;
        return new Date(d.deadline_date).getTime() <= Date.now() + 7 * 86_400_000;
      }),
    relevanceNote: () => 'Court hearing due within 7 days.',
  },
  {
    intent: 'find-all-pending-firs',
    keywords: ['pending', 'open', 'all fir', 'list fir', 'show fir', 'सभी', 'लंबित'],
    check: (ctx) => ctx.fir?.status === 'Pending',
    relevanceNote: () => 'FIR is pending.',
  },
];

// ── Spell correction (minimal) ────────────────────────────────────────────────

const TYPO_MAP: Record<string, string> = {
  'chargesheet': 'charge sheet',
  'chargsheet':  'charge sheet',
  'meical':      'medical',
  'mdical':      'medical',
  'foernsic':    'forensic',
  'fornsic':     'forensic',
  'pendig':      'pending',
};

function correct(query: string): { corrected: string; wasCorrected: boolean } {
  let corrected = query.toLowerCase();
  let wasCorrected = false;
  for (const [typo, fix] of Object.entries(TYPO_MAP)) {
    if (corrected.includes(typo)) {
      corrected = corrected.replaceAll(typo, fix);
      wasCorrected = true;
    }
  }
  return { corrected, wasCorrected };
}

// ── Intent detection ──────────────────────────────────────────────────────────

function detectIntent(query: string): { intent: NLQIntent; pattern?: IntentPattern } {
  const q = query.toLowerCase();
  for (const p of PATTERNS) {
    if (p.keywords.some((kw) => q.includes(kw))) {
      return { intent: p.intent, pattern: p };
    }
  }
  return { intent: 'unknown' };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class NaturalLanguageQueryEngine {
  /**
   * Translate a natural language query and match against provided contexts.
   * Contexts are pre-loaded InvestigationContexts (one per FIR) by the
   * caller — this engine never touches repositories directly.
   */
  static query(
    rawQuery: string,
    contexts: InvestigationContext[]
  ): NLQResult {
    const { corrected, wasCorrected } = correct(rawQuery);
    const { intent, pattern }         = detectIntent(corrected);

    let matchingFIRs: NLQResult['matchingFIRs'] = [];
    let interpretations: string[] = [];

    if (intent === 'unknown' || !pattern) {
      // Fallback: keyword search across FIR number / crime type / section
      const kws = corrected.split(/\s+/).filter((w) => w.length > 2);
      matchingFIRs = contexts
        .filter((ctx) => {
          if (!ctx.fir) return false;
          const haystack = `${ctx.fir.fir_number} ${ctx.fir.crime_type} ${ctx.fir.section}`.toLowerCase();
          return kws.some((kw) => haystack.includes(kw));
        })
        .map((ctx) => ({
          firId:         ctx.fir!.id,
          firNumber:     ctx.fir!.fir_number,
          crimeType:     ctx.fir!.crime_type,
          relevanceNote: 'Keyword match.',
        }));
      interpretations = ['Keyword search (no specific intent detected).'];
    } else {
      matchingFIRs = contexts
        .filter((ctx) => ctx.fir && pattern.check(ctx))
        .map((ctx) => ({
          firId:         ctx.fir!.id,
          firNumber:     ctx.fir!.fir_number,
          crimeType:     ctx.fir!.crime_type,
          relevanceNote: pattern.relevanceNote(ctx),
        }));
      interpretations = [`Intent: ${intent}`, `Matched on: ${pattern.keywords.slice(0, 3).join(', ')}`];
    }

    return {
      query:          rawQuery,
      correctedQuery: wasCorrected ? corrected : undefined,
      intent,
      interpretations,
      matchingFIRs,
      totalMatches: matchingFIRs.length,
      executionNote:
        `Searched ${contexts.length} FIR context(s). ` +
        `Found ${matchingFIRs.length} match(es). ` +
        (wasCorrected ? `Query auto-corrected to: "${corrected}".` : ''),
      confidence: intent !== 'unknown' ? 85 : 45,
    };
  }
}
