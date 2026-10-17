import { getDatabase, generateUUID, nowTimestamp, isFirKaryvahiSortOrderAvailable, getDbInstanceTag } from './database';
import { saveSnapshot } from './checklistSnapshotRepo';
import { updateFIRStatus } from './firRepo';
import {
  getChecklistItemsForPairs,
  getChecklistItemsForCrimeTypes,
  getChecklistsByCrimeType,
  getItemsByChecklist,
  parseCrimeTypePairs,
  type SubtypePair,
  type ChecklistItem,
} from './checklistRepo';
import { logger } from '../logger';
import { unlockDependentsOf } from './actionConditionsRepo';

// ── Instance counter for mount/unmount tracing (shared across screen renders) ──
let _karyvahiInstanceSeq = 0;
export function nextKaryvahiInstanceId(): number { return ++_karyvahiInstanceSeq; }

// ── Phase 1: Priority + Rich Status types ────────────────────────────────────
export type KaryvahiPriority = 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED';
export type KaryvahiStatus   = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE' | 'DEFERRED';

export interface FIRKaryvahi {
  id: string;
  fir_id: string;
  name: string;
  precautions?: string;
  is_completed: number; // 0 | 1  — kept in sync: COMPLETED → 1, all others → 0
  sort_order: number;
  completed_by_diary_id?: string;
  execution_count: number; // derived; NEVER set manually — see recalcExecutionCount
  source?: string; // 'system' | 'user'
  // Phase 1 additive fields — optional (DB DEFAULT covers existing rows)
  priority?: KaryvahiPriority;   // DEFAULT 'MANDATORY'
  status?: KaryvahiStatus;       // DEFAULT 'PENDING'
  not_applicable_reason?: string;
  deferred_reason?: string;
  due_date?: string;
  // Phase 3 additive field — optional (DB DEFAULT 0 covers existing rows)
  is_locked?: number; // 0 = unlocked, 1 = locked (waiting for a blocker)
  // Phase 4 additive field — optional: format to auto-open on COMPLETED
  auto_generate_format_id?: string;
  // Investigation Playbook field (optional)
  step_code?: string;
  // Diary queue flag: 1 = officer flagged this item for the next Case Diary session
  queued_for_diary?: number; // 0 | 1, DEFAULT 0
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type FIRKaryvahiInput = Omit<FIRKaryvahi, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

// Five mandatory Karyvahi added to every FIR at creation time (sort_order 0–4)
export const DEFAULT_KARYVAHI = [
  { name: 'नकल चिक का अवलोकन', precautions: 'नकल चिक की प्रविष्टि का अवलोकन कर सत्यापित करें।' },
  { name: 'नकल रपट का अवलोकन', precautions: 'नकल रपट की प्रविष्टि का अवलोकन कर सत्यापित करें।' },
  { name: 'वादी/वादिनी का बयान', precautions: 'वादी/पीड़ित का बयान दर्ज करें।' },
  { name: 'घटनास्थल निरीक्षण', precautions: 'घटनास्थल का निरीक्षण करें।' },
  { name: 'ई-साक्ष्य ऐप से वीडियोग्राफी', precautions: 'ई-साक्ष्य ऐप से वीडियोग्राफी करें।' },
] as const;

export const LEGACY_DEFAULT_KARYVAHI_NAMES: readonly string[] = [
  'Avlokan Nakal Chick',
  'Avlokan Nakal Rapat',
  'Bayan Vadi / Vadini',
  'Ghatnasthal Nirikshan',
  'e-Sakshya App Videography',
];

/**
 * 34 standard investigation steps officers can select from when adding
 * Karyvahi to an existing FIR from the Common Investigation Checklist screen.
 */
export const COMMON_INVESTIGATION_CHECKLIST: Array<{ name: string; precautions: string }> = [
  { name: 'एफआईआर/सूचना पंजीकरण', precautions: 'सूचना को सही धाराओं में दर्ज करें।' },
  { name: 'एफआईआर की प्रति सूचनादाता/पीड़ित को', precautions: 'निःशुल्क प्रति तुरंत उपलब्ध कराएं।' },
  { name: 'जीडी प्रविष्टि', precautions: 'थाने की जीडी में घटना दर्ज करें।' },
  { name: 'विवेचक नियुक्ति', precautions: 'सक्षम अधिकारी द्वारा विवेचक नामित करें।' },
  { name: 'घटनास्थल हेतु रवानगी', precautions: 'तुरंत घटनास्थल के लिए रवाना हों।' },
  { name: 'घटनास्थल सुरक्षा', precautions: 'साक्ष्य नष्ट होने से बचाने हेतु घेराबंदी करें।' },
  { name: 'घटनास्थल निरीक्षण', precautions: 'घटनास्थल का सूक्ष्मता से निरीक्षण करें।' },
  { name: 'नक्शा नजरी (साइट प्लान)', precautions: 'दूरी/दिशा सहित सही नक्शा बनाएं।' },
  { name: 'फोटोग्राफी', precautions: 'घटनास्थल की फोटो लें।' },
  { name: 'वीडियोग्राफी', precautions: 'ई-साक्ष्य ऐप से वीडियोग्राफी कराएं।' },
  { name: 'भौतिक साक्ष्य संकलन', precautions: 'वैज्ञानिक विधि से साक्ष्य एकत्र करें।' },
  { name: 'गवाहों की पहचान', precautions: 'सभी संभावित गवाहों को चिन्हित करें।' },
  { name: 'गवाहों के बयान', precautions: 'धारा के अनुसार बयान दर्ज करें।' },
  { name: 'सीसीटीवी खोज', precautions: 'आसपास के सीसीटीवी फुटेज एकत्र करें।' },
  { name: 'इलेक्ट्रॉनिक साक्ष्य संरक्षण', precautions: 'डिजिटल साक्ष्य सुरक्षित रखें।' },
  { name: 'संदिग्ध की पहचान', precautions: 'संभावित संदिग्धों को चिन्हित करें।' },
  { name: 'अभियुक्त से पूछताछ', precautions: 'विधिक प्रक्रिया अनुसार पूछताछ करें।' },
  { name: 'गिरफ्तारी आवश्यकता का आकलन', precautions: 'आवश्यकता का विधिक मूल्यांकन करें।' },
  { name: 'गिरफ्तारी ज्ञापन (यदि गिरफ्तार हो)', precautions: 'गिरफ्तारी मेमो तैयार करें।' },
  { name: 'व्यक्तिगत तलाशी', precautions: 'गिरफ्तारी पर तलाशी लें।' },
  { name: 'चिकित्सीय परीक्षण (जहां लागू हो)', precautions: 'एमएलसी करवाएं।' },
  { name: 'केस डायरी प्रविष्टियां', precautions: 'नियमित रूप से डायरी अंकित करें।' },
  { name: 'जब्त माल मालखाना', precautions: 'जब्त सामान मालखाना जमा करें।' },
  { name: 'एफएसएल परीक्षण (जहां आवश्यक हो)', precautions: 'नमूने एफएसएल भेजें।' },
  { name: 'विशेषज्ञ राय', precautions: 'आवश्यकतानुसार विशेषज्ञ राय लें।' },
  { name: 'बरामदगी (यदि हो)', precautions: 'बरामदगी का पंचनामा तैयार करें।' },
  { name: 'पहचान परेड (यदि आवश्यक हो)', precautions: 'टीआई परेड कराएं।' },
  { name: 'पूर्व आपराधिक इतिहास सत्यापन', precautions: 'अभियुक्त का रिकॉर्ड जांचें।' },
  { name: 'सीडीआर/आईपीडीआर/लोकेशन डाटा', precautions: 'विधिक अनुमति से प्राप्त करें।' },
  { name: 'वित्तीय/बैंक ट्रेल', precautions: 'बैंक खाता विवरण प्राप्त करें।' },
  { name: 'अभिप्रेरणा (मोटिव) की जांच', precautions: 'घटना के कारण की जांच करें।' },
  { name: 'बयानों का सत्यापन/विरोधाभास जांच', precautions: 'बयानों में विरोधाभास जांचें।' },
  { name: 'लंबित साक्ष्य समीक्षा', precautions: 'सभी साक्ष्यों की समीक्षा करें।' },
  { name: 'अंतिम राय', precautions: 'विवेचना की अंतिम राय तैयार करें।' },
  { name: 'आरोप पत्र/अंतिम रिपोर्ट', precautions: 'न्यायालय में प्रस्तुत करें।' },
];

export const DEFAULT_KARYVAHI_RENAME_MAP = [
  {
    oldName: 'Avlokan Nakal Chick',
    newName: 'नकल चिक का अवलोकन',
    oldPrecaution: 'Review and verify the Nakal Chick entry.',
    newPrecaution: 'नकल चिक की प्रविष्टि का अवलोकन कर सत्यापित करें।',
  },
  {
    oldName: 'Avlokan Nakal Rapat',
    newName: 'नकल रपट का अवलोकन',
    oldPrecaution: 'Review and verify the Nakal Rapat entry.',
    newPrecaution: 'नकल रपट की प्रविष्टि का अवलोकन कर सत्यापित करें।',
  },
  {
    oldName: 'Bayan Vadi / Vadini',
    newName: 'वादी/वादिनी का बयान',
    oldPrecaution: 'Record statement of complainant/victim.',
    newPrecaution: 'वादी/पीड़ित का बयान दर्ज करें।',
  },
  {
    oldName: 'Ghatnasthal Nirikshan',
    newName: 'घटनास्थल निरीक्षण',
    oldPrecaution: 'Conduct site inspection of the crime scene.',
    newPrecaution: 'घटनास्थल का निरीक्षण करें।',
  },
  {
    oldName: 'e-Sakshya App Videography',
    newName: 'ई-साक्ष्य ऐप से वीडियोग्राफी',
    oldPrecaution: 'Record videography via e-Sakshya app.',
    newPrecaution: 'ई-साक्ष्य ऐप से वीडियोग्राफी करें।',
  },
] as const;

export async function migrateDefaultKaryvahiHindiNames(): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  try {
    await db.withTransactionAsync(async () => {
      for (const item of DEFAULT_KARYVAHI_RENAME_MAP) {
        // UPDATE fir_karyvahi SET name=<new>, updated_at=now WHERE LOWER(TRIM(name)) = LOWER(old) AND (source IS NULL OR source != 'user')
        await db.runAsync(
          `UPDATE fir_karyvahi
           SET name = ?, updated_at = ?
           WHERE LOWER(TRIM(name)) = LOWER(?)
             AND (source IS NULL OR source != 'user')`,
          [item.newName, now, item.oldName]
        );

        // Also set precautions to the new Hindi precautions only where precautions equals the OLD default precaution text
        await db.runAsync(
          `UPDATE fir_karyvahi
           SET precautions = ?, updated_at = ?
           WHERE precautions = ?`,
          [item.newPrecaution, now, item.oldPrecaution]
        );

        // UPDATE case_diary_entries SET karyvahi_name=<new> WHERE karyvahi_name=<old>
        await db.runAsync(
          `UPDATE case_diary_entries
           SET karyvahi_name = ?
           WHERE karyvahi_name = ?`,
          [item.newName, item.oldName]
        );

        // same for case_diary_karyvahi.karyvahi_name
        await db.runAsync(
          `UPDATE case_diary_karyvahi
           SET karyvahi_name = ?
           WHERE karyvahi_name = ?`,
          [item.newName, item.oldName]
        );
      }
    });
  } catch (err) {
    logger.warn('[migration] v340_default_karyvahi_hindi_names failed:', err);
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Pure read: returns all active Karyvahi for a FIR, sorted by sort_order then
 * created_at.  Does NOT seed, does NOT insert anything — seeding happens
 * exactly once inside seedFIRKaryvahi, called from handleSave before navigation.
 *
 * Ordering strategy:
 *   • When sort_order is available: primary key = sort_order, secondary = created_at.
 *   • When sort_order is absent from the schema: primary key = created_at only.
 * Both cases are handled by the same JS comparator — sort_order defaults to 999
 * when the column is absent (expo-sqlite returns undefined for missing columns),
 * effectively falling back to created_at order with no code-path branching.
 *
 * All filtering and sorting is done in JavaScript so this query is safe on
 * every SQLite schema version (no dependency on column names in WHERE/ORDER BY).
 */
export async function getKaryvahiByFIR(firId: string, callerTag = ''): Promise<FIRKaryvahi[]> {
  const _t = () => Date.now();
  const t0 = _t();
  // Q3 PROBE: log instance tag — must match the tag logged by seedFIRKaryvahi
  // and the Q1+Q3 probe in add-fir.tsx. If different → two DB instances.
  const instanceTag = getDbInstanceTag();
  logger.warn(
    `[TRACE] getKaryvahiByFIR ENTER` +
    ` caller="${callerTag}"` +
    ` firId="${firId}"` +
    ` db="${instanceTag}"` +
    ` sort_order_available=${isFirKaryvahiSortOrderAvailable()}` +
    ` t=${t0}`
  );
  try {
    const db = await getDatabase();
    const tQuery = _t();
    const sql = 'SELECT * FROM fir_karyvahi WHERE fir_id = ?';
    logger.warn(`[TRACE] getKaryvahiByFIR SQL="${sql}" params=["${firId}"] t=${_t()}`);
    const all = await db.getAllAsync<FIRKaryvahi>(sql, [firId]);
    logger.warn(
      `[TRACE] getKaryvahiByFIR SELECT done` +
      ` raw_rows=${all.length}` +
      ` queryElapsed=${_t() - tQuery}ms` +
      ` t=${_t()}`
    );
    // Log every raw row so deleted_at / sort_order / is_completed / fir_id can be inspected
    all.forEach((r, i) => {
      logger.warn(
        `[TRACE] getKaryvahiByFIR row[${i}]` +
        ` id="${r.id}"` +
        ` fir_id="${r.fir_id}"` +
        ` name="${r.name}"` +
        ` is_completed=${r.is_completed}` +
        ` sort_order=${r.sort_order}` +
        ` deleted_at=${r.deleted_at}`
      );
    });
    const active = all.filter((r) => r.deleted_at == null);
    logger.warn(
      `[TRACE] getKaryvahiByFIR active=${active.length}` +
      ` deleted_filtered=${all.length - active.length}` +
      ` t=${_t()}`
    );
    const sorted = active.sort((a, b) => {
      const so = (r: FIRKaryvahi) => (typeof r.sort_order === 'number' ? r.sort_order : 999);
      const ca = (r: FIRKaryvahi) => (typeof r.created_at === 'number' ? r.created_at : 0);
      return so(a) - so(b) || ca(a) - ca(b);
    });
    logger.warn(`[TRACE] getKaryvahiByFIR EXIT returning ${sorted.length} rows t=${_t()}`);
    return sorted;
  } catch (e) {
    logger.error(`[TRACE] getKaryvahiByFIR SELECT FAILED firId="${firId}" t=${Date.now()} error:`, e);
    return [];
  }
}

// ─── Seeding (called once at FIR creation) ────────────────────────────────────

/**
 * Seeds all Karyvahi for a new FIR inside a single database transaction.
 * Called exactly once from handleSave, before navigation to the FIR screen.
 *
 * Transaction strategy — manual BEGIN/COMMIT:
 *   withTransactionAsync (SDK 55 source, SQLiteDatabase.js line 120-130) is
 *   literally: await execAsync('BEGIN'); await task(); await execAsync('COMMIT').
 *   It provides NO additional serialisation over the manual pattern. Both call
 *   the same nativeDatabase methods in the same order. Using it would be
 *   cosmetically different but mechanically identical.
 *
 * Backward-compatibility strategy:
 *   isFirKaryvahiSortOrderAvailable() is checked once before the transaction.
 *   – true  → full INSERT including sort_order
 *   – false → fallback INSERT without sort_order; ordering preserved via
 *              sequential created_at offsets (now+0 … now+N).
 */
export async function seedFIRKaryvahi(firId: string, crimeType: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const _t = () => Date.now();

  const hasSortOrder = isFirKaryvahiSortOrderAvailable();
  logger.warn(
    `[TRACE] seedFIRKaryvahi ENTER` +
    ` firId="${firId}"` +
    ` crimeType="${crimeType}"` +
    ` hasSortOrder=${hasSortOrder}` +
    ` t=${_t()}`
  );

  // ── Collect checklist items BEFORE opening the write transaction ──────────
  //
  // ENCODING FORMATS (backward-compat):
  //   NEW (v2, flat):   "murder|robbery|ndps"  — pipe-separated flat crime-type IDs
  //   LEGACY (v1):      "CrimeType1:Sub1,Sub2|CrimeType2:Sub3"  — contains ':'
  //
  // If crimeType contains ':' → legacy path (getChecklistItemsForPairs / legacy checklist tables).
  // If no ':' → new flat path (getChecklistItemsForCrimeTypes via M2M table).
  // Either way seededNames guards DEFAULT_KARYVAHI from being overwritten.
  const seededNames = new Set([
    ...DEFAULT_KARYVAHI.map((k) => k.name.toLowerCase().trim()),
    ...LEGACY_DEFAULT_KARYVAHI_NAMES.map((name) => name.toLowerCase().trim()),
  ]);
  const checklistItems: ChecklistItem[] = [];

  const isLegacyFormat = crimeType.includes(':');

  if (isLegacyFormat) {
    // ── LEGACY path: "CrimeType:Sub1,Sub2|CrimeType2:Sub3" ─────────────────
    logger.warn(`[TRACE] seedFIRKaryvahi legacy format detected for crimeType="${crimeType}"`);

    const uniquePairs = parseCrimeTypePairs(crimeType);

    logger.warn(
      `[TRACE] seedFIRKaryvahi legacy: ${uniquePairs.length} (type,subtype) pairs`
    );

    const namedPairs = uniquePairs.filter((p) => p.subType !== '');
    const barePairs  = uniquePairs.filter((p) => p.subType === '');

    if (namedPairs.length > 0) {
      try {
        const m2mItems = await getChecklistItemsForPairs(namedPairs);
        logger.warn(`[TRACE] seedFIRKaryvahi legacy getChecklistItemsForPairs → ${m2mItems.length} items`);
        for (const item of m2mItems) {
          const key = item.task_name.toLowerCase().trim();
          if (!seededNames.has(key)) { checklistItems.push(item); seededNames.add(key); }
        }
      } catch (e) {
        logger.warn('[TRACE] seedFIRKaryvahi legacy getChecklistItemsForPairs failed:', e);
      }
    }

    if (barePairs.length > 0) {
      for (const { crimeType: ct } of barePairs) {
        try {
          const checklists = await getChecklistsByCrimeType(ct);
          logger.warn(
            `[TRACE] seedFIRKaryvahi legacy bare path "${ct}": ${checklists.length} checklists`
          );
          for (const cl of checklists) {
            const items = await getItemsByChecklist(cl.id);
            for (const item of items) {
              const key = item.task_name.toLowerCase().trim();
              if (!seededNames.has(key)) { checklistItems.push(item); seededNames.add(key); }
            }
          }
        } catch (e) {
          logger.warn(`[TRACE] seedFIRKaryvahi legacy bare path failed for "${ct}":`, e);
        }
      }
    }

  } else {
    // ── NEW flat path: "murder|robbery|ndps" ──────────────────────────────
    const ids = crimeType.split('|').map((s) => s.trim()).filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    logger.warn(
      `[TRACE] seedFIRKaryvahi flat format: ${uniqueIds.length} ids → ${uniqueIds.join(',')}`
    );
    try {
      const flatItems = await getChecklistItemsForCrimeTypes(uniqueIds);
      logger.warn(`[TRACE] seedFIRKaryvahi flat getChecklistItemsForCrimeTypes → ${flatItems.length} items`);
      for (const item of flatItems) {
        const key = item.task_name.toLowerCase().trim();
        if (!seededNames.has(key)) { checklistItems.push(item); seededNames.add(key); }
      }
    } catch (e) {
      logger.warn('[TRACE] seedFIRKaryvahi flat getChecklistItemsForCrimeTypes failed:', e);
    }
  }

  logger.warn(
    `[TRACE] seedFIRKaryvahi pre-tx:` +
    ` ${DEFAULT_KARYVAHI.length} mandatory + ${checklistItems.length} checklist` +
    ` t=${_t()}`
  );

  // ── Transactional write ───────────────────────────────────────────────────
  let txState = 'pre-BEGIN';
  try {
    const tBegin = _t();
    await db.execAsync('BEGIN');
    txState = 'BEGIN';
    logger.warn(`[TRACE] seedFIRKaryvahi BEGIN elapsed=${_t() - tBegin}ms t=${_t()}`);

    // ── INSERT 5 mandatory items ─────────────────────────────────────────────
    for (let i = 0; i < DEFAULT_KARYVAHI.length; i++) {
      const k = DEFAULT_KARYVAHI[i];
      const sql = hasSortOrder
        ? `INSERT INTO fir_karyvahi
             (id, fir_id, name, precautions, is_completed, sort_order, priority, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, 'MANDATORY', 'PENDING', ?, ?)`
        : `INSERT INTO fir_karyvahi
             (id, fir_id, name, precautions, is_completed, priority, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 'MANDATORY', 'PENDING', ?, ?)`;
      const params = hasSortOrder
        ? [generateUUID(), firId, k.name, k.precautions, i, now + i, now + i]
        : [generateUUID(), firId, k.name, k.precautions, now + i, now + i];

      txState = `mandatory INSERT ${i + 1} of ${DEFAULT_KARYVAHI.length}`;
      try {
        await db.runAsync(sql, params);
        logger.warn(
          `[TRACE] seedFIRKaryvahi mandatory INSERT ${i + 1}/${DEFAULT_KARYVAHI.length}` +
          ` OK "${k.name}"` +
          ` firId="${firId}"` +
          ` t=${_t()}`
        );
      } catch (insertErr) {
        logger.error(
          `[TRACE] seedFIRKaryvahi mandatory INSERT FAILED\n` +
          `  SQL:    ${sql}\n` +
          `  firId:  ${firId}\n` +
          `  task:   ${k.name}\n` +
          `  txState:${txState}\n` +
          `  error:  ${insertErr}`
        );
        throw insertErr;
      }
    }

    // ── Step 6: Verify mandatory rows exist INSIDE the transaction ───────────
    const mandatoryCheck = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM fir_karyvahi WHERE fir_id = ?',
      [firId]
    );
    const mandatoryCount = mandatoryCheck.length;
    logger.warn(
      `[TRACE] seedFIRKaryvahi in-tx verify:` +
      ` found ${mandatoryCount} row(s)` +
      ` expected ≥ ${DEFAULT_KARYVAHI.length}` +
      ` t=${_t()}`
    );

    if (mandatoryCount < DEFAULT_KARYVAHI.length) {
      throw new Error(
        `Karyvahi mandatory verification failed: ` +
        `inserted ${DEFAULT_KARYVAHI.length} rows but SELECT returned ${mandatoryCount}. ` +
        `FIR ID: ${firId}`
      );
    }

    // ── INSERT checklist items + Phase 6 snapshot ───────────────────────────
    for (let i = 0; i < checklistItems.length; i++) {
      const item     = checklistItems[i];
      const offset   = DEFAULT_KARYVAHI.length + i;
      // Carry priority + auto_generate_format_id from the template item
      const priority = item.priority ?? 'MANDATORY';
      const formatId = item.auto_generate_format_id ?? null;
      const sql = hasSortOrder
        ? `INSERT INTO fir_karyvahi
             (id, fir_id, name, precautions, is_completed, sort_order, priority, status, auto_generate_format_id, step_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, 'PENDING', ?, ?, ?, ?)`
        : `INSERT INTO fir_karyvahi
             (id, fir_id, name, precautions, is_completed, priority, status, auto_generate_format_id, step_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, 'PENDING', ?, ?, ?, ?)`;
      const params = hasSortOrder
        ? [generateUUID(), firId, item.task_name.trim(), item.brief_description?.trim() || null, 10 + i, priority, formatId, item.step_code ?? null, now + offset, now + offset]
        : [generateUUID(), firId, item.task_name.trim(), item.brief_description?.trim() || null, priority, formatId, item.step_code ?? null, now + offset, now + offset];

      txState = `checklist INSERT ${i + 1} of ${checklistItems.length}`;
      try {
        await db.runAsync(sql, params);
        // Phase 6: snapshot this template item verbatim — future template edits
        // will not affect this FIR because the FIR reads from the snapshot.
        await saveSnapshot(db, firId, item as unknown as Record<string, unknown>);
      } catch (insertErr) {
        logger.error(
          `[TRACE] seedFIRKaryvahi checklist INSERT FAILED\n` +
          `  SQL:    ${sql}\n` +
          `  firId:  ${firId}\n` +
          `  task:   ${item.task_name}\n` +
          `  txState:${txState}\n` +
          `  error:  ${insertErr}`
        );
        throw insertErr;
      }
    }

    await db.execAsync('COMMIT');
    txState = 'COMMITTED';
    logger.warn(`[TRACE] seedFIRKaryvahi COMMIT done t=${_t()}`);

    // ── Step 7: Post-COMMIT verification ────────────────────────────────────
    // Q1 PROBE: This SELECT runs AFTER await COMMIT resolves on the same
    // connection. If it returns < 5 rows the commit did not persist — that
    // would be definitive evidence of a durability bug.
    // If it returns 5 rows but karyvahi still shows empty, the root cause
    // is NOT in the transaction — it is in getDatabase() identity or React state.
    const tPostCommit = _t();
    const finalCheck = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM fir_karyvahi WHERE fir_id = ?',
      [firId]
    );
    const finalCount = finalCheck.length;
    const expectedTotal = DEFAULT_KARYVAHI.length + checklistItems.length;
    logger.warn(
      `[TRACE] seedFIRKaryvahi post-COMMIT verify:` +
      ` ${finalCount} rows` +
      ` (expected ${expectedTotal}:` +
      ` ${DEFAULT_KARYVAHI.length} mandatory + ${checklistItems.length} checklist)` +
      ` queryElapsed=${_t() - tPostCommit}ms` +
      ` t=${_t()}`
    );

    if (finalCount < DEFAULT_KARYVAHI.length) {
      throw new Error(
        `Karyvahi post-commit verification failed: ` +
        `expected ≥ ${DEFAULT_KARYVAHI.length} rows but found ${finalCount}. ` +
        `FIR ID: ${firId}`
      );
    }

  } catch (e) {
    if (txState !== 'COMMITTED') {
      try { await db.execAsync('ROLLBACK'); } catch { /* rollback error ignored */ }
      logger.error(`[TRACE] seedFIRKaryvahi ROLLBACK — txState="${txState}" firId="${firId}" t=${_t()} error:`, e);
    }
    throw e;
  }
  logger.warn(`[TRACE] seedFIRKaryvahi EXIT OK t=${_t()}`);
}

