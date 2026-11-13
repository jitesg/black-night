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
  /** name the case diary entry gets when this part is picked ("हिस्सा चुनें") — printed in red in the पर्चा; default = label */
  entryName?: string;
  /** playbook cards (step codes) that became this part — their reading text is shown under it */
  codes?: readonly string[];
}

export type ChecklistKind = 'pm' | 'scene' | 'med' | 'fsl' | 'acc' | 'wpn' | 'cctv' | 'wit' | 'mot' | 'dig' | 'end';

type KLike = { step_code?: string | null; name?: string | null };

export interface ChecklistDef {
  kind: ChecklistKind;
  formatId: string;
  steps: readonly SubStepDef[];
  match: (k: KLike) => boolean;
  /** parts the format printed, from its values */
  partsFromValues: (values: Record<string, string | undefined>) => string[];
  /** more case diary formats that tick parts (format id → parts from its values) */
  moreFormats?: Record<string, (values: Record<string, string | undefined>) => string[]>;
  /** the format's values are kept and come back next time (instant filling) */
  prefill?: boolean;
  /** merged card (new FIRs): its title and synthetic step code */
  title?: string;
  hostCode?: string;
  /** playbook cards folded into this card when a new FIR is seeded */
  mergeCodes?: readonly string[];
  /** one line under the title on the card */
  brief?: string;
}

export const PM_SUB_STEPS: readonly SubStepDef[] = [
  { id: 'pan', label: 'अवलोकन पंचायतनामा', formatKey: 'doPan' },
  { id: 'pm', label: 'अवलोकन पोस्टमार्टम रिपोर्ट', formatKey: 'doPm', codes: ['MUR_PM_REPORT'] },
  { id: 'si', label: 'बयान उ0नि0 (पंचायतनामा भरने वाले)', formatKey: 'doBayanSI' },
  { id: 'co', label: 'बयान आरक्षी (पोस्टमार्टम कराने वाले)', formatKey: 'doBayanCo' },
  { id: 'panch', label: 'बयान पंच गवाहान', formatKey: 'doBayanPanch' },
  { id: 'doc', label: 'बयान चिकित्सक (PM करने वाले)', formatKey: 'doBayanDoc', codes: ['DWD_MEDICAL_CAUSE', 'CHM_DEATH_CAUSE'] },
  { id: 'send', label: 'शव पोस्टमार्टम हेतु भेजा (फार्म 33)', optional: true, codes: ['MUR_PM_SEND'] },
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
  partsFromValues: (values) => PM_SUB_STEPS.filter((s) => s.formatKey && String(values[s.formatKey] ?? '').trim() !== '').map((s) => s.id),
  prefill: true,
  // new FIRs: these cards are folded into the पंचनामा व पोस्टमार्टम card (हत्या: PM रिपोर्ट = अवलोकन PM; दहेज / सदोष: मृत्यु के कारण की राय = डॉक्टर)
  mergeCodes: ['MUR_PM_SEND', 'MUR_PM_REPORT', 'DWD_MEDICAL_CAUSE', 'CHM_DEATH_CAUSE'],
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
  prefill: true,
};

const on = (v: string | undefined) => String(v ?? '').trim() !== '';
const NONE = () => [] as string[];

/** Merged cards (owner): in a NEW FIR, 2+ of `mergeCodes` become ONE card (title / hostCode) with these parts. */
function mergedDef(
  kind: ChecklistKind, hostCode: string, title: string, brief: string, steps: SubStepDef[],
  extra: Partial<ChecklistDef> = {},
): ChecklistDef {
  return {
    kind, formatId: '', steps, title, hostCode, brief,
    mergeCodes: steps.flatMap((s) => s.codes ?? []),
    match: (k) => k.step_code === hostCode || String(k.name ?? '').trim() === title,
    partsFromValues: NONE,
    ...extra,
  };
}

