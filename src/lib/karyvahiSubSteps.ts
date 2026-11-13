/**
 * Inner checklists of a karyvahi card (owner).
 *  - "मृतक का पंचनामा व पोस्टमार्टम" (PM_DEF): 6 parts, all required; ticked by the format
 *    `sys-fmt-cd-panchayatnama-pm-avlokan` (its do* ticks) or by hand.
 *  - "घटनास्थल निरीक्षण" (SCENE_DEF): 5 parts — निरीक्षण / सुरक्षा / फोटो-वीडियो optional (narrative or a tick by hand),
 *    ई-साक्ष्य से फोटो-वीडियो + नक्शा नजरी required; the format `sys-fmt-cd-nirikshan-ghatnasthal` ticks निरीक्षण,
 *    नक्शा नजरी and (ESakshya = की गयी / तकनीकी समस्या) ई-साक्ष्य.
 * A karyvahi with a checklist is complete when all its REQUIRED parts are done (with the पर्चा number when saved from a format).
 * Pure — no DB / RN imports. Tests: scripts/test_karyvahi_sub_steps.ts
 */

export const PM_FORMAT_ID = 'sys-fmt-cd-panchayatnama-pm-avlokan';
export const SCENE_FORMAT_ID = 'sys-fmt-cd-nirikshan-ghatnasthal';

export interface SubStepDef {
  id: string;
  label: string;
  /** PM: checkbox key of the format that prints this part */
  formatKey?: string;
  /** not needed for completion (shown with "वैकल्पिक") */
  optional?: boolean;
}

export type ChecklistKind = 'pm' | 'scene';

type KLike = { step_code?: string | null; name?: string | null };

export interface ChecklistDef {
  kind: ChecklistKind;
  formatId: string;
  steps: readonly SubStepDef[];
  match: (k: KLike) => boolean;
  /** parts the format printed, from its values */
  partsFromValues: (values: Record<string, string | undefined>) => string[];
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
export function isPmKaryvahi(k: KLike): boolean {
  if (k.step_code && PM_STEP_CODES.includes(k.step_code)) return true;
  const n = String(k.name ?? '');
  return /(पंचनामा|पंचायतनामा)/.test(n) && /(पोस्टमार्टम|पोस्टमॉर्टम|शव परीक्षण)/.test(n) && !/जब्ती|बरामदगी/.test(n);
}

export const SCENE_SUB_STEPS: readonly SubStepDef[] = [
  { id: 'nir', label: 'घटनास्थल निरीक्षण', optional: true },
  { id: 'sur', label: 'घटनास्थल की सुरक्षा', optional: true },
  { id: 'photo', label: 'फोटो-वीडियोग्राफी', optional: true },
  { id: 'esakshya', label: 'ई-साक्ष्य से फोटो-वीडियोग्राफी' },
  { id: 'naksha', label: 'नक्शा नजरी' },
];

/** Playbook cards merged into the one "घटनास्थल निरीक्षण" card — not added to NEW FIRs any more (owner). */
export const SCENE_MERGED_STEP_CODES: readonly string[] = [
  'COM_SCENE_SECURE', 'COM_SCENE_PHOTO', 'COM_SITE_PLAN', 'MUR_SCENE_SECURE', 'MUR_SCENE_PHOTO', 'MUR_SITE_PLAN', 'ATM_SPOT',
];

/** "घटनास्थल निरीक्षण" (the default card of every FIR; हत्या का प्रयास ATM_SPOT has the same name). */
export function isSceneKaryvahi(k: KLike): boolean {
  if (k.step_code === 'ATM_SPOT') return true;
  const n = String(k.name ?? '');
  return /(घटनास्थल|घटना\s*स्थल)\s*(का\s*)?निरीक्षण|ghatnasthal\s*nirikshan/i.test(n);
}

export const PM_DEF: ChecklistDef = {
  kind: 'pm',
  formatId: PM_FORMAT_ID,
  steps: PM_SUB_STEPS,
  match: isPmKaryvahi,
  partsFromValues: (values) => PM_SUB_STEPS.filter((s) => String(values[s.formatKey ?? ''] ?? '').trim() !== '').map((s) => s.id),
};

export const SCENE_DEF: ChecklistDef = {
  kind: 'scene',
  formatId: SCENE_FORMAT_ID,
  steps: SCENE_SUB_STEPS,
  match: isSceneKaryvahi,
  // the format always writes the निरीक्षण and the नक्शा नजरी lines; ई-साक्ष्य when done (or its technical-problem line)
  partsFromValues: (values) => {
    const e = String(values.ESakshya ?? '').trim();
    return ['nir', ...(e === 'की गयी' || e === 'तकनीकी समस्या' ? ['esakshya'] : []), 'naksha'];
  },
};

export const CHECKLISTS: readonly ChecklistDef[] = [PM_DEF, SCENE_DEF];

/** The checklist of a karyvahi (null = an ordinary card). */
export function checklistOf(k: KLike): ChecklistDef | null {
  return CHECKLISTS.find((d) => d.match(k)) ?? null;
}

export function checklistForFormat(formatId: string | null | undefined): ChecklistDef | null {
  return CHECKLISTS.find((d) => d.formatId === formatId) ?? null;
}

export interface SubStepState {
  done: boolean;
  /** 'manual' = officer's tick on the card; 'auto' = saved from the format; 'old' = written before the checklist existed */
  by?: 'manual' | 'auto' | 'old';
  /** पर्चा number (01, 02…) of the diary that wrote it */
  parcha?: string;
  /** case diary entry that wrote it (un-tick when the entry is deleted) */
  entryId?: string;
  at?: number;
  /** short extra note (e.g. "तकनीकी समस्या") */
  note?: string;
}

export type SubStepsMap = Record<string, SubStepState>;

export function parseSubSteps(raw: string | null | undefined, def: ChecklistDef = PM_DEF): SubStepsMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: SubStepsMap = {};
    for (const s of def.steps) {
      const e = v[s.id];
      if (e && typeof e === 'object' && e.done) out[s.id] = { ...e, done: true };
    }
    return out;
  } catch {
    return {};
  }
}

