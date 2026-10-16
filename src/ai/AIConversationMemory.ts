/**
 * AIConversationMemory.ts
 * In-memory, session-scoped conversation store.
 * Never persists to SQLite — cleared on session end.
 */

import { generateUUID } from '@/lib/db/database';
import type { AIMessage, AICopilotSession, AIContextSnapshot } from './AITypes';

export class AIConversationMemory {
  private session: AICopilotSession;

  constructor(context: AIContextSnapshot, isOffline = false) {
    this.session = {
      id: generateUUID(),
      messages: [],
      context,
      startedAt: Date.now(),
      isOffline,
    };
  }

  // ── Session access ───────────────────────────────────────────────────────

  getSession(): AICopilotSession {
    return this.session;
  }

  getMessages(): AIMessage[] {
    return this.session.messages;
  }

  getContext(): AIContextSnapshot {
    return this.session.context;
  }

  isOffline(): boolean {
    return this.session.isOffline;
  }

  setOffline(offline: boolean): void {
    this.session.isOffline = offline;
  }

  updateContext(patch: Partial<AIContextSnapshot>): void {
    this.session.context = { ...this.session.context, ...patch };
  }

  // ── Message management ───────────────────────────────────────────────────

  addMessage(message: Omit<AIMessage, 'id' | 'timestamp'>): AIMessage {
    const full: AIMessage = {
      ...message,
      id: generateUUID(),
      timestamp: Date.now(),
    };
    this.session.messages.push(full);
    return full;
  }

  updateMessage(id: string, patch: Partial<AIMessage>): void {
    const idx = this.session.messages.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.session.messages[idx] = { ...this.session.messages[idx], ...patch };
    }
  }

  getLastN(n: number): AIMessage[] {
    return this.session.messages.slice(-n);
  }

  /** Build a compact text summary of recent messages for prompt context. */
  buildContextWindow(maxMessages = 10): string {
    const recent = this.getLastN(maxMessages);
    return recent
      .map((m) => `${m.role === 'user' ? 'Officer' : 'Copilot'}: ${m.content}`)
      .join('\n');
  }

  clear(): void {
    this.session.messages = [];
  }
}
