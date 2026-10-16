/**
 * EvidenceTool.ts — Compiles evidence summary from Karyvahi content.
 */
import { getKaryvahiByFIR } from '@/lib/db/firKaryvahiRepo';
import { getCaseDiariesByFIR } from '@/lib/db/caseDiaryRepo';
import { getFIRById } from '@/lib/db/firRepo';
import type { AITool } from '../AITypes';

export interface EvidenceInput {
  firId: string;
}

export interface EvidenceSummary {
  firNumber: string;
  karyvahiCount: number;
  completedCount: number;
  pendingCount: number;
  caseDiaryCount: number;
  investigationActions: Array<{ name: string; completed: boolean; notes: string }>;
}

export const EvidenceTool: AITool<EvidenceInput, EvidenceSummary> = {
  name: 'EvidenceTool',
  description: 'Compiles evidence and investigation action summary for a FIR.',
  async execute({ firId }) {
    const fir = await getFIRById(firId);
    const karyvahi = await getKaryvahiByFIR(firId, 'AI-Evidence');
    const diaries = await getCaseDiariesByFIR(firId);

    const investigationActions = karyvahi.map((k) => ({
      name: k.name,
      completed: k.is_completed === 1,
      notes: k.precautions ?? '',
    }));

    return {
      firNumber: fir?.fir_number ?? firId,
      karyvahiCount: karyvahi.length,
      completedCount: karyvahi.filter((k) => k.is_completed === 1).length,
      pendingCount: karyvahi.filter((k) => k.is_completed !== 1).length,
      caseDiaryCount: diaries.length,
      investigationActions,
    };
  },
};
