/**
 * ConversationMemoryEngine.ts
 * Maintains FIR-scoped AI conversation history.
 * Memory is strictly isolated per FIR — never mixed across cases.
 *
 * SAFETY: Read-only. Never modifies investigation records.
 */

import type {
  ConversationTurn,
  FIRConversationMemory,
  ConversationContext,
} from './L5Types';

// ── In-process store (per FIR) ────────────────────────────────────────────────
const store = new Map<string, FIRConversationMemory>();
const MAX_TURNS_PER_SESSION = 100;
const RECENT_TURNS_FOR_CONTEXT = 10;

function emptyMemory(firId: string, firNumber?: string): FIRConversationMemory {
  return {
    firId,
    firNumber,
    sessions: [],
    totalTurns: 0,
    lastInteractionAt: new Date().toISOString(),
  };
}

export class ConversationMemoryEngine {
  /** Get or create memory for a FIR. */
  static getMemory(firId: string, firNumber?: string): FIRConversationMemory {
    if (!store.has(firId)) {
      store.set(firId, emptyMemory(firId, firNumber));
    }
    return store.get(firId)!;
  }

  /** Add a conversation turn into a session. Creates session if needed. */
  static addTurn(
    firId: string,
    sessionId: string,
    role: ConversationTurn['role'],
    content: string,
    firNumber?: string,
    relatedRecommendationIds?: string[]
  ): ConversationTurn {
    const memory = ConversationMemoryEngine.getMemory(firId, firNumber);

    let session = memory.sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      session = { sessionId, startedAt: new Date().toISOString(), turns: [] };
      memory.sessions.push(session);
    }

    const turn: ConversationTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firId,
      sessionId,
      role,
      content,
      timestamp: new Date().toISOString(),
      relatedRecommendationIds,
    };

    session.turns.push(turn);
    // Trim session if too long
    if (session.turns.length > MAX_TURNS_PER_SESSION) {
      session.turns.shift();
    }

    memory.totalTurns += 1;
    memory.lastInteractionAt = turn.timestamp;
    return turn;
  }

  /**
   * Build a ConversationContext for prompt injection.
   * Returns the most recent N turns across sessions for the given FIR.
   */
  static buildContext(firId: string, sessionId: string): ConversationContext {
    const memory = store.get(firId);
    if (!memory) {
      return { firId, recentTurns: [], summary: 'No previous conversation history.' };
    }

    // Collect all turns from current session first, then previous sessions
    const currentSession = memory.sessions.find((s) => s.sessionId === sessionId);
    const otherTurns = memory.sessions
      .filter((s) => s.sessionId !== sessionId)
      .flatMap((s) => s.turns)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const allTurns = [
      ...(currentSession?.turns ?? []),
      ...otherTurns,
    ].slice(0, RECENT_TURNS_FOR_CONTEXT);

    const officerQuestions = allTurns
      .filter((t) => t.role === 'officer')
      .slice(0, 3)
      .map((t) => `• "${t.content.slice(0, 60)}..."`)
      .join('\n');

    const summary = memory.totalTurns === 0
      ? 'No previous conversation history for this FIR.'
      : `Previous conversation: ${memory.totalTurns} turns across ${memory.sessions.length} session(s).\n` +
        `Recent officer questions:\n${officerQuestions || '(none)'}`;

    return { firId, recentTurns: allTurns, summary };
  }

  /** Clear all conversation memory for a FIR (officer-initiated reset). */
  static clearMemory(firId: string): void {
    store.delete(firId);
  }

  /** Check if any conversation history exists for a FIR. */
  static hasHistory(firId: string): boolean {
    return (store.get(firId)?.totalTurns ?? 0) > 0;
  }
}
