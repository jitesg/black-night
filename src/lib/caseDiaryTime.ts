/**
 * केस डायरी की तारीख / समय के नियम (owner):
 *  - पहली केस डायरी की तारीख = FIR दर्ज होने (सूचना) की तारीख, अपने-आप भरी जाती है।
 *  - उसी तारीख की डायरी का समय FIR दर्ज होने के समय से पहले नहीं हो सकता।
 * Pure — tests: scripts/test_case_diary_time.ts
 */
export interface FirTimes { date_of_information?: string | null; time_of_information?: string | null }

/** "10:15" / "9:05" / "10.15" / "10:15 AM" → minutes since midnight, or null. */
export function timeToMinutes(v: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm|एएम|पीएम)?\s*$/i.exec(v ?? '');
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] ?? '').toLowerCase();
  if (ap === 'pm' || ap === 'पीएम') { if (h < 12) h += 12; } else if ((ap === 'am' || ap === 'एएम') && h === 12) h = 0;
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** "2025-07-01" (also "01.07.2025" / "01/07/2025") → "2025-07-01"; else ''. */
export function isoDate(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/** Date a NEW diary opens with: the first one → FIR सूचना की तारीख (if known), else today. */
export function newDiaryDefaultDate(existingDiaries: number, fir: FirTimes | null, today: string): string {
  if (existingDiaries > 0) return today;
  return isoDate(fir?.date_of_information) || today;
}

/** Error text, or null when the times are fine. */
export function checkDiaryTime(prepDate: string, startTime: string, endTime: string, fir: FirTimes | null): string | null {
  const infoDate = isoDate(fir?.date_of_information);
  const infoMin = timeToMinutes(fir?.time_of_information);
  if (!infoDate || infoMin === null || isoDate(prepDate) !== infoDate) return null;
  const at = fir?.time_of_information?.trim();
  const start = timeToMinutes(startTime);
  if (start !== null && start < infoMin) {
    return `केस डायरी आरम्भ का समय (${startTime.trim()}) मुकदमा दर्ज होने के समय (${at}) से पहले नहीं हो सकता।`;
  }
  const end = timeToMinutes(endTime);
  if (start === null && end !== null && end < infoMin) {
    return `केस डायरी समाप्ति का समय (${endTime.trim()}) मुकदमा दर्ज होने के समय (${at}) से पहले नहीं हो सकता।`;
  }
  return null;
}
