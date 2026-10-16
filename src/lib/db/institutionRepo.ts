import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface SocialInstitution {
  id: string;
  gp_id: string;
  category: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photo_uri?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface InstitutionHead {
  id: string;
  institution_id: string;
  name: string;
  address?: string;
  mobile?: string;
  alternate_mobile?: string;
  photo_uri?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface InstitutionStaff {
  id: string;
  institution_id: string;
  name: string;
  designation?: string;
  mobile?: string;
  alternate_mobile?: string;
  photo_uri?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type SocialInstitutionInput = Omit<SocialInstitution, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type InstitutionHeadInput = Omit<InstitutionHead, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type InstitutionStaffInput = Omit<InstitutionStaff, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

export async function getInstitutionsByGP(gpId: string): Promise<SocialInstitution[]> {
  const db = await getDatabase();
  return db.getAllAsync<SocialInstitution>(
    'SELECT * FROM social_institutions WHERE gp_id = ? AND deleted_at IS NULL ORDER BY name ASC',
    [gpId]
  );
}

export async function getInstitutionById(id: string): Promise<SocialInstitution | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SocialInstitution>(
    'SELECT * FROM social_institutions WHERE id = ? AND deleted_at IS NULL', [id]
  );
}

export async function createInstitution(input: SocialInstitutionInput): Promise<SocialInstitution> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO social_institutions (id, gp_id, category, name, address, latitude, longitude, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.gp_id, input.category, input.name, input.address ?? null,
     input.latitude ?? null, input.longitude ?? null, input.photo_uri ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateInstitution(id: string, input: Partial<SocialInstitutionInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE social_institutions SET ${fields}, updated_at = ? WHERE id = ?`, [...Object.values(input), now, id]);
}

export async function deleteInstitution(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE institution_heads SET deleted_at = ? WHERE institution_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE institution_staff SET deleted_at = ? WHERE institution_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE social_institutions SET deleted_at = ? WHERE id = ?', [now, id]);
}

export interface SocialInstitutionWithGP extends SocialInstitution { gp_name: string }

export async function getAllInstitutions(): Promise<SocialInstitutionWithGP[]> {
  const db = await getDatabase();
  return db.getAllAsync<SocialInstitutionWithGP>(
    `SELECT si.*, g.name as gp_name FROM social_institutions si
     JOIN gram_panchayats g ON g.id = si.gp_id
     WHERE si.deleted_at IS NULL ORDER BY si.name ASC`
  );
}

export async function getHeadByInstitution(institutionId: string): Promise<InstitutionHead | null> {
  const db = await getDatabase();
  return db.getFirstAsync<InstitutionHead>(
    'SELECT * FROM institution_heads WHERE institution_id = ? AND deleted_at IS NULL', [institutionId]
  );
}

export async function upsertInstitutionHead(input: InstitutionHeadInput): Promise<InstitutionHead> {
  const db = await getDatabase();
  const existing = await getHeadByInstitution(input.institution_id);
  const now = nowTimestamp();
  if (existing) {
    await db.runAsync(
      `UPDATE institution_heads SET name=?, address=?, mobile=?, alternate_mobile=?, photo_uri=?, updated_at=? WHERE id=?`,
      [input.name, input.address ?? null, input.mobile ?? null,
       input.alternate_mobile ?? null, input.photo_uri ?? null, now, existing.id]
    );
    return { ...existing, ...input, updated_at: now };
  }
  const id = generateUUID();
  await db.runAsync(
    `INSERT INTO institution_heads (id, institution_id, name, address, mobile, alternate_mobile, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.institution_id, input.name, input.address ?? null,
     input.mobile ?? null, input.alternate_mobile ?? null, input.photo_uri ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function getStaffByInstitution(institutionId: string): Promise<InstitutionStaff[]> {
  const db = await getDatabase();
  return db.getAllAsync<InstitutionStaff>(
    'SELECT * FROM institution_staff WHERE institution_id = ? AND deleted_at IS NULL ORDER BY name ASC',
    [institutionId]
  );
}

export async function createInstitutionStaff(input: InstitutionStaffInput): Promise<InstitutionStaff> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO institution_staff (id, institution_id, name, designation, mobile, alternate_mobile, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.institution_id, input.name, input.designation ?? null,
     input.mobile ?? null, input.alternate_mobile ?? null, input.photo_uri ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateInstitutionStaff(id: string, input: Partial<InstitutionStaffInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE institution_staff SET ${fields}, updated_at = ? WHERE id = ?`, [...Object.values(input), now, id]);
}

export async function deleteInstitutionStaff(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE institution_staff SET deleted_at = ? WHERE id = ?', [nowTimestamp(), id]);
}
