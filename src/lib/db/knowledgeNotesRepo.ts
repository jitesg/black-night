/**
 * knowledgeNotesRepo.ts
 *
 * Repository for personal notes ("मेरा नोट") attached to Knowledge entries.
 * Backed by table: knowledge_notes(entry_id TEXT PRIMARY KEY, note TEXT NOT NULL, updated_at INTEGER NOT NULL)
 * Never touches system seed rows or content hashes.
 */

import { getDatabase } from './database';

export interface KnowledgeNoteRow {
  entry_id: string;
  note: string;
  updated_at: number;
}

/**
 * Get note text for a given knowledge entry ID, or null if no note exists.
 */
export async function getKnowledgeNote(entryId: string): Promise<string | null> {
  const db = await getDatabase();
  try {
    const row = await db.getFirstAsync<{ note: string }>(
      `SELECT note FROM knowledge_notes WHERE entry_id = ?`,
      [entryId]
    );
    return row?.note?.trim() ? row.note : null;
  } catch (err) {
    console.warn('[knowledgeNotesRepo] getKnowledgeNote error:', err);
    return null;
  }
}

/**
 * Save note text for a knowledge entry.
 * If note is empty or whitespace only, the row is DELETED.
 * Otherwise INSERT OR REPLACE into knowledge_notes.
 */
export async function saveKnowledgeNote(entryId: string, note: string): Promise<void> {
  const db = await getDatabase();
  const trimmed = (note || '').trim();
  const now = Math.floor(Date.now() / 1000);

  if (!trimmed) {
    // Delete row when note is empty
    await db.runAsync(`DELETE FROM knowledge_notes WHERE entry_id = ?`, [entryId]);
  } else {
    // Insert or replace with trimmed or full text (preserve internal formatting)
    await db.runAsync(
      `INSERT OR REPLACE INTO knowledge_notes (entry_id, note, updated_at) VALUES (?, ?, ?)`,
      [entryId, note, now]
    );
  }
}

/**
 * Load all notes as a Map of entry_id -> note string for efficient lookup and badge calculation.
 */
export async function getAllKnowledgeNotesMap(): Promise<Map<string, string>> {
  const db = await getDatabase();
  const map = new Map<string, string>();
  try {
    const rows = await db.getAllAsync<{ entry_id: string; note: string }>(
      `SELECT entry_id, note FROM knowledge_notes WHERE note IS NOT NULL AND note != ''`
    );
    for (const r of rows) {
      if (r.note && r.note.trim()) {
        map.set(r.entry_id, r.note);
      }
    }
  } catch (err) {
    console.warn('[knowledgeNotesRepo] getAllKnowledgeNotesMap error:', err);
  }
  return map;
}

/**
 * Search note texts matching the query and return matching entry_ids.
 */
export async function searchKnowledgeNoteEntryIds(query: string): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const db = await getDatabase();
  try {
    const rows = await db.getAllAsync<{ entry_id: string; note: string }>(
      `SELECT entry_id, note FROM knowledge_notes WHERE note IS NOT NULL AND note != ''`
    );
    const matched: string[] = [];
    for (const r of rows) {
      if (r.note && r.note.toLowerCase().includes(q)) {
        matched.push(r.entry_id);
      }
    }
    return matched;
  } catch (err) {
    console.warn('[knowledgeNotesRepo] searchKnowledgeNoteEntryIds error:', err);
    return [];
  }
}
