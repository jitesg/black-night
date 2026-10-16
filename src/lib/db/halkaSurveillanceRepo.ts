import { getDatabase, generateUUID, nowTimestamp } from './database';

export const CRIMINAL_ACTIVITIES = [
  'शराब बनाना/ बेचना',
  'गांजा बेचना',
  'जुआ खिलाना',
  'सट्टा खिलाना',
  'चोरी का सामान खरीदना',
] as const;

export type CriminalActivity = typeof CRIMINAL_ACTIVITIES[number];

export interface SurveillanceTarget {
  id: string;
  gp_id: string;
  gp_name: string;
  name: string;
  father_name: string;
  criminal_activity: string;
  photo_uri?: string | null;
  created_at: number;
  deleted_at?: number | null;
}

export type SurveillanceTargetInput = Omit<SurveillanceTarget, 'id' | 'created_at' | 'deleted_at'>;

export async function addSurveillanceTarget(input: SurveillanceTargetInput): Promise<SurveillanceTarget> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO surveillance_targets (id, gp_id, gp_name, name, father_name, criminal_activity, photo_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.gp_id, input.gp_name, input.name, input.father_name, input.criminal_activity, input.photo_uri ?? null, now],
  );
  return { id, ...input, created_at: now, deleted_at: null };
}

export async function getSurveillanceTargets(): Promise<SurveillanceTarget[]> {
  const db = await getDatabase();
  return db.getAllAsync<SurveillanceTarget>(
    'SELECT * FROM surveillance_targets WHERE deleted_at IS NULL ORDER BY created_at DESC',
  );
}

export async function updateSurveillanceTarget(id: string, input: Partial<SurveillanceTargetInput>): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = [...entries.map(([, v]) => v), id];
  await db.runAsync(
    `UPDATE surveillance_targets SET ${setClause} WHERE id = ?`,
    values,
  );
}

export async function deleteSurveillanceTarget(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE surveillance_targets SET deleted_at = ? WHERE id = ?',
    [now, id],
  );
}

export async function searchSurveillanceTargets(
  query: string,
  activityFilter?: string,
): Promise<SurveillanceTarget[]> {
  const db = await getDatabase();
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (query.trim()) {
    conditions.push('(name LIKE ? OR father_name LIKE ? OR gp_name LIKE ?)');
    const q = `%${query.trim()}%`;
    params.push(q, q, q);
  }
  if (activityFilter && activityFilter.trim()) {
    conditions.push('criminal_activity = ?');
    params.push(activityFilter.trim());
  }

  const where = conditions.join(' AND ');
  return db.getAllAsync<SurveillanceTarget>(
    `SELECT * FROM surveillance_targets WHERE ${where} ORDER BY created_at DESC`,
    params,
  );
}
