/**
 * AILearningLayer.ts
 * Level-7: In-memory learning from usage — tracks frequently opened laws,
 * formats, knowledge, and questions. Never modifies investigation data.
 *
 * SAFETY: In-memory only. Never persists to DB. Never modifies investigation records.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { AILearningReport, LearningInsight } from './L7Types';

// ── In-memory store ───────────────────────────────────────────────────────────

interface CountEntry { count: number; lastAt: string; label: string }

const store = {
  lawCounts:       new Map<string, CountEntry>(),
  formatCounts:    new Map<string, CountEntry>(),
  knowledgeCounts: new Map<string, CountEntry>(),
  questionCounts:  new Map<string, CountEntry>(),
};

function bump(map: Map<string, CountEntry>, key: string, label: string): void {
  const e = map.get(key);
  if (e) { e.count++; e.lastAt = new Date().toISOString(); }
  else   map.set(key, { count: 1, lastAt: new Date().toISOString(), label });
}

function topN(map: Map<string, CountEntry>, n: number, type: LearningInsight['type']): LearningInsight[] {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, n)
    .map(([key, e]) => ({
      type, item: e.label || key,
      openCount: e.count,
      relevance: Math.min(1, e.count / 10),
      boostReason: `Opened ${e.count} time(s). Last accessed: ${e.lastAt.slice(0, 10)}.`,
    }));
}

export const AILearningLayer = {
  /** Called when officer opens a law/rule reference */
  recordLawOpen(ruleId: string, title: string): void {
    bump(store.lawCounts, ruleId, title);
  },

  /** Called when a format is used */
  recordFormatUse(formatId: string, title: string): void {
    bump(store.formatCounts, formatId, title);
  },

  /** Called when a knowledge article is viewed */
  recordKnowledgeView(articleId: string, title: string): void {
    bump(store.knowledgeCounts, articleId, title);
  },

  /** Called when an NL question is asked */
  recordQuestion(question: string): void {
    const normalized = question.toLowerCase().trim().slice(0, 80);
    bump(store.questionCounts, normalized, question);
  },

  /** Generate learning report */
  generateReport(ctx: InvestigationContext): AILearningReport {
    // Seed from context relevantKnowledge if first run
    if (store.lawCounts.size === 0 && ctx.relevantKnowledge.length > 0) {
      ctx.relevantKnowledge.slice(0, 5).forEach((k) => {
        bump(store.lawCounts, k.id, `${k.category} — ${k.title}`);
      });
    }

    const topLaws      = topN(store.lawCounts,       5, 'law');
    const topFormats   = topN(store.formatCounts,    5, 'format');
    const topKnowledge = topN(store.knowledgeCounts, 5, 'knowledge');
    const topQuestions = topN(store.questionCounts,  5, 'question');

    const hints: string[] = [];
    if (topLaws.length > 0)      hints.push(`Frequently referenced: ${topLaws[0].item}`);
    if (topQuestions.length > 0) hints.push(`Most asked: "${topQuestions[0].item}"`);
    if (ctx.relevantKnowledge.length > 0)
      hints.push(`${ctx.relevantKnowledge.length} knowledge articles relevant to this FIR type.`);

    return {
      generatedAt: new Date().toISOString(),
      topLaws, topFormats, topKnowledge, topQuestions,
      improvementHints: hints,
    };
  },

  /** Reset all learning data (for testing / privacy) */
  reset(): void {
    store.lawCounts.clear();
    store.formatCounts.clear();
    store.knowledgeCounts.clear();
    store.questionCounts.clear();
  },
};
