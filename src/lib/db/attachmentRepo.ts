/**
 * attachmentRepo.ts — "संलग्न कागज़" (photos / PDFs) of a प्रार्थना पत्र or a न्यायालय document (owner).
 * Files live in the app's documents folder (persistPickedFile); this table only keeps where they are.
 * `source` = 'self' (added on this phone) or 'office' (came from the कार्यालय app — later; deleting one warns first).
 */
import { getDatabase, generateUUID, nowTimestamp } from './database';

export type AttachmentModule = 'pp' | 'court';
export type AttachmentSource = 'self' | 'office';

export interface Attachment {
  id: string;
  module: AttachmentModule;
  parent_id: string;
  uri: string;
  name: string;
  mime: string;
  size: number;
  source: AttachmentSource;
  created_at: number;
}

/** A file picked on a form before the paper itself is saved (no parent id yet). */
export type PendingAttachment = Pick<Attachment, 'uri' | 'name' | 'mime' | 'size'>;

export function isImageMime(mime: string | null | undefined): boolean {
  return /^image\//i.test(mime ?? '');
}

export async function listAttachments(module: AttachmentModule, parentId: string): Promise<Attachment[]> {
  const db = await getDatabase();
  return db.getAllAsync<Attachment>(
    `SELECT id, module, parent_id, uri, name, mime, size, source, created_at FROM module_attachments
      WHERE module = ? AND parent_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid`,
    [module, parentId],
  );
}

export async function addAttachment(
  module: AttachmentModule, parentId: string, file: PendingAttachment, source: AttachmentSource = 'self',
): Promise<Attachment> {
  const db = await getDatabase();
  const row: Attachment = {
    id: generateUUID(), module, parent_id: parentId, uri: file.uri, name: file.name || 'file',
    mime: file.mime || 'application/octet-stream', size: file.size || 0, source, created_at: nowTimestamp(),
  };
  await db.runAsync(
    `INSERT INTO module_attachments (id, module, parent_id, uri, name, mime, size, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.module, row.parent_id, row.uri, row.name, row.mime, row.size, row.source, row.created_at],
  );
  return row;
}

/** Saves the files picked on an add form once the paper has its id. */
export async function addPendingAttachments(module: AttachmentModule, parentId: string, files: PendingAttachment[]): Promise<void> {
  for (const f of files) {
    try { await addAttachment(module, parentId, f); } catch { /* one failure must not stop the rest */ }
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE module_attachments SET deleted_at = ? WHERE id = ?', [nowTimestamp(), id]);
}

/** When the paper itself is deleted. */
export async function deleteAttachmentsOf(module: AttachmentModule, parentId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE module_attachments SET deleted_at = ? WHERE module = ? AND parent_id = ? AND deleted_at IS NULL',
    [nowTimestamp(), module, parentId],
  );
}

/** parent id → how many files (for the 📎 n on list cards). */
export async function attachmentCounts(module: AttachmentModule): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ parent_id: string; n: number }>(
    `SELECT parent_id, COUNT(*) AS n FROM module_attachments WHERE module = ? AND deleted_at IS NULL GROUP BY parent_id`,
    [module],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.parent_id] = r.n;
  return out;
}
