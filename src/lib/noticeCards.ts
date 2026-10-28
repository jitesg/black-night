/**
 * noticeCards.ts — pure rules for the "सूचनाएँ" screen (home bell).
 *
 * The list is built live from the data every time it opens, so it always shows
 * what needs attention now: केस डायरी लंबित, न्यायालय / प्रार्थना पत्र deadlines
 * (overdue or due in 3 days) and reminders that are due today or missed.
 *
 * No React Native imports — tests: node --experimental-strip-types --test scripts/test_notice_cards.ts
 */
import { CD_ALERT_AFTER_DAYS, CD_MAX_GAP_DAYS, daysBetween, fmtDate, gapBase, parseLocalDate, type CdFirRow } from './caseDiaryGap';
import { nkDate, nkPendingDays, nkPlace, type NkPendingRow } from './nkChalani';

export type NoticeKind = 'cd' | 'court' | 'petition' | 'reminder' | 'nk';
export type NoticeLevel = 'over' | 'warn' | 'info';

export interface NoticeCard {
  id: string;
  kind: NoticeKind;
  level: NoticeLevel;
  title: string;
  body: string;
  /** Short time label: "आज", "कल", "3 दिन बाकी", "2 दिन overdue", "9 दिन" … */
  when: string;
  route: string;
  /** Lower = more urgent (used for sorting inside a level). */
  rank: number;
}

export interface CourtDocRow { id: string; registration_number: string; doc_type: string; sub_type?: string | null; writ_type?: string | null; deadline_date: string }
export interface PetitionRow { id: string; registration_number: string; petition_type: string; deadline_date: string }
export interface ReminderRow { id: string; title: string; due_at: number; fir_label?: string | null }

export const DUE_SOON_DAYS = 3;
/** High Court work is shown (and notified) from 5 days before the deadline. */
export const HC_DUE_SOON_DAYS = 5;

const COURT_LABEL: Record<string, string> = {
  NBW: 'NBW',
  Summons: 'सम्मन',
  Bail_Lower_Court: 'जमानत (निचली अदालत)',
  High_Court_Documents: 'हाईकोर्ट दस्तावेज़',
  Anya: 'न्यायालय दस्तावेज़',
};

const COURT_TASK: Record<string, string> = {
  NBW: 'NBW तामील',
  Summons: 'सम्मन तामील',
  Bail_Lower_Court: 'जमानत आख्या',
  High_Court_Documents: 'हाईकोर्ट आख्या',
  Anya: 'आख्या',
};

function courtLabel(d: CourtDocRow): string {
  const base = COURT_LABEL[d.doc_type] ?? d.doc_type;
  if (d.doc_type !== 'High_Court_Documents') return base;
  const sub = [d.sub_type === 'Bail' ? 'जमानत' : d.sub_type === 'Writ' ? 'रिट' : '', d.writ_type && d.writ_type !== 'Anya' ? d.writ_type : '']
    .filter(Boolean).join(' ');
  return sub ? `${base} (${sub})` : base;
}

function petitionTask(type: string): string {
  if (type === 'RTI') return 'RTI सूचना';
  if (type === 'बीट सूचना' || type === 'NCR') return 'कार्यवाही';
  return 'जाँच आख्या';
}

/** "आज", "कल", "N दिन बाकी", "N दिन overdue" for a deadline `days` away (negative = past). */
export function dueLabel(days: number): string {
  if (days === 0) return 'आज';
  if (days === 1) return 'कल';
  if (days > 1) return `${days} दिन बाकी`;
  return `${-days} दिन overdue`;
}

function deadlineCard(
  kind: 'court' | 'petition', id: string, label: string, task: string, reg: string,
  deadline: string, route: string, now: Date, horizon: number = DUE_SOON_DAYS,
): NoticeCard | null {
  const d = parseLocalDate(deadline);
  if (!d) return null;
  const days = daysBetween(now, d);
  if (days > horizon) return null;
  const over = days < 0;
  const body = over
    ? `${task} की अंतिम तिथि ${fmtDate(d)} ${-days} दिन पहले निकल चुकी है।`
    : days === 0
      ? `${task} की अंतिम तिथि आज (${fmtDate(d)}) है।`
      : `${task} की अंतिम तिथि ${fmtDate(d)} है — ${days === 1 ? 'कल' : `${days} दिन बाकी`}।`;
  return {
    id: `${kind}-${id}`, kind, level: over || days === 0 ? 'over' : 'warn',
    title: `${label} — सं0 ${reg}`, body, when: dueLabel(days), route, rank: days,
  };
}

