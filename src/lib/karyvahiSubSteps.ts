/**
 * "मृतक का पंचनामा व पोस्टमार्टम" — inner checklist of a karyvahi (owner, चरण 2).
 * One karyvahi needs 6 parts (अवलोकन पंचायतनामा / PM + 4 बयान); each is ticked by itself (manual) or, later,
 * by saving the format `sys-fmt-cd-panchayatnama-pm-avlokan` (auto, with the पर्चा number).
 * Pure — no DB / RN imports. Tests: scripts/test_karyvahi_sub_steps.ts
 */

export const PM_FORMAT_ID = 'sys-fmt-cd-panchayatnama-pm-avlokan';

export interface SubStepDef {
  id: string;
  label: string;
  /** checkbox key of the format that prints this part */
  formatKey: string;
}

export const PM_SUB_STEPS: readonly SubStepDef[] = [
  { id: 'pan', label: 'अवलोकन पंचायतनामा', formatKey: 'doPan' },
  { id: 'pm', label: 'अवलोकन पोस्टमार्टम रिपोर्ट', formatKey: 'doPm' },
  { id: 'si', label: 'बयान उ0नि0 (पंचायतनामा भरने वाले)', formatKey: 'doBayanSI' },
  { id: 'co', label: 'बयान आरक्षी (पोस्टमार्टम कराने वाले)', formatKey: 'doBayanCo' },
  { id: 'panch', label: 'बयान पंच गवाहान', formatKey: 'doBayanPanch' },
  { id: 'doc', label: 'बयान चिकित्सक (PM करने वाले)', formatKey: 'doBayanDoc' },
];

/** Playbook karyvahis that mean "पंचनामा + पोस्टमार्टम" (road accident, आत्महत्या दुष्प्रेरण, सदोष मानव वध, हत्या, दहेज मृत्यु). */
export const PM_STEP_CODES: readonly string[] = ['RTA_PM_DEATH', 'ABS_INQUEST_PM', 'CHM_INQUEST_PM', 'MUR_INQUEST', 'DWD_INQUEST_SDM'];

/** A karyvahi with this checklist: one of the playbook codes, or a name with पंचनामा/पंचायतनामा + पोस्टमार्टम/शव परीक्षण. */
export function isPmKaryvahi(k: { step_code?: string | null; name?: string | null }): boolean {
  if (k.step_code && PM_STEP_CODES.includes(k.step_code)) return true;
  const n = String(k.name ?? '');
  return /(पंचनामा|पंचायतनामा)/.test(n) && /(पोस्टमार्टम|पोस्टमॉर्टम|शव परीक्षण)/.test(n) && !/जब्ती|बरामदगी/.test(n);
}

export interface SubStepState {
  done: boolean;
  /** 'manual' = officer's tick on the card; 'auto' = saved from the format */
  by?: 'manual' | 'auto';
  /** पर्चा number (01, 02…) of the diary that wrote it */
  parcha?: string;
  /** case diary entry that wrote it (un-tick when the entry is deleted) */
  entryId?: string;
  at?: number;
}

export type SubStepsMap = Record<string, SubStepState>;

export function parseSubSteps(raw: string | null | undefined): SubStepsMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: SubStepsMap = {};
    for (const s of PM_SUB_STEPS) {
      const e = v[s.id];
      if (e && typeof e === 'object' && e.done) out[s.id] = { ...e, done: true };
    }
    return out;
  } catch {
    return {};
  }
}

export interface SubStepProgress {
  done: number;
  total: number;
  complete: boolean;
  remaining: SubStepDef[];
}

export function subStepProgress(map: SubStepsMap): SubStepProgress {
  const remaining = PM_SUB_STEPS.filter((s) => !map[s.id]?.done);
  const total = PM_SUB_STEPS.length;
  return { done: total - remaining.length, total, complete: remaining.length === 0, remaining };
}

/** Officer taps a row: not done → manual tick; done → untick (also an auto one). */
export function toggleSubStep(map: SubStepsMap, id: string, now: number = Date.now()): SubStepsMap {
  if (!PM_SUB_STEPS.some((s) => s.id === id)) return map;
  const next = { ...map };
  if (next[id]?.done) delete next[id];
  else next[id] = { done: true, by: 'manual', at: now };
  return next;
}

/** Short text for a done row: "पर्चा 03" (auto) / "स्वयं ✓" (manual). */
export function subStepNote(s: SubStepState | undefined): string {
  if (!s?.done) return '';
  if (s.parcha) return `पर्चा ${s.parcha}`;
  return s.by === 'manual' ? 'स्वयं ✓' : '';
}

/** "बाकी: बयान आरक्षी, बयान पंच गवाहान" — short labels (text before " ("). */
export function remainingText(map: SubStepsMap): string {
  const r = subStepProgress(map).remaining;
  if (r.length === 0) return '';
  return 'बाकी: ' + r.map((s) => s.label.replace(/\s*\(.*$/, '')).join(', ');
}
