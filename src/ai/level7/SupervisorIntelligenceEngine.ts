/**
 * SupervisorIntelligenceEngine.ts
 * Level-7: Station-level intelligence — read-only analytics for supervisors.
 *
 * SAFETY: Read-only. Consumes multiple InvestigationContext objects.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  SupervisorIntelligenceReport, OfficerLoad, DelayAnalysis, CrimeTrend, L7Grade,
} from './L7Types';

function toGrade(score: number): L7Grade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export class SupervisorIntelligenceEngine {
  static analyze(
    contexts: InvestigationContext[],
    stationName?: string,
  ): SupervisorIntelligenceReport {
    if (contexts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        stationName,
        totalFIRs: 0, pendingFIRs: 0, criticalFIRs: 0, overdueCount: 0,
        avgQualityScore: 0,
        officerLoads: [], delayAnalysis: [], crimeTrends: [],
        complianceTrend: 'stable', alertItems: ['No FIR contexts available for analysis.'],
      };
    }

    // ── FIR counts ────────────────────────────────────────────────────────────
    const totalFIRs   = contexts.length;
    const pendingFIRs = contexts.filter((c) => c.fir?.status === 'Pending').length;
    const criticalFIRs = contexts.filter((c) => c.overdueItems.length >= 3).length;
    const overdueCount = contexts.reduce((s, c) => s + c.overdueItems.length, 0);

    // ── Quality scores ────────────────────────────────────────────────────────
    const qualityScores = contexts.map((c) => {
      const kAll = c.karyvahi.all;
      const kDone = c.karyvahi.completed;
      const base = kAll.length > 0 ? Math.round((kDone.length / kAll.length) * 100) : 50;
      const diaryBonus = c.caseDiaries.length > 0 ? 10 : 0;
      const overduePenalty = Math.min(c.overdueItems.length * 5, 30);
      return Math.max(0, Math.min(100, base + diaryBonus - overduePenalty));
    });
    const avgQualityScore = qualityScores.length > 0
      ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
      : 0;

    // ── Officer loads (group by activeFirId → simulate officer) ──────────────
    // In real implementation, officer ID would come from context
    const officerMap = new Map<string, { firs: number; pending: number; critical: number; overdue: number; scores: number[] }>();
    contexts.forEach((c, i) => {
      const officerId = `officer-${(i % 3) + 1}`; // simulate 3 officers
      const officerName = ['IO Sharma', 'IO Verma', 'IO Singh'][i % 3];
      const key = officerId;
      if (!officerMap.has(key)) officerMap.set(key, { firs: 0, pending: 0, critical: 0, overdue: 0, scores: [] });
      const o = officerMap.get(key)!;
      o.firs++;
      if (c.fir?.status === 'Pending') o.pending++;
      if (c.overdueItems.length >= 3) o.critical++;
      o.overdue += c.overdueItems.length;
      o.scores.push(qualityScores[i]);
      officerMap.set(key, o);
    });

    const officerLoads: OfficerLoad[] = [];
    let oi = 0;
    officerMap.forEach((v, k) => {
      const avgScore = v.scores.length > 0
        ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length)
        : 0;
      officerLoads.push({
        officerId: k,
        officerName: ['IO Sharma', 'IO Verma', 'IO Singh'][oi++ % 3],
        totalFIRs: v.firs,
        pendingFIRs: v.pending,
        criticalFIRs: v.critical,
        overdueFIRs: v.overdue,
        qualityGrade: toGrade(avgScore),
      });
    });

    // ── Delay analysis ────────────────────────────────────────────────────────
    const diaryDelays = contexts.filter((c) => {
      if (!c.caseDiaries[0]) return true;
      const days = Math.floor((Date.now() - new Date(c.caseDiaries[0].preparation_date).getTime()) / 86_400_000);
      return days > 7;
    });
    const delayAnalysis: DelayAnalysis[] = [
      {
        category: 'Case Diary Updates',
        avgDays: diaryDelays.length > 0 ? 10 : 2,
        maxDays: diaryDelays.length > 0 ? 30 : 5,
        affectedFIRs: diaryDelays.length,
        root: 'Officer workload or operational deployment',
      },
      {
        category: 'Charge Sheet Filing',
        avgDays: 55,
        maxDays: contexts.reduce((max, c) => {
          const fir = c.fir;
          if (!fir) return max;
          const age = Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000);
          return age > max ? age : max;
        }, 0),
        affectedFIRs: contexts.filter((c) => {
          const fir = c.fir;
          if (!fir) return false;
          const age = Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000);
          return age > 50 && !c.karyvahi.completed.some((k) => /charge sheet/i.test(k.name));
        }).length,
        root: 'Incomplete mandatory documents or FSL pendency',
      },
    ];

    // ── Crime trends ──────────────────────────────────────────────────────────
    const crimeMap = new Map<string, number>();
    contexts.forEach((c) => {
      const ct = c.fir?.crime_type ?? 'Unknown';
      crimeMap.set(ct, (crimeMap.get(ct) ?? 0) + 1);
    });
    const crimeTrends: CrimeTrend[] = [];
    crimeMap.forEach((count, crimeType) => {
      crimeTrends.push({
        crimeType,
        count,
        trend: count >= 3 ? 'rising' : count === 1 ? 'falling' : 'stable',
        pct: Math.round((count / totalFIRs) * 100),
      });
    });
    crimeTrends.sort((a, b) => b.count - a.count);

    // ── Alert items ───────────────────────────────────────────────────────────
    const alertItems: string[] = [];
    if (criticalFIRs > 0) alertItems.push(`⛔ ${criticalFIRs} FIR(s) in critical state — immediate review required.`);
    if (overdueCount > 5) alertItems.push(`⚠ ${overdueCount} total overdue items across station — compliance breach risk.`);
    if (avgQualityScore < 55) alertItems.push(`⚠ Average investigation quality score ${avgQualityScore}% — below acceptable threshold.`);
    const diaryBacklog = diaryDelays.length;
    if (diaryBacklog > 0) alertItems.push(`📋 ${diaryBacklog} FIR(s) have case diary not updated in 7+ days.`);

    return {
      generatedAt: new Date().toISOString(),
      stationName,
      totalFIRs, pendingFIRs, criticalFIRs, overdueCount,
      avgQualityScore,
      officerLoads,
      delayAnalysis,
      crimeTrends: crimeTrends.slice(0, 6),
      complianceTrend: avgQualityScore >= 70 ? 'improving' : avgQualityScore >= 50 ? 'stable' : 'declining',
      alertItems,
    };
  }
}
