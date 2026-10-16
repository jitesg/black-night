/**
 * karyvahiEvidenceRepo.ts — Phase 2: Evidence Linking
 *
 * Manages photo / document attachments for a single fir_karyvahi item.
 * All files are stored on-device using the local_uri returned by
 * expo-image-picker (or expo-document-picker).
 *
 * No cloud upload in Phase 2 — local_uri is the source of truth.
 */

import { getDatabase, generateUUID } from './database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KaryvahiEvidence {
  id: string;
  karyvahi_id: string;
  fir_id: string;
  local_uri: string;
  mime_type: string;
  caption?: string;
  created_at: number; // Unix epoch seconds
}

export type KaryvahiEvidenceInput = {
  karyvahi_id: string;
  fir_id: string;
  local_uri: string;
  mime_type: string;
  caption?: string;
};

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToEvidence(row: Record<string, unknown>): KaryvahiEvidence {
  return {
    id:           row.id          as string,
    karyvahi_id:  row.karyvahi_id as string,
    fir_id:       row.fir_id      as string,
    local_uri:    row.local_uri   as string,
    mime_type:    (row.mime_type  as string) || 'image/jpeg',
    caption:      (row.caption    as string | undefined) ?? undefined,
    created_at:   row.created_at  as number,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Insert a new evidence record and return it. */
export async function addEvidence(input: KaryvahiEvidenceInput): Promise<KaryvahiEvidence> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    `INSERT INTO karyvahi_evidence
       (id, karyvahi_id, fir_id, local_uri, mime_type, caption, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.karyvahi_id, input.fir_id, input.local_uri, input.mime_type, input.caption ?? null, now],
  );

  return {
    id,
    karyvahi_id: input.karyvahi_id,
    fir_id:      input.fir_id,
    local_uri:   input.local_uri,
    mime_type:   input.mime_type,
    caption:     input.caption,
    created_at:  now,
  };
}

/** Fetch all evidence for a karyvahi item, newest first. */
export async function getEvidenceByKaryvahi(karyvahiId: string): Promise<KaryvahiEvidence[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM karyvahi_evidence
     WHERE karyvahi_id = ?
     ORDER BY created_at DESC`,
    [karyvahiId],
  );
  return rows.map(rowToEvidence);
}

/** Update the caption of an evidence record. */
export async function updateEvidenceCaption(id: string, caption: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE karyvahi_evidence SET caption = ? WHERE id = ?`,
    [caption, id],
  );
}

/** Permanently delete a single evidence record. */
export async function deleteEvidence(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM karyvahi_evidence WHERE id = ?`, [id]);
}

/** Count evidence attached to a karyvahi item. */
export async function countEvidence(karyvahiId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM karyvahi_evidence WHERE karyvahi_id = ?`,
    [karyvahiId],
  );
  return row?.n ?? 0;
}
