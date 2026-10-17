import type * as SQLite from 'expo-sqlite';
import { logger } from '../logger';
import crimeTaxonomySeed from '../../../assets/seed/crime_taxonomy_seed.json';
import { PLAYBOOKS } from './playbooks';
import { PLAYBOOK_TEXTS } from './playbooks/playbookTexts';
import { parseStepLines } from './playbooks/parse';
import { resolveCrimeKey, resolveCrimeKeys } from './playbooks/crimeIds';
import { CRIME_FILES, SHARED_FILES } from './playbooks/registry';
import { SHARED_EXTRA } from './playbooks/sharedExtra';

export interface PlaybookSeedRow {
  sort_order: number;
  step_code: string;
  phase: string;
  proves: string;
  priority: string;
  task_name: string;
  condition_note: string;
  legal_basis: string;
  why_text: string;
  court_text: string;
  care_text: string;
  risk_text: string;
  steps_text?: string;
  docs_text?: string;
  brief_description?: string;
}

export type PlaybookStep = PlaybookSeedRow;

/**
 * Legacy repair, run once per app start before seeding, idempotent:
 * - For every checklist_items row with non-empty step_code: determine its flat crime id
 *   from the PLAYBOOKS data (the step_code appears under a crime id) — if not found,
 *   from prefix: MUR_ → murder, ATM_ → attempt_to_murder.
 * - DELETE from checklist_item_subtypes where checklist_item_id = that item AND NOT
 *   (LOWER(TRIM(crime_type)) = flat id AND crime_subtype = '').
 * - Ensure exactly ONE link (item, flatId, '') exists (insert if missing).
 */
async function repairLegacyPlaybookLinks(database: SQLite.SQLiteDatabase): Promise<void> {
  const stepCodeToCrimeId = new Map<string, string>();
  for (const { crimeId, steps } of PLAYBOOKS) {
    for (const s of steps) {
      if (s.step_code) {
        stepCodeToCrimeId.set(s.step_code.trim(), crimeId);
      }
    }
  }

  // d) The legacy-repair step (relinking step_code items) must SKIP every step_code present in CRIME_FILES or SHARED_FILES
  const registryStepCodes = new Set<string>();
  for (const cf of CRIME_FILES) {
    const steps = parseStepLines(cf.raw);
    for (const s of steps) {
      if (s.step_code) registryStepCodes.add(s.step_code.trim());
    }
  }
  for (const sf of SHARED_FILES) {
    const steps = parseStepLines(sf.raw);
    for (const s of steps) {
      if (s.step_code) registryStepCodes.add(s.step_code.trim());
    }
  }

  const items = await database.getAllAsync<{ id: string; step_code: string }>(
    `SELECT id, step_code
     FROM checklist_items
     WHERE step_code IS NOT NULL AND TRIM(step_code) != '' AND deleted_at IS NULL`
  );

  for (const item of items) {
    const code = item.step_code.trim();
    if (registryStepCodes.has(code)) {
      continue;
    }

    let flatId = stepCodeToCrimeId.get(code);
    if (!flatId) {
      if (code.startsWith('MUR_')) {
        flatId = 'murder';
      } else if (code.startsWith('ATM_')) {
        flatId = 'attempt_to_murder';
      }
    }
    if (!flatId) continue;

    // Remove any link that is NOT (LOWER(TRIM(crime_type)) = flat id AND crime_subtype = '')
    await database.runAsync(
      `DELETE FROM checklist_item_subtypes
       WHERE checklist_item_id = ?
         AND NOT (LOWER(TRIM(crime_type)) = ? AND crime_subtype = '')`,
      [item.id, flatId]
    );

    // Ensure exactly ONE link (item, flatId, '') exists (insert if missing, prune duplicates)
    const matchingLinks = await database.getAllAsync<{ id: string }>(
      `SELECT id FROM checklist_item_subtypes
       WHERE checklist_item_id = ?
         AND LOWER(TRIM(crime_type)) = ?
         AND crime_subtype = ''`,
      [item.id, flatId]
    );

    if (matchingLinks.length === 0) {
      await database.runAsync(
        `INSERT INTO checklist_item_subtypes (id, checklist_item_id, crime_type, crime_subtype)
         VALUES (lower(hex(randomblob(16))), ?, ?, '')`,
        [item.id, flatId]
      );
    } else if (matchingLinks.length > 1) {
      const extraIds = matchingLinks.slice(1).map((l) => l.id);
      const placeholders = extraIds.map(() => '?').join(',');
      await database.runAsync(
        `DELETE FROM checklist_item_subtypes WHERE id IN (${placeholders})`,
        extraIds
      );
    }
  }
}

/**
 * Seeds structured playbook investigation steps for supported crime types.
 *
 * Runs inside database initialisation. Uses the provided open SQLite database
 * instance and does NOT import './database' to prevent deadlocks or import cycles.
 */