export interface SubStepProgress {
  /** required parts done / required parts */
  done: number;
  total: number;
  complete: boolean;
  /** required parts still left */
  remaining: SubStepDef[];
  /** optional parts done / optional parts */
  optionalDone: number;
  optionalTotal: number;
}

export function subStepProgress(map: SubStepsMap, def: ChecklistDef = PM_DEF): SubStepProgress {
  const req = def.steps.filter((s) => !s.optional);
  const opt = def.steps.filter((s) => s.optional);
  const remaining = req.filter((s) => !map[s.id]?.done);
  return {
    done: req.length - remaining.length, total: req.length, complete: remaining.length === 0, remaining,
    optionalDone: opt.filter((s) => map[s.id]?.done).length, optionalTotal: opt.length,
  };
}

/** Officer taps a row: not done → manual tick; done → untick (also an auto one). */
export function toggleSubStep(map: SubStepsMap, id: string, now: number = Date.now(), def: ChecklistDef = PM_DEF): SubStepsMap {
  if (!def.steps.some((s) => s.id === id)) return map;
  const next = { ...map };
  if (next[id]?.done) delete next[id];
  else next[id] = { done: true, by: 'manual', at: now };
  return next;
}

/** Short text for a done row: "पर्चा 03" (auto) / "स्वयं ✓" (manual) / "पहले से" (old). */
export function subStepNote(s: SubStepState | undefined): string {
  if (!s?.done) return '';
  if (s.parcha) return s.note ? `पर्चा ${s.parcha} · ${s.note}` : `पर्चा ${s.parcha}`;
  if (s.by === 'old') return 'पहले से';
  return s.by === 'manual' ? 'स्वयं ✓' : '';
}