export const MED_DEF = mergedDef('med', 'CK_MED', 'मेडिकल (घायल / पीड़ित)', 'MLC, एक्स-रे, डॉक्टर की राय व अंतिम राय एक ही जगह', [
  { id: 'mlc', label: 'MLC (मेडिको-लीगल परीक्षण)', entryName: 'अवलोकन MLC', codes: ['COM_MLC', 'ATM_MLC'] },
  { id: 'dr', label: 'डॉक्टर की राय / बयान', entryName: 'बयान चिकित्सक', codes: ['HRT_INJURY_OPINION', 'ATM_DR_OPINION'] },
  { id: 'xray', label: 'एक्स-रे / सीटी', optional: true, entryName: 'अवलोकन एक्स-रे रिपोर्ट', codes: ['ATM_XRAY'] },
  { id: 'injphoto', label: 'चोटों की फोटोग्राफी', optional: true, codes: ['ATM_INJ_PHOTO'] },
  { id: 'final', label: 'अंतिम राय / BHT', optional: true, entryName: 'अवलोकन BHT / अंतिम चिकित्सीय राय', codes: ['HRT_FINAL_MED', 'ATM_FINAL_MED'] },
], {
  moreFormats: {
    'sys-fmt-cd-medical-avlokan': (v) => [
      ...(['p1', 'p2', 'p3'].some((p) => on(v[`${p}Mlc`]) || on(v[`${p}Er`])) ? ['mlc'] : []),
      ...(['p1', 'p2', 'p3'].some((p) => on(v[`${p}Xray`])) ? ['xray'] : []),
      ...(['p1', 'p2', 'p3'].some((p) => on(v[`${p}Bht`])) ? ['final'] : []),
    ],
    'sys-fmt-cd-doctor-bayan': () => ['dr'],
  },
});

export const FSL_DEF = mergedDef('fsl', 'CK_FSL', 'साक्ष्य व FSL', 'भौतिक साक्ष्य की जब्ती-सीलिंग, FSL भेजना और रिपोर्ट', [
  { id: 'jabti', label: 'साक्ष्य की जब्ती व सीलिंग', entryName: 'फर्द जब्ती साक्ष्य', codes: ['COM_PHYS_EVIDENCE', 'MUR_PHYS_EVIDENCE', 'MUR_BODY_SAMPLES', 'ATM_CLOTHES', 'HRT_BLOODSTAIN'] },
  { id: 'send', label: 'FSL भेजा', entryName: 'साक्ष्य FSL हेतु प्रेषित', codes: ['COM_FSL_SEND', 'MUR_FSL_SEND', 'ATM_FSL'] },
  { id: 'report', label: 'FSL रिपोर्ट मिली', entryName: 'अवलोकन FSL रिपोर्ट', codes: ['COM_FSL_REPORT', 'MUR_FSL_REPORTS'] },
], { moreFormats: { fard_jabti: () => ['jabti'] } });

export const ACC_DEF = mergedDef('acc', 'CK_ACC', 'अभियुक्त', 'अभियुक्त की तलाश, गिरफ्तारी / नोटिस, पूछताछ और बरामदगी', [
  { id: 'trace', label: 'तलाश / पहचान', entryName: 'तलाश अभियुक्त', codes: ['COM_ACCUSED_TRACE', 'MUR_SUSPECTS', 'MUR_ACCUSED_TRACE', 'ATM_ACCUSED_ID'] },
  { id: 'arrest', label: 'गिरफ्तारी / 35(3) नोटिस', entryName: 'गिरफ्तारी अभियुक्त', codes: ['COM_ARREST_ASSESS', 'ATM_ARREST_ASSESS'] },
  { id: 'interrog', label: 'पूछताछ / बयान अभियुक्त', entryName: 'बयान अभियुक्त', codes: ['COM_INTERROGATION', 'MUR_INTERROGATION'] },
  { id: 'recovery', label: 'निशानदेही पर बरामदगी', optional: true, entryName: 'बरामदगी', codes: ['COM_RECOVERY', 'MUR_RECOVERY', 'MUR_DISCLOSURE'] },
  { id: 'med', label: 'अभियुक्त का मेडिकल', optional: true, entryName: 'मेडिकल अभियुक्त', codes: ['ATM_ACCUSED_MED'] },
], {
  moreFormats: {
    'sys-fmt-notice-35-3-bnss': () => ['arrest'],
    'sys-fmt-cd-abhiyukt-bayan-35-3': () => ['arrest', 'interrog'],
    fard_baramadgi: () => ['recovery'],
  },
});

