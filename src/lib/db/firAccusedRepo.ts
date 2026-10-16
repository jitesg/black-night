import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface FIRAccused {
  id: string;
  fir_id: string;
  is_known: number; // 1 = known, 0 = unknown count row
  name?: string;
  address?: string;
  mobile?: string;
  alt_mobile?: string;
  jati?: string;
  age?: string;
  bail_status: 'unknown' | 'in_jail' | 'on_bail';
  remand_number?: string;
  date_of_remand?: string;
  next_remand_date?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type FIRAccusedInput = Omit<FIRAccused, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

export async function getAccusedByFIR(firId: string): Promise<FIRAccused[]> {
  const db = await getDatabase();
  return db.getAllAsync<FIRAccused>(
    'SELECT * FROM fir_accused WHERE fir_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
    [firId]
  );
}

export async function createAccused(input: FIRAccusedInput): Promise<FIRAccused> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO fir_accused (id, fir_id, is_known, name, address, mobile, alt_mobile, jati, age,
      bail_status, remand_number, date_of_remand, next_remand_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.fir_id, input.is_known ? 1 : 0,
      input.name ?? null, input.address ?? null, input.mobile ?? null,
      input.alt_mobile ?? null, input.jati ?? null, input.age ?? null,
      input.bail_status ?? 'unknown', input.remand_number ?? null,
      input.date_of_remand ?? null, input.next_remand_date ?? null,
      now, now,
    ]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateAccused(id: string, input: Partial<FIRAccusedInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const allowed = [
    'name', 'address', 'mobile', 'alt_mobile', 'jati', 'age',
    'bail_status', 'remand_number', 'date_of_remand', 'next_remand_date',
  ];
  const entries = Object.entries(input).filter(([k]) => allowed.includes(k));
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE fir_accused SET ${sets}, updated_at = ? WHERE id = ?`,
    [...vals, now, id]
  );
}

export async function deleteAccused(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE fir_accused SET deleted_at = ? WHERE id = ?', [now, id]);
}
