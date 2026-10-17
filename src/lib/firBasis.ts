/**
 * firBasis.ts — FIR Basis evaluation engine.
 * Pure logic, no DB access, never throws.
 *
 * Rules:
 * FB1: diaryDate earlier than FIR occurrence/information date -> warn 'केस डायरी की तारीख घटना/सूचना से पहले की है'
 * FB2: text cites a section number (BNS|BNSS|धारा + digits) not in fir.section -> info 'धारा FIR में नहीं है; जोड़ने का आधार लिखें'
 * FB3: hasDiaries and fir.nakal_chick empty -> warn 'नकल चिक दर्ज नहीं: विवेचना का आधार अधूरा'
 * FB4: hasDiaries and fir.nakal_rapat empty -> warn 'नकल रपट दर्ज नहीं: समय का मिलान नहीं हो सका'
 * FB5: info date-time > 24h after occurrence date-time and no delay reason (देरी/विलंब/delay) in fir.nakal_chick -> info 'देरी का कारण दर्ज करें'
 * FB6: karyvahiKey VADI_BAYAN and complainant name tokens (>=3 chars) not in text -> info 'बयान में वादी का नाम चिक से मेल नहीं खा रहा'
 */

import type { FIR } from '@/lib/db/firRepo';
import { matchDefaultKaryvahi } from './karyvahiNames';

export interface FirBasis {
  sections: string;
  occDate: string;
  occTime: string;
  infoDate: string;
  infoTime: string;
  place: string;
  complainant: string;
  hasChick: boolean;
  hasRapat: boolean;
}

export interface FirBasisHint {
  id: 'FB1' | 'FB2' | 'FB3' | 'FB4' | 'FB5' | 'FB6' | 'FB7';
  level: 'warn' | 'info';
  titleHi: string;
  titleEn: string;
  detailHi: string;
  detailEn: string;
}

export interface EvaluateFirBasisParams {
  fir?: Partial<FIR> | null;
  diaryDate?: string | null;
  text?: string | null;
  karyvahiKey?: string | null;
  hasDiaries?: boolean;
}

/**
 * Extracts normalized basis fields from FIR.
 * Never throws, safe with partial/null/undefined.
 */
export function getFirBasis(fir?: Partial<FIR> | null): FirBasis {
  return {
    sections: fir?.section?.trim() ?? '',
    occDate: fir?.date_of_occurrence?.trim() ?? '',
    occTime: fir?.time_of_occurrence?.trim() ?? '',
    infoDate: fir?.date_of_information?.trim() ?? '',
    infoTime: fir?.time_of_information?.trim() ?? '',
    place: fir?.ghatnasthal?.trim() ?? '',
    complainant: fir?.complainant_name?.trim() ?? '',
    hasChick: Boolean(fir?.nakal_chick && fir.nakal_chick.trim().length > 0),
    hasRapat: Boolean(fir?.nakal_rapat && fir.nakal_rapat.trim().length > 0),
  };
}

/** Helper to parse a date string (YYYY-MM-DD or DD/MM/YYYY) to a Date or null */
function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Standard ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/** Helper to parse date + optional time to milliseconds */
function parseDateTimeMs(dateStr?: string | null, timeStr?: string | null): number | null {
  const d = parseDateSafe(dateStr);
  if (!d) return null;

  if (timeStr && typeof timeStr === 'string') {
    const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
    if (tm) {
      d.setHours(parseInt(tm[1], 10), parseInt(tm[2], 10), 0, 0);
      return d.getTime();
    }
  }
  return d.getTime();
}

/**
 * Pure evaluation of FIR basis rules.
 * Never throws, invalid/missing fields skip silently.
 */
