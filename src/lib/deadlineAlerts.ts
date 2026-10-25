/**
 * deadlineAlerts.ts — pure plan for न्यायालय / प्रार्थना पत्र phone notifications.
 *
 * 9 AM on: 2 days, 1 day before and the deadline day (High Court: 5, 3, 1 days before
 * and the day), then once a day after the deadline until the item is Finished.
 * Text = the same card text as the सूचनाएँ screen at that moment (noticeCards.ts),
 * so the phone notification and the in-app card always say the same thing.
 */
import { buildNoticeCards, type CourtDocRow, type NoticeCard, type PetitionRow } from './noticeCards';
import { CD_ALERT_HOUR, CD_DAYS_AHEAD, parseLocalDate } from './caseDiaryGap';

export const DEADLINE_MAX_TOTAL = 120;

export interface DeadlineAlert { at: Date; card: NoticeCard }

function offsetsFor(kind: 'court' | 'petition', docType: string): number[] {
  return kind === 'court' && docType === 'High_Court_Documents' ? [5, 3, 1, 0] : [2, 1, 0];
}

function at9(d: Date, addDays: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, CD_ALERT_HOUR);
}

function planOne(kind: 'court' | 'petition', row: CourtDocRow | PetitionRow, docType: string, now: Date): DeadlineAlert[] {
  const deadline = parseLocalDate(row.deadline_date);
  if (!deadline) return [];
  const times: Date[] = offsetsFor(kind, docType).map((o) => at9(deadline, -o)).filter((t) => t.getTime() > now.getTime());
  // Overdue: every day after the deadline, the next CD_DAYS_AHEAD days (refreshed on app open).
  let first = at9(deadline, 1);
  if (first.getTime() <= now.getTime()) {
    first = at9(now, 0);
    if (first.getTime() <= now.getTime()) first = at9(now, 1);
  }
  for (let i = 0; i < CD_DAYS_AHEAD; i++) times.push(at9(first, i));
  const input = kind === 'court' ? { courtDocs: [row as CourtDocRow] } : { petitions: [row as PetitionRow] };
  return times.flatMap((at) => {
    const card = buildNoticeCards(input, at)[0];
    return card ? [{ at, card }] : [];
  });
}

export function planDeadlineAlerts(
  input: { courtDocs?: CourtDocRow[]; petitions?: PetitionRow[] }, now: Date = new Date(),
): DeadlineAlert[] {
  const out: DeadlineAlert[] = [
    ...(input.courtDocs ?? []).flatMap((d) => planOne('court', d, d.doc_type, now)),
    ...(input.petitions ?? []).flatMap((p) => planOne('petition', p, p.petition_type, now)),
  ];
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, DEADLINE_MAX_TOTAL);
}