export const WPN_DEF = mergedDef('wpn', 'CK_WPN', 'हथियार', 'हथियार की बरामदगी, FSL / बैलिस्टिक और चोट से मिलान', [
  { id: 'recover', label: 'हथियार की बरामदगी', entryName: 'बरामदगी आलाकत्ल / हथियार', codes: ['MUR_WEAPON_SEARCH', 'ATM_WEAPON', 'HRT_WEAPON_SEIZE'] },
  { id: 'fsl', label: 'FSL / बैलिस्टिक परीक्षण', optional: true, entryName: 'हथियार FSL / बैलिस्टिक हेतु प्रेषित', codes: ['MUR_WEAPON_FSL', 'MUR_BALLISTIC', 'ATM_BALLISTIC'] },
  { id: 'match', label: 'चोट से मिलान / डॉक्टर की राय', optional: true, entryName: 'हथियार के सम्बन्ध में डॉक्टर की राय', codes: ['MUR_PM_OPINION', 'CHM_WEAPON_MATCH'] },
]);

export const CCTV_DEF = mergedDef('cctv', 'CK_CCTV', 'CCTV', 'CCTV की तलाश, फुटेज का अवलोकन और DVR जब्ती', [
  { id: 'search', label: 'CCTV की तलाश', entryName: 'तलाश CCTV', codes: ['COM_CCTV', 'MUR_CCTV_SEARCH', 'ATM_CCTV'] },
  { id: 'footage', label: 'फुटेज का अवलोकन', optional: true, entryName: 'अवलोकन CCTV फुटेज' },
  { id: 'dvr', label: 'DVR जब्ती व 63 BSA प्रमाणपत्र', optional: true, entryName: 'फर्द जब्ती DVR', codes: ['MUR_DVR_SEIZE'] },
]);

export const WIT_DEF = mergedDef('wit', 'CK_WIT', 'गवाहों के बयान', 'प्रत्यक्षदर्शी, परिवार, अंतिम बार साथ देखने वाले व अन्य गवाह', [
  { id: 'eye', label: 'प्रत्यक्षदर्शी / गवाह', entryName: 'बयान गवाह', codes: ['COM_EYEWITNESS', 'MUR_EYEWITNESS', 'ATM_EYEWITNESS'] },
  { id: 'family', label: 'परिवार / संबंधी', optional: true, entryName: 'बयान परिजन', codes: ['MUR_FAMILY_STMT', 'DWD_FAMILY_STMT'] },
  { id: 'lastseen', label: 'अंतिम बार साथ देखने वाले', optional: true, entryName: 'बयान गवाह (अंतिम बार साथ देखने वाले)', codes: ['MUR_LAST_SEEN'] },
  { id: 'other', label: 'पड़ोसी / अन्य', optional: true, entryName: 'बयान गवाह (पड़ोसी)', codes: ['TRS_NEIGHBOR_STMT'] },
]);

