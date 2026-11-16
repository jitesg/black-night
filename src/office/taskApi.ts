/**
 * InvestSuite कार्यालय — कागज़ on Supabase: public.tasks + task_assignees (one officer) + task_files / Storage "task-files".
 * Row Level Security decides who may do what (sql/001); this file only shapes the calls.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { officeClient } from './officeApi';
import { b64ToBytes, formToTaskRow, storagePath, type AssigneeStatus, type TaskForm, type TaskListRow } from './taskCore';

export interface PickedFile { uri: string; name: string; mime: string }
export interface TaskFile { id: string; path: string; name: string | null; mime: string | null; created_at: string }

type RawTask = Omit<TaskListRow, 'assignee' | 'fileCount'> & {
  task_assignees: { member_id: string; status: AssigneeStatus; status_note: string | null; updated_at: string }[] | null;
  task_files: { id: string }[] | null;
};

function shape(r: RawTask): TaskListRow {
  const { task_assignees, task_files, ...rest } = r;
  return { ...rest, assignee: task_assignees?.[0] ?? null, fileCount: task_files?.length ?? 0 };
}

const SELECT = 'id, kind, subtype, title, received_on, due_on, created_at, updated_at, closed, fields, task_assignees(member_id, status, status_note, updated_at), task_files(id)';

export async function listTasks(): Promise<TaskListRow[]> {
  const { data, error } = await officeClient().from('tasks').select(SELECT).in('kind', ['petition', 'court']).order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return ((data ?? []) as unknown as RawTask[]).map(shape);
}

export async function getTask(id: string): Promise<TaskListRow | null> {
  const { data, error } = await officeClient().from('tasks').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? shape(data as unknown as RawTask) : null;
}

export async function listTaskFiles(taskId: string): Promise<TaskFile[]> {
  const { data, error } = await officeClient().from('task_files').select('id, path, name, mime, created_at').eq('task_id', taskId).order('created_at');
  if (error) throw error;
  return (data ?? []) as TaskFile[];
}

/** Short-lived link to look at a file (private bucket). */
export async function fileUrl(path: string): Promise<string> {
  const { data, error } = await officeClient().storage.from('task-files').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function uploadFiles(thanaId: string, taskId: string, memberId: string, files: PickedFile[]): Promise<number> {
  const sb = officeClient();
  let failed = 0;
  for (const f of files) {
    try {
      const b64 = await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.Base64 });
      const path = storagePath(thanaId, taskId, f.name);
      const body = b64ToBytes(b64).slice().buffer; // ArrayBuffer — what supabase-js expects on React Native
      const { error } = await sb.storage.from('task-files').upload(path, body, { contentType: f.mime || 'application/octet-stream', upsert: false });
      if (error) throw error;
      const { error: e2 } = await sb.from('task_files').insert({ task_id: taskId, path, name: f.name, mime: f.mime, added_by: memberId });
      if (e2) throw e2;
    } catch { failed += 1; }
  }
  return failed;
}

/** New कागज़ → one officer. Returns how many files could not be uploaded (the कागज़ itself is saved). */
export async function sendTask(input: { thanaId: string; me: string; form: TaskForm; memberId: string; files: PickedFile[] }): Promise<{ id: string; failedFiles: number }> {
  const sb = officeClient();
  const row = formToTaskRow(input.form);
  const { data, error } = await sb.from('tasks').insert({ ...row, thana_id: input.thanaId, created_by: input.me }).select('id').single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  const { error: e2 } = await sb.from('task_assignees').insert({ task_id: id, member_id: input.memberId });
  if (e2) { await sb.from('tasks').delete().eq('id', id); throw e2; }
  const failedFiles = await uploadFiles(input.thanaId, id, input.me, input.files);
  return { id, failedFiles };
}

/** Edit (owner: office can change a sent कागज़). A new officer replaces the old one (status starts again at "भेजा"). */
export async function updateTask(input: { id: string; thanaId: string; me: string; form: TaskForm; memberId: string; oldMemberId: string | null; files: PickedFile[] }): Promise<{ failedFiles: number }> {
  const sb = officeClient();
  const row = formToTaskRow(input.form);
  const { error } = await sb.from('tasks').update(row).eq('id', input.id);
  if (error) throw error;
  if (input.memberId !== input.oldMemberId) {
    if (input.oldMemberId) await sb.from('task_assignees').delete().eq('task_id', input.id).eq('member_id', input.oldMemberId);
    const { error: e2 } = await sb.from('task_assignees').insert({ task_id: input.id, member_id: input.memberId });
    if (e2) throw e2;
  }
  const failedFiles = await uploadFiles(input.thanaId, input.id, input.me, input.files);
  return { failedFiles };
}

export async function setCancelled(id: string, cancelled: boolean): Promise<void> {
  const { error } = await officeClient().from('tasks').update({ closed: cancelled }).eq('id', id);
  if (error) throw error;
}

/** "दोबारा भेजें" after the officer removed it from the phone. */
export async function resend(taskId: string, memberId: string): Promise<void> {
  const { error } = await officeClient().from('task_assignees').update({ status: 'sent', status_note: null }).eq('task_id', taskId).eq('member_id', memberId);
  if (error) throw error;
}

export async function removeTaskFile(file: TaskFile): Promise<void> {
  const sb = officeClient();
  await sb.storage.from('task-files').remove([file.path]);
  const { error } = await sb.from('task_files').delete().eq('id', file.id);
  if (error) throw error;
}