// ─── Write (officer-initiated mutations) ─────────────────────────────────────

/**
 * Returns the next sort_order for a manually added Karyvahi entry.
 * Reads all rows (no column-name dependency in WHERE) and derives max in JS.
 */
export async function getNextKaryvahiSortOrder(firId: string): Promise<number> {
  const db = await getDatabase();
  try {
    // Exclude soft-deleted rows so that a deleted Karyvahi with a high sort_order
    // does not inflate the next value for newly added active entries.
    const rows = await db.getAllAsync<{ sort_order: number }>(
      'SELECT sort_order FROM fir_karyvahi WHERE fir_id = ? AND deleted_at IS NULL',
      [firId]
    );
    if (rows.length === 0) return 100;
    const max = rows.reduce(
      (m, r) => Math.max(m, typeof r.sort_order === 'number' ? r.sort_order : 0),
      0
    );
    return max + 1;
  } catch {
    return 100;
  }
}

export async function createKaryvahi(input: FIRKaryvahiInput): Promise<FIRKaryvahi> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  const hasSortOrder = isFirKaryvahiSortOrderAvailable();

  // Dual INSERT path — mirrors seedFIRKaryvahi for schema compatibility.
  // On devices where the sort_order migration never ran, omit the column
  // entirely; ordering falls back to created_at (same JS comparator in
  // getKaryvahiByFIR treats undefined sort_order as 999).
  if (hasSortOrder) {
    await db.runAsync(
      `INSERT INTO fir_karyvahi
         (id, fir_id, name, precautions, is_completed, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, input.fir_id, input.name, input.precautions ?? null, input.sort_order, now, now]
    );
  } else {
    await db.runAsync(
      `INSERT INTO fir_karyvahi
         (id, fir_id, name, precautions, is_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, input.fir_id, input.name, input.precautions ?? null, now, now]
    );
  }
  return { id, ...input, is_completed: 0, created_at: now, updated_at: now };
}


