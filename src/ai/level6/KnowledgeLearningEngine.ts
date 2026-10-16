/**
 * KnowledgeLearningEngine.ts
 * Level-6: Tracks frequently used laws, formats, checklists, and AI questions.
 * Used only to improve recommendations — never modifies system data.
 *
 * SAFETY: Read-only advisory. In-memory only. Never writes to any repository.
 * Privacy mode: local-only. No external sync.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  KnowledgeLearningReport,
  FrequentLaw,
  FrequentFormat,
  FrequentQuestion,
} from './L6Types';

// ── In-memory learning store (session-scoped) ─────────────────────────────────
interface LearningStore {
  lawOpenCounts:      Map<string, { title: string; count: number; lastAt: string }>;
  formatUseCounts:    Map<string, { count: number; lastAt: string }>;
  questionAskCounts:  Map<string, { count: number; lastAt: string; category: string }>;
  acceptedRecs:       Map<string, { title: string; accepted: number; total: number }>;
}

const store: LearningStore = {
  lawOpenCounts:     new Map(),
  formatUseCounts:   new Map(),
  questionAskCounts: new Map(),
  acceptedRecs:      new Map(),
};

export class KnowledgeLearningEngine {
  // ── Record events (called by service layer — never auto-invoked) ─────────────

  static recordLawOpen(section: string, title: string): void {
    const existing = store.lawOpenCounts.get(section);
    store.lawOpenCounts.set(section, {
      title,
      count:  (existing?.count ?? 0) + 1,
      lastAt: new Date().toISOString(),
    });
  }

  static recordFormatUse(formatType: string): void {
    const existing = store.formatUseCounts.get(formatType);
    store.formatUseCounts.set(formatType, {
      count:  (existing?.count ?? 0) + 1,
      lastAt: new Date().toISOString(),
    });
  }

  static recordQuestion(question: string, category: string): void {
    const key      = question.toLowerCase().trim().slice(0, 80);
    const existing = store.questionAskCounts.get(key);
    store.questionAskCounts.set(key, {
      count:    (existing?.count ?? 0) + 1,
      lastAt:   new Date().toISOString(),
      category,
    });
  }

  static recordRecommendationOutcome(recId: string, title: string, accepted: boolean): void {
    const existing = store.acceptedRecs.get(recId);
    store.acceptedRecs.set(recId, {
      title,
      accepted: (existing?.accepted ?? 0) + (accepted ? 1 : 0),
      total:    (existing?.total    ?? 0) + 1,
    });
  }

  // ── Generate report from context + in-memory store ────────────────────────

  static analyze(ctx: InvestigationContext): KnowledgeLearningReport {
    // Derive frequent laws from relevant knowledge entries
    const lawsFromCtx: FrequentLaw[] = ctx.relevantKnowledge.slice(0, 5).map((k) => ({
      section:    k.category ?? 'N/A',
      title:      k.title,
      openCount:  store.lawOpenCounts.get(k.category ?? '')?.count ?? 1,
      lastOpenedAt: store.lawOpenCounts.get(k.category ?? '')?.lastAt ?? new Date().toISOString(),
    }));

    // Merge with recorded opens
    const allLaws: FrequentLaw[] = [...lawsFromCtx];
    store.lawOpenCounts.forEach((v, section) => {
      if (!allLaws.some((l) => l.section === section)) {
        allLaws.push({ section, title: v.title, openCount: v.count, lastOpenedAt: v.lastAt });
      }
    });
    allLaws.sort((a, b) => b.openCount - a.openCount);

    // Frequent formats
    const defaultFormats: FrequentFormat[] = [
      { formatType: 'case-diary',    useCount: 0, lastUsedAt: '' },
      { formatType: 'notice',        useCount: 0, lastUsedAt: '' },
      { formatType: 'arrest-memo',   useCount: 0, lastUsedAt: '' },
      { formatType: 'charge-sheet',  useCount: 0, lastUsedAt: '' },
    ];
    const formats: FrequentFormat[] = defaultFormats.map((df) => {
      const rec = store.formatUseCounts.get(df.formatType);
      return { ...df, useCount: rec?.count ?? df.useCount, lastUsedAt: rec?.lastAt ?? df.lastUsedAt };
    });
    store.formatUseCounts.forEach((v, ft) => {
      if (!formats.some((f) => f.formatType === ft)) {
        formats.push({ formatType: ft, useCount: v.count, lastUsedAt: v.lastAt });
      }
    });
    formats.sort((a, b) => b.useCount - a.useCount);

    // Frequent questions
    const questions: FrequentQuestion[] = [];
    store.questionAskCounts.forEach((v, q) => {
      questions.push({ question: q, askedCount: v.count, lastAskedAt: v.lastAt, category: v.category });
    });
    questions.sort((a, b) => b.askedCount - a.askedCount);

    // Recommendation boosts
    const boosts = Array.from(store.acceptedRecs.entries()).map(([, v]) => ({
      title:          v.title,
      acceptanceRate: v.total > 0 ? Math.round((v.accepted / v.total) * 100) : 0,
      boostApplied:   v.total > 0 ? Math.min(15, Math.round((v.accepted / v.total) * 15)) : 0,
    })).filter((b) => b.acceptanceRate >= 50);

    return {
      generatedAt:          new Date().toISOString(),
      frequentLaws:         allLaws.slice(0, 8),
      frequentFormats:      formats.slice(0, 6),
      frequentQuestions:    questions.slice(0, 10),
      recommendationBoosts: boosts.slice(0, 5),
      isEnabled:            true,
      privacyMode:          'local-only',
      summary: `Learning engine active (local-only). ${allLaws.length} law(s) tracked, ${formats.filter(f => f.useCount > 0).length} format(s) used, ${questions.length} question(s) recorded.`,
    };
  }
}
