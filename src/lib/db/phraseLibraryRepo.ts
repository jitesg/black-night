import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface Phrase {
  id: string;
  category: string;
  phrase_text: string;
  usage_count: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export const DEFAULT_PHRASES: Array<{ category: string; phrase_text: string }> = [
  // शुरुआत
  { category: 'शुरुआत', phrase_text: 'दिनांक ___ को थाना क्षेत्र में गश्त के दौरान सूचना प्राप्त हुई कि' },
  { category: 'शुरुआत', phrase_text: 'मुखबिर खास की सूचना पर' },
  // सामान्य वाक्यांश
  { category: 'सामान्य वाक्यांश', phrase_text: 'मौके पर पहुंचकर मुआयना किया गया' },
  { category: 'सामान्य वाक्यांश', phrase_text: 'घटनास्थल का निरीक्षण किया गया' },
  { category: 'सामान्य वाक्यांश', phrase_text: 'बयान दर्ज किया गया' },
  { category: 'सामान्य वाक्यांश', phrase_text: 'आवश्यक कार्यवाही की गई' },
  { category: 'सामान्य वाक्यांश', phrase_text: 'साक्ष्य एकत्रित किए गए' },
  { category: 'सामान्य वाक्यांश', phrase_text: 'पंचनामा तैयार किया गया' },
  // समापन
  { category: 'समापन', phrase_text: 'जांच जारी है' },
  { category: 'समापन', phrase_text: 'आगे की कार्यवाही हेतु प्रस्तुत' },
  { category: 'समापन', phrase_text: 'उपरोक्त तथ्यों के आधार पर रिपोर्ट प्रस्तुत की जाती है' },
];

/**
 * Ensures the phrase_library table exists (idempotent guard).
 */
export async function ensurePhraseTable(): Promise<void> {
  const db = await getDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS phrase_library (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        phrase_text TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
    `);
  } catch {
    // Non-fatal or stub
  }
}

/**
 * Returns all non-deleted phrases sorted by usage_count DESC, created_at ASC.
 */
export async function getAllPhrases(): Promise<Phrase[]> {
  await ensurePhraseTable();
  const db = await getDatabase();
  return db.getAllAsync<Phrase>(
    `SELECT * FROM phrase_library
     WHERE deleted_at IS NULL
     ORDER BY usage_count DESC, created_at ASC`
  );
}

/**
 * Returns all non-deleted phrases in a specific category.
 */
export async function getPhrasesByCategory(category: string): Promise<Phrase[]> {
  await ensurePhraseTable();
  const db = await getDatabase();
  return db.getAllAsync<Phrase>(
    `SELECT * FROM phrase_library
     WHERE deleted_at IS NULL AND category = ?
     ORDER BY usage_count DESC, created_at ASC`,
    [category]
  );
}

/**
 * Creates a new phrase and persists it to phrase_library.
 */
export async function createPhrase(category: string, phraseText: string): Promise<Phrase> {
  await ensurePhraseTable();
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  const trimmedCat = category.trim() || 'सामान्य वाक्यांश';
  const trimmedText = phraseText.trim();

  await db.runAsync(
    `INSERT INTO phrase_library (id, category, phrase_text, usage_count, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, 0, ?, ?, NULL)`,
    [id, trimmedCat, trimmedText, now, now]
  );

  return {
    id,
    category: trimmedCat,
    phrase_text: trimmedText,
    usage_count: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Updates a phrase's text (and optionally category).
 */
export async function updatePhrase(id: string, phraseText: string, category?: string): Promise<void> {
  await ensurePhraseTable();
  const db = await getDatabase();
  const now = nowTimestamp();
  const trimmedText = phraseText.trim();

  if (category !== undefined) {
    const trimmedCat = category.trim() || 'सामान्य वाक्यांश';
    await db.runAsync(
      `UPDATE phrase_library SET phrase_text = ?, category = ?, updated_at = ? WHERE id = ?`,
      [trimmedText, trimmedCat, now, id]
    );
  } else {
    await db.runAsync(
      `UPDATE phrase_library SET phrase_text = ?, updated_at = ? WHERE id = ?`,
      [trimmedText, now, id]
    );
  }
}

/**
 * Soft-deletes a phrase by setting deleted_at to current timestamp.
 */
export async function deletePhrase(id: string): Promise<void> {
  await ensurePhraseTable();
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE phrase_library SET deleted_at = ? WHERE id = ?`,
    [now, id]
  );
}

/**
 * Increments the usage_count for a phrase (safely for both native SQLite and web stub).
 */
export async function incrementUsage(id: string): Promise<void> {
  await ensurePhraseTable();
  const db = await getDatabase();
  const phrase = await db.getFirstAsync<{ usage_count: number }>(
    'SELECT usage_count FROM phrase_library WHERE id = ?',
    [id]
  );
  const newCount = (phrase?.usage_count ?? 0) + 1;
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE phrase_library SET usage_count = ?, updated_at = ? WHERE id = ?',
    [newCount, now, id]
  );
}

/**
 * Seeds initial starter phrases if the table has no non-deleted rows.
 */
export async function seedDefaultPhrasesIfEmpty(): Promise<void> {
  await ensurePhraseTable();
  const existing = await getAllPhrases();
  if (existing.length > 0) return;

  const db = await getDatabase();
  const now = nowTimestamp();
  for (let i = 0; i < DEFAULT_PHRASES.length; i++) {
    const p = DEFAULT_PHRASES[i];
    const id = generateUUID();
    await db.runAsync(
      `INSERT INTO phrase_library (id, category, phrase_text, usage_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 0, ?, ?, NULL)`,
      [id, p.category, p.phrase_text, now + i, now + i]
    );
  }
}