/** "बाकी: बयान आरक्षी, बयान पंच गवाहान" — short labels (text before " ("), required parts only. */
export function remainingText(map: SubStepsMap, def: ChecklistDef = PM_DEF): string {
  const r = subStepProgress(map, def).remaining;
  if (r.length === 0) return '';
  return 'बाकी: ' + r.map((s) => s.label.replace(/\s*\(.*$/, '')).join(', ');
}

/** Parts the PM format printed: its ticks doPan … doBayanDoc that are on ("हाँ"). */
export function partsFromFormatValues(values: Record<string, string | undefined>): string[] {
  return PM_DEF.partsFromValues(values);
}

/** Drop the ticks a case diary entry made (entry deleted / its format generated again). Manual ticks stay. */
export function removeEntryParts(map: SubStepsMap, entryId: string): SubStepsMap {
  const next: SubStepsMap = {};
  for (const [id, st] of Object.entries(map)) if (st.entryId !== entryId) next[id] = st;
  return next;
}

/** Saving the format in a diary entry: its parts become done with the पर्चा number. */
export function applyEntryParts(
  map: SubStepsMap, entryId: string, parts: string[], parcha: string, now: number = Date.now(), def: ChecklistDef = PM_DEF,
  notes: Record<string, string> = {},
): SubStepsMap {
  const next = removeEntryParts(map, entryId);
  for (const id of parts) {
    if (def.steps.some((s) => s.id === id)) {
      next[id] = { done: true, by: 'auto', parcha, entryId, at: now, ...(notes[id] ? { note: notes[id] } : {}) };
    }
  }
  return next;
}

/** Notes shown next to auto ticks (scene: ई-साक्ष्य not possible → "तकनीकी समस्या"). */
export function partNotesFromValues(def: ChecklistDef, values: Record<string, string | undefined>): Record<string, string> {
  if (def.kind === 'scene' && String(values.ESakshya ?? '').trim() === 'तकनीकी समस्या') return { esakshya: 'तकनीकी समस्या' };
  return {};
}

/** Old karyvahis already written before this checklist existed → every part done (by 'old'). */
export function allDoneLegacy(now: number = Date.now(), def: ChecklistDef = PM_DEF): SubStepsMap {
  const m: SubStepsMap = {};
  for (const s of def.steps) m[s.id] = { done: true, by: 'old', at: now };
  return m;
}

type KRow = KLike & { sub_steps_json?: string | null; execution_count?: number | null };

/** Done rule: a card with a checklist = all its required parts; every other karyvahi = written at least once. */
export function isKaryvahiDone(k: KRow): boolean {
  const def = checklistOf(k);
  if (def) return subStepProgress(parseSubSteps(k.sub_steps_json, def), def).complete;
  return (k.execution_count ?? 0) > 0;
}

/** Unfinished checklist card → progress for the "⏳ लंबित · n/m" chips; null for others / when complete. */
export function pmPendingInfo(k: KRow): { done: number; total: number; remaining: string } | null {
  const def = checklistOf(k);
  if (!def) return null;
  const map = parseSubSteps(k.sub_steps_json, def);
  const p = subStepProgress(map, def);
  if (p.complete) return null;
  return { done: p.done, total: p.total, remaining: remainingText(map, def) };
}

/**
 * Instant filling (owner, चरण 5): opening the PM format again for the same FIR → the last typed values come back
 * and only the parts still left stay ticked (done parts off). `last` = values saved with the earlier entry (may be {}).
 */
export function prefillPmValues(last: Record<string, string>, map: SubStepsMap): Record<string, string> {
  const out: Record<string, string> = { ...last };
  const complete = subStepProgress(map).complete;
  for (const s of PM_SUB_STEPS) {
    const key = s.formatKey ?? '';
    if (complete) delete out[key]; // all 6 done → the format's own ticks (writing again)
    else out[key] = map[s.id]?.done ? '' : 'हाँ';
  }
  return out;
}

/** Instant filling for any checklist format: PM = last values + remaining ticks; others = last values. */
export function prefillChecklistValues(def: ChecklistDef, last: Record<string, string>, map: SubStepsMap): Record<string, string> {
  return def.kind === 'pm' ? prefillPmValues(last, map) : { ...last };
}