// ─── Execution types & helpers (v250) ────────────────────────────────────────

export interface KaryvahiExecution {
  id: string;
  fir_karyvahi_id: string;
  case_diary_id: string;
  case_id: string;
  execution_number: number;
  narrative_before?: string;
  template_used?: string;
  generated_text?: string;
  officer?: string;
  created_at: number;
}

/** Returns all executions for a karyvahi, newest first. */
export async function getExecutionsByKaryvahi(firKaryvahiId: string): Promise<KaryvahiExecution[]> {
  const db = await getDatabase();
  return db.getAllAsync<KaryvahiExecution>(
    'SELECT * FROM karyvahi_executions WHERE fir_karyvahi_id = ? ORDER BY execution_number DESC',
    [firKaryvahiId]
  );
}

/**
 * Adds a new execution and bumps execution_count (derived — never manual).
 * Returns the newly created execution record.
 */
export async function addExecution(input: {
  fir_karyvahi_id: string;
  case_diary_id: string;
  case_id: string;
  narrative_before?: string;
  template_used?: string;
  generated_text?: string;
  officer?: string;
}): Promise<KaryvahiExecution> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  const countRow = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM karyvahi_executions WHERE fir_karyvahi_id = ?',
    [input.fir_karyvahi_id]
  );
  const execNum = (countRow?.cnt ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO karyvahi_executions
       (id, fir_karyvahi_id, case_diary_id, case_id, execution_number,
        narrative_before, template_used, generated_text, officer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.fir_karyvahi_id, input.case_diary_id, input.case_id, execNum,
     input.narrative_before ?? null, input.template_used ?? null,
     input.generated_text ?? null, input.officer ?? null, now]
  );
  await recalcExecutionCount(input.fir_karyvahi_id, input.case_id);
  return { id, ...input, execution_number: execNum, created_at: now };
}

