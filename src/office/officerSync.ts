/**
 * InvestSuite ⇄ कार्यालय (owner, चरण ग, option क): when the app opens / comes back and every ~15–30 min in the background,
 * the कागज़ the थाना कार्यालय sent to this officer are pulled into the phone (प्रार्थना पत्र / न्यायालय rows + their photos /
 * PDFs as "कार्यालय" attachments, phone notification), office edits are applied, and the status goes back (मिला / देखा /
 * निस्तारित / फ़ोन से हटाया). Nothing else leaves the phone — never the आख्या text (owner).
 * Rules: officerSyncCore.ts (tested). Only runs when this phone is joined (officerLink).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '@/lib/db/database';
import { getOfficerLink } from './officerLink';
import { ensureSession, getMe, officeClient } from './officeApi';
import { memberTitle } from './officeCore';
import type { AssigneeStatus } from './taskCore';
import {
  desiredStatus, editedNotice, moduleOf, newMeta, newPaperNotice, officeEdited, parseMeta, planTask, routeFor, taskToCourt, taskToPetition,
  type OfficeMeta, type OfficeModule, type RemoteTask,
} from './officerSyncCore';

export const OFFICE_NOTICE_KIND = 'office';

const TABLE: Record<OfficeModule, string> = { pp: 'prarthna_patra', court: 'nyayalay_documents' };

interface LocalRow { id: string; deleted_at: number | null; status: string; office_json: string | null; office_new: number | null }

async function findLocal(module: OfficeModule, taskId: string): Promise<LocalRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalRow>(
    `SELECT id, deleted_at, status, office_json, office_new FROM ${TABLE[module]} WHERE office_task_id = ? ORDER BY deleted_at IS NULL DESC LIMIT 1`,
    [taskId],
  );
}

async function saveMeta(module: OfficeModule, id: string, meta: OfficeMeta, extra = ''): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE ${TABLE[module]} SET office_json = ?${extra} WHERE id = ?`, [JSON.stringify(meta), id]);
}

const isDone = (module: OfficeModule, status: string) => (module === 'pp' ? status === 'Nistarit' || status === 'Finished' : status === 'Finished');

async function downloadFiles(module: OfficeModule, localId: string, taskId: string, meta: OfficeMeta): Promise<number> {
  const sb = officeClient();
  const { data } = await sb.from('task_files').select('id, path, name, mime').eq('task_id', taskId);
  let added = 0;
  const dir = `${FileSystem.documentDirectory ?? ''}attachments/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => null);
  const { addAttachment } = await import('@/lib/db/attachmentRepo');
  for (const f of (data ?? []) as { id: string; path: string; name: string | null; mime: string | null }[]) {
    if (meta.files.includes(f.id)) continue;
    try {
      const { data: signed, error } = await sb.storage.from('task-files').createSignedUrl(f.path, 600);
      if (error || !signed) continue;
      const safe = (f.name ?? 'file').replace(/[^\w.\-]+/g, '_');
      const dest = `${dir}${Date.now()}_office_${safe}`;
      const r = await FileSystem.downloadAsync(signed.signedUrl, dest);
      if (r.status !== 200) continue;
      const info = await FileSystem.getInfoAsync(dest);
      await addAttachment(module, localId, { uri: dest, name: f.name ?? safe, mime: f.mime ?? 'application/octet-stream', size: info.exists && 'size' in info ? info.size ?? 0 : 0 }, 'office');
      meta.files.push(f.id);
      added += 1;
    } catch { /* try again next run */ }
  }
  return added;
}

async function createLocal(module: OfficeModule, t: RemoteTask, investigator: string): Promise<string> {
  if (module === 'pp') {
    const { createPrarthnaPatra } = await import('@/lib/db/prarthnaPatraRepo');
    const pp = await createPrarthnaPatra(taskToPetition(t, investigator) as never);
    return pp.id;
  }
  const { createNyayalayDocument } = await import('@/lib/db/nyayalayRepo');
  return createNyayalayDocument(taskToCourt(t) as never);
}

/** Office edit → the header fields (people the officer may have corrected stay as they are). */
async function applyEdit(module: OfficeModule, id: string, t: RemoteTask): Promise<void> {
  const db = await getDatabase();
  if (module === 'pp') {
    const p = taskToPetition(t, '');
    await db.runAsync(
      'UPDATE prarthna_patra SET petition_type = ?, date_of_receipt = ?, deadline_date = ?, matter = ?, updated_at = ? WHERE id = ?',
      [p.petition_type, p.date_of_receipt, p.deadline_date, p.matter, Math.floor(Date.now() / 1000), id],
    );
  } else {
    const c = taskToCourt(t);
    await db.runAsync(
      `UPDATE nyayalay_documents SET doc_type = ?, court_name = ?, vad_sankhya = ?, apradh_sankhya = ?, applicable_sections = ?,
       matter = ?, document_title = ?, deadline_date = ?, updated_at = ? WHERE id = ?`,
      [c.doc_type, c.court_name, c.vad_sankhya, c.apradh_sankhya, c.applicable_sections, c.matter, c.document_title, c.deadline_date, Math.floor(Date.now() / 1000), id],
    );
  }
}

async function notify(title: string, body: string, route: string): Promise<void> {
  try {
    const { scheduleLocalNotification } = await import('@/lib/reminderNotifications');
    await scheduleLocalNotification(title, body, null, { kind: OFFICE_NOTICE_KIND, route });
  } catch { /* notifications off — the list still shows "नया" */ }
}

let running: Promise<SyncResult> | null = null;

