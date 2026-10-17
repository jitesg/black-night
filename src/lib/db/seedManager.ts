/**
 * SeedManager — System Content Update Engine for InvestSuite.
 *
 * Runs on every app launch (idempotent). For each seed item:
 *   - First launch:  INSERT if UUID does not exist locally.
 *   - App update:    UPDATE if bundled seed_version > stored, OR content_hash changed.
 *   - Never touches rows where source = 'user'.
 *   - Logs Added / Updated / Skipped counts after each run.
 *
 * Content hash: djb2 hash computed at runtime from canonical content fields.
 * This makes the engine self-validating — no manual hash maintenance required
 * in the JSON seed files.
 *
 * Fast-path guard (performance + correctness):
 *   A single "seed_content_version" token is stored in workspace_settings.
 *   It is a djb2 hash of the entire bundled seed corpus (all format IDs +
 *   seed_versions + knowledge IDs + seed_versions, concatenated). On every
 *   launch the token is computed from the bundled JSON (in-memory, ~1 ms)
 *   and compared to the stored value. If they match AND a sanity row-count
 *   check passes, the full per-row reconciliation is skipped entirely.
 *   Only on first launch or when the bundled seed files change does the
 *   full reconciliation run.
 *
 *   DEFENSIVE COUNT CHECK: even when the stored token matches the bundled
 *   corpus hash, the fast-path is NOT taken if predefined_formats or
 *   knowledge_entries have fewer active rows than the bundled seed contains.
 *   This protects against the "stale token after partial seed failure"
 *   scenario: if the app previously crashed mid-seed but still persisted
 *   the token, every future launch would silently skip seeding and leave
 *   the tables empty forever. The count check catches this and forces a
 *   full re-seed, clearing the stored token beforehand so the recovery is
 *   logged and visible.
 *
 *   To force a full re-seed after editing the seed JSON, the token will
 *   automatically differ — no manual bump is needed.
 */
import { getDatabase, dbRunAsync, dbGetFirstAsync, dbGetAllAsync, generateUUID, nowTimestamp } from './database';
import { logger } from '../logger';

// ─── Result type ─────────────────────────────────────────────────────────────
export interface SeedResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface SeedFileStatus {
  fileName: string;
  entriesRead: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
  appliedHash: string;
}

let _perSeedFileStatuses: SeedFileStatus[] = [];

export interface SeedTimestamps {
  appStart: number | null;
  seedStart: number | null;
  seedEnd: number | null;
  seedCompleted: boolean;
  firstKnowledgeCountQuery: number | null;
}

const _timestamps: SeedTimestamps = {
  appStart: Date.now(),
  seedStart: null,
  seedEnd: null,
  seedCompleted: false,
  firstKnowledgeCountQuery: null,
};

export function recordAppStartTime(): void {
  if (!_timestamps.appStart) _timestamps.appStart = Date.now();
}

export function recordFirstKnowledgeCountQueryTime(): void {
  if (!_timestamps.firstKnowledgeCountQuery) {
    _timestamps.firstKnowledgeCountQuery = Date.now();
  }
}

export function getSeedTimestamps(): SeedTimestamps {
  return { ..._timestamps };
}

export function getPerSeedFileStatus(): SeedFileStatus[] {
  return [..._perSeedFileStatuses];
}

let _resolveSeedReady: () => void;
export const seedReady: Promise<void> = new Promise<void>((resolve) => {
  _resolveSeedReady = resolve;
});

type SeedCompleteListener = (result?: SeedResult) => void;
const _seedListeners = new Set<SeedCompleteListener>();

export function onSeedComplete(listener: SeedCompleteListener): () => void {
  _seedListeners.add(listener);
  if (_timestamps.seedCompleted) {
    try {
      listener();
    } catch (e) {
      logger.warn('[SeedManager] onSeedComplete immediate callback failed:', e);
    }
  }
  return () => {
    _seedListeners.delete(listener);
  };
}

// ─── Seed data types ──────────────────────────────────────────────────────────
interface SeedFormatKey {
  key_name: string;
  label: string;
  field_type: string;
  is_required: number;
  sort_order: number;
  default_value?: string;
  dropdown_options?: string;
}

interface SeedFormat {
  id: string;
  title: string;
  format_type: string;
  vivran: string;
  is_favorite: number;
  created_by: string;
  source: string;
  editable: number;
  content_type: string;
  seed_version: number;
  app_version: string;
  last_updated: string;
  tags: string[];
  keys: SeedFormatKey[];
}

interface SeedKnowledge {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  crime_type: string;
  description: string;
  tags: string;
  attachment_uris: string;
  source: string;
  editable: number;
  content_type: string;
  seed_version: number;
  app_version: string;
  last_updated: string;
}

// ─── Load bundled JSON (Metro resolves static imports at build time) ──────────
import formatsSeedData from '../../../assets/seed/formats_seed.json';
import knowledgeSeedData from '../../../assets/seed/knowledge_seed.json';
import circularsSeedData from '../../../assets/seed/circulars_seed.json';
import circularsSeed2Data from '../../../assets/seed/circulars_seed_2.json';
import circularsSeed3Data from '../../../assets/seed/circulars_seed_3.json';
import circularsSeed4Data from '../../../assets/seed/circulars_seed_4.json';
import circularsSeed5Data from '../../../assets/seed/circulars_seed_5.json';
import circularsSeed6Data from '../../../assets/seed/circulars_seed_6.json';
import circularsSeed7Data from '../../../assets/seed/circulars_seed_7.json';
import circularsSeed8Data from '../../../assets/seed/circulars_seed_8.json';
import sopSeed1Data from '../../../assets/seed/sop_seed_1.json';
import sopSeed2Data from '../../../assets/seed/sop_seed_2.json';

const FORMATS_SEED = formatsSeedData as { formats: SeedFormat[] };
// Filter out legacy system Law / Laws & Sections entries from bundled knowledge seed
const RAW_KNOWLEDGE_SEED = knowledgeSeedData as { knowledge: SeedKnowledge[] };
const KNOWLEDGE_BASE_SEED: SeedKnowledge[] = RAW_KNOWLEDGE_SEED.knowledge.filter(
  (k) => !(k.source === 'system' && (k.category === 'Law' || k.category === 'Laws & Sections'))
);