/** Removes a single execution and recomputes execution_count. */
export async function removeExecution(
  executionId: string, firKaryvahiId: string, firId: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM karyvahi_executions WHERE id = ?', [executionId]);
  await recalcExecutionCount(firKaryvahiId, firId);
}

/**
 * Recomputes execution_count from karyvahi_executions and syncs is_completed.
 * This is the ONLY function allowed to set is_completed on fir_karyvahi.
 */
export async function recalcExecutionCount(firKaryvahiId: string, firId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM karyvahi_executions WHERE fir_karyvahi_id = ?',
    [firKaryvahiId]
  );
  const count = row?.cnt ?? 0;
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE fir_karyvahi SET execution_count = ?, is_completed = ?, updated_at = ? WHERE id = ?',
    [count, count > 0 ? 1 : 0, now, firKaryvahiId]
  );
  await updateFIRStatus(firId);
  return count;
}

/**
 * v250 one-time startup migration: backfill all is_completed=1 fir_karyvahi rows
 * that have no karyvahi_executions record yet.
 *
 * Design guarantees:
 *  - Idempotent: checks COUNT(*) in karyvahi_executions for each row before
 *    inserting — if any execution already exists, that row is skipped.
 *  - Transactional: the entire backfill runs inside a single
 *    withTransactionAsync so a mid-run failure leaves zero partial writes.
 *    On failure the error is re-thrown to the caller; the one-time flag in
 *    app_migrations must NOT be set by the caller until this resolves cleanly.
 *  - All-FIRs: iterates every fir_karyvahi row (no firId filter) so callers
 *    do not need to know FIR IDs in advance.
 *  - Logging: emits a single summary line so it's visible in console logs
 *    and DevOptions → Log Viewer that the migration ran exactly once.
 *
 * Returns { backfilled, firCount } for the caller to log / assert.
 */