export async function ensurePlaybookSeeded(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // 1. Legacy link repair (idempotent, once per app start before seeding)
    await repairLegacyPlaybookLinks(database);

    const validCrimeIds = new Set<string>(
      (crimeTaxonomySeed.crimeTypes as Array<{ id: string }>).map((c) => c.id)
    );

    for (const { crimeId, steps } of PLAYBOOKS) {
      if (!validCrimeIds.has(crimeId)) {
        console.warn(
          `[playbookSeed] Skipping crimeId "${crimeId}" as it does not exist in crime_taxonomy_seed.json.`
        );
        continue;
      }

      await database.withTransactionAsync(async () => {
        const now = Math.floor(Date.now() / 1000);

        for (const row of steps) {
          const stepsText =
            row.steps_text?.trim() ||
            PLAYBOOK_TEXTS[row.step_code]?.steps_text ||
            '';
          const docsText =
            row.docs_text?.trim() ||
            PLAYBOOK_TEXTS[row.step_code]?.docs_text ||
            '';

          // a) SELECT the non-deleted checklist_items row with this step_code
          const existing = await database.getFirstAsync<{
            id: string;
            task_name: string;
            brief_description: string;
            priority: string;
            sort_order: number;
            step_code: string;
            phase: string;
            proves: string;
            condition_note: string;
            legal_basis: string;
            why_text: string;
            court_text: string;
            care_text: string;
            risk_text: string;
            steps_text: string | null;
            docs_text: string | null;
          }>(
            `SELECT id, task_name, brief_description, priority, sort_order, step_code,
                    phase, proves, condition_note, legal_basis, why_text, court_text,
                    care_text, risk_text, steps_text, docs_text
             FROM checklist_items
             WHERE step_code = ? AND deleted_at IS NULL
             LIMIT 1`,
            [row.step_code]
          );

          let itemId: string;

          if (!existing) {
            // b) None -> INSERT with generated id in SQL lower(hex(randomblob(16)))
            const idRow = await database.getFirstAsync<{ id: string }>(
              'SELECT lower(hex(randomblob(16))) AS id'
            );
            itemId = idRow!.id;

            await database.runAsync(
              `INSERT INTO checklist_items (
                id, checklist_id, serial_no, task_name, brief_description, priority,
                sort_order, source, editable, created_at, updated_at,
                step_code, phase, proves, condition_note, legal_basis,
                why_text, court_text, care_text, risk_text, steps_text, docs_text
              ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'system', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                itemId,
                row.sort_order,
                row.task_name,
                row.why_text,
                row.priority,
                1000 + row.sort_order,
                now,
                now,
                row.step_code,
                row.phase,
                row.proves,
                row.condition_note,
                row.legal_basis,
                row.why_text,
                row.court_text,
                row.care_text,
                row.risk_text,
                stepsText,
                docsText,
              ]
            );
          } else {
            // c) Exists -> UPDATE only when some value differs
            itemId = existing.id;
            const targetSortOrder = 1000 + row.sort_order;
            const isDifferent =
              existing.task_name !== row.task_name ||
              existing.brief_description !== row.why_text ||
              existing.priority !== row.priority ||
              existing.sort_order !== targetSortOrder ||
              (existing.phase ?? '') !== (row.phase ?? '') ||
              (existing.proves ?? '') !== (row.proves ?? '') ||
              (existing.condition_note ?? '') !== (row.condition_note ?? '') ||
              (existing.legal_basis ?? '') !== (row.legal_basis ?? '') ||
              (existing.why_text ?? '') !== (row.why_text ?? '') ||
              (existing.court_text ?? '') !== (row.court_text ?? '') ||
              (existing.care_text ?? '') !== (row.care_text ?? '') ||
              (existing.risk_text ?? '') !== (row.risk_text ?? '') ||
              (existing.steps_text ?? '') !== stepsText ||
              (existing.docs_text ?? '') !== docsText;

            if (isDifferent) {
              await database.runAsync(
                `UPDATE checklist_items SET
                  task_name = ?,
                  brief_description = ?,
                  priority = ?,
                  sort_order = ?,
                  step_code = ?,
                  phase = ?,
                  proves = ?,
                  condition_note = ?,
                  legal_basis = ?,
                  why_text = ?,
                  court_text = ?,
                  care_text = ?,
                  risk_text = ?,
                  steps_text = ?,
                  docs_text = ?,
                  updated_at = ?
                WHERE id = ?`,
                [
                  row.task_name,
                  row.why_text,
                  row.priority,
                  targetSortOrder,
                  row.step_code,
                  row.phase,
                  row.proves,
                  row.condition_note,
                  row.legal_basis,
                  row.why_text,
                  row.court_text,
                  row.care_text,
                  row.risk_text,
                  stepsText,
                  docsText,
                  now,
                  itemId,
                ]
              );
            }
          }

          // d) Link: make sure exactly one checklist_item_subtypes row with
          // crime_type = crimeId and crime_subtype = '' exists for the item,
          // and DELETE any other link rows of this item.
          await database.runAsync(
            `DELETE FROM checklist_item_subtypes
             WHERE checklist_item_id = ?
               AND NOT (LOWER(TRIM(crime_type)) = ? AND crime_subtype = '')`,
            [itemId, crimeId]
          );

          const matchingLinks = await database.getAllAsync<{ id: string }>(
            `SELECT id FROM checklist_item_subtypes
             WHERE checklist_item_id = ?
               AND LOWER(TRIM(crime_type)) = ?
               AND crime_subtype = ''`,
            [itemId, crimeId]
          );

          if (matchingLinks.length === 0) {
            await database.runAsync(
              `INSERT INTO checklist_item_subtypes (id, checklist_item_id, crime_type, crime_subtype)
               VALUES (lower(hex(randomblob(16))), ?, ?, '')`,
              [itemId, crimeId]
            );
          } else if (matchingLinks.length > 1) {
            const extraIds = matchingLinks.slice(1).map((l) => l.id);
            const placeholders = extraIds.map(() => '?').join(',');
            await database.runAsync(
              `DELETE FROM checklist_item_subtypes WHERE id IN (${placeholders})`,
              extraIds
            );
          }
        }
      });
    }

    // 3. Process CRIME_FILES and SHARED_FILES (Playbook infrastructure v3)
    try {
      const activeKeys = new Set<string>(CRIME_FILES.map((cf) => cf.crimeKey));

      // b) Crime files: parse; upsert each step by step_code (insert if missing; update only if a field differs)
      // links for the item = exactly resolveCrimeKeys(crimeKey) with crime_subtype '' (add missing, delete others)
      for (const cf of CRIME_FILES) {
        const flatIds = resolveCrimeKeys(cf.crimeKey);
        if (flatIds.length === 0) {
          logger.warn(
            `[playbookSeed] Skipping crime file with key "${cf.crimeKey}": could not resolve flat crime id.`
          );
          continue;
        }

        const steps = parseStepLines(cf.raw);
        await database.withTransactionAsync(async () => {
          const now = Math.floor(Date.now() / 1000);
          for (const step of steps) {
            const itemId = await upsertChecklistStep(database, step, now);
            await setChecklistItemLinks(database, itemId, flatIds);
          }
        });
      }

      // c) Shared files: parse; upsert each step the same way;
      // target ids = resolveCrimeKeys(k) for each k in (links[step_code] UNION SHARED_EXTRA[step_code]) that is ALSO in activeKeys;
      // set the item's links to exactly that set (delete others, add missing). Empty set = item exists with no links.
      for (const sf of SHARED_FILES) {
        const steps = parseStepLines(sf.raw);
        await database.withTransactionAsync(async () => {
          const now = Math.floor(Date.now() / 1000);
          for (const step of steps) {
            const itemId = await upsertChecklistStep(database, step, now);
            const baseKeys = sf.links[step.step_code] || [];
            const extraKeys = SHARED_EXTRA[step.step_code] || [];
            const combinedKeys = Array.from(new Set([...baseKeys, ...extraKeys]));
            const targetIds = combinedKeys
              .filter((k) => activeKeys.has(k))
              .flatMap((k) => resolveCrimeKeys(k));

            await setChecklistItemLinks(database, itemId, targetIds);
          }
        });
      }
    } catch (err) {
      logger.warn('[playbookSeed] Error processing CRIME_FILES or SHARED_FILES:', err);
    }
  } catch (err) {
    logger.warn('[playbookSeed] Error while seeding playbook items:', err);
  }
}

async function upsertChecklistStep(
  database: SQLite.SQLiteDatabase,
  row: PlaybookStep,
  now: number
): Promise<string> {
  const stepsText = row.steps_text || '';
  const docsText = row.docs_text || '';
  const briefDesc = row.brief_description || row.why_text || '';
  const targetSortOrder = row.sort_order;

  const existing = await database.getFirstAsync<{
    id: string;
    task_name: string;
    brief_description: string;
    priority: string;
    sort_order: number;
    step_code: string;
    phase: string;
    proves: string;
    condition_note: string;
    legal_basis: string;
    why_text: string;
    court_text: string;
    care_text: string;
    risk_text: string;
    steps_text: string | null;
    docs_text: string | null;
  }>(
    `SELECT id, task_name, brief_description, priority, sort_order, step_code,
            phase, proves, condition_note, legal_basis, why_text, court_text,
            care_text, risk_text, steps_text, docs_text
     FROM checklist_items
     WHERE step_code = ? AND deleted_at IS NULL
     LIMIT 1`,
    [row.step_code]
  );

  let itemId: string;

  if (!existing) {
    const idRow = await database.getFirstAsync<{ id: string }>(
      'SELECT lower(hex(randomblob(16))) AS id'
    );
    itemId = idRow!.id;

    await database.runAsync(
      `INSERT INTO checklist_items (
        id, checklist_id, serial_no, task_name, brief_description, priority,
        sort_order, source, editable, created_at, updated_at,
        step_code, phase, proves, condition_note, legal_basis,
        why_text, court_text, care_text, risk_text, steps_text, docs_text
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'system', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        targetSortOrder,
        row.task_name,
        briefDesc,
        row.priority,
        targetSortOrder,
        now,
        now,
        row.step_code,
        row.phase,
        row.proves,
        row.condition_note,
        row.legal_basis,
        row.why_text,
        row.court_text,
        row.care_text,
        row.risk_text,
        stepsText,
        docsText,
      ]
    );
  } else {
    itemId = existing.id;
    const isDifferent =
      existing.task_name !== row.task_name ||
      existing.brief_description !== briefDesc ||
      existing.priority !== row.priority ||
      existing.sort_order !== targetSortOrder ||
      (existing.phase ?? '') !== (row.phase ?? '') ||
      (existing.proves ?? '') !== (row.proves ?? '') ||
      (existing.condition_note ?? '') !== (row.condition_note ?? '') ||
      (existing.legal_basis ?? '') !== (row.legal_basis ?? '') ||
      (existing.why_text ?? '') !== (row.why_text ?? '') ||
      (existing.court_text ?? '') !== (row.court_text ?? '') ||
      (existing.care_text ?? '') !== (row.care_text ?? '') ||
      (existing.risk_text ?? '') !== (row.risk_text ?? '') ||
      (existing.steps_text ?? '') !== stepsText ||
      (existing.docs_text ?? '') !== docsText;

    if (isDifferent) {
      await database.runAsync(
        `UPDATE checklist_items SET
          task_name = ?,
          brief_description = ?,
          priority = ?,
          sort_order = ?,
          step_code = ?,
          phase = ?,
          proves = ?,
          condition_note = ?,
          legal_basis = ?,
          why_text = ?,
          court_text = ?,
          care_text = ?,
          risk_text = ?,
          steps_text = ?,
          docs_text = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          row.task_name,
          briefDesc,
          row.priority,
          targetSortOrder,
          row.step_code,
          row.phase,
          row.proves,
          row.condition_note,
          row.legal_basis,
          row.why_text,
          row.court_text,
          row.care_text,
          row.risk_text,
          stepsText,
          docsText,
          now,
          itemId,
        ]
      );
    }
  }

  return itemId;
}

async function setChecklistItemLinks(
  database: SQLite.SQLiteDatabase,
  itemId: string,
  targetCrimeIds: string[]
): Promise<void> {
  const uniqueTargets = Array.from(
    new Set(targetCrimeIds.map((id) => id.toLowerCase().trim()).filter((id) => id.length > 0))
  );

  if (uniqueTargets.length === 0) {
    // Empty set = item exists with no links. Delete all existing links for this item.
    await database.runAsync(
      `DELETE FROM checklist_item_subtypes WHERE checklist_item_id = ?`,
      [itemId]
    );
    return;
  }

  // Delete any links that are NOT in targetCrimeIds (or crime_subtype != '')
  const placeholders = uniqueTargets.map(() => '?').join(',');
  await database.runAsync(
    `DELETE FROM checklist_item_subtypes
     WHERE checklist_item_id = ?
       AND NOT (crime_subtype = '' AND LOWER(TRIM(crime_type)) IN (${placeholders}))`,
    [itemId, ...uniqueTargets]
  );

  // For each target crime_type, ensure exactly one row exists with crime_subtype = ''
  for (const crimeId of uniqueTargets) {
    const matching = await database.getAllAsync<{ id: string }>(
      `SELECT id FROM checklist_item_subtypes
       WHERE checklist_item_id = ?
         AND LOWER(TRIM(crime_type)) = ?
         AND crime_subtype = ''`,
      [itemId, crimeId]
    );

    if (matching.length === 0) {
      await database.runAsync(
        `INSERT INTO checklist_item_subtypes (id, checklist_item_id, crime_type, crime_subtype)
         VALUES (lower(hex(randomblob(16))), ?, ?, '')`,
        [itemId, crimeId]
      );
    } else if (matching.length > 1) {
      const extraIds = matching.slice(1).map((m) => m.id);
      const extraPlaceholders = extraIds.map(() => '?').join(',');
      await database.runAsync(
        `DELETE FROM checklist_item_subtypes WHERE id IN (${extraPlaceholders})`,
        extraIds
      );
    }
  }
}
