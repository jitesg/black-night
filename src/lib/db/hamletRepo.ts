import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface Hamlet {
  id: string;
  gp_id: string;
  name: string;
  population?: number;
  remarks?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type HamletInput = Omit<Hamlet, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

export async function getHamletById(id: string): Promise<Hamlet | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Hamlet>(
    'SELECT * FROM hamlets WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

export async function getHamletsByGP(gpId: string): Promise<Hamlet[]> {
  const db = await getDatabase();
  return db.getAllAsync<Hamlet>(
    'SELECT * FROM hamlets WHERE gp_id = ? AND deleted_at IS NULL ORDER BY name ASC',
    [gpId]
  );
}

export async function createHamlet(input: HamletInput): Promise<Hamlet> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    'INSERT INTO hamlets (id, gp_id, name, population, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input.gp_id, input.name, input.population ?? null, input.remarks ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateHamlet(id: string, input: Partial<HamletInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  const values = [...Object.values(input), now, id];
  await db.runAsync(`UPDATE hamlets SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

export async function deleteHamlet(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE hamlets SET deleted_at = ? WHERE id = ?', [nowTimestamp(), id]);
}

export interface HamletWithGP extends Hamlet { gp_name: string }

export async function getAllHamlets(): Promise<HamletWithGP[]> {
  const db = await getDatabase();
  return db.getAllAsync<HamletWithGP>(
    `SELECT h.*, g.name as gp_name FROM hamlets h
     JOIN gram_panchayats g ON g.id = h.gp_id
     WHERE h.deleted_at IS NULL ORDER BY h.name ASC`
  );
}