export async function migrateCompletedToExecutions(): Promise<{ backfilled: number; firCount: number }> {
  const db = await getDatabase();
  const now = nowTimestamp();

  // Gather all is_completed=1 rows that have no executions yet — across every FIR.
  // The LEFT JOIN + e.id IS NULL pattern is a single SQL scan; faster than N+1
  // SELECT COUNT(*) queries and avoids holding data in JS during the transaction.
  const candidates = await db.getAllAsync<{
    id: string;
    fir_id: string;
    completed_by_diary_id: string | null;
  }>(
    `SELECT k.id, k.fir_id, k.completed_by_diary_id
     FROM   fir_karyvahi k
     LEFT   JOIN karyvahi_executions e ON e.fir_karyvahi_id = k.id
     WHERE  k.is_completed = 1
       AND  k.deleted_at IS NULL
       AND  e.id IS NULL`
  );

  if (candidates.length === 0) {
    console.info('[Migration] v250 — no backfill needed (0 orphan rows found)');
    return { backfilled: 0, firCount: 0 };
  }

  // Run all inserts inside a single transaction.
  // withTransactionAsync rolls back automatically on exception.
  await db.withTransactionAsync(async () => {
    for (const row of candidates) {
      const diaryId = row.completed_by_diary_id ?? 'migrated';
      await db.runAsync(
        `INSERT INTO karyvahi_executions
           (id, fir_karyvahi_id, case_diary_id, case_id, execution_number, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [generateUUID(), row.id, diaryId, row.fir_id, now]
      );
      await db.runAsync(
        'UPDATE fir_karyvahi SET execution_count = 1, updated_at = ? WHERE id = ?',
        [now, row.id]
      );
    }
  });

  const firCount = new Set(candidates.map((r) => r.fir_id)).size;
  console.info(
    `[Migration] v250 backfilled ${candidates.length} execution records across ${firCount} FIR(s)`
  );
  return { backfilled: candidates.length, firCount };
}

/** @deprecated v250: completion is derived from execution_count. Use addExecution/removeExecution. */
export async function toggleKaryvahiComplete(id: string, firId: string, isCompleted: boolean): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE fir_karyvahi SET is_completed = ?, updated_at = ? WHERE id = ?',
    [isCompleted ? 0 : 1, now, id]
  );
  await updateFIRStatus(firId);
}

/**
 * Phase 1: Update the rich status (+ optional reason / due_date) of a karyvahi.
 * Keeps is_completed in sync: COMPLETED → 1, all other states → 0.
 * When the new status is COMPLETED the execution_count / is_completed path
 * continues to be the source of truth; this function only records the status
 * label + reason fields that the execution system does not touch.
 */
export async function updateKaryvahiStatus(
  id: string,
  firId: string,
  status: KaryvahiStatus,
  opts?: { not_applicable_reason?: string; deferred_reason?: string; due_date?: string }
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const isCompleted = status === 'COMPLETED' ? 1 : 0;
  await db.runAsync(
    `UPDATE fir_karyvahi
        SET status = ?, is_completed = ?,
            not_applicable_reason = ?, deferred_reason = ?, due_date = ?,
            updated_at = ?
      WHERE id = ?`,
    [
      status,
      isCompleted,
      opts?.not_applicable_reason ?? null,
      opts?.deferred_reason       ?? null,
      opts?.due_date              ?? null,
      now,
      id,
    ]
  );
  await updateFIRStatus(firId);

  // Phase 3: auto-unlock any dependents whose all blockers are now COMPLETED
  if (status === 'COMPLETED') {
    try {
      await unlockDependentsOf(id, firId);
    } catch (e) {
      // Non-fatal: log but don't block the status update
      logger.warn('[Phase3] unlockDependentsOf failed:', e);
    }
  }
}

export async function updateKaryvahi(id: string, firId: string, name: string, precautions?: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE fir_karyvahi SET name = ?, precautions = ?, updated_at = ? WHERE id = ?',
    [name, precautions ?? null, now, id]
  );
  await updateFIRStatus(firId);
}

export async function deleteKaryvahi(id: string, firId: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE fir_karyvahi SET deleted_at = ? WHERE id = ?', [now, id]);
  await updateFIRStatus(firId);
}

/**
 * Toggle the diary-queue flag on a fir_karyvahi row.
 * queued = true  → queued_for_diary = 1 (show in Diary tab pending section)
 * queued = false → queued_for_diary = 0 (remove from pending section)
 * Also bumps updated_at so useFocusEffect reloads see a fresh timestamp.
 */
export async function updateKaryvahiQueuedFlag(
  id: string,
  firId: string,
  queued: boolean,
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE fir_karyvahi SET queued_for_diary = ?, updated_at = ? WHERE id = ? AND fir_id = ?`,
    [queued ? 1 : 0, now, id, firId],
  );
}

/**
 * BUG-H1 FIX: Fetch a single karyvahi row by its primary key.
 * Previously this query lived inside add-karyvahi.tsx (a screen file),
 * which directly imported getDatabase — violating the Repository Pattern.
 * All DB access must go through repo functions; screens import only repos.
 */
/**
 * Fetch a single karyvahi row by primary key, scoped to a specific FIR.
 * The firId guard prevents a stale editKaryvahiId (e.g. from a recycled
 * navigation stack pointing at a now-deleted FIR) from loading a row that
 * belongs to a different FIR and pre-filling the edit form with wrong data.
 */
export async function getKaryvahiById(id: string, firId: string): Promise<FIRKaryvahi | null> {
  const db = await getDatabase();
  // ── PROBE: log the exact SQL and parameters ────────────────────────────────
  const sql = 'SELECT * FROM fir_karyvahi WHERE id = ? AND fir_id = ? AND deleted_at IS NULL';
  logger.warn(
    `[PROBE] getKaryvahiById SQL="${sql}"` +
    ` params=["${id}", "${firId}"]` +
    ` t=${Date.now()}`
  );
  const row = await db.getFirstAsync<FIRKaryvahi>(sql, [id, firId]);
  logger.warn(
    `[PROBE] getKaryvahiById result` +
    ` id="${id}"` +
    ` firId="${firId}"` +
    ` found=${row !== null}` +
    (row
      ? ` row.fir_id="${row.fir_id}"` +
        ` row.name="${row.name}"` +
        ` row.deleted_at=${row.deleted_at ?? 'NULL'}`
      : '') +
    ` t=${Date.now()}`
  );
  return row;
}