export const MOT_DEF = mergedDef('mot', 'CK_MOT', 'मकसद व रंजिश', 'घटना का मकसद, पुरानी रंजिश और धमकी / कॉल का इतिहास', [
  { id: 'motive', label: 'मकसद (Motive)', entryName: 'मकसद', codes: ['ATM_MOTIVE', 'MUR_MOTIVE', 'HRT_MOTIVE_CAUSE'] },
  { id: 'enmity', label: 'पुरानी रंजिश', optional: true, entryName: 'पुरानी रंजिश', codes: ['ATM_ENMITY'] },
  { id: 'threats', label: 'धमकी / कॉल / मैसेज इतिहास', optional: true, entryName: 'धमकी / कॉल इतिहास', codes: ['ATM_THREATS'] },
]);

export const DIG_DEF = mergedDef('dig', 'CK_DIG', 'डिजिटल व लेन-देन', 'कॉल / CDR / लोकेशन, सोशल मीडिया और बैंक / UPI लेन-देन', [
  { id: 'cdr', label: 'कॉल / CDR / लोकेशन', entryName: 'अवलोकन CDR / लोकेशन', codes: ['COM_DIGITAL_CDR', 'MUR_DIGITAL'] },
  { id: 'fin', label: 'बैंक / UPI लेन-देन', entryName: 'अवलोकन बैंक / UPI लेन-देन', codes: ['COM_FIN_TRAIL', 'MUR_FINANCIAL'] },
  { id: 'social', label: 'सोशल मीडिया', optional: true, entryName: 'सोशल मीडिया साक्ष्य', codes: ['MUR_SOCIAL'] },
]);

export const END_DEF = mergedDef('end', 'CK_END', 'समापन (केस डायरी समीक्षा व आरोपपत्र)', 'केस डायरी की समीक्षा और आरोपपत्र / अंतिम रिपोर्ट', [
  { id: 'review', label: 'केस डायरी की समीक्षा', optional: true, entryName: 'केस डायरी समीक्षा', codes: ['COM_CD_REVIEW', 'MUR_CD_REVIEW'] },
  { id: 'cs', label: 'आरोपपत्र / अंतिम रिपोर्ट', entryName: 'आरोपपत्र / अंतिम रिपोर्ट', codes: ['COM_CHARGESHEET', 'MUR_CHARGESHEET'] },
]);

/** The merged cards (2+ of their codes in a new FIR → one card). */
export const MERGED_DEFS: readonly ChecklistDef[] = [MED_DEF, FSL_DEF, ACC_DEF, WPN_DEF, CCTV_DEF, WIT_DEF, MOT_DEF, DIG_DEF, END_DEF];

export const CHECKLISTS: readonly ChecklistDef[] = [PM_DEF, SCENE_DEF, ...MERGED_DEFS];

/** The checklist of a karyvahi (null = an ordinary card). */
export function checklistOf(k: KLike): ChecklistDef | null {
  return CHECKLISTS.find((d) => d.match(k)) ?? null;
}

export function checklistForFormat(formatId: string | null | undefined): ChecklistDef | null {
  if (!formatId) return null;
  return CHECKLISTS.find((d) => d.formatId === formatId || !!d.moreFormats?.[formatId]) ?? null;
}

/** Parts a case diary format ticks on its card. */
export function partsForFormat(def: ChecklistDef, formatId: string, values: Record<string, string | undefined>): string[] {
  if (def.formatId === formatId) return def.partsFromValues(values);
  return def.moreFormats?.[formatId]?.(values) ?? [];
}

/** "हिस्सा चुनें": the entry name of a part (printed in the पर्चा). */
export function partEntryName(s: SubStepDef): string {
  return s.entryName ?? s.label;
}

/** Part of an entry from its karyvahi name (a saved entry opened again). */
export function partByEntryName(def: ChecklistDef, name: string | null | undefined): SubStepDef | null {
  const n = String(name ?? '').trim();
  if (!n) return null;
  return def.steps.find((s) => partEntryName(s) === n || s.label === n) ?? null;
}

const PRIORITY_RANK: Record<string, number> = { MANDATORY: 0, CONDITIONAL: 1, RECOMMENDED: 2 };

