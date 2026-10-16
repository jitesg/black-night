import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface ReligiousPlace {
  id: string;
  gp_id: string;
  category: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photo_uri?: string;
  remarks?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface ReligiousAuthority {
  id: string;
  place_id: string;
  authority_type: string;
  name: string;
  address?: string;
  mobile?: string;
  alternate_mobile?: string;
  photo_uri?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface ReligiousEvent {
  id: string;
  place_id: string;
  event_name: string;
  event_type: string;
  event_date?: string;
  description?: string;
  expected_crowd?: number;
  remarks?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type ReligiousPlaceInput = Omit<ReligiousPlace, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type ReligiousAuthorityInput = Omit<ReligiousAuthority, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type ReligiousEventInput = Omit<ReligiousEvent, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

export async function getReligiousPlacesByGP(gpId: string): Promise<ReligiousPlace[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReligiousPlace>(
    'SELECT * FROM religious_places WHERE gp_id = ? AND deleted_at IS NULL ORDER BY name ASC',
    [gpId]
  );
}

export async function getReligiousPlaceById(id: string): Promise<ReligiousPlace | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ReligiousPlace>(
    'SELECT * FROM religious_places WHERE id = ? AND deleted_at IS NULL', [id]
  );
}

export async function createReligiousPlace(input: ReligiousPlaceInput): Promise<ReligiousPlace> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO religious_places (id, gp_id, category, name, address, latitude, longitude, photo_uri, remarks, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.gp_id, input.category, input.name, input.address ?? null,
     input.latitude ?? null, input.longitude ?? null, input.photo_uri ?? null, input.remarks ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateReligiousPlace(id: string, input: Partial<ReligiousPlaceInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE religious_places SET ${fields}, updated_at = ? WHERE id = ?`, [...Object.values(input), now, id]);
}

export async function deleteReligiousPlace(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE religious_authorities SET deleted_at = ? WHERE place_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE religious_events SET deleted_at = ? WHERE place_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE religious_places SET deleted_at = ? WHERE id = ?', [now, id]);
}

export interface ReligiousPlaceWithGP extends ReligiousPlace { gp_name: string }

export async function getAllReligiousPlaces(): Promise<ReligiousPlaceWithGP[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReligiousPlaceWithGP>(
    `SELECT rp.*, g.name as gp_name FROM religious_places rp
     JOIN gram_panchayats g ON g.id = rp.gp_id
     WHERE rp.deleted_at IS NULL ORDER BY rp.name ASC`
  );
}

export async function getAuthorityByPlace(placeId: string): Promise<ReligiousAuthority | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ReligiousAuthority>(
    'SELECT * FROM religious_authorities WHERE place_id = ? AND deleted_at IS NULL', [placeId]
  );
}

export async function upsertAuthority(input: ReligiousAuthorityInput): Promise<ReligiousAuthority> {
  const db = await getDatabase();
  const existing = await getAuthorityByPlace(input.place_id);
  const now = nowTimestamp();
  if (existing) {
    await db.runAsync(
      `UPDATE religious_authorities SET authority_type=?, name=?, address=?, mobile=?, alternate_mobile=?, photo_uri=?, updated_at=? WHERE id=?`,
      [input.authority_type, input.name, input.address ?? null, input.mobile ?? null,
       input.alternate_mobile ?? null, input.photo_uri ?? null, now, existing.id]
    );
    return { ...existing, ...input, updated_at: now };
  }
  const id = generateUUID();
  await db.runAsync(
    `INSERT INTO religious_authorities (id, place_id, authority_type, name, address, mobile, alternate_mobile, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.place_id, input.authority_type, input.name, input.address ?? null,
     input.mobile ?? null, input.alternate_mobile ?? null, input.photo_uri ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function getEventsByPlace(placeId: string): Promise<ReligiousEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReligiousEvent>(
    'SELECT * FROM religious_events WHERE place_id = ? AND deleted_at IS NULL ORDER BY event_date ASC',
    [placeId]
  );
}

export async function createReligiousEvent(input: ReligiousEventInput): Promise<ReligiousEvent> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO religious_events (id, place_id, event_name, event_type, event_date, description, expected_crowd, remarks, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.place_id, input.event_name, input.event_type, input.event_date ?? null,
     input.description ?? null, input.expected_crowd ?? null, input.remarks ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateReligiousEvent(id: string, input: Partial<ReligiousEventInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE religious_events SET ${fields}, updated_at = ? WHERE id = ?`, [...Object.values(input), now, id]);
}

export async function deleteReligiousEvent(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE religious_events SET deleted_at = ? WHERE id = ?', [nowTimestamp(), id]);
}
