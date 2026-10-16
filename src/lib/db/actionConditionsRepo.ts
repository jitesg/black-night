/**
 * actionConditionsRepo.ts — Phase 3: Dependency Engine
 *
 * An "action condition" links one prerequisite karyvahi (blocker_id) to one
 * dependent karyvahi (dependent_id) within the same FIR.  When the blocker
 * reaches COMPLETED status, the dependent is automatically unlocked (its
 * is_locked flag is cleared and its status stays PENDING).
 *
 * Schema (see database.ts _ensureColumn guards):
 *   action_conditions
 *     id           TEXT PK
 *     fir_id       TEXT NOT NULL
 *     blocker_id   TEXT NOT NULL  → fir_karyvahi.id
 *     dependent_id TEXT NOT NULL  → fir_karyvahi.id
 *     created_at   INTEGER NOT NULL
 *
 *   fir_karyvahi.is_locked   INTEGER DEFAULT 0
 *     1 = locked (waiting for a blocker), 0 = unlocked / no condition
 *
 * Public API (all async):
 *   addCondition()           — link blocker → dependent
 *   removeCondition()        — remove a single link
 *   getConditionsForFIR()    — all conditions for a FIR (for UI rendering)
 *   getBlockersFor()         — which blockers does a dependent wait on?
 *   getDependentsOf()        — which dependents does a blocker unlock?
 *   unlockDependentsOf()     — called by updateKaryvahiStatus after COMPLETED;
 *                              unlocks any dependent whose ALL blockers are done
 *   isLocked()               — quick boolean check for a single karyvahi
 */

import { getDatabase, generateUUID, nowTimestamp } from './database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionCondition {
  id: string;
  fir_id: string;
  blocker_id: string;
  dependent_id: string;
  created_at: number;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Create a dependency: `dependentId` is locked until `blockerId` is COMPLETED.
 * Immediately sets fir_karyvahi.is_locked = 1 on the dependent row.
 * Idempotent: silently returns the existing record if the pair already exists.
 */
