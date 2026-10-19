/**
 * Knowledge Diagnostics Collector (Task L18D)
 * Dev-only diagnostics for investigating Knowledge -> परिपत्र 0 on user's device.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getDatabase, getIsUsingStub, dbGetAllAsync, dbGetFirstAsync, dbRunAsync } from '@/lib/db/database';
import { getKnowledgeAnalytics, searchKnowledge, type KnowledgeAnalytics } from '@/lib/db/knowledgeRepo';
import { getCategoryLabel, getCanonicalCategory } from '@/lib/knowledgeConstants';
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
import formatsSeedData from '../../../assets/seed/formats_seed.json';
import knowledgeSeedData from '../../../assets/seed/knowledge_seed.json';
import { REG_SEED_FILES } from '@/lib/regulations/regSeedFiles';
import { getRegIndex, getRegIndexError } from '@/lib/regulations/regIndex';
import { CIRCULAR_SEED_FILES } from '@/lib/db/seedManager';
import {
  FORMATS_FILE_TOKEN,
  KNOWLEDGE_FILE_TOKEN,
  CIRCULARS_FILE_TOKEN,
  CIRCULARS_2_FILE_TOKEN,
  CIRCULARS_3_FILE_TOKEN,
  CIRCULARS_4_FILE_TOKEN,
  CIRCULARS_5_FILE_TOKEN,
  CIRCULARS_6_FILE_TOKEN,
  CIRCULARS_7_FILE_TOKEN,
  CIRCULARS_8_FILE_TOKEN,
  SOP_1_FILE_TOKEN,
  SOP_2_FILE_TOKEN,
  getPerSeedFileStatus,
  getSeedTimestamps,
} from '@/lib/db/seedManager';

export const KNOWLEDGE_DIAG_BUILD = 'L18D';

export interface DiagnosticsReport {
  rawReport: string;
  timestamp: number;
}

export async function runKnowledgeDiagnostics(): Promise<string> {
  const lines: string[] = [];
  const log = (msg: string) => lines.push(msg);

  log('=== KNOWLEDGE MODULE DIAGNOSTIC REPORT (TASK L18D) ===');
  log(`Generated At: ${new Date().toISOString()} (${Date.now()})`);
  log('');

  // ── 1) Platform and DB driver ──────────────────────────────────────────────
  log('--- 1) PLATFORM & DB DRIVER ---');
  const isStub = getIsUsingStub();
  const driverType = isStub
    ? 'Web in-memory stub (_mem with localStorage persistence)'
    : Platform.OS === 'web'
      ? 'Web Native SQLite / Fallback'
      : `Native SQLite (Platform.OS=${Platform.OS})`;
  log(`Platform OS: ${Platform.OS} (EXPO_OS=${process.env.EXPO_OS})`);
  log(`DB Driver: ${driverType}`);
  log(`Is Using Stub: ${isStub}`);

  // Storage key / DB name
  const storagePrefix = '__investsuite_stub_';
  log(`Storage Key Prefix: ${storagePrefix}`);
  if (typeof localStorage !== 'undefined') {
    const lsKeys = Object.keys(localStorage).filter(k => k.startsWith(storagePrefix) || k.includes('investsuite'));
    log(`LocalStorage keys present (${lsKeys.length}): ${lsKeys.join(', ') || 'none'}`);
  } else {
    log('LocalStorage: not available in current environment');
  }

  // Schema version from app_migrations / pragma
  try {
    const migrations = await dbGetAllAsync<{ migration_name: string; applied_at: number }>(
      `SELECT migration_name, applied_at FROM app_migrations ORDER BY applied_at ASC`
    );
    log(`Applied Schema Migrations (${migrations.length}): ${migrations.map(m => m.migration_name).join(', ') || 'none'}`);
  } catch (e: any) {
    log(`Schema Version Query Error: ${e?.message || String(e)}`);
  }

  // PRAGMA table_info for app_settings & workspace_settings
  try {
    const asCols = await dbGetAllAsync<{ name: string; type: string }>(
      `PRAGMA table_info(app_settings)`
    );
    log(`Table app_settings Columns (${asCols.length}): ${asCols.map(c => `${c.name}(${c.type})`).join(', ') || 'TABLE_NOT_FOUND'}`);
  } catch (e: any) {
    log(`app_settings table_info Error: ${e?.message || String(e)}`);
  }
  try {
    const wsCols = await dbGetAllAsync<{ name: string; type: string }>(
      `PRAGMA table_info(workspace_settings)`
    );
    log(`Table workspace_settings Columns (${wsCols.length}): ${wsCols.map(c => `${c.name}(${c.type})`).join(', ') || 'TABLE_NOT_FOUND'}`);
  } catch (e: any) {
    log(`workspace_settings table_info Error: ${e?.message || String(e)}`);
  }
  log('');

  // ── 2) Seeding per file ───────────────────────────────────────────────────
  log('--- 2) SEEDING PER FILE STATUS ---');
  const seedFiles = [
    {
      fileName: 'formats_seed.json',
      bundledCount: (formatsSeedData as any)?.formats?.length ?? 0,
      computedHash: FORMATS_FILE_TOKEN,
      settingKey: 'seed_file:formats_seed.json',
    },
    {
      fileName: 'knowledge_seed.json',
      bundledCount: (knowledgeSeedData as any)?.knowledge?.length ?? 0,
      computedHash: KNOWLEDGE_FILE_TOKEN,
      settingKey: 'seed_file:knowledge_seed.json',
    },
    {
      fileName: 'circulars_seed.json',
      bundledCount: (circularsSeedData as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed.json',
    },
    {
      fileName: 'circulars_seed_2.json',
      bundledCount: (circularsSeed2Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_2_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_2.json',
    },
    {
      fileName: 'circulars_seed_3.json',
      bundledCount: (circularsSeed3Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_3_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_3.json',
    },
    {
      fileName: 'circulars_seed_4.json',
      bundledCount: (circularsSeed4Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_4_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_4.json',
    },
    {
      fileName: 'circulars_seed_5.json',
      bundledCount: (circularsSeed5Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_5_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_5.json',
    },
    {
      fileName: 'circulars_seed_6.json',
      bundledCount: (circularsSeed6Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_6_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_6.json',
    },
    {
      fileName: 'circulars_seed_7.json',
      bundledCount: (circularsSeed7Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_7_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_7.json',
    },
    {
      fileName: 'circulars_seed_8.json',
      bundledCount: (circularsSeed8Data as any)?.knowledge?.length ?? 0,
      computedHash: CIRCULARS_8_FILE_TOKEN,
      settingKey: 'seed_file:circulars_seed_8.json',
    },
    {
      fileName: 'sop_seed_1.json',
      bundledCount: (sopSeed1Data as any)?.knowledge?.length ?? 0,
      computedHash: SOP_1_FILE_TOKEN,
      settingKey: 'seed_file:sop_seed_1.json',
    },
    {
      fileName: 'sop_seed_2.json',
      bundledCount: (sopSeed2Data as any)?.knowledge?.length ?? 0,
      computedHash: SOP_2_FILE_TOKEN,
      settingKey: 'seed_file:sop_seed_2.json',
    },
    // UP Police Regulations: every reg_seed_<n>.json (Task L35)
    ...REG_SEED_FILES.map((f) => ({
      fileName: f.fileName,
      bundledCount: f.rows.length,
      computedHash: CIRCULAR_SEED_FILES.find((x) => x.fileName === f.fileName)?.fileToken ?? '',
      settingKey: `seed_file:${f.fileName}`,
    })),
  ];

  const inMemoryStatuses = getPerSeedFileStatus();

  for (const sf of seedFiles) {
    log(`File: ${sf.fileName}`);
    log(`  Bundled Entries Count: ${sf.bundledCount}`);
    log(`  Computed Hash: ${sf.computedHash}`);

    try {
      const storedToken = await dbGetFirstAsync<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = ?`,
        [sf.settingKey]
      );
      log(`  Stored Token in app_settings: ${storedToken?.value ?? 'NULL (not set)'}`);
      log(`  Token Match: ${storedToken?.value === sf.computedHash}`);
    } catch (e: any) {
      log(`  Stored Token Query Error: ${e?.message || String(e)}`);
    }

    // Persisted last run result
    try {
      const lastRunSetting = await dbGetFirstAsync<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = ?`,
        [`seed_last_run:${sf.fileName}`]
      );
      if (lastRunSetting?.value) {
        log(`  Persisted Last Run Info: ${lastRunSetting.value}`);
      } else {
        log(`  Persisted Last Run Info: None in app_settings`);
      }
    } catch (e: any) {
      log(`  Persisted Last Run Query Error: ${e?.message || String(e)}`);
    }

    // In-memory status for current session
    const memSt = inMemoryStatuses.find(s => s.fileName === sf.fileName);
    if (memSt) {
      log(`  Current Session In-Memory Status:`);
      log(`    Entries Read: ${memSt.entriesRead}`);
      log(`    Inserted: ${memSt.inserted}, Updated: ${memSt.updated}, Skipped: ${memSt.skipped}, Errors: ${memSt.errors}`);
      log(`    Error Messages: ${memSt.errorMessages.length > 0 ? JSON.stringify(memSt.errorMessages) : 'None'}`);
    } else {
      log(`  Current Session In-Memory Status: None recorded yet`);
    }
  }
  log('');

  // ── 3) Timestamps & Ordering ──────────────────────────────────────────────
  // ── 2b) UP Police Regulations (Task L35) ──────────────────────────────────
  log('--- 2b) UP POLICE REGULATIONS ---');
  try {
    const idx = getRegIndex();
    log(`Sidecar reg_index.json: ${idx ? `${Object.keys(idx.paras).length} paras, ${idx.chapters.length} chapters` : `NOT LOADED (${getRegIndexError() ?? 'unknown'})`}`);
    const regRows = await dbGetAllAsync<{ id: string }>(
      `SELECT id FROM knowledge_entries WHERE deleted_at IS NULL AND (content_type = 'regulation' OR id LIKE 'sys-reg-%')`
    ).catch(() => [] as { id: string }[]);
    const withDone = regRows.filter((r) => idx?.paras[r.id]?.done).length;
    const missing = regRows.filter((r) => !idx?.paras[r.id]).map((r) => r.id);
    log(`Regulation rows in DB: ${regRows.length}`);
    log(`  with sidecar done=true: ${withDone}`);
    log(`  sidecar entry missing: ${missing.length}${missing.length ? ` (${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''})` : ''}`);
    for (const f of REG_SEED_FILES) {
      log(`  seed file ${f.fileName}: ${f.error ? `ERROR ${f.error}` : `${f.rows.length} rows bundled`}`);
    }
  } catch (e: any) {
    log(`Regulations diagnostics error: ${e?.message || String(e)}`);
  }
  log('');

  log('--- 3) TIMESTAMPS & ORDERING ---');
  const ts = getSeedTimestamps();
  log(`App Start Time: ${ts.appStart ? new Date(ts.appStart).toISOString() + ` (${ts.appStart})` : 'NOT_SET'}`);
  log(`Seed Start Time: ${ts.seedStart ? new Date(ts.seedStart).toISOString() + ` (${ts.seedStart})` : 'NOT_SET'}`);
  log(`Seed End Time: ${ts.seedEnd ? new Date(ts.seedEnd).toISOString() + ` (${ts.seedEnd})` : 'NOT_SET'}`);
  log(`Seed Completed in this session: ${ts.seedCompleted ? 'YES' : 'NO'}`);
  log(`First Knowledge Count Query Time: ${ts.firstKnowledgeCountQuery ? new Date(ts.firstKnowledgeCountQuery).toISOString() + ` (${ts.firstKnowledgeCountQuery})` : 'NOT_YET_CALLED'}`);

  if (ts.firstKnowledgeCountQuery && ts.seedEnd) {
    const diff = ts.firstKnowledgeCountQuery - ts.seedEnd;
    log(`Diff (First Count Query - Seed End): ${diff}ms`);
    if (diff < 0) {
      log(`FLAG: Count query ran ${Math.abs(diff)}ms BEFORE seed finished!`);
    } else {
      log(`FLAG: Count query ran ${diff}ms AFTER seed finished (OK).`);
    }
  } else if (ts.firstKnowledgeCountQuery && !ts.seedEnd) {
    log(`FLAG: Count query ran BEFORE seed finished!`);
  } else {
    log(`FLAG: Order normal or count query has not run yet.`);
  }
  log('');

  // ── 4) Raw table facts ────────────────────────────────────────────────────
  log('--- 4) RAW TABLE FACTS ---');
  try {
    const totalRow = await dbGetFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM knowledge_entries`
    );
    log(`SELECT COUNT(*) FROM knowledge_entries: ${totalRow?.cnt ?? 'N/A'}`);

    const activeTotalRow = await dbGetFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM knowledge_entries WHERE deleted_at IS NULL`
    );
    log(`SELECT COUNT(*) FROM knowledge_entries WHERE deleted_at IS NULL: ${activeTotalRow?.cnt ?? 'N/A'}`);

    // Grouped by raw category string
    const rawCategories = await dbGetAllAsync<{ category: string; cnt: number }>(
      `SELECT category, COUNT(*) as cnt FROM knowledge_entries GROUP BY category`
    );
    log(`Counts grouped by raw category string (${rawCategories.length} categories):`);
    for (const rc of rawCategories) {
      const strVal = String(rc.category);
      log(`  "${strVal}" (length=${strVal.length}): count=${rc.cnt}`);
    }

    // Grouped by (category, source, deleted_at IS NULL)
    // Stub might not do multiple group by columns, let's fetch individual fields or group in JS if needed
    const allRows = await dbGetAllAsync<{ category: string; source: string; deleted_at: number | null }>(
      `SELECT category, source, deleted_at FROM knowledge_entries`
    );
    const complexGroup = new Map<string, number>();
    for (const r of allRows) {
      const key = `category="${r.category}" (len=${String(r.category).length}) | source="${r.source}" | active=${r.deleted_at === null}`;
      complexGroup.set(key, (complexGroup.get(key) ?? 0) + 1);
    }
    log(`Grouped by (category, source, deleted_at IS NULL) from ${allRows.length} rows:`);
    for (const [k, v] of complexGroup.entries()) {
      log(`  ${k} => count=${v}`);
    }

    // List the 3 circular IDs
    const targetCircIds = [
      'sys-circ-dg-12-2012',
      'sys-circ-ardh-14-2012',
      'sys-circ-ardh-dg-15-2012',
    ];
    log(`Looking for 3 circular IDs:`);
    for (const cid of targetCircIds) {
      const row = await dbGetFirstAsync<any>(
        `SELECT * FROM knowledge_entries WHERE id = ?`,
        [cid]
      );
      if (row) {
        log(`  ID ${cid}: FOUND -> ${JSON.stringify(row)}`);
      } else {
        log(`  ID ${cid}: NOT FOUND`);
      }
    }
  } catch (e: any) {
    log(`Raw Table Facts Query Error: ${e?.message || String(e)}`);
  }
  log('');

  // ── 5) Analytics and searchKnowledge results ─────────────────────────────
  log('--- 5) GETKNOWLEDGEANALYTICS & SEARCHKNOWLEDGE ---');
  try {
    const analytics = await getKnowledgeAnalytics();
    log(`getKnowledgeAnalytics() raw return: ${JSON.stringify(analytics)}`);

    // Circular queries
    const searchVariants = ['Circular', 'Circulars', 'परिपत्र'];
    for (const variant of searchVariants) {
      const canonical = getCanonicalCategory(variant);
      const executedSql = `SELECT * FROM knowledge_entries WHERE deleted_at IS NULL AND category IN (?, ?) ORDER BY updated_at DESC`;
      const executedParams = [canonical, variant];
      const res = await searchKnowledge(variant, '');
      const firstId = res.length > 0 ? res[0].id : 'NONE';
      log(`searchKnowledge('${variant}') -> canonical='${canonical}', length=${res.length}, firstId=${firstId}`);
      log(`  SQL: ${executedSql} | Params: ${JSON.stringify(executedParams)}`);
    }
  } catch (e: any) {
    log(`Analytics / Search Query Error: ${e?.message || String(e)}`);
  }
  log('');

  // ── 6) Stub capability tests ──────────────────────────────────────────────
  log('--- 6) WEB SQLITE STUB CAPABILITY TESTS ---');
  const dummyId = 'diag-test-1';
  try {
    // Test 6a: INSERT OR REPLACE
    let passIns = false;
    try {
      await dbRunAsync(
        `INSERT OR REPLACE INTO knowledge_entries
           (id, title, category, subcategory, crime_type, description,
            tags, attachment_uris, source, editable, content_type,
            seed_version, app_version, content_hash, last_updated,
            created_at, updated_at, version, sync_status)
         VALUES (?, 'Diag Test', 'Circular', 'Test Sub', '', 'Description',
                 '', '[]', 'system', 0, 'circular', 1, '1.0.0', 'hash', '',
                 1700000000, 1700000000, 1, 'synced')`,
        [dummyId]
      );
      const inserted = await dbGetFirstAsync<{ id: string; category: string }>(
        `SELECT id, category FROM knowledge_entries WHERE id = ?`,
        [dummyId]
      );
      passIns = inserted?.id === dummyId && inserted?.category === 'Circular';
    } catch (e: any) {
      log(`  Test 6a (INSERT OR REPLACE) threw: ${e?.message || String(e)}`);
    }
    log(`  Test 6a: INSERT OR REPLACE dummy row -> ${passIns ? 'PASS' : 'FAIL'}`);

    // Test 6b: SELECT with IN (...)
    let passIn = false;
    try {
      const inRes = await dbGetAllAsync<{ id: string }>(
        `SELECT id FROM knowledge_entries WHERE id IN (?, ?)`,
        [dummyId, 'non-existent-id']
      );
      passIn = inRes.length === 1 && inRes[0].id === dummyId;
    } catch (e: any) {
      log(`  Test 6b (SELECT with IN) threw: ${e?.message || String(e)}`);
    }
    log(`  Test 6b: SELECT with IN (?, ?) -> ${passIn ? 'PASS' : 'FAIL'}`);

    // Test 6c: GROUP BY COUNT(*)
    let passGroupBy = false;
    try {
      const gbRes = await dbGetAllAsync<{ category: string; cnt: number }>(
        `SELECT category, COUNT(*) as cnt FROM knowledge_entries WHERE deleted_at IS NULL GROUP BY category`
      );
      const circGroup = gbRes.find(g => g.category === 'Circular');
      passGroupBy = (circGroup?.cnt ?? 0) >= 1;
    } catch (e: any) {
      log(`  Test 6c (GROUP BY COUNT(*)) threw: ${e?.message || String(e)}`);
    }
    log(`  Test 6c: GROUP BY COUNT(*) -> ${passGroupBy ? 'PASS' : 'FAIL'}`);

    // Test 6d: WHERE deleted_at IS NULL
    let passNull = false;
    try {
      const nullRes = await dbGetFirstAsync<{ id: string }>(
        `SELECT id FROM knowledge_entries WHERE id = ? AND deleted_at IS NULL`,
        [dummyId]
      );
      passNull = nullRes?.id === dummyId;
    } catch (e: any) {
      log(`  Test 6d (WHERE deleted_at IS NULL) threw: ${e?.message || String(e)}`);
    }
    log(`  Test 6d: WHERE deleted_at IS NULL -> ${passNull ? 'PASS' : 'FAIL'}`);

    // Cleanup dummy row
    await dbRunAsync(`DELETE FROM knowledge_entries WHERE id = ?`, [dummyId]);
    const afterDelete = await dbGetFirstAsync<{ id: string }>(
      `SELECT id FROM knowledge_entries WHERE id = ?`,
      [dummyId]
    );
    log(`  Cleanup dummy row: ${!afterDelete ? 'PASS (cleaned up)' : 'FAIL (still present)'}`);
  } catch (e: any) {
    log(`Stub Capability Tests Error: ${e?.message || String(e)}`);
  }
  log('');

  // ── 7) Direct test: insert first circular row inside try/catch ────────────
  log('--- 7) DIRECT TEST: INSERT FIRST CIRCULAR ROW ---');
  const circEntries = (circularsSeedData as any)?.knowledge ?? [];
  const firstCirc = circEntries[0];
  if (!firstCirc) {
    log('  No circular entry found in circulars_seed.json!');
  } else {
    log(`  Target circular id: ${firstCirc.id} (${firstCirc.title})`);
    // Check if it already exists before test
    const preCheck = await dbGetFirstAsync<{ id: string }>(
      `SELECT id FROM knowledge_entries WHERE id = ?`,
      [firstCirc.id]
    );
    const existedBefore = !!preCheck;
    log(`  Existed in DB before direct test: ${existedBefore}`);

    try {
      const tagsStr = typeof firstCirc.tags === 'string'
        ? firstCirc.tags
        : Array.isArray(firstCirc.tags)
          ? firstCirc.tags.join(',')
          : '';
      const attachmentUris = typeof firstCirc.attachment_uris === 'string'
        ? firstCirc.attachment_uris
        : JSON.stringify(firstCirc.attachment_uris ?? []);

      await dbRunAsync(
        `INSERT INTO knowledge_entries
           (id, title, category, subcategory, crime_type, description,
            tags, attachment_uris,
            source, editable, content_type, seed_version, app_version,
            content_hash, last_updated,
            created_at, updated_at, version, sync_status)
         VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?, ?,?,1,'synced')`,
        [
          firstCirc.id, firstCirc.title, firstCirc.category, firstCirc.subcategory ?? '', firstCirc.crime_type ?? '',
          firstCirc.description ?? '', tagsStr, attachmentUris,
          'system', 0,
          firstCirc.content_type || 'circular',
          firstCirc.seed_version ?? 1,
          firstCirc.app_version ?? '',
          'diag-direct-hash',
          firstCirc.last_updated ?? '',
          1700000000, 1700000000,
        ]
      );
      log(`  Direct INSERT result: SUCCESS`);

      // Verify row is selectable
      const verifyRow = await dbGetFirstAsync<any>(
        `SELECT id, category, deleted_at FROM knowledge_entries WHERE id = ?`,
        [firstCirc.id]
      );
      log(`  Select verification: ${JSON.stringify(verifyRow)}`);

      // Rollback / delete if it was NOT there before
      if (!existedBefore) {
        await dbRunAsync(`DELETE FROM knowledge_entries WHERE id = ?`, [firstCirc.id]);
        log(`  Rollback: Deleted newly inserted row to preserve initial state.`);
      } else {
        log(`  Rollback: Kept row because it already existed before.`);
      }
    } catch (e: any) {
      log(`  Direct INSERT FAILED with full error: ${e?.message || String(e)}`);
      if (e?.stack) {
        log(`  Error stack: ${e.stack}`);
      }
    }
  }
  log('');

  // ── 8) Version / Build info ───────────────────────────────────────────────
  log('--- 8) VERSION & BUILD INFO ---');
  log(`App Version: ${Constants.expoConfig?.version ?? '1.0.0'}`);
  log(`KNOWLEDGE_DIAG_BUILD: ${KNOWLEDGE_DIAG_BUILD}`);
  log(`Expo SDK Version: ${Constants.expoConfig?.sdkVersion ?? 'Unknown'}`);
  log(`Constants.expoRuntimeVersion: ${(Constants as any)?.expoRuntimeVersion ?? 'N/A'}`);
  log(`seed_content_version in app_settings:`);
  try {
    const scv = await dbGetFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'seed_content_version'`
    );
    log(`  ${scv?.value ?? 'NULL'}`);
  } catch (e: any) {
    log(`  Error: ${e?.message || String(e)}`);
  }

  log('');
  log('=== END OF DIAGNOSTIC REPORT ===');

  return lines.join('\n');
}