export function buildNoticeCards(input: {
  firs?: CdFirRow[]; courtDocs?: CourtDocRow[]; petitions?: PetitionRow[]; reminders?: ReminderRow[];
  nkPending?: NkPendingRow[];
}, now: Date = new Date()): NoticeCard[] {
  const out: NoticeCard[] = [];

  // निरोधात्मक: चलानी not yet sent to the magistrate (until the checklist tick is set).
  for (const r of input.nkPending ?? []) {
    const d = nkDate(r);
    const days = nkPendingDays(r, now);
    out.push({
      id: `nk-${r.id}`, kind: 'nk', level: 'warn',
      title: `चलानी प्रेषण लंबित — ${nkPlace(r)}`,
      body: `निरोधात्मक कार्यवाही${r.proceeding_type ? ` (${r.proceeding_type})` : ''}${d ? ` दिनांक ${fmtDate(d)}` : ''} की चलानी अभी मजिस्ट्रेट को प्रेषित नहीं की गई है।`,
      when: days === 0 ? 'आज' : `${days} दिन`, route: '/(app)/nirodhatmak', rank: -days,
    });
  }

  for (const f of input.firs ?? []) {
    const base = gapBase(f);
    if (!base) continue;
    const days = daysBetween(base.date, now);
    if (days < CD_ALERT_AFTER_DAYS) continue;
    const over = days > CD_MAX_GAP_DAYS;
    out.push({
      id: `cd-${f.id}`, kind: 'cd', level: over ? 'over' : 'warn',
      title: `केस डायरी लंबित — मु0अ0सं0 ${f.fir_number}`,
      body: (base.hasDiary
        ? `आखिरी केस डायरी ${fmtDate(base.date)} को कटी है, अगला पर्चा अभी तक नहीं काटा गया है।`
        : `${fmtDate(base.date)} से अभी तक कोई केस डायरी नहीं काटी गई है।`)
        + (over ? ` ${CD_MAX_GAP_DAYS} दिन की सीमा पार।` : ''),
      when: `${days} दिन`, route: `/(app)/mukadma/${f.id}/case-diary`, rank: -days,
    });
  }

  for (const d of input.courtDocs ?? []) {
    const c = deadlineCard('court', d.id, courtLabel(d), COURT_TASK[d.doc_type] ?? 'आख्या', d.registration_number,
      d.deadline_date, `/(app)/nyayalay/${d.id}`, now, d.doc_type === 'High_Court_Documents' ? HC_DUE_SOON_DAYS : DUE_SOON_DAYS);
    if (c) out.push(c);
  }

  for (const p of input.petitions ?? []) {
    const c = deadlineCard('petition', p.id, p.petition_type, petitionTask(p.petition_type), p.registration_number,
      p.deadline_date, `/(app)/prarthna-patra/${p.id}`, now);
    if (c) out.push(c);
  }

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  for (const r of input.reminders ?? []) {
    const ms = r.due_at < 10000000000 ? r.due_at * 1000 : r.due_at;
    if (ms >= endOfToday) continue;
    const missed = ms < now.getTime();
    const at = new Date(ms);
    const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    const daysAgo = daysBetween(at, now);
    out.push({
      id: `rem-${r.id}`, kind: 'reminder', level: missed ? 'over' : 'info',
      title: r.title || 'रिमाइंडर',
      body: [missed ? (daysAgo > 0 ? `${fmtDate(at)} ${time} का रिमाइंडर छूट गया` : `आज ${time} का रिमाइंडर छूट गया`) : `आज ${time} बजे`, r.fir_label]
        .filter(Boolean).join(' · '),
      when: missed ? (daysAgo > 0 ? `${daysAgo} दिन पहले` : 'छूटा') : time,
      route: '/(app)/reminders', rank: ms / 86400000 - 1e6,
    });
  }

  const order: Record<NoticeLevel, number> = { over: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level] || a.rank - b.rank);
}

/** Count shown on the bell: everything that needs action (over + warn). */
export function noticeBadgeCount(cards: NoticeCard[]): number {
  return cards.filter((c) => c.level !== 'info').length;
}