export async function addCondition(
  firId: string,
  blockerId: string,
  dependentId: string,
): Promise<ActionCondition> {
  const db = await getDatabase();

  // Check for existing pair first — idempotent
  const existing = await db.getFirstAsync<ActionCondition>(
    `SELECT * FROM action_conditions
     WHERE fir_id = ? AND blocker_id = ? AND dependent_id = ?`,
    [firId, blockerId, dependentId],
  );
  if (existing) return existing;

  const id  = generateUUID();
  const now = nowTimestamp();

  await db.runAsync(
    `INSERT INTO action_conditions (id, fir_id, blocker_id, dependent_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, firId, blockerId, dependentId, now],
  );

  // Lock the dependent immediately
  await db.runAsync(
    `UPDATE fir_karyvahi SET is_locked = 1, updated_at = ? WHERE id = ?`,
    [now, dependentId],
  );

  return { id, fir_id: firId, blocker_id: blockerId, dependent_id: dependentId, created_at: now };
}

/** Remove a specific blocker → dependent link and re-evaluate lock state. */
export async function removeCondition(conditionId: string): Promise<void> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ dependent_id: string; fir_id: string }>(
    `SELECT dependent_id, fir_id FROM action_conditions WHERE id = ?`,
    [conditionId],
  );
  if (!row) return;

  await db.runAsync(`DELETE FROM action_conditions WHERE id = ?`, [conditionId]);

  // Re-evaluate: if no more blockers remain, unlock the dependent
  await _reEvaluateLock(row.dependent_id, row.fir_id);
}

/** All conditions for a FIR — used for UI (dependency graph view). */
export async function getConditionsForFIR(firId: string): Promise<ActionCondition[]> {
  const db = await getDatabase();
  return db.getAllAsync<ActionCondition>(
    `SELECT * FROM action_conditions WHERE fir_id = ? ORDER BY created_at ASC`,
    [firId],
  );
}

/** All blocker karyvahi IDs that a dependent is waiting on. */
export async function getBlockersFor(dependentId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ blocker_id: string }>(
    `SELECT blocker_id FROM action_conditions WHERE dependent_id = ?`,
    [dependentId],
  );
  return rows.map((r) => r.blocker_id);
}

/** All dependent karyvahi IDs that will be unlocked when blockerId completes. */
export async function getDependentsOf(blockerId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ dependent_id: string }>(
    `SELECT dependent_id FROM action_conditions WHERE blocker_id = ?`,
    [blockerId],
  );
  return rows.map((r) => r.dependent_id);
}

/**
 * Quick is-locked check for a single karyvahi.
 * Reads the is_locked column (set by addCondition / _reEvaluateLock).
 */
export async function isLocked(karyvahiId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ is_locked: number }>(
    `SELECT is_locked FROM fir_karyvahi WHERE id = ?`,
    [karyvahiId],
  );
  return (row?.is_locked ?? 0) === 1;
}

// ── Core trigger ──────────────────────────────────────────────────────────────

/**
 * Called by updateKaryvahiStatus (firKaryvahiRepo) immediately after a karyvahi
 * reaches COMPLETED.  For every dependent of `completedId`, re-evaluates whether
 * ALL its blockers are now COMPLETED — and if so, clears is_locked.
 *
 * Returns the list of karyvahi IDs that were unlocked (may be empty).
 */
export async function unlockDependentsOf(
  completedId: string,
  firId: string,
): Promise<string[]> {
  const db        = await getDatabase();
  const now       = nowTimestamp();
  const unlocked: string[] = [];

  // 1. Find all dependents of this blocker
  const depRows = await db.getAllAsync<{ dependent_id: string }>(
    `SELECT dependent_id FROM action_conditions WHERE blocker_id = ? AND fir_id = ?`,
    [completedId, firId],
  );
  if (depRows.length === 0) return unlocked;

  for (const { dependent_id } of depRows) {
    // 2. Check whether ALL blockers for this dependent are now COMPLETED
    const allDone = await _allBlockersCompleted(dependent_id, firId);
    if (allDone) {
      await db.runAsync(
        `UPDATE fir_karyvahi SET is_locked = 0, updated_at = ? WHERE id = ?`,
        [now, dependent_id],
      );
      unlocked.push(dependent_id);
    }
  }

  return unlocked;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** True when every blocker of `dependentId` has status = COMPLETED or execution_count > 0. */
async function _allBlockersCompleted(dependentId: string, firId: string): Promise<boolean> {
  const db = await getDatabase();

  // Join action_conditions with fir_karyvahi to count incomplete blockers in one query
  const row = await db.getFirstAsync<{ incomplete: number }>(
    `SELECT COUNT(*) AS incomplete
     FROM action_conditions ac
     JOIN fir_karyvahi k ON k.id = ac.blocker_id
     WHERE ac.dependent_id = ?
       AND ac.fir_id       = ?
       AND k.deleted_at    IS NULL
       AND (k.status != 'COMPLETED' AND (k.execution_count IS NULL OR k.execution_count = 0))`,
    [dependentId, firId],
  );
  return (row?.incomplete ?? 1) === 0;
}

/**
 * Re-evaluate and set is_locked for `dependentId` based on current blocker states.
 * Called after removeCondition so the dependent is unlocked if no blockers remain.
 */
async function _reEvaluateLock(dependentId: string, firId: string): Promise<void> {
  const db  = await getDatabase();
  const now = nowTimestamp();

  // Count remaining conditions for this dependent
  const condRow = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM action_conditions WHERE dependent_id = ?`,
    [dependentId],
  );
  const hasConditions = (condRow?.n ?? 0) > 0;

  if (!hasConditions) {
    // No conditions left → always unlocked
    await db.runAsync(
      `UPDATE fir_karyvahi SET is_locked = 0, updated_at = ? WHERE id = ?`,
      [now, dependentId],
    );
    return;
  }

  const allDone = await _allBlockersCompleted(dependentId, firId);
  await db.runAsync(
    `UPDATE fir_karyvahi SET is_locked = ?, updated_at = ? WHERE id = ?`,
    [allDone ? 0 : 1, now, dependentId],
  );
}
