import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface GramPanchayat {
  id: string;
  name: string;
  tehsil: string;
  police_station: string;
  district: string;
  state: string;
  remarks?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
  version: number;
}

export type GramPanchayatInput = Omit<GramPanchayat, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version'>;

export async function getAllGramPanchayats(): Promise<GramPanchayat[]> {
  const db = await getDatabase();
  return db.getAllAsync<GramPanchayat>(
    'SELECT * FROM gram_panchayats WHERE deleted_at IS NULL ORDER BY name ASC'
  );
}

export async function getGramPanchayatById(id: string): Promise<GramPanchayat | null> {
  const db = await getDatabase();
  return db.getFirstAsync<GramPanchayat>(
    'SELECT * FROM gram_panchayats WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

export async function createGramPanchayat(input: GramPanchayatInput): Promise<GramPanchayat> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO gram_panchayats (id, name, tehsil, police_station, district, state, remarks, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, input.name, input.tehsil, input.police_station, input.district, input.state, input.remarks ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now, version: 1 };
}

export async function updateGramPanchayat(id: string, input: Partial<GramPanchayatInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input)
    .map(([k]) => `${k} = ?`)
    .join(', ');
  const values = [...Object.values(input), now, id];
  await db.runAsync(
    `UPDATE gram_panchayats SET ${fields}, updated_at = ?, version = version + 1 WHERE id = ?`,
    values
  );
}

export async function deleteGramPanchayat(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE hamlets SET deleted_at = ? WHERE gp_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE persons SET deleted_at = ? WHERE gp_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE religious_places SET deleted_at = ? WHERE gp_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE social_institutions SET deleted_at = ? WHERE gp_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE liquor_shops SET deleted_at = ? WHERE gp_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync(`UPDATE religious_authorities SET deleted_at = ? WHERE place_id IN (SELECT id FROM religious_places WHERE gp_id = ?) AND deleted_at IS NULL`, [now, id]);
  await db.runAsync(`UPDATE religious_events SET deleted_at = ? WHERE place_id IN (SELECT id FROM religious_places WHERE gp_id = ?) AND deleted_at IS NULL`, [now, id]);
  await db.runAsync(`UPDATE institution_heads SET deleted_at = ? WHERE institution_id IN (SELECT id FROM social_institutions WHERE gp_id = ?) AND deleted_at IS NULL`, [now, id]);
  await db.runAsync(`UPDATE institution_staff SET deleted_at = ? WHERE institution_id IN (SELECT id FROM social_institutions WHERE gp_id = ?) AND deleted_at IS NULL`, [now, id]);
  await db.runAsync(`UPDATE shop_staff SET deleted_at = ? WHERE shop_id IN (SELECT id FROM liquor_shops WHERE gp_id = ?) AND deleted_at IS NULL`, [now, id]);
  // surveillance_targets is confirmed GP-scoped with gp_id column in schema.ts
  await db.runAsync('UPDATE surveillance_targets SET deleted_at = ? WHERE gp_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync(
    'UPDATE gram_panchayats SET deleted_at = ? WHERE id = ?',
    [now, id]
  );
}

export async function getAnalytics(): Promise<{
  totalGP: number;
  totalHamlets: number;
  totalReligiousPlaces: number;
  totalInstitutions: number;
  totalLiquorShops: number;
  totalImportantPersons: number;
  totalHistorySheeters: number;
  totalSurveillance: number;
}> {
  const db = await getDatabase();
  const [gp, hamlets, rp, inst, shops, persons, hs, surv] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM gram_panchayats WHERE deleted_at IS NULL'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM hamlets WHERE deleted_at IS NULL'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM religious_places WHERE deleted_at IS NULL'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM social_institutions WHERE deleted_at IS NULL'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM liquor_shops WHERE deleted_at IS NULL'),
    db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM persons WHERE deleted_at IS NULL AND person_type IN ('current_pradhan','former_pradhan','bdc','important')`),
    db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM persons WHERE deleted_at IS NULL AND person_type = 'history_sheeter'`),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM surveillance_targets WHERE deleted_at IS NULL'),
  ]);
  return {
    totalGP: gp?.count ?? 0,
    totalHamlets: hamlets?.count ?? 0,
    totalReligiousPlaces: rp?.count ?? 0,
    totalInstitutions: inst?.count ?? 0,
    totalLiquorShops: shops?.count ?? 0,
    totalImportantPersons: persons?.count ?? 0,
    totalHistorySheeters: hs?.count ?? 0,
    totalSurveillance: surv?.count ?? 0,
  };
}
