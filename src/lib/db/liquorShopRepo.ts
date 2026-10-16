import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface LiquorShop {
  id: string;
  gp_id: string;
  shop_name: string;
  shop_type: string;
  owner_name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  mobile?: string;
  alternate_mobile?: string;
  licence_number?: string;
  photo_uri?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface ShopStaff {
  id: string;
  shop_id: string;
  name: string;
  mobile?: string;
  created_at: number;
  deleted_at?: number;
}

export type LiquorShopInput = Omit<LiquorShop, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type ShopStaffInput = Omit<ShopStaff, 'id' | 'created_at' | 'deleted_at'>;

export async function getShopsByGP(gpId: string): Promise<LiquorShop[]> {
  const db = await getDatabase();
  return db.getAllAsync<LiquorShop>(
    'SELECT * FROM liquor_shops WHERE gp_id = ? AND deleted_at IS NULL ORDER BY shop_name ASC',
    [gpId]
  );
}

export async function getShopById(id: string): Promise<LiquorShop | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LiquorShop>(
    'SELECT * FROM liquor_shops WHERE id = ? AND deleted_at IS NULL', [id]
  );
}

export async function createShop(input: LiquorShopInput): Promise<LiquorShop> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO liquor_shops (id, gp_id, shop_name, shop_type, owner_name, address, latitude, longitude, mobile, alternate_mobile, licence_number, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.gp_id, input.shop_name, input.shop_type, input.owner_name,
     input.address ?? null, input.latitude ?? null, input.longitude ?? null,
     input.mobile ?? null, input.alternate_mobile ?? null,
     input.licence_number ?? null, input.photo_uri ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateShop(id: string, input: Partial<LiquorShopInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const fields = Object.entries(input).map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE liquor_shops SET ${fields}, updated_at = ? WHERE id = ?`, [...Object.values(input), now, id]);
}

export async function deleteShop(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE shop_staff SET deleted_at = ? WHERE shop_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE liquor_shops SET deleted_at = ? WHERE id = ?', [now, id]);
}

export interface LiquorShopWithGP extends LiquorShop { gp_name: string }

export async function getAllShops(): Promise<LiquorShopWithGP[]> {
  const db = await getDatabase();
  return db.getAllAsync<LiquorShopWithGP>(
    `SELECT ls.*, g.name as gp_name FROM liquor_shops ls
     JOIN gram_panchayats g ON g.id = ls.gp_id
     WHERE ls.deleted_at IS NULL ORDER BY ls.shop_name ASC`
  );
}

export async function getStaffByShop(shopId: string): Promise<ShopStaff[]> {
  const db = await getDatabase();
  return db.getAllAsync<ShopStaff>(
    'SELECT * FROM shop_staff WHERE shop_id = ? AND deleted_at IS NULL ORDER BY name ASC',
    [shopId]
  );
}

export async function createShopStaff(input: ShopStaffInput): Promise<ShopStaff> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    'INSERT INTO shop_staff (id, shop_id, name, mobile, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, input.shop_id, input.name, input.mobile ?? null, now]
  );
  return { id, ...input, created_at: now };
}

export async function deleteShopStaff(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE shop_staff SET deleted_at = ? WHERE id = ?', [nowTimestamp(), id]);
}
