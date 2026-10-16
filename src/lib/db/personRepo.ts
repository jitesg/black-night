import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface Person {
  id: string;
  gp_id: string;
  person_type: string;
  name: string;
  address?: string;
  mobile?: string;
  alternate_mobile?: string;
  photo_uri?: string;
  remarks?: string;
  category?: string;
  designation?: string;
  related_entity_id?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type PersonInput = Omit<Person, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

export async function getPersonsByType(gpId: string, personType: string): Promise<Person[]> {
  const db = await getDatabase();
  return db.getAllAsync<Person>(
    'SELECT * FROM persons WHERE gp_id = ? AND person_type = ? AND deleted_at IS NULL ORDER BY name ASC',
    [gpId, personType]
  );
}

export async function getPersonsByEntityId(entityId: string, personType: string): Promise<Person[]> {
  const db = await getDatabase();
  return db.getAllAsync<Person>(
    'SELECT * FROM persons WHERE related_entity_id = ? AND person_type = ? AND deleted_at IS NULL ORDER BY name ASC',
    [entityId, personType]
  );
}

export async function createPerson(input: PersonInput): Promise<Person> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO persons (id, gp_id, person_type, name, address, mobile, alternate_mobile, photo_uri, remarks, category, designation, related_entity_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.gp_id, input.person_type, input.name, input.address ?? null,
     input.mobile ?? null, input.alternate_mobile ?? null, input.photo_uri ?? null,
     input.remarks ?? null, input.category ?? null, input.designation ?? null,
     input.related_entity_id ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updatePerson(id: string, input: Partial<PersonInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  const values = [...Object.values(input), now, id];
  await db.runAsync(`UPDATE persons SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

export async function deletePerson(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE persons SET deleted_at = ? WHERE id = ?', [nowTimestamp(), id]);
}

export interface PersonWithGP extends Person { gp_name: string }

export async function getAllImportantPersons(): Promise<PersonWithGP[]> {
  const db = await getDatabase();
  return db.getAllAsync<PersonWithGP>(
    `SELECT p.*, g.name as gp_name FROM persons p
     JOIN gram_panchayats g ON g.id = p.gp_id
     WHERE p.deleted_at IS NULL
       AND p.person_type IN ('current_pradhan','former_pradhan','bdc','important')
     ORDER BY p.name ASC`
  );
}

export async function getAllHistorySheeters(): Promise<PersonWithGP[]> {
  const db = await getDatabase();
  return db.getAllAsync<PersonWithGP>(
    `SELECT p.*, g.name as gp_name FROM persons p
     JOIN gram_panchayats g ON g.id = p.gp_id
     WHERE p.deleted_at IS NULL
       AND p.person_type = 'history_sheeter'
     ORDER BY p.name ASC`
  );
}
