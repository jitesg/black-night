/**
 * TimelineTool.ts — Builds a chronological investigation timeline for a FIR.
 * Aggregates: FIR → Karyvahi → Case Diary → Court Docs → GD mentions.
 */
import { getFIRById } from '@/lib/db/firRepo';
import { getKaryvahiByFIR } from '@/lib/db/firKaryvahiRepo';
import { getCaseDiariesByFIR } from '@/lib/db/caseDiaryRepo';
import { getAllNyayalayDocuments } from '@/lib/db/nyayalayRepo';
import type { AITool } from '../AITypes';

export interface TimelineInput {
  firId: string;
}

export interface TimelineEvent {
  date: string;
  time?: string;
  type: string;
  title: string;
  description: string;
}

export interface TimelineOutput {
  firNumber: string;
  events: TimelineEvent[];
}

export const TimelineTool: AITool<TimelineInput, TimelineOutput> = {
  name: 'TimelineTool',
  description: 'Builds a chronological investigation timeline from all events for a FIR.',
  async execute({ firId }) {
    const fir = await getFIRById(firId);
    const firNumber = fir?.fir_number ?? firId;
    const events: TimelineEvent[] = [];

    // FIR registration
    if (fir) {
      events.push({
        date: fir.date_of_occurrence ?? String(fir.created_at),
        time: fir.time_of_occurrence,
        type: 'FIR',
        title: `FIR Registered — ${fir.fir_number}`,
        description: `Section: ${fir.section} | Crime: ${fir.crime_type} | Complainant: ${fir.complainant_name}`,
      });
    }

    // Karyvahi actions
    const karyvahi = await getKaryvahiByFIR(firId, 'AI-Timeline');
    karyvahi.forEach((k) => {
      events.push({
        date: new Date(k.created_at * 1000).toISOString().split('T')[0],
        type: 'Karyvahi',
        title: k.name,
        description: k.precautions ?? '',
      });
    });

    // Case diaries
    const diaries = await getCaseDiariesByFIR(firId);
    diaries.forEach((d) => {
      events.push({
        date: d.preparation_date,
        time: d.start_time,
        type: 'Case Diary',
        title: `Case Diary — ${d.preparation_date}`,
        description: d.start_time ? `${d.start_time} – ${d.end_time ?? ''}` : '',
      });
    });

    // Court documents — filter by fir_number string (no FK on nyayalay_documents)
    if (fir?.fir_number) {
      const allCourtDocs = await getAllNyayalayDocuments();
      const courtDocs = allCourtDocs.filter((d) => d.fir_number === fir!.fir_number);
      courtDocs.forEach((doc) => {
        events.push({
          date: doc.deadline_date ?? new Date(doc.created_at * 1000).toISOString().split('T')[0],
          type: 'Court',
          title: `Court: ${doc.doc_type} — ${doc.registration_number}`,
          description: doc.court_name ?? '',
        });
      });
    }

    // Sort by date ascending
    events.sort((a, b) => a.date.localeCompare(b.date));
    return { firNumber, events };
  },
};