export function evaluateFirBasis({
  fir,
  diaryDate,
  text,
  karyvahiKey,
  hasDiaries,
}: EvaluateFirBasisParams): FirBasisHint[] {
  const hints: FirBasisHint[] = [];
  if (!fir) return hints;

  const basis = getFirBasis(fir);

  // ── FB1: diaryDate earlier than FIR occurrence / information date ──────────
  if (diaryDate) {
    const dDiary = parseDateSafe(diaryDate);
    const dOcc = parseDateSafe(basis.occDate);
    const dInfo = parseDateSafe(basis.infoDate);

    let isEarlier = false;
    if (dDiary && dOcc) {
      // Compare calendar dates (day boundary)
      const diaryDay = new Date(dDiary.getFullYear(), dDiary.getMonth(), dDiary.getDate()).getTime();
      const occDay = new Date(dOcc.getFullYear(), dOcc.getMonth(), dOcc.getDate()).getTime();
      if (diaryDay < occDay) isEarlier = true;
    }
    if (dDiary && dInfo) {
      const diaryDay = new Date(dDiary.getFullYear(), dDiary.getMonth(), dDiary.getDate()).getTime();
      const infoDay = new Date(dInfo.getFullYear(), dInfo.getMonth(), dInfo.getDate()).getTime();
      if (diaryDay < infoDay) isEarlier = true;
    }

    if (isEarlier) {
      hints.push({
        id: 'FB1',
        level: 'warn',
        titleHi: 'केस डायरी की तारीख घटना/सूचना से पहले की है',
        titleEn: 'Case diary date is earlier than FIR occurrence/information date',
        detailHi: `केस डायरी की तारीख (${diaryDate}) घटना (${basis.occDate || '—'}) या सूचना (${basis.infoDate || '—'}) से पहले की दर्ज है।`,
        detailEn: `Case diary date (${diaryDate}) is earlier than occurrence date (${basis.occDate || '—'}) or reporting date (${basis.infoDate || '—'}).`,
      });
    }
  }

  // ── FB2: text cites section number (BNS|BNSS|धारा|section + digits) not in fir.section ───
  if (text && typeof text === 'string' && text.trim().length > 0) {
    const regex = /(?:BNS|BNSS|धारा|section)\s*[:.\/-]?\s*(\d+[A-Za-z]?)/gi;
    const firSectionsStr = basis.sections.toLowerCase();
    const missingSections: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const secNum = match[1];
      if (secNum) {
        // Check if this number exists in fir.section
        const secRegex = new RegExp(`(?:^|[^0-9a-zA-Z])${secNum}(?:[^0-9a-zA-Z]|$)`, 'i');
        if (!secRegex.test(firSectionsStr) && !missingSections.includes(secNum)) {
          missingSections.push(secNum);
        }
      }
    }

    if (missingSections.length > 0) {
      hints.push({
        id: 'FB2',
        level: 'info',
        titleHi: 'धारा FIR में नहीं है; जोड़ने का आधार लिखें',
        titleEn: 'Section is not in FIR; record basis for adding',
        detailHi: `विवरण में उल्लिखित धारा (${missingSections.join(', ')}) मूल FIR (${basis.sections || 'लागू नहीं'}) में दर्ज नहीं है। यदि धारा बढ़ाई गई है तो आधार लिखें।`,
        detailEn: `Section (${missingSections.join(', ')}) cited in text is not in original FIR (${basis.sections || 'N/A'}). Record the legal basis for addition.`,
      });
    }
  }

  // ── FB3: hasDiaries and fir.nakal_chick empty ──────────────────────────────
  if (hasDiaries && !basis.hasChick) {
    hints.push({
      id: 'FB3',
      level: 'warn',
      titleHi: 'नकल चिक दर्ज नहीं: विवेचना का आधार अधूरा',
      titleEn: 'Nakal Chik not recorded: investigation basis incomplete',
      detailHi: 'केस डायरी शुरू हो चुकी है लेकिन नकल चिक दर्ज नहीं है। चिक पूरी विवेचना का प्राथमिक आधार है।',
      detailEn: 'Case diary is maintained but Nakal Chik is not recorded. FIR copy is the baseline of the investigation.',
    });
  }

  // ── FB4: hasDiaries and fir.nakal_rapat empty ──────────────────────────────
  if (hasDiaries && !basis.hasRapat) {
    hints.push({
      id: 'FB4',
      level: 'warn',
      titleHi: 'नकल रपट दर्ज नहीं: समय का मिलान नहीं हो सका',
      titleEn: 'Nakal Rapat not recorded: timeline cannot be verified',
      detailHi: 'केस डायरी शुरू हो चुकी है लेकिन नकल रपट (जीडी) दर्ज नहीं है। समय व रवानगी का मिलान नहीं हो सका।',
      detailEn: 'Case diary is maintained but Nakal Rapat (GD entry) is not recorded: timeline cannot be verified.',
    });
  }

  // ── FB5: info date-time > 24h after occurrence and no delay reason in nakal_chick ──
  if (basis.occDate && basis.infoDate) {
    const occMs = parseDateTimeMs(basis.occDate, basis.occTime);
    const infoMs = parseDateTimeMs(basis.infoDate, basis.infoTime);

    if (occMs !== null && infoMs !== null) {
      const diffHours = (infoMs - occMs) / (1000 * 60 * 60);
      if (diffHours > 24) {
        const chickContent = fir?.nakal_chick ?? '';
        const hasDelayReason = /देरी|विलंब|delay/i.test(chickContent);
        if (!hasDelayReason) {
          hints.push({
            id: 'FB5',
            level: 'info',
            titleHi: 'देरी का कारण दर्ज करें',
            titleEn: 'Record reason for delay',
            detailHi: `घटना और सूचना में ${Math.round(diffHours)} घंटे का अंतर है। नकल चिक या केस डायरी में देरी का कारण दर्ज करें।`,
            detailEn: `More than 24 hours (${Math.round(diffHours)}h) between incident and reporting. Record the reason for delay.`,
          });
        }
      }
    }
  }

  // ── FB6: karyvahiKey VADI_BAYAN and complainant name tokens (>=3 chars) not in text ─
  if (karyvahiKey && text && typeof text === 'string' && text.trim().length > 0) {
    const isVadiBayan =
      karyvahiKey === 'VADI_BAYAN' ||
      matchDefaultKaryvahi(karyvahiKey) === 'bayanVadi' ||
      /vadi.*bayan|bayan.*vadi|वादी.*बयान/i.test(karyvahiKey);

    if (isVadiBayan && basis.complainant) {
      // Extract tokens of length >= 3
      const tokens = basis.complainant
        .split(/[\s,./\\_-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);

      if (tokens.length > 0) {
        const textLower = text.toLowerCase();
        const found = tokens.some((token) => textLower.includes(token.toLowerCase()));
        if (!found) {
          hints.push({
            id: 'FB6',
            level: 'info',
            titleHi: 'बयान में वादी का नाम चिक से मेल नहीं खा रहा',
            titleEn: 'Complainant name in statement does not match FIR/chik',
            detailHi: `बयान के विवरण में वादी (${basis.complainant}) का नाम नहीं पाया गया। सुनिश्चित करें कि बयान सही वादी/पीड़ित का है।`,
            detailEn: `Complainant name (${basis.complainant}) was not found in statement text. Verify statement is for the correct complainant.`,
          });
        }
      }
    }
  }

  // ── FB7: Fard mention in Case Diary vivran ─────────────────────────────────
  if (text && typeof text === 'string' && text.trim().length > 0) {
    if (/फर्द|बरामदगी|जब्ती|तलाशी|नक्शा\s*नजरी|पंचनामा/i.test(text)) {
      hints.push({
        id: 'FB7',
        level: 'info',
        titleHi: 'फर्द विवरण की जाँच उपलब्ध',
        titleEn: 'Fard verification available',
        detailHi: 'विवरण में फर्द/बरामदगी/जब्ती/तलाशी का उल्लेख है। कानूनी तत्वों की जाँच हेतु नीचे \'फर्द जाँचें\' का उपयोग करें।',
        detailEn: 'Fard / recovery memo mentioned in narrative. Use \'Check Fard\' below to verify mandatory legal essentials.',
      });
    }
  }

  return hints;
}