export interface SeedItemLike {
  step_code?: string | null;
  task_name: string;
  brief_description?: string | null;
  priority?: string | null;
  merged_codes?: string;
}

/**
 * New FIR (owner): fold playbook cards into one card.
 *  - पंचनामा व पोस्टमार्टम: PM_DEF.mergeCodes go into the FIR's PM card (when it has one).
 *  - merged cards: 2+ codes of a def → the first becomes the def's card (title, hostCode, best priority), the rest go;
 *    a single code stays as its own card.
 * `merged_codes` (comma list) tells the card's "जानकारी" which texts to show. Pure — returns a new array.
 */
export function mergeSeedItems<T extends SeedItemLike>(items: readonly T[]): T[] {
  let out: T[] = items.map((i) => ({ ...i }));
  const pmHost = out.find((i) => i.step_code && PM_STEP_CODES.includes(i.step_code));
  if (pmHost) {
    const extra = out.filter((i) => i.step_code && PM_DEF.mergeCodes!.includes(i.step_code));
    if (extra.length) {
      pmHost.merged_codes = extra.map((i) => i.step_code).join(',');
      out = out.filter((i) => !extra.includes(i));
    }
  }
  for (const def of MERGED_DEFS) {
    const group = out.filter((i) => i.step_code && def.mergeCodes!.includes(i.step_code));
    if (group.length < 2) continue;
    const best = group.reduce((a, b) => ((PRIORITY_RANK[b.priority ?? ''] ?? 9) < (PRIORITY_RANK[a.priority ?? ''] ?? 9) ? b : a));
    const host = group[0];
    host.merged_codes = group.map((i) => i.step_code).join(',');
    host.task_name = def.title!;
    host.step_code = def.hostCode!;
    host.priority = best.priority ?? host.priority;
    host.brief_description = def.brief ?? host.brief_description;
    out = out.filter((i) => i === host || !group.includes(i));
  }
  return out;
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
  /** ticked by "हिस्सा चुनें" (not by the entry's format) */
  pick?: boolean;
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

/** Drop only the "हिस्सा चुनें" tick of an entry (its format ticks stay). */
export function removeEntryPicks(map: SubStepsMap, entryId: string): SubStepsMap {
  const next: SubStepsMap = {};
  for (const [id, st] of Object.entries(map)) if (!(st.entryId === entryId && st.pick)) next[id] = st;
  return next;
}

/**
 * Saving a diary entry: its parts become done with the पर्चा number.
 * `pickId` = the part picked with "हिस्सा चुनें" (marked `pick`). `keepFormatTicks` = no format generated in this
 * session → the entry's earlier format ticks stay, only its old pick is replaced.
 */
export function applyEntryParts(
  map: SubStepsMap, entryId: string, parts: string[], parcha: string, now: number = Date.now(), def: ChecklistDef = PM_DEF,
  notes: Record<string, string> = {}, pickId: string | null = null, keepFormatTicks = false,
): SubStepsMap {
  const next = keepFormatTicks ? removeEntryPicks(map, entryId) : removeEntryParts(map, entryId);
  for (const id of parts) {
    if (def.steps.some((s) => s.id === id)) {
      next[id] = { done: true, by: 'auto', parcha, entryId, at: now, ...(notes[id] ? { note: notes[id] } : {}), ...(id === pickId ? { pick: true } : {}) };
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
    const key = s.formatKey;
    if (!key) continue; // parts the format does not print (शव भेजा)
    if (complete) delete out[key]; // all 6 done → the format's own ticks (writing again)
    else out[key] = map[s.id]?.done ? '' : 'हाँ';
  }
  return out;
}

/** Instant filling for a checklist format (PM / घटनास्थल): PM = last values + remaining ticks; others = last values. */
export function prefillChecklistValues(def: ChecklistDef, last: Record<string, string>, map: SubStepsMap): Record<string, string> {
  return def.kind === 'pm' ? prefillPmValues(last, map) : { ...last };
}
