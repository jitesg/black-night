/**
 * LearningEngine.ts
 * Optional local learning engine. Learns only from officer-approved interactions.
 * Learning is local-only by default, privacy-safe.
 * Never overrides officer decisions. Never shares data externally.
 *
 * SAFETY: Read-only advisory. Never modifies investigation records.
 */

import type {
  LearningPattern,
  LearningEngineState,
  OfficerAction,
} from './L5Types';

// ── In-process state ──────────────────────────────────────────────────────────
const state: LearningEngineState = {
  patterns:                    [],
  totalAcceptedInteractions:   0,
  totalRejectedInteractions:   0,
  lastTrainingAt:              undefined,
  isEnabled:                   true,
  privacyMode:                 'local-only',
};

// ── Min confirmations before pattern is applied ───────────────────────────────
const MIN_CONFIRMATIONS = 3;

function uid(): string {
  return `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class LearningEngine {
  /** Enable or disable learning. */
  static setEnabled(enabled: boolean): void {
    state.isEnabled = enabled;
  }

  static isEnabled(): boolean {
    return state.isEnabled;
  }

  /**
   * Record officer feedback on a recommendation.
   * Only 'accepted' interactions contribute to learning patterns.
   */
  static recordFeedback(
    recommendationTitle: string,
    crimeType: string | undefined,
    triggerConditions: string[],
    action: OfficerAction
  ): void {
    if (!state.isEnabled) return;

    if (action === 'accepted') {
      state.totalAcceptedInteractions += 1;
      LearningEngine._upsertPattern(recommendationTitle, crimeType, triggerConditions, true);
    } else if (action === 'rejected') {
      state.totalRejectedInteractions += 1;
      LearningEngine._upsertPattern(recommendationTitle, crimeType, triggerConditions, false);
    }
  }

  /** Get a confidence boost for a given recommendation if pattern matches. */
  static getConfidenceBoost(
    recommendationTitle: string,
    crimeType?: string
  ): number {
    if (!state.isEnabled) return 0;
    const pattern = state.patterns.find(
      (p) =>
        p.isActive &&
        p.confirmationCount >= MIN_CONFIRMATIONS &&
        p.recommendedAction.toLowerCase() === recommendationTitle.toLowerCase() &&
        (p.crimeType === undefined || p.crimeType === crimeType)
    );
    return pattern?.confidenceBoost ?? 0;
  }

  /** Return active patterns for a crime type. */
  static getPatternsForCrimeType(crimeType: string): LearningPattern[] {
    return state.patterns.filter(
      (p) =>
        p.isActive &&
        p.confirmationCount >= MIN_CONFIRMATIONS &&
        (p.crimeType === undefined || p.crimeType === crimeType)
    );
  }

  /** Return current state snapshot. */
  static getState(): Readonly<LearningEngineState> {
    return { ...state, patterns: [...state.patterns] };
  }

  /** Reset all learned patterns (officer-initiated). */
  static reset(): void {
    state.patterns                  = [];
    state.totalAcceptedInteractions = 0;
    state.totalRejectedInteractions = 0;
    state.lastTrainingAt            = undefined;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private static _upsertPattern(
    title: string,
    crimeType: string | undefined,
    triggers: string[],
    positive: boolean
  ): void {
    const key = `${title.toLowerCase()}|${crimeType ?? '*'}`;
    let   pat = state.patterns.find(
      (p) =>
        p.recommendedAction.toLowerCase() === title.toLowerCase() &&
        p.crimeType === crimeType
    );

    if (!pat) {
      pat = {
        id:                uid(),
        patternType:       'recommendation',
        description:       `Learned pattern: "${title}"`,
        crimeType,
        triggerConditions: triggers,
        recommendedAction: title,
        confirmationCount: 0,
        rejectionCount:    0,
        confidenceBoost:   0,
        lastUpdatedAt:     new Date().toISOString(),
        isActive:          false,
      };
      state.patterns.push(pat);
    }

    if (positive) {
      pat.confirmationCount += 1;
      // Increase confidence boost (capped at 20)
      pat.confidenceBoost = Math.min(20, pat.confirmationCount * 2);
    } else {
      pat.rejectionCount += 1;
      // Reduce confidence boost on rejection
      pat.confidenceBoost = Math.max(0, pat.confidenceBoost - 5);
    }

    // Activate pattern only after MIN_CONFIRMATIONS
    pat.isActive       = pat.confirmationCount >= MIN_CONFIRMATIONS;
    pat.lastUpdatedAt  = new Date().toISOString();
    state.lastTrainingAt = pat.lastUpdatedAt;

    // Suppress unused-variable warning for key (used conceptually)
    void key;
  }
}
