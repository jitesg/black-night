/**
 * readerFontPreference.ts
 *
 * Law Library reader font size preference and migration.
 * - Default body font size: 14px
 * - Allowed range: 12px to 22px (step: 1)
 * - Migration flag: 'law_reader_size_v2'
 *   Resets previously saved font size (which was 17px) to 14px once.
 *   Subsequent launches keep the user's chosen size.
 * - Tapping px label resets to 14px.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { dbGetFirstAsync, dbRunAsync } from '@/lib/db/database';

export const DEFAULT_READER_FONT_SIZE = 14;
export const MIN_READER_FONT_SIZE = 12;
export const MAX_READER_FONT_SIZE = 22;

export const READER_FONT_STORAGE_KEY = 'readerFontSize';
export const READER_FONT_MIGRATION_FLAG = 'law_reader_size_v2';

/**
 * Loads the stored font size, running the one-time law_reader_size_v2 migration
 * if it has not executed yet.
 */
export async function getReaderFontSize(): Promise<number> {
  try {
    // 1. Check if the one-time migration flag has been applied
    let migrationDone = await AsyncStorage.getItem(READER_FONT_MIGRATION_FLAG);

    if (!migrationDone) {
      // Check SQLite app_settings if available
      try {
        const row = await dbGetFirstAsync<{ value: string }>(
          `SELECT value FROM app_settings WHERE key = ?`,
          [READER_FONT_MIGRATION_FLAG]
        );
        if (row && row.value === '1') {
          migrationDone = '1';
          await AsyncStorage.setItem(READER_FONT_MIGRATION_FLAG, '1').catch(() => {});
        }
      } catch {
        // SQLite may not be open yet or web stub
      }
    }

    if (!migrationDone) {
      // ONE-TIME MIGRATION: Reset saved font size to 14px and mark flag done
      await AsyncStorage.setItem(READER_FONT_STORAGE_KEY, String(DEFAULT_READER_FONT_SIZE)).catch(() => {});
      await AsyncStorage.setItem(READER_FONT_MIGRATION_FLAG, '1').catch(() => {});

      try {
        await dbRunAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
          [READER_FONT_STORAGE_KEY, String(DEFAULT_READER_FONT_SIZE)]
        );
        await dbRunAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, '1')`,
          [READER_FONT_MIGRATION_FLAG]
        );
      } catch {
        // Ignore DB error if app_settings unavailable
      }

      return DEFAULT_READER_FONT_SIZE;
    }

    // Migration already ran in a previous session; read user's saved preference
    const rawVal = await AsyncStorage.getItem(READER_FONT_STORAGE_KEY);
    if (rawVal) {
      const parsed = parseInt(rawVal, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_READER_FONT_SIZE && parsed <= MAX_READER_FONT_SIZE) {
        return parsed;
      }
    }

    // Fallback: check SQLite app_settings
    try {
      const row = await dbGetFirstAsync<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = ?`,
        [READER_FONT_STORAGE_KEY]
      );
      if (row?.value) {
        const parsed = parseInt(row.value, 10);
        if (!Number.isNaN(parsed) && parsed >= MIN_READER_FONT_SIZE && parsed <= MAX_READER_FONT_SIZE) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    return DEFAULT_READER_FONT_SIZE;
  } catch (e) {
    console.warn('[readerFontPreference] Failed to read font size:', e);
    return DEFAULT_READER_FONT_SIZE;
  }
}

/**
 * Saves the user's preferred font size, clamped to [12, 22].
 */
export async function saveReaderFontSize(size: number): Promise<number> {
  const clamped = Math.max(MIN_READER_FONT_SIZE, Math.min(MAX_READER_FONT_SIZE, Math.round(size)));
  try {
    await AsyncStorage.setItem(READER_FONT_STORAGE_KEY, String(clamped)).catch(() => {});
    try {
      await dbRunAsync(
        `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
        [READER_FONT_STORAGE_KEY, String(clamped)]
      );
    } catch {
      // ignore
    }
  } catch (e) {
    console.warn('[readerFontPreference] Failed to save font size:', e);
  }
  return clamped;
}

/**
 * Resets the font size back to the default 14px and persists it.
 */
export async function resetReaderFontSize(): Promise<number> {
  return saveReaderFontSize(DEFAULT_READER_FONT_SIZE);
}