const CIRCULARS_1_ENTRIES: SeedKnowledge[] = ((circularsSeedData as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_2_ENTRIES: SeedKnowledge[] = ((circularsSeed2Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_3_ENTRIES: SeedKnowledge[] = ((circularsSeed3Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_4_ENTRIES: SeedKnowledge[] = ((circularsSeed4Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_5_ENTRIES: SeedKnowledge[] = ((circularsSeed5Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_6_ENTRIES: SeedKnowledge[] = ((circularsSeed6Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_7_ENTRIES: SeedKnowledge[] = ((circularsSeed7Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const CIRCULARS_8_ENTRIES: SeedKnowledge[] = ((circularsSeed8Data as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const SOP_1_ENTRIES: SeedKnowledge[] = ((sopSeed1Data as unknown as { knowledge?: any[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'sop',
  })
);

const SOP_2_ENTRIES: SeedKnowledge[] = ((sopSeed2Data as unknown as { knowledge?: any[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'sop',
  })
);

export interface CircularSeedFileDef {
  fileName: string;
  entries: SeedKnowledge[];
  tokenKey: string;
  fileToken: string;
}

function _computeCircularFileToken(fileName: string, entries: SeedKnowledge[]): string {
  const parts = entries
    .map((c) => `c:${c.id}:${c.seed_version}:${_djb2Hash(c.description || '')}`)
    .sort()
    .join('|');
  return _djb2Hash(`${fileName}||${parts}`);
}

export const CIRCULAR_SEED_FILES: CircularSeedFileDef[] = [
  {
    fileName: 'circulars_seed.json',
    entries: CIRCULARS_1_ENTRIES,
    tokenKey: 'seed_file:circulars_seed.json',
    fileToken: _computeCircularFileToken('circulars_seed.json', CIRCULARS_1_ENTRIES),
  },
  {
    fileName: 'circulars_seed_2.json',
    entries: CIRCULARS_2_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_2.json',
    fileToken: _computeCircularFileToken('circulars_seed_2.json', CIRCULARS_2_ENTRIES),
  },
  {
    fileName: 'circulars_seed_3.json',
    entries: CIRCULARS_3_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_3.json',
    fileToken: _computeCircularFileToken('circulars_seed_3.json', CIRCULARS_3_ENTRIES),
  },
  {
    fileName: 'circulars_seed_4.json',
    entries: CIRCULARS_4_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_4.json',
    fileToken: _computeCircularFileToken('circulars_seed_4.json', CIRCULARS_4_ENTRIES),
  },
  {
    fileName: 'circulars_seed_5.json',
    entries: CIRCULARS_5_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_5.json',
    fileToken: _computeCircularFileToken('circulars_seed_5.json', CIRCULARS_5_ENTRIES),
  },
  {
    fileName: 'circulars_seed_6.json',
    entries: CIRCULARS_6_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_6.json',
    fileToken: _computeCircularFileToken('circulars_seed_6.json', CIRCULARS_6_ENTRIES),
  },
  {
    fileName: 'circulars_seed_7.json',
    entries: CIRCULARS_7_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_7.json',
    fileToken: _computeCircularFileToken('circulars_seed_7.json', CIRCULARS_7_ENTRIES),
  },
  {
    fileName: 'circulars_seed_8.json',
    entries: CIRCULARS_8_ENTRIES,
    tokenKey: 'seed_file:circulars_seed_8.json',
    fileToken: _computeCircularFileToken('circulars_seed_8.json', CIRCULARS_8_ENTRIES),
  },
  {
    fileName: 'sop_seed_1.json',
    entries: SOP_1_ENTRIES,
    tokenKey: 'seed_file:sop_seed_1.json',
    fileToken: _computeCircularFileToken('sop_seed_1.json', SOP_1_ENTRIES),
  },
  {
    fileName: 'sop_seed_2.json',
    entries: SOP_2_ENTRIES,
    tokenKey: 'seed_file:sop_seed_2.json',
    fileToken: _computeCircularFileToken('sop_seed_2.json', SOP_2_ENTRIES),
  },
];

// Backwards-compatible exported constants
export const CIRCULARS_SEED = CIRCULARS_1_ENTRIES;
export const CIRCULARS_2_SEED = CIRCULARS_2_ENTRIES;
export const CIRCULARS_3_SEED = CIRCULARS_3_ENTRIES;
export const CIRCULARS_4_SEED = CIRCULARS_4_ENTRIES;
export const CIRCULARS_5_SEED = CIRCULARS_5_ENTRIES;
export const CIRCULARS_6_SEED = CIRCULARS_6_ENTRIES;
export const CIRCULARS_7_SEED = CIRCULARS_7_ENTRIES;
export const CIRCULARS_8_SEED = CIRCULARS_8_ENTRIES;
export const SOP_1_SEED = SOP_1_ENTRIES;
export const SOP_2_SEED = SOP_2_ENTRIES;
export const CIRCULARS_FILE_TOKEN = CIRCULAR_SEED_FILES[0].fileToken;
export const CIRCULARS_2_FILE_TOKEN = CIRCULAR_SEED_FILES[1].fileToken;
export const CIRCULARS_3_FILE_TOKEN = CIRCULAR_SEED_FILES[2].fileToken;
export const CIRCULARS_4_FILE_TOKEN = CIRCULAR_SEED_FILES[3].fileToken;
export const CIRCULARS_5_FILE_TOKEN = CIRCULAR_SEED_FILES[4].fileToken;
export const CIRCULARS_6_FILE_TOKEN = CIRCULAR_SEED_FILES[5].fileToken;
export const CIRCULARS_7_FILE_TOKEN = CIRCULAR_SEED_FILES[6].fileToken;
export const CIRCULARS_8_FILE_TOKEN = CIRCULAR_SEED_FILES[7].fileToken;
export const SOP_1_FILE_TOKEN = CIRCULAR_SEED_FILES[8].fileToken;
export const SOP_2_FILE_TOKEN = CIRCULAR_SEED_FILES[9].fileToken;

const ALL_CIRCULARS_COMBINED: SeedKnowledge[] = CIRCULAR_SEED_FILES.flatMap((f) => f.entries);

const KNOWLEDGE_SEED: { knowledge: SeedKnowledge[] } = {
  knowledge: [
    ...KNOWLEDGE_BASE_SEED,
    ...ALL_CIRCULARS_COMBINED,
  ],
};

// ─── djb2 content hash ────────────────────────────────────────────────────────
/**
 * Lightweight djb2 hash of a canonical string.
 * Produces a stable hex string — same input always gives the same output.
 * Used to detect silent content changes without a seed_version bump.
 */
function _djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

function _parseIsoDateToUnix(dateStr?: string): number {
  if (!dateStr) return nowTimestamp();
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return nowTimestamp();
  return Math.floor(parsed / 1000);
}

const SEED_VERSION_KEY = 'seed_content_version';
const SEED_VERSION_SALT = 'v8';

/** Per-seed-file tokens to track applied state independently per file */
export const FORMATS_FILE_TOKEN: string = (() => {
  const parts = FORMATS_SEED.formats
    .map(f => `f:${f.id}:${f.seed_version}`)
    .sort()
    .join('|');
  return _djb2Hash(`formats_seed.json||${parts}`);
})();

export const KNOWLEDGE_FILE_TOKEN: string = (() => {
  const parts = KNOWLEDGE_BASE_SEED
    .map(k => `k:${k.id}:${k.seed_version}`)
    .sort()
    .join('|');
  return _djb2Hash(`knowledge_seed.json||${parts}`);
})();

/**
 * Corpus token — a single hash that summarises the entire bundled seed.
 * Maintained for legacy compatibility.
 */
const SEED_CORPUS_VERSION: string = (() => {
  const fmtParts = FORMATS_SEED.formats
    .map(f => `f:${f.id}:${f.seed_version}`)
    .sort()
    .join('|');
  const knParts = KNOWLEDGE_SEED.knowledge
    .map(k => `k:${k.id}:${k.seed_version}`)
    .sort()
    .join('|');
  return _djb2Hash(`${fmtParts}||${knParts}||${SEED_VERSION_SALT}`);
})();

/** Canonical hash for a format: covers all content fields + keys + tags. */
function _formatHash(fmt: SeedFormat): string {
  const canonical = JSON.stringify({
    title: fmt.title,
    format_type: fmt.format_type,
    vivran: fmt.vivran,
    keys: fmt.keys.map((k) => ({
      key_name: k.key_name, label: k.label, field_type: k.field_type,
      is_required: k.is_required, sort_order: k.sort_order,
      default_value: k.default_value ?? null,
      dropdown_options: k.dropdown_options ?? null,
    })),
    tags: [...fmt.tags].sort(),
  });
  return _djb2Hash(canonical);
}

/** Canonical hash for a knowledge entry: covers all content fields + tags. */
function _knowledgeHash(kn: SeedKnowledge): string {
  const canonical = JSON.stringify({
    title: kn.title,
    category: kn.category,
    subcategory: kn.subcategory,
    crime_type: kn.crime_type,
    description: kn.description,
    tags: kn.tags,
    content_type: kn.content_type,
  });
  return _djb2Hash(canonical);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Idempotent System Content Update Engine with Per-Seed-File Tracking.
 * Returns a SeedResult with Added / Updated / Skipped counts.
 * Call once after getDatabase() resolves at app startup.
 */
export async function seedSystemContent(): Promise<SeedResult> {
  const t0 = Date.now();
  _timestamps.seedStart = t0;
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };
  const newStatuses: SeedFileStatus[] = [];

  try {
    // ── One-time migration: retire legacy system Law seed entries ─────────────
    await _retireOldSystemLawSeed();

    // ── Step 0: Clean up legacy/retired format rows ───────────────────────────
    await _dedupSystemFormats();

    // ── File 1: formats_seed.json ─────────────────────────────────────────────
    try {
      let storedFmtToken: string | null = null;
      try {
        const storedRow = await dbGetFirstAsync<{ value: string }>(
          `SELECT value FROM app_settings WHERE key = 'seed_file:formats_seed.json'`
        );
        storedFmtToken = storedRow?.value ?? null;
      } catch (tokenErr) {
        logger.warn('[SeedManager] formats_seed.json token read failed, treating as not applied:', tokenErr);
      }

      const activeFmtCountRow = await dbGetFirstAsync<{ n: number }>(
        `SELECT COUNT(*) as n FROM predefined_formats WHERE deleted_at IS NULL`
      ).catch(() => ({ n: 0 }));
      const activeFmtCount = activeFmtCountRow?.n ?? 0;
      const shouldSkipFormats =
        storedFmtToken === FORMATS_FILE_TOKEN &&
        activeFmtCount >= FORMATS_SEED.formats.length;

      if (shouldSkipFormats) {
        newStatuses.push({
          fileName: 'formats_seed.json',
          entriesRead: FORMATS_SEED.formats.length,
          inserted: 0,
          updated: 0,
          skipped: FORMATS_SEED.formats.length,
          errors: 0,
          errorMessages: [],
          appliedHash: FORMATS_FILE_TOKEN,
        });
        result.skipped += FORMATS_SEED.formats.length;
      } else {
        const fmtRes = await _seedFormats(FORMATS_SEED.formats);
        result.added += fmtRes.added;
        result.updated += fmtRes.updated;
        result.skipped += fmtRes.skipped;

        await dbRunAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seed_file:formats_seed.json', ?)`,
          [FORMATS_FILE_TOKEN]
        );
        await dbRunAsync(`DELETE FROM app_settings WHERE key = 'seed_last_error:formats_seed.json'`).catch(() => {});

        newStatuses.push({
          fileName: 'formats_seed.json',
          entriesRead: FORMATS_SEED.formats.length,
          inserted: fmtRes.added,
          updated: fmtRes.updated,
          skipped: fmtRes.skipped,
          errors: 0,
          errorMessages: [],
          appliedHash: FORMATS_FILE_TOKEN,
        });
      }
    } catch (fmtErr) {
      const errMsg = fmtErr instanceof Error ? fmtErr.message : String(fmtErr);
      logger.warn(`[SeedManager] formats_seed.json seeding failed: ${errMsg}`, fmtErr);
      await dbRunAsync(
        `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seed_last_error:formats_seed.json', ?)`,
        [errMsg]
      ).catch(() => {});
      newStatuses.push({
        fileName: 'formats_seed.json',
        entriesRead: FORMATS_SEED.formats.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        errorMessages: [errMsg],
        appliedHash: '',
      });
    }

    // ── File 2: knowledge_seed.json ───────────────────────────────────────────
    try {
      let storedKnToken: string | null = null;
      try {
        const storedRow = await dbGetFirstAsync<{ value: string }>(
          `SELECT value FROM app_settings WHERE key = 'seed_file:knowledge_seed.json'`
        );
        storedKnToken = storedRow?.value ?? null;
      } catch (tokenErr) {
        logger.warn('[SeedManager] knowledge_seed.json token read failed, treating as not applied:', tokenErr);
      }

      const knPlaceholders = KNOWLEDGE_BASE_SEED.map(() => '?').join(',');
      const knActiveRows = await dbGetAllAsync<{ id: string }>(
        `SELECT id FROM knowledge_entries WHERE deleted_at IS NULL AND id IN (${knPlaceholders})`,
        KNOWLEDGE_BASE_SEED.map(k => k.id)
      ).catch(() => []);
      const shouldSkipKnowledge =
        storedKnToken === KNOWLEDGE_FILE_TOKEN &&
        knActiveRows.length === KNOWLEDGE_BASE_SEED.length;

      if (shouldSkipKnowledge) {
        newStatuses.push({
          fileName: 'knowledge_seed.json',
          entriesRead: KNOWLEDGE_BASE_SEED.length,
          inserted: 0,
          updated: 0,
          skipped: KNOWLEDGE_BASE_SEED.length,
          errors: 0,
          errorMessages: [],
          appliedHash: KNOWLEDGE_FILE_TOKEN,
        });
        result.skipped += KNOWLEDGE_BASE_SEED.length;
      } else {
        const knRes = await _seedKnowledgeEntries(KNOWLEDGE_BASE_SEED, 'knowledge_seed.json');
        result.added += knRes.added;
        result.updated += knRes.updated;
        result.skipped += knRes.skipped;

        await dbRunAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seed_file:knowledge_seed.json', ?)`,
          [KNOWLEDGE_FILE_TOKEN]
        );
        await dbRunAsync(`DELETE FROM app_settings WHERE key = 'seed_last_error:knowledge_seed.json'`).catch(() => {});

        newStatuses.push({
          fileName: 'knowledge_seed.json',
          entriesRead: KNOWLEDGE_BASE_SEED.length,
          inserted: knRes.added,
          updated: knRes.updated,
          skipped: knRes.skipped,
          errors: knRes.errors,
          errorMessages: knRes.errorMessages,
          appliedHash: KNOWLEDGE_FILE_TOKEN,
        });
      }
    } catch (knErr) {
      const errMsg = knErr instanceof Error ? knErr.message : String(knErr);
      logger.warn(`[SeedManager] knowledge_seed.json seeding failed: ${errMsg}`, knErr);
      await dbRunAsync(
        `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seed_last_error:knowledge_seed.json', ?)`,
        [errMsg]
      ).catch(() => {});
      newStatuses.push({
        fileName: 'knowledge_seed.json',
        entriesRead: KNOWLEDGE_BASE_SEED.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        errorMessages: [errMsg],
        appliedHash: '',
      });
    }

    // ── Circular Seed Files (Generic Multi-File Loader) ─────────────────────
    for (const seedFile of CIRCULAR_SEED_FILES) {
      try {
        let storedCircToken: string | null = null;
        try {
          const storedRow = await dbGetFirstAsync<{ value: string }>(
            `SELECT value FROM app_settings WHERE key = ?`,
            [seedFile.tokenKey]
          );
          storedCircToken = storedRow?.value ?? null;
        } catch (tokenErr) {
          logger.warn(`[SeedManager] ${seedFile.fileName} token read failed, treating as not applied:`, tokenErr);
        }

        const circPlaceholders = seedFile.entries.map(() => '?').join(',');
        const circActiveRows = await dbGetAllAsync<{ id: string }>(
          `SELECT id FROM knowledge_entries WHERE deleted_at IS NULL AND id IN (${circPlaceholders})`,
          seedFile.entries.map((c) => c.id)
        ).catch(() => []);
        const shouldSkipCirculars =
          storedCircToken === seedFile.fileToken &&
          circActiveRows.length === seedFile.entries.length;

        if (shouldSkipCirculars) {
          newStatuses.push({
            fileName: seedFile.fileName,
            entriesRead: seedFile.entries.length,
            inserted: 0,
            updated: 0,
            skipped: seedFile.entries.length,
            errors: 0,
            errorMessages: [],
            appliedHash: seedFile.fileToken,
          });
          result.skipped += seedFile.entries.length;
        } else {
          const circRes = await _seedKnowledgeEntries(seedFile.entries, seedFile.fileName);
          result.added += circRes.added;
          result.updated += circRes.updated;
          result.skipped += circRes.skipped;

          await dbRunAsync(
            `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
            [seedFile.tokenKey, seedFile.fileToken]
          );
          await dbRunAsync(
            `DELETE FROM app_settings WHERE key = ?`,
            [`seed_last_error:${seedFile.fileName}`]
          ).catch(() => {});

          newStatuses.push({
            fileName: seedFile.fileName,
            entriesRead: seedFile.entries.length,
            inserted: circRes.added,
            updated: circRes.updated,
            skipped: circRes.skipped,
            errors: circRes.errors,
            errorMessages: circRes.errorMessages,
            appliedHash: seedFile.fileToken,
          });
        }
      } catch (circErr) {
        const errMsg = circErr instanceof Error ? circErr.message : String(circErr);
        logger.warn(`[SeedManager] ${seedFile.fileName} seeding failed: ${errMsg}`, circErr);
        await dbRunAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
          [`seed_last_error:${seedFile.fileName}`, errMsg]
        ).catch(() => {});
        newStatuses.push({
          fileName: seedFile.fileName,
          entriesRead: seedFile.entries.length,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: 1,
          errorMessages: [errMsg],
          appliedHash: '',
        });
      }
    }

    _perSeedFileStatuses = newStatuses;

    // Persist per-file last run info so it survives reloads (Task L18D / L19 diagnostics)
    for (const st of _perSeedFileStatuses) {
      try {
        await dbRunAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
          [`seed_last_run:${st.fileName}`, JSON.stringify({
            timestamp: Date.now(),
            entriesRead: st.entriesRead,
            inserted: st.inserted,
            updated: st.updated,
            skipped: st.skipped,
            errors: st.errors,
            errorMessages: st.errorMessages,
            appliedHash: st.appliedHash,
          })]
        );
      } catch (err) {
        console.warn(`[SeedManager] Failed to persist seed_last_run for ${st.fileName}:`, err);
      }
    }

    // ── Startup debug log: row counts per table & category ────────────────────
    const circCountRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL AND category IN ('Circular', 'Circulars', 'परिपत्र')`
    ).catch(() => ({ n: 0 }));
    const sopCountRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL AND category IN ('SOP', 'एसओपी')`
    ).catch(() => ({ n: 0 }));
    const courtCountRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL AND category IN ('Court Judgment', 'Court Judgments', 'अदालत का निर्णय')`
    ).catch(() => ({ n: 0 }));
    const policeFmtCountRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL AND category IN ('Police Format', 'Police Formats', 'पुलिस प्रारूप')`
    ).catch(() => ({ n: 0 }));
    const lawCountRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL AND category IN ('Law', 'Laws & Sections')`
    ).catch(() => ({ n: 0 }));
    const totalFormatsRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM predefined_formats WHERE deleted_at IS NULL`
    ).catch(() => ({ n: 0 }));

    console.info(
      `[KnowledgeSeedDebug] Table counts: knowledge_entries: ` +
      `Circular=${circCountRow?.n ?? 0}, SOP=${sopCountRow?.n ?? 0}, ` +
      `Court Judgment=${courtCountRow?.n ?? 0}, Police Format=${policeFmtCountRow?.n ?? 0}, ` +
      `Law=${lawCountRow?.n ?? 0} | predefined_formats: Formats=${totalFormatsRow?.n ?? 0}`
    );

    console.info(`[SeedManager] Per-seed-file reconcile summary:`);
    for (const st of _perSeedFileStatuses) {
      console.info(
        `  • ${st.fileName}: Read=${st.entriesRead}, Inserted=${st.inserted}, ` +
        `Updated=${st.updated}, Skipped=${st.skipped}, Errors=${st.errors}`
      );
    }

    // ── Persist legacy corpus token for backwards compatibility ───────────────
    await dbRunAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
      [SEED_VERSION_KEY, SEED_CORPUS_VERSION]
    ).catch(() => {});

    const elapsed = Date.now() - t0;
    if (__DEV__) {
      console.info(
        `[SeedManager] seedSystemContent complete in ${elapsed}ms — ` +
        `Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}`
      );
    }
  } catch (e) {
    console.error('[SeedManager] seed failed:', e);
  } finally {
    _timestamps.seedEnd = Date.now();
    _timestamps.seedCompleted = true;
    _resolveSeedReady?.();
    for (const listener of _seedListeners) {
      try {
        listener(result);
      } catch (listenerErr) {
        logger.warn('[SeedManager] onSeedComplete listener error:', listenerErr);
      }
    }
  }
  return result;
}

// ─── Retire legacy Law system seed entries ────────────────────────────────────
/**
 * One-time migration: soft-deletes legacy system-seeded Law entries
 * (e.g. "BNS Section 101 — completely born. Murder") which had incorrect
 * titles and sections.
 *
 * Guarded by stored flag 'law_seed_retired_v1' in app_settings.
 * NEVER touches user-created notes (source != 'system') or non-Law categories
 * (SOP, Checklist, Circular, etc.).
 */
async function _retireOldSystemLawSeed(): Promise<void> {
  const RETIRE_KEY = 'law_seed_retired_v1';
  try {
    const existing = await dbGetFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = ?`,
      [RETIRE_KEY]
    );
    if (existing?.value === '1') {
      return;
    }

    const now = nowTimestamp();
    const toDeleteRows = await dbGetAllAsync<{ id: string }>(
      `SELECT id FROM knowledge_entries
       WHERE source = 'system'
         AND category IN ('Law', 'Laws & Sections')
         AND deleted_at IS NULL`
    );

    if (toDeleteRows.length > 0) {
      await dbRunAsync(
        `UPDATE knowledge_entries
         SET deleted_at = ?, updated_at = ?
         WHERE source = 'system'
           AND category IN ('Law', 'Laws & Sections')
           AND deleted_at IS NULL`,
        [now, now]
      );
      logger.log(
        `[SeedManager] Retired ${toDeleteRows.length} legacy system Law entries from knowledge_entries`
      );
    } else {
      logger.log('[SeedManager] No legacy system Law entries to retire');
    }

    await dbRunAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, '1')`,
      [RETIRE_KEY]
    );
  } catch (err) {
    logger.warn('[SeedManager] _retireOldSystemLawSeed failed:', err);
  }
}

// ─── Legacy format cleanup ────────────────────────────────────────────────────
/**
 * Two responsibilities, run on every app start (both are idempotent):
 *
 * A) Hard-delete the one confirmed near-duplicate legacy row.
 *    id = bafb59c2-2585-438c-b0c6-53bb0ad60fa8
 *    title = "बीट सूचना में 126/135 की कार्यवाही"  (differs from canonical by one word "में")
 *    This row pre-dates stable IDs and was never in the seed file. Title-based
 *    dedup never caught it because its title doesn't exactly match any canonical.
 *    Safe to hard-delete: format_usage_log refs are reassigned to sys-fmt-bnss126-beat first.
 *
 * B) Soft-delete two retired BNSS-126/135 formats that were removed from the
 *    seed file (they still exist in DB on devices that had them installed):
 *      sys-fmt-bnss126-nyayalay  — "न्यायालय आदेश पर 126/135 की कार्यवाही"
 *      sys-fmt-bnss126-shikayat  — "शिकायत पर 126/135 की कार्यवाही"
 *    Soft-delete (set deleted_at) rather than hard-delete so format_usage_log
 *    history from previously generated reports remains intact and referenced.
 *
 * C) Orphan-check: IDs present in DB (active, src=system) but absent from the
 *    current seed file are logged as warnings. The reference set is derived
 *    dynamically from FORMATS_SEED at runtime — never a hardcoded stale list.
 *    src=user rows are explicitly excluded; they are never orphans by definition.
 */
async function _dedupSystemFormats(): Promise<void> {
  if (__DEV__) console.info('[SeedManager] _dedupSystemFormats starting');
  let hardDeleted = 0;
  let softDeleted = 0;

  try {

    // ── A) Hard-delete confirmed legacy near-duplicate ────────────────────────
    const LEGACY_DUPE_ID   = 'bafb59c2-2585-438c-b0c6-53bb0ad60fa8';
    const LEGACY_DUPE_CANONICAL = 'sys-fmt-bnss126-beat'; // reassign usage history here

    try {
      const dupeRow = await dbGetAllAsync<{ id: string; title: string; created_at: number }>(
        `SELECT id, title, created_at FROM predefined_formats
         WHERE id = ? AND deleted_at IS NULL`,
        [LEGACY_DUPE_ID]
      );

      if (dupeRow.length > 0) {
        const r = dupeRow[0];
        if (__DEV__) console.info(`[SeedManager/dedup] Legacy near-duplicate found: id=${r.id} title=${JSON.stringify(r.title)} created_at=${r.created_at}`);

        // Reassign any usage_log history to the canonical row before deleting.
        const usageCount = await dbGetFirstAsync<{ n: number }>(
          `SELECT COUNT(*) as n FROM format_usage_log WHERE format_id = ?`,
          [LEGACY_DUPE_ID]
        ).catch(() => ({ n: 0 }));

        if ((usageCount?.n ?? 0) > 0) {
          if (__DEV__) console.info(
            `[SeedManager/dedup] Reassigning ${usageCount!.n} usage_log row(s)` +
            ` from ${LEGACY_DUPE_ID} → ${LEGACY_DUPE_CANONICAL}`
          );
          await dbRunAsync(
            `UPDATE format_usage_log SET format_id = ? WHERE format_id = ?`,
            [LEGACY_DUPE_CANONICAL, LEGACY_DUPE_ID]
          );
        }

        await dbRunAsync(`DELETE FROM format_keys WHERE format_id = ?`, [LEGACY_DUPE_ID]);
        await dbRunAsync(`DELETE FROM format_tags WHERE format_id = ?`, [LEGACY_DUPE_ID]);
        await dbRunAsync(`DELETE FROM predefined_formats WHERE id = ?`, [LEGACY_DUPE_ID]);
        if (__DEV__) console.info(`[SeedManager/dedup] HARD-DELETED legacy duplicate id=${LEGACY_DUPE_ID}`);
        hardDeleted++;
      }
    } catch (e) {
      console.error(`[SeedManager/dedup] Failed to remove legacy duplicate ${LEGACY_DUPE_ID}:`, e);
    }

    // ── B) Soft-delete retired BNSS formats removed from seed ─────────────────
    const RETIRED_IDS: Array<{ id: string; label: string }> = [
      { id: 'sys-fmt-bnss126-nyayalay', label: 'न्यायालय आदेश पर 126/135 की कार्यवाही' },
      { id: 'sys-fmt-bnss126-shikayat', label: 'शिकायत पर 126/135 की कार्यवाही' },
    ];

    for (const { id, label } of RETIRED_IDS) {
      try {
        const rows = await dbGetAllAsync<{ id: string; deleted_at: number | null }>(
          `SELECT id, deleted_at FROM predefined_formats WHERE id = ?`,
          [id]
        );
        if (rows.length === 0) continue;
        if (rows[0].deleted_at != null) continue;

        const now = Date.now();
        await dbRunAsync(
          `UPDATE predefined_formats SET deleted_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, id]
        );
        if (__DEV__) console.info(`[SeedManager/dedup] SOFT-DELETED retired format id=${id} ("${label}")`);
        softDeleted++;
      } catch (e) {
        console.error(`[SeedManager/dedup] Failed to soft-delete retired format ${id}:`, e);
      }
    }

    // ── C) Auto-soft-delete orphan system rows not present in current seed ────
    // Any active system row whose ID is absent from the current seed file is
    // stale (format was removed from the bundle). Soft-delete so it disappears
    // from all list screens without losing format_usage_log history.
    // source='user' rows are never touched — officers' own formats are always kept.
    try {
      const seedIdSet = new Set(FORMATS_SEED.formats.map(f => f.id));
      RETIRED_IDS.forEach(r => seedIdSet.add(r.id));
      seedIdSet.add(LEGACY_DUPE_ID);

      const activeSystemRows = await dbGetAllAsync<{ id: string; title: string }>(
        `SELECT id, title FROM predefined_formats
         WHERE deleted_at IS NULL AND source = 'system'`
      );
      const orphanRows = activeSystemRows.filter(r => !seedIdSet.has(r.id));
      if (orphanRows.length > 0) {
        const now = Date.now();
        for (const r of orphanRows) {
          try {
            await dbRunAsync(
              `UPDATE predefined_formats SET deleted_at = ?, updated_at = ? WHERE id = ?`,
              [now, now, r.id]
            );
            console.info(
              `[SeedManager/dedup] AUTO-SOFT-DELETED orphan system format id=${r.id} ("${r.title}")`
            );
            softDeleted++;
          } catch (delErr) {
            console.error(`[SeedManager/dedup] Failed to soft-delete orphan ${r.id}:`, delErr);
          }
        }
      }
    } catch (orphanErr) {
      console.warn('[SeedManager/dedup] Orphan auto-cleanup failed:', orphanErr);
    }

  } catch (e) {
    console.error('[SeedManager/dedup] Unexpected error in _dedupSystemFormats:', e);
  }

  if (__DEV__) console.info(
    `[SeedManager] _dedupSystemFormats complete — ` +
    `hard-deleted: ${hardDeleted}, soft-deleted: ${softDeleted}`
  );
}

// ─── Formats seeding ──────────────────────────────────────────────────────────
async function _seedFormats(formats: SeedFormat[]): Promise<SeedResult> {
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };

  // ── Prefetch ALL existing rows via serialized wrapper ─────────────────────
  // Uses dbGetAllAsync (routes through _enqueue) so reads are correctly
  // serialized against any concurrent writes in progress.
  const placeholders = formats.map(() => '?').join(',');
  const existingRows = await dbGetAllAsync<{
    id: string; seed_version: number; source: string; content_hash: string;
  }>(
    `SELECT id, seed_version, source, content_hash FROM predefined_formats
     WHERE deleted_at IS NULL AND id IN (${placeholders})`,
    formats.map(f => f.id)
  );
  const existingMap = new Map(existingRows.map(r => [r.id, r]));
  if (__DEV__) console.log(`[SeedManager] _seedFormats prefetch: ${existingRows.length} existing rows for ${formats.length} seed entries`);

  // ── Per-row upserts via serialized dbRunAsync — no transaction wrapper ────
  // withTransactionAsync on the raw db instance bypasses _enqueue and causes
  // deadlocks when other serialized operations are in-flight. The _enqueue
  // queue itself serializes all writes; no explicit transaction is needed for
  // the idempotent INSERT/UPDATE logic below.
  for (const fmt of formats) {
    try {
      const bundledHash = _formatHash(fmt);
      const existing = existingMap.get(fmt.id) ?? null;

      if (!existing) {
        // ── INSERT: new system content ───────────────────────────────────────
        const now = nowTimestamp();
        const insertFormatParams = [
          fmt.id,
          fmt.title,
          fmt.format_type,
          fmt.vivran,
          fmt.is_favorite  ?? 0,
          fmt.created_by   ?? 'system',
          'system', 0,
          fmt.content_type ?? 'format',
          fmt.seed_version ?? 1,
          fmt.app_version  ?? '',
          bundledHash,
          fmt.last_updated ?? '',
          now, now,
        ];
        if (__DEV__) console.log('[SeedManager] About to INSERT format', fmt.id);
        try {
          await dbRunAsync(
            `INSERT INTO predefined_formats
               (id, title, format_type, vivran, is_favorite, created_by,
                source, editable, content_type, seed_version, app_version,
                content_hash, last_updated,
                created_at, updated_at, version, sync_status)
             VALUES (?,?,?,?,?,?, ?,?,?,?,?, ?,?, ?,?,1,'synced')`,
            insertFormatParams
          );
        } catch (e: unknown) {
          const err = e as { message?: string; stack?: string } | null;
          console.error(`[SeedManager] FAILED at INSERT format for ${fmt.id}:`,
            { message: err?.message, stack: err?.stack, raw: e });
          throw e;
        }

        // ── INSERT keys ──────────────────────────────────────────────────────
        for (let ki = 0; ki < fmt.keys.length; ki++) {
          const key = fmt.keys[ki];
          try {
            await dbRunAsync(
              `INSERT INTO format_keys
                 (id, format_id, key_name, label, field_type, is_required,
                  default_value, dropdown_options, sort_order, created_at, updated_at)
               VALUES (?,?,?,?,?,?, ?,?,?,?,?)`,
              [
                generateUUID(), fmt.id,
                key.key_name, key.label, key.field_type, key.is_required,
                key.default_value ?? null, key.dropdown_options ?? null, key.sort_order,
                now, now,
              ]
            );
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at INSERT key #${ki} (${key.key_name}) for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
        }

        // ── INSERT tags ──────────────────────────────────────────────────────
        for (const tag of [...new Set(fmt.tags)]) {
          try {
            await dbRunAsync(
              `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
              [generateUUID(), fmt.id, tag, now]
            );
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at INSERT tag '${tag}' for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
        }

        result.added++;

      } else if (existing.source === 'system') {
        // ── UPDATE: version bump OR content changed ──────────────────────────
        const storedVersion = existing.seed_version ?? 0;
        const storedHash    = existing.content_hash  ?? '';
        const needsUpdate   = fmt.seed_version > storedVersion || bundledHash !== storedHash;

        if (needsUpdate) {
          const now = nowTimestamp();
          try {
            await dbRunAsync(
              `UPDATE predefined_formats
                 SET title=?, format_type=?, vivran=?,
                     seed_version=?, app_version=?,
                     content_hash=?, last_updated=?,
                     updated_at=?, version=version+1
               WHERE id=?`,
              [
                fmt.title, fmt.format_type, fmt.vivran,
                fmt.seed_version ?? 1,
                fmt.app_version  ?? '',
                bundledHash,
                fmt.last_updated ?? '',
                now,
                fmt.id,
              ]
            );
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at UPDATE format for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }

          // Replace keys
          try {
            await dbRunAsync(`DELETE FROM format_keys WHERE format_id=?`, [fmt.id]);
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at DELETE format_keys for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
          for (let ki = 0; ki < fmt.keys.length; ki++) {
            const key = fmt.keys[ki];
            try {
              await dbRunAsync(
                `INSERT INTO format_keys
                   (id, format_id, key_name, label, field_type, is_required,
                    default_value, dropdown_options, sort_order, created_at, updated_at)
                 VALUES (?,?,?,?,?,?, ?,?,?,?,?)`,
                [
                  generateUUID(), fmt.id,
                  key.key_name, key.label, key.field_type, key.is_required,
                  key.default_value ?? null, key.dropdown_options ?? null, key.sort_order,
                  now, now,
                ]
              );
            } catch (e: unknown) {
              const err = e as { message?: string; stack?: string } | null;
              console.error(`[SeedManager] FAILED at UPDATE INSERT key #${ki} (${key.key_name}) for ${fmt.id}:`,
                { message: err?.message, stack: err?.stack, raw: e });
              throw e;
            }
          }

          // Replace tags
          try {
            await dbRunAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at DELETE format_tags for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
          for (const tag of [...new Set(fmt.tags)]) {
            try {
              await dbRunAsync(
                `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
                [generateUUID(), fmt.id, tag, now]
              );
            } catch (e: unknown) {
              const err = e as { message?: string; stack?: string } | null;
              console.error(`[SeedManager] FAILED at UPDATE INSERT tag '${tag}' for ${fmt.id}:`,
                { message: err?.message, stack: err?.stack, raw: e });
              throw e;
            }
          }

          result.updated++;
        } else {
          result.skipped++;
        }
        // existing.source === 'user' → skip, never overwrite
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error(`[SeedManager] format seed failed for ${fmt.id}:`, e);
      result.skipped++;
    }
  }

  return result;
}

// ─── Knowledge seeding with per-file reporting and constraint safety ─────────
async function _seedKnowledgeEntries(
  entries: SeedKnowledge[],
  fileName: string
): Promise<{ added: number; updated: number; skipped: number; errors: number; errorMessages: string[] }> {
  const result = { added: 0, updated: 0, skipped: 0, errors: 0, errorMessages: [] as string[] };
  if (entries.length === 0) return result;

  // Prefetch existing rows (include deleted_at so we know if row exists in DB, avoiding UNIQUE constraint error)
  const knPlaceholders = entries.map(() => '?').join(',');
  const knExistingRows = await dbGetAllAsync<{
    id: string; seed_version: number; source: string; content_hash: string; deleted_at: number | null;
  }>(
    `SELECT id, seed_version, source, content_hash, deleted_at FROM knowledge_entries
     WHERE id IN (${knPlaceholders})`,
    entries.map(e => e.id)
  );
  const knExistingMap = new Map(knExistingRows.map(r => [r.id, r]));
  if (__DEV__) {
    console.log(`[SeedManager] _seedKnowledgeEntries (${fileName}) prefetch: ${knExistingRows.length} existing rows for ${entries.length} seed entries`);
  }

  for (const kn of entries) {
    try {
      const bundledHash = _knowledgeHash(kn);
      const existing = knExistingMap.get(kn.id) ?? null;

      // Column mapping & constraint guarantees
      const tagsStr = typeof kn.tags === 'string'
        ? kn.tags
        : Array.isArray(kn.tags)
          ? (kn.tags as string[]).join(',')
          : '';
      const attachmentUris = typeof kn.attachment_uris === 'string'
        ? kn.attachment_uris
        : JSON.stringify(kn.attachment_uris ?? []);
      const contentType = kn.content_type || (kn.category === 'Circular' ? 'circular' : 'knowledge');
      const crimeType = kn.crime_type ?? '';
      const subcategory = kn.subcategory ?? '';
      const appVersion = kn.app_version ?? '';
      const seedVersion = kn.seed_version ?? 1;
      const lastUpdated = kn.last_updated ?? '';
      const itemTimestamp = _parseIsoDateToUnix(lastUpdated);

      if (!existing) {
        // INSERT: new system row
        await dbRunAsync(
          `INSERT INTO knowledge_entries
             (id, title, category, subcategory, crime_type, description,
              tags, attachment_uris,
              source, editable, content_type, seed_version, app_version,
              content_hash, last_updated,
              created_at, updated_at, version, sync_status)
           VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?, ?,?,1,'synced')`,
          [
            kn.id, kn.title, kn.category, subcategory, crimeType, kn.description ?? '',
            tagsStr, attachmentUris,
            'system', 0,
            contentType,
            seedVersion,
            appVersion,
            bundledHash,
            lastUpdated,
            itemTimestamp, itemTimestamp,
          ]
        );
        result.added++;
      } else if (existing.source === 'system') {
        const storedVersion = existing.seed_version ?? 0;
        const storedHash = existing.content_hash ?? '';
        // Keep soft-deleted-by-user system rows hidden; do not revive with deleted_at=NULL
        const needsUpdate = seedVersion > storedVersion || bundledHash !== storedHash;

        if (needsUpdate) {
          const now = nowTimestamp();
          await dbRunAsync(
            `UPDATE knowledge_entries
               SET title=?, category=?, subcategory=?, crime_type=?, description=?,
                   tags=?, attachment_uris=?, content_type=?, seed_version=?, app_version=?,
                   content_hash=?, last_updated=?,
                   updated_at=?, version=version+1
             WHERE id=?`,
            [
              kn.title, kn.category, subcategory, crimeType, kn.description ?? '',
              tagsStr, attachmentUris, contentType,
              seedVersion,
              appVersion,
              bundledHash,
              lastUpdated,
              now,
              kn.id,
            ]
          );
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // User entry with same ID: never overwrite user rows
        result.skipped++;
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      console.warn(`[SeedManager] Insert/update failed for entry ${kn.id} in ${fileName}: ${err}`);
      logger.warn(`[SeedManager] Insert/update failed for entry ${kn.id} in ${fileName}:`, e);
      result.errors++;
      result.errorMessages.push(`${kn.id}: ${err}`);
    }
  }

  return result;
}

async function _seedKnowledge(entries: SeedKnowledge[]): Promise<SeedResult> {
  const res = await _seedKnowledgeEntries(entries, 'knowledge_seed.json');
  return { added: res.added, updated: res.updated, skipped: res.skipped };
}

// ─── Developer Content Restore ────────────────────────────────────────────────

/**
 * restoreDevContent — Startup restore for Developer System Content.
 *
 * Must be called AFTER seedSystemContent() resolves (so the DB schema and
 * bundled system content are already in place).
 *
 * WHAT IT DOES
 * ────────────
 * 1. Reads developer-created formats + knowledge from the persistent adapter
 *    (localStorage on Expo Web / AsyncStorage on Android / iOS).
 * 2. For each item applies an upsert-by-UUID:
 *      – UUID not in DB → INSERT (cold start after browser refresh)
 *      – UUID exists    → UPDATE only if developer's seed_version is higher
 *        (prevents overwriting bundled content the developer hasn't edited)
 * 3. Never touches rows where source ≠ 'system' created by this developer.
 * 4. Logs Added / Updated / Skipped so the AppLogger ring-buffer captures it.
 *
 * PRODUCTION SAFETY
 * ─────────────────
 * - The call site in _layout.tsx is wrapped in `if (__DEV__)`.
 * - dcGet always returns null in production because devContentPersistence
 *   keys are never written outside of devSeedStore (which is __DEV__-only).
 * - Even if called accidentally in production the function is a complete no-op
 *   (empty arrays → no DB writes).
 */
export async function restoreDevContent(): Promise<SeedResult> {
  const t0 = Date.now();
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };
  try {
    // Lazy-import to keep the dependency out of the production bundle graph.
    // Metro will tree-shake this when the call site is inside __DEV__.
    const { dcGet, DC_KEY_FORMATS, DC_KEY_KNOWLEDGE } =
      await import('../devContentPersistence');

    // ── Formats — serialized upserts via dbRunAsync ───────────────────────────
    const fmtRaw = await dcGet(DC_KEY_FORMATS);
    if (fmtRaw) {
      const devFormats: SeedFormat[] = JSON.parse(fmtRaw);
      for (const fmt of devFormats) {
        try {
          const existing = await dbGetFirstAsync<{
            seed_version: number;
            source: string;
          }>(
            `SELECT seed_version, source FROM predefined_formats
              WHERE id = ? AND deleted_at IS NULL`,
            [fmt.id]
          );

          const now = nowTimestamp();

          if (!existing) {
            await dbRunAsync(
              `INSERT INTO predefined_formats
                 (id, title, format_type, vivran, is_favorite, created_by,
                  source, editable, seed_version, app_version, last_updated,
                  created_at, updated_at, version, sync_status)
               VALUES (?,?,?,?,0,'developer', ?,?,?,?,?, ?,?,1,'pending')`,
              [
                fmt.id, fmt.title, fmt.format_type ?? 'Any', fmt.vivran ?? '',
                fmt.source ?? 'system', fmt.editable ?? 0,
                fmt.seed_version ?? 1, fmt.app_version ?? '', fmt.last_updated ?? '',
                now, now,
              ]
            );
            await dbRunAsync(`DELETE FROM format_keys WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.keys)) {
              for (let i = 0; i < fmt.keys.length; i++) {
                const k = fmt.keys[i] as SeedFormatKey;
                await dbRunAsync(
                  `INSERT INTO format_keys
                     (id, format_id, key_name, label, field_type, is_required,
                      default_value, dropdown_options, sort_order, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    generateUUID(), fmt.id,
                    k.key_name, k.label, k.field_type, k.is_required,
                    k.default_value ?? null, k.dropdown_options ?? null, i,
                    now, now,
                  ]
                );
              }
            }
            await dbRunAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.tags)) {
              for (const tag of [...new Set(fmt.tags)]) {
                await dbRunAsync(
                  `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
                  [generateUUID(), fmt.id, tag, now]
                );
              }
            }
            result.added++;
          } else if (existing.source === 'system') {
            await dbRunAsync(
              `UPDATE predefined_formats
                 SET title=?, format_type=?, vivran=?,
                     seed_version=?, app_version=?, last_updated=?,
                     updated_at=?, version=version+1
               WHERE id=?`,
              [
                fmt.title, fmt.format_type ?? 'Any', fmt.vivran ?? '',
                fmt.seed_version ?? 1, fmt.app_version ?? '', fmt.last_updated ?? '',
                now, fmt.id,
              ]
            );
            await dbRunAsync(`DELETE FROM format_keys WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.keys)) {
              for (let i = 0; i < fmt.keys.length; i++) {
                const k = fmt.keys[i] as SeedFormatKey;
                await dbRunAsync(
                  `INSERT INTO format_keys
                     (id, format_id, key_name, label, field_type, is_required,
                      default_value, dropdown_options, sort_order, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    generateUUID(), fmt.id,
                    k.key_name, k.label, k.field_type, k.is_required,
                    k.default_value ?? null, k.dropdown_options ?? null, i,
                    now, now,
                  ]
                );
              }
            }
            await dbRunAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.tags)) {
              for (const tag of [...new Set(fmt.tags)]) {
                await dbRunAsync(
                  `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
                  [generateUUID(), fmt.id, tag, now]
                );
              }
            }
            result.updated++;
          } else {
            result.skipped++;
          }
        } catch (e) {
          console.error(`[SeedManager] restoreDevContent format failed for ${fmt.id}:`, e);
          result.skipped++;
        }
      }
    }

    // ── Knowledge — serialized upserts via dbRunAsync ─────────────────────────
    const knRaw = await dcGet(DC_KEY_KNOWLEDGE);
    if (knRaw) {
      const devKnowledge: SeedKnowledge[] = JSON.parse(knRaw);
      for (const kn of devKnowledge) {
        try {
          const existing = await dbGetFirstAsync<{
            seed_version: number;
            source: string;
          }>(
            `SELECT seed_version, source FROM knowledge_entries
              WHERE id = ? AND deleted_at IS NULL`,
            [kn.id]
          );

          const now = nowTimestamp();

          if (!existing) {
            await dbRunAsync(
              `INSERT INTO knowledge_entries
                 (id, title, category, subcategory, crime_type, description,
                  tags, attachment_uris,
                  source, editable, seed_version, app_version, last_updated,
                  created_at, updated_at, version, sync_status)
               VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?,1,'pending')`,
              [
                kn.id, kn.title, kn.category ?? '', kn.subcategory ?? '',
                kn.crime_type ?? '', kn.description ?? '',
                kn.tags ?? '', kn.attachment_uris ?? '[]',
                kn.source ?? 'system', kn.editable ?? 0,
                kn.seed_version ?? 1, kn.app_version ?? '', kn.last_updated ?? '',
                now, now,
              ]
            );
            result.added++;
          } else if (existing.source === 'system') {
            await dbRunAsync(
              `UPDATE knowledge_entries
                 SET title=?, category=?, subcategory=?, crime_type=?,
                     description=?, tags=?, attachment_uris=?,
                     seed_version=?, app_version=?, last_updated=?,
                     updated_at=?, version=version+1
               WHERE id=?`,
              [
                kn.title, kn.category ?? '', kn.subcategory ?? '',
                kn.crime_type ?? '', kn.description ?? '',
                kn.tags ?? '', kn.attachment_uris ?? '[]',
                kn.seed_version ?? 1, kn.app_version ?? '', kn.last_updated ?? '',
                now, kn.id,
              ]
            );
            result.updated++;
          } else {
            result.skipped++;
          }
        } catch (e) {
          console.error(`[SeedManager] restoreDevContent knowledge failed for ${kn.id}:`, e);
          result.skipped++;
        }
      }
    }

    const elapsed = Date.now() - t0;
    if (__DEV__) console.info(
      `[SeedManager] restoreDevContent complete in ${elapsed}ms — ` +
      `Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped} ` +
      `(ran AFTER seedSystemContent ✓)`
    );
  } catch (e) {
    console.error('[SeedManager] restoreDevContent failed:', e);
  }
  return result;
}

// ─── DEV ONLY: Export published system formats as seed JSON ──────────────────

/**
 * exportFormatsAsSeedJSON — __DEV__-only utility.
 *
 * Reads every published system format from the local DB (source='system',
 * status='published', deleted_at IS NULL) together with its keys and tags,
 * and returns a JSON string that can be pasted directly into
 * assets/seed/formats_seed.json.
 *
 * Workflow:
 *   1. Press "Export as Seed JSON" in sys-format-manager list screen.
 *   2. JSON is console.log'd AND copied to clipboard.
 *   3. Paste into assets/seed/formats_seed.json and ship.
 *
 * NOT exported in production — call site is wrapped in __DEV__.
 */
export async function exportFormatsAsSeedJSON(): Promise<string> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1. Fetch all published system formats ordered by id for stable output.
  const rows = await db.getAllAsync<{
    id: string; title: string; format_type: string; vivran: string;
    is_favorite: number; created_by: string; content_type: string;
    seed_version: number; app_version: string; last_updated: string;
  }>(
    `SELECT id, title, format_type, vivran, is_favorite, created_by,
            content_type, seed_version, app_version, last_updated
     FROM predefined_formats
     WHERE deleted_at IS NULL AND source = 'system' AND status = 'published'
     ORDER BY id ASC`
  );

  if (rows.length === 0) {
    if (__DEV__) console.warn('[SeedManager] exportFormatsAsSeedJSON: no published system formats found.');
    return JSON.stringify({ formats: [] }, null, 2);
  }

  // 2. Batch-fetch all keys and tags for matched format ids.
  const ids = rows.map(r => r.id);
  const ph  = ids.map(() => '?').join(',');

  const keyRows = await db.getAllAsync<{
    format_id: string; key_name: string; label: string;
    field_type: string; is_required: number; sort_order: number;
    default_value: string | null; dropdown_options: string | null;
  }>(
    `SELECT format_id, key_name, label, field_type, is_required, sort_order,
            default_value, dropdown_options
     FROM format_keys WHERE format_id IN (${ph}) ORDER BY format_id, sort_order ASC`,
    ids
  );
  const tagRows = await db.getAllAsync<{ format_id: string; tag: string }>(
    `SELECT format_id, tag FROM format_tags WHERE format_id IN (${ph}) ORDER BY format_id, tag ASC`,
    ids
  );

  // Build lookup maps.
  const keysMap = new Map<string, typeof keyRows>();
  const tagsMap = new Map<string, string[]>();
  for (const k of keyRows) {
    if (!keysMap.has(k.format_id)) keysMap.set(k.format_id, []);
    keysMap.get(k.format_id)!.push(k);
  }
  for (const t of tagRows) {
    if (!tagsMap.has(t.format_id)) tagsMap.set(t.format_id, []);
    tagsMap.get(t.format_id)!.push(t.tag);
  }

  // 3. Assemble seed-JSON-compatible objects.
  const formats = rows.map(r => {
    const keys = (keysMap.get(r.id) ?? []).map(k => {
      const entry: Record<string, unknown> = {
        key_name:    k.key_name,
        label:       k.label,
        field_type:  k.field_type,
        is_required: k.is_required,
        sort_order:  k.sort_order,
      };
      // Only include optional fields when they have a value.
      if (k.default_value   != null) entry.default_value   = k.default_value;
      if (k.dropdown_options != null) entry.dropdown_options = k.dropdown_options;
      return entry;
    });

    return {
      id:           r.id,
      title:        r.title,
      format_type:  r.format_type,
      vivran:       r.vivran,
      is_favorite:  0,              // always 0 in seed
      created_by:   'system',       // normalised for seed
      source:       'system',
      editable:     0,
      content_type: r.content_type ?? 'format',
      seed_version: r.seed_version ?? 1,
      app_version:  r.app_version  || '1.0.0',
      tags:         tagsMap.get(r.id) ?? [],
      keys,
      last_updated: r.last_updated || today,
    };
  });

  const output = JSON.stringify({ formats }, null, 2);
  if (__DEV__) console.log(
    `[SeedManager] exportFormatsAsSeedJSON — ${formats.length} format(s) exported:\n`,
    output
  );
  return output;
}