export interface SyncResult { added: number; edited: number; statusSent: number; error?: string }

/** Pull new / changed कागज़ and send statuses back. Safe to call often (one run at a time). */
export function runOfficerSync(opts: { notify?: boolean } = {}): Promise<SyncResult> {
  if (!getOfficerLink()) return Promise.resolve({ added: 0, edited: 0, statusSent: 0 });
  running ??= doSync(opts.notify !== false).finally(() => { running = null; });
  return running;
}

async function doSync(withNotice: boolean): Promise<SyncResult> {
  const res: SyncResult = { added: 0, edited: 0, statusSent: 0 };
  try {
    await ensureSession();
    const me = await getMe();
    if (!me) return res;
    const sb = officeClient();
    const [{ data: rows, error }, { data: mem }] = await Promise.all([
      sb.from('tasks')
        .select('id, kind, subtype, title, received_on, due_on, created_at, updated_at, closed, created_by, fields, task_assignees!inner(member_id, status)')
        .eq('task_assignees.member_id', me.member.id)
        .in('kind', ['petition', 'court'])
        .order('created_at', { ascending: true })
        .limit(500),
      sb.from('members').select('id, name, role, rank'),
    ]);
    if (error) throw error;
    const nameOf = (id: string | null) => {
      const m = (mem ?? []).find((x) => x.id === id) as { name: string; role: string; rank: string | null } | undefined;
      return m ? `${memberTitle(m)}${m.role === 'cm' || m.role === 'hm' ? ` (${m.role.toUpperCase()})` : ''}` : 'कार्यालय';
    };
    const investigator = memberTitle(me.member);
    let changed = false;

    for (const raw of (rows ?? []) as (Omit<RemoteTask, 'status'> & { task_assignees: { member_id: string; status: AssigneeStatus }[] })[]) {
      const module = moduleOf(raw.kind);
      if (!module) continue;
      const t: RemoteTask = { ...raw, status: raw.task_assignees?.[0]?.status ?? 'sent' };
      let local = await findLocal(module, t.id);
      let meta = parseMeta(local?.office_json);
      const plan = planTask(t, local ? { exists: true, deleted: local.deleted_at !== null } : null, meta);

      if (plan.type === 'skip') continue;
      if (plan.type === 'create') {
        const id = await createLocal(module, t, investigator);
        meta = newMeta(t, nameOf(t.created_by));
        const db = await getDatabase();
        await db.runAsync(`UPDATE ${TABLE[module]} SET office_task_id = ?, office_new = 1 WHERE id = ?`, [t.id, id]);
        await downloadFiles(module, id, t.id, meta);
        await saveMeta(module, id, meta);
        local = await findLocal(module, t.id);
        res.added += 1; changed = true;
        if (withNotice) { const n = newPaperNotice(t); await notify(n.title, n.body, routeFor(module, id)); }
      } else if (plan.type === 'restore' && local && meta) {
        const db = await getDatabase();
        await db.runAsync(`UPDATE ${TABLE[module]} SET deleted_at = NULL, office_new = 1 WHERE id = ?`, [local.id]);
        await db.runAsync('UPDATE module_attachments SET deleted_at = NULL WHERE module = ? AND parent_id = ?', [module, local.id]).catch(() => {});
        local = await findLocal(module, t.id);
        res.added += 1; changed = true;
        if (withNotice) { const n = newPaperNotice(t); await notify(n.title, n.body, routeFor(module, local!.id)); }
      } else if (local && meta && local.deleted_at === null && officeEdited(meta, t)) {
        await applyEdit(module, local.id, t);
        meta.updatedAt = t.updated_at; meta.note = typeof t.fields?.note === 'string' ? (t.fields.note as string) : meta.note;
        meta.cancelled = t.closed;
        await downloadFiles(module, local.id, t.id, meta);
        await saveMeta(module, local.id, meta);
        res.edited += 1; changed = true;
        if (withNotice) { const n = editedNotice(t); await notify(n.title, n.body, routeFor(module, local.id)); }
      }

      // status back to the office
      if (!local || !meta) continue;
      const want = desiredStatus({ exists: true, deleted: local.deleted_at !== null, done: isDone(module, local.status), isNew: !!local.office_new });
      if (want !== t.status) {
        const { error: e2 } = await sb.from('task_assignees').update({ status: want }).eq('task_id', t.id).eq('member_id', me.member.id);
        if (!e2) {
          meta.status = want;
          await saveMeta(module, local.id, meta);
          res.statusSent += 1;
        }
      }
    }
    if (changed) {
      try { const { syncAppNotifications } = await import('@/lib/appNotificationSync'); await syncAppNotifications(); } catch { /* alerts resync next start */ }
    }
  } catch (e) {
    res.error = e instanceof Error ? e.message : String(e);
  }
  return res;
}

/** Opening an office कागज़ → no longer "नया" → office sees "देखा". */
export async function markOfficeSeen(module: OfficeModule, id: string): Promise<void> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ office_new: number | null; office_task_id: string | null }>(`SELECT office_new, office_task_id FROM ${TABLE[module]} WHERE id = ?`, [id]);
  if (!r?.office_task_id || !r.office_new) return;
  await db.runAsync(`UPDATE ${TABLE[module]} SET office_new = 0 WHERE id = ?`, [id]);
  void runOfficerSync({ notify: false });
}

/** After a status change / delete on the phone (repos call this lazily). */
export function queueOfficeSync(): void {
  setTimeout(() => { void runOfficerSync({ notify: false }); }, 1500);
}
