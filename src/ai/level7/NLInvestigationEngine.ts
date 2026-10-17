/**
 * NLInvestigationEngine.ts
 * Level-7: Natural Language Investigation — structured answers to officer questions.
 *
 * SAFETY: Read-only. Pure analysis. No DB access. No LLM calls.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  NLInvestigationReport, NLInvestigationAnswer, NLStructuredData,
} from './L7Types';

function daysUntil(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function mkStructured(label: string, value: string | number, unit?: string, flag?: NLStructuredData['flag']): NLStructuredData {
  return { label, value, unit, flag };
}

// ── Question handlers ─────────────────────────────────────────────────────────

type Handler = (ctx: InvestigationContext) => NLInvestigationAnswer;

const HANDLERS: Array<{ patterns: RegExp[]; handler: Handler }> = [
  {
    patterns: [/what is pending/i, /kya pending/i, /pending kya/i, /show pending/i],
    handler: (ctx) => {
      const pending = ctx.karyvahi.pending;
      const overdue = ctx.overdueItems;
      const structured: NLStructuredData[] = [
        mkStructured('Pending Karyvahi', pending.length, 'items', pending.length > 3 ? 'warning' : 'ok'),
        mkStructured('Overdue Items', overdue.length, 'items', overdue.length > 0 ? 'critical' : 'ok'),
        mkStructured('Pending Court Docs', ctx.courtDocs.filter((d) => d.status === 'Pending').length, 'docs',
          ctx.courtDocs.filter((d) => d.status === 'Pending').length > 0 ? 'warning' : 'ok'),
        mkStructured('Pending Prarthna Patra', ctx.prarthnaPatra.filter((p) => p.status === 'Pending').length, 'items'),
      ];
      const items = [
        ...pending.slice(0, 4).map((k) => `• ${k.name}`),
        ...overdue.slice(0, 2).map((o) => `• [Overdue] ${o.title}`),
      ];
      return {
        question: 'What is pending?',
        answer: pending.length === 0 && overdue.length === 0
          ? 'No pending items found. All investigation steps appear completed.'
          : `${pending.length} karyvahi pending, ${overdue.length} overdue.\n${items.join('\n')}`,
        structured,
        confidence: 95,
        sources: ['Karyvahi', 'Overdue Items', 'Court Documents'],
        followUps: ['What evidence is missing?', 'What is the court readiness?'],
        relatedRules: ['L7-BNSS-007'],
      };
    },
  },
  {
    patterns: [/what evidence is missing/i, /evidence missing/i, /missing evidence/i, /saboot/i],
    handler: (ctx) => {
      const kCompleted = ctx.karyvahi.completed;
      const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
      const fir = ctx.fir;
      const crimeType = (fir?.crime_type ?? '').toLowerCase();
      const isViolent = /assault|murder|rape|hurt|kidnap|मारपीट|हत्या|बलात्कार/.test(crimeType);

      const missing: string[] = [];
      if (!doneK(['seizure', 'panchnama'])) missing.push('Seizure Memo / Panchnama');
      if (!doneK(['bayan', 'witness', 'statement'])) missing.push('Witness Statements (Bayan)');
      if (isViolent && !doneK(['medical', 'mlc', 'doctor'])) missing.push('Medical Certificate (MLC)');
      if (!doneK(['fsl report', 'forensic'])) missing.push('FSL Report');
      if (!doneK(['photography', 'photo', 'videography'])) missing.push('Photography/Videography');
      if (!doneK(['ghatnasthal', 'site inspection'])) missing.push('Site Inspection (Ghatnasthal)');

      const structured = missing.map((m) =>
        mkStructured('Missing', m, undefined, 'warning')
      );

      return {
        question: 'What evidence is missing?',
        answer: missing.length === 0
          ? 'No critical evidence gaps detected. Evidence collection appears adequate.'
          : `${missing.length} evidence item(s) missing:\n${missing.map((m) => `• ${m}`).join('\n')}`,
        structured,
        confidence: 90,
        sources: ['Karyvahi', 'FIR', 'Case Diary'],
        followUps: ['What is the charge sheet readiness?', 'What is the evidence strength score?'],
        relatedRules: ['L7-BNSS-001', 'L7-BNSS-003', 'L7-BNSS-004', 'L7-BNSS-006'],
      };
    },
  },
  {
    patterns: [/why is readiness/i, /readiness score/i, /why.*58/i, /why.*score/i, /investigation score/i],
    handler: (ctx) => {
      const kAll = ctx.karyvahi.all;
      const kCompleted = ctx.karyvahi.completed;
      const completionPct = kAll.length > 0 ? Math.round((kCompleted.length / kAll.length) * 100) : 0;
      const lastDiary = ctx.caseDiaries[0];
      const daysSinceDiary_ = lastDiary ? daysSince(lastDiary.preparation_date) : 999;
      const overdue = ctx.overdueItems.length;

      const factors: string[] = [];
      if (completionPct < 70) factors.push(`Only ${completionPct}% karyvahi completed`);
      if (daysSinceDiary_ > 7) factors.push(`Case diary not updated for ${daysSinceDiary_} days`);
      if (overdue > 0) factors.push(`${overdue} overdue compliance items`);
      if (!ctx.karyvahi.completed.some((k) => /bayan|witness|बयान|गवाह|वादी/.test(k.name.toLowerCase())))
        factors.push('Witness statements not completed');

      const structured = [
        mkStructured('Karyvahi Completed', completionPct, '%', completionPct >= 70 ? 'ok' : 'warning'),
        mkStructured('Days Since Last Diary', daysSinceDiary_, 'days', daysSinceDiary_ > 7 ? 'critical' : 'ok'),
        mkStructured('Overdue Items', overdue, 'items', overdue > 0 ? 'warning' : 'ok'),
      ];

      return {
        question: 'Why is the readiness score low?',
        answer: factors.length === 0
          ? 'Investigation readiness is on track. No critical gaps detected.'
          : `Readiness is affected by ${factors.length} factor(s):\n${factors.map((f) => `• ${f}`).join('\n')}`,
        structured,
        confidence: 88,
        sources: ['Karyvahi', 'Case Diary', 'Overdue Items'],
        followUps: ['What is pending?', 'Which karyvahi is highest priority?'],
        relatedRules: ['L7-BNSS-007', 'L7-BNS-001'],
      };
    },
  },
  {
    patterns: [/highest risk/i, /biggest risk/i, /critical risk/i, /main risk/i, /top risk/i],
    handler: (ctx) => {
      const fir = ctx.fir;
      const firAge = fir
        ? Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000)
        : 0;
      const overdue = ctx.overdueItems.length;
      const doneK = (pats: string[]) => ctx.karyvahi.completed.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

      const risks: Array<{ risk: string; score: number; rule: string }> = [];
      if (firAge > 55 && !doneK(['charge sheet'])) risks.push({ risk: 'Default bail risk — charge sheet deadline near', score: 95, rule: 'L7-BNS-001' });
      if (ctx.courtDocs.some((d) => { const days = daysUntil(d.deadline_date); return days !== undefined && days >= 0 && days <= 3; }))
        risks.push({ risk: 'Court deadline within 3 days — non-compliance risk', score: 90, rule: 'L7-COURT-001' });
      if (overdue >= 3) risks.push({ risk: `${overdue} overdue items — compliance breach`, score: 75, rule: 'L7-BNSS-007' });
      if (!doneK(['bayan', 'witness'])) risks.push({ risk: 'No witness statements — oral evidence missing', score: 70, rule: 'L7-BNSS-002' });

      const topRisk = risks.sort((a, b) => b.score - a.score)[0];

      return {
        question: 'What is the highest risk?',
        answer: topRisk
          ? `Highest risk: ${topRisk.risk} (Risk score: ${topRisk.score}/100)`
          : 'No critical risks detected. Investigation appears on track.',
        structured: risks.slice(0, 4).map((r) =>
          mkStructured(r.rule, r.risk, undefined, r.score >= 80 ? 'critical' : 'warning')
        ),
        confidence: 85,
        sources: ['FIR', 'Court Documents', 'Karyvahi', 'Overdue Items'],
        followUps: ['How to mitigate the highest risk?', 'What is pending?'],
        relatedRules: risks.map((r) => r.rule),
      };
    },
  },
  {
    patterns: [/which witness/i, /witness remain/i, /pending witness/i, /bayan kiska/i],
    handler: (ctx) => {
      const allBayan = ctx.karyvahi.all.filter((k) => /bayan|witness|statement|बयान/i.test(k.name));
      const doneBayan = ctx.karyvahi.completed.filter((k) => /bayan|witness|statement|बयान/i.test(k.name));
      const pendingBayan = allBayan.filter((k) => k.is_completed === 0);

      const structured = [
        mkStructured('Total Witness Karyvahi', allBayan.length, 'items'),
        mkStructured('Completed', doneBayan.length, 'items', 'ok'),
        mkStructured('Pending', pendingBayan.length, 'items', pendingBayan.length > 0 ? 'warning' : 'ok'),
      ];

      return {
        question: 'Which witnesses remain?',
        answer: pendingBayan.length === 0
          ? doneBayan.length === 0
            ? 'No witness statements recorded in this investigation.'
            : 'All witness statements have been completed.'
          : `${pendingBayan.length} witness statement(s) still pending:\n${pendingBayan.map((k) => `• ${k.name}`).join('\n')}`,
        structured,
        confidence: 92,
        sources: ['Karyvahi'],
        followUps: ['What evidence is missing?', 'What is the charge sheet readiness?'],
        relatedRules: ['L7-BNSS-002'],
      };
    },
  },
  {
    patterns: [/court/i, /hearing/i, /next date/i, /tarikh/i],
    handler: (ctx) => {
      const upcoming = ctx.courtDocs
        .filter((d) => d.deadline_date && d.status !== 'Finished')
        .sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime());
      const next = upcoming[0];
      const days = next ? daysUntil(next.deadline_date) : undefined;

      const structured = upcoming.slice(0, 3).map((d) => {
        const dl = daysUntil(d.deadline_date) ?? 99;
        return mkStructured(d.document_title || d.doc_type, `${dl} days`, undefined, dl <= 3 ? 'critical' : dl <= 7 ? 'warning' : 'ok');
      });

      return {
        question: 'What is the next court date?',
        answer: next
          ? `Next court deadline: ${next.deadline_date} (${days ?? '?'} day(s) from today)\nDocument: ${next.document_title || next.doc_type}\nCourt: ${next.court_name}`
          : 'No upcoming court deadlines detected in this investigation.',
        structured,
        confidence: 90,
        sources: ['Court Documents'],
        followUps: ['Is the court compliance ready?', 'What is pending?'],
        relatedRules: ['L7-COURT-001'],
      };
    },
  },
];

// ── Default fallback ──────────────────────────────────────────────────────────

function defaultAnswer(question: string, ctx: InvestigationContext): NLInvestigationAnswer {
  const fir = ctx.fir;
  const kDone = ctx.karyvahi.completed.length;
  const kTotal = ctx.karyvahi.all.length;
  return {
    question,
    answer: `Investigation context: FIR ${fir?.fir_number ?? 'N/A'} | ${kDone}/${kTotal} steps done | ${ctx.overdueItems.length} overdue items. Try asking: "What is pending?", "What evidence is missing?", "Highest risk?", "Which witness remains?"`,
    structured: [
      mkStructured('FIR', fir?.fir_number ?? 'N/A'),
      mkStructured('Karyvahi Done', `${kDone}/${kTotal}`),
      mkStructured('Overdue', ctx.overdueItems.length, 'items', ctx.overdueItems.length > 0 ? 'warning' : 'ok'),
    ],
    confidence: 50,
    sources: ['Investigation Context'],
    followUps: ['What is pending?', 'What evidence is missing?', 'Highest risk?'],
    relatedRules: [],
  };
}

// ── Suggested questions ───────────────────────────────────────────────────────

function getSuggestedQuestions(ctx: InvestigationContext): string[] {
  const suggestions = ['What is pending?', 'What evidence is missing?', 'What is the highest risk?'];
  if (ctx.courtDocs.length > 0) suggestions.push('What is the next court date?');
  if (ctx.karyvahi.all.some((k) => /bayan|witness|बयान|गवाह|वादी/i.test(k.name))) suggestions.push('Which witness remains?');
  suggestions.push('Why is the readiness score low?');
  return suggestions.slice(0, 5);
}

// ── Public API ────────────────────────────────────────────────────────────────

export class NLInvestigationEngine {
  static answer(question: string, ctx: InvestigationContext): NLInvestigationAnswer {
    for (const { patterns, handler } of HANDLERS) {
      if (patterns.some((p) => p.test(question))) {
        return handler(ctx);
      }
    }
    return defaultAnswer(question, ctx);
  }

  static generateReport(ctx: InvestigationContext): NLInvestigationReport {
    // Pre-populate answers for common questions
    const commonQuestions = [
      'What is pending?',
      'What evidence is missing?',
      'What is the highest risk?',
    ];
    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      answers: commonQuestions.map((q) => NLInvestigationEngine.answer(q, ctx)),
      suggestedQuestions: getSuggestedQuestions(ctx),
    };
  }
}
