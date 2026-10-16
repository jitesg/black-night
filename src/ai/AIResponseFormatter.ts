/**
 * AIResponseFormatter.ts
 * Converts raw tool results + AI content into a clean AIResponse.
 */

import type { AIResponse, AIToolCall, AIDraft } from './AITypes';
import { generateUUID } from '@/lib/db/database';

export class AIResponseFormatter {
  static format(params: {
    content: string;
    toolCalls: AIToolCall[];
    draft?: AIDraft;
    suggestedActions?: string[];
    isOffline?: boolean;
    error?: string;
  }): AIResponse {
    return {
      messageId: generateUUID(),
      content: params.content,
      toolCalls: params.toolCalls,
      draft: params.draft,
      suggestedActions: params.suggestedActions ?? [],
      isOffline: params.isOffline ?? false,
      error: params.error,
    };
  }

  static errorResponse(error: string, isOffline = false): AIResponse {
    return AIResponseFormatter.format({
      content: isOffline
        ? 'I am currently in offline mode. I can assist using local data — knowledge base, templates, and investigation guides are available.'
        : `I encountered an issue: ${error}. Please try again or use one of the quick actions below.`,
      toolCalls: [],
      isOffline,
      error,
      suggestedActions: ['Check Pending Tasks', 'View Analytics', 'Search Knowledge'],
    });
  }

  /** Strip markdown to plain text for accessibility / copy. */
  static toPlainText(content: string): string {
    return content
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/#+\s/g, '')
      .trim();
  }
}
