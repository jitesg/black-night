/**
 * devDiagnosticsRepo.ts — Read-only diagnostics and database utilities for
 * the Developer Options module.
 *
 * SAFETY CONTRACT:
 *  - COUNT / PRAGMA queries only — no INSERT, UPDATE, DELETE on user data.
 *  - VACUUM and PRAGMA optimize affect storage layout only.
 *  - All functions are safe to call concurrently (read-only or idempotent).
 *  - Never imported by business-logic code — only by DevOptions screens.
 */

import { getDatabase } from './database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiagnosticsSnapshot {
  totalFIR: number;
  totalGD: number;
  totalCourtFiles: number;
  totalFormats: number;
  totalKnowledge: number;
  totalVillages: number;
  totalAttachments: number;
  databaseSizeKB: number;
  pageCount: number;
  pageSize: number;
  freelistCount: number;
  integrityOk: boolean;
  foreignKeyErrors: number;
}

export interface TableStat {
  name: string;
  rowCount: number;
}

// ── Count helpers ─────────────────────────────────────────────────────────────

async function countTable(tableName: string): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM ${tableName} WHERE deleted_at IS NULL`
    );
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getDiagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  const db = await getDatabase();

  const [
    totalFIR, totalGD, totalCourtFiles, totalFormats,
    totalKnowledge, totalVillages,
  ] = await Promise.all([
    countTable('firs'),
    countTable('gd_entries'),
    countTable('nyayalay_documents'),
    countTable('predefined_formats'),
    countTable('knowledge_entries'),
    countTable('gram_panchayats'),
  ]);

  // Attachments — knowledge_entries vivran length as proxy (no attachment table yet)
  const totalAttachments = 0;

  // Database size via PRAGMAs
  const pageCountRow = await db.getFirstAsync<{ page_count: number }>('PRAGMA page_count');
  const pageSizeRow  = await db.getFirstAsync<{ page_size: number }>('PRAGMA page_size');
  const freelistRow  = await db.getFirstAsync<{ freelist_count: number }>('PRAGMA freelist_count');

  const pageCount    = pageCountRow?.page_count ?? 0;
  const pageSize     = pageSizeRow?.page_size ?? 4096;
  const freelistCount = freelistRow?.freelist_count ?? 0;
  const databaseSizeKB = Math.round((pageCount * pageSize) / 1024);

  // Integrity check (quick — doesn't scan all rows)
  let integrityOk = true;
  try {
    const row = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check(1)');
    integrityOk = row?.integrity_check === 'ok';
  } catch { integrityOk = false; }

  // Foreign key check
  let foreignKeyErrors = 0;
  try {
    const rows = await db.getAllAsync<{ table: string }>('PRAGMA foreign_key_check');
    foreignKeyErrors = rows.length;
  } catch { foreignKeyErrors = -1; }

  return {
    totalFIR, totalGD, totalCourtFiles, totalFormats,
    totalKnowledge, totalVillages, totalAttachments,
    databaseSizeKB, pageCount, pageSize, freelistCount,
    integrityOk, foreignKeyErrors,
  };
}

export async function getAllTableStats(): Promise<TableStat[]> {
  const db = await getDatabase();
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  const stats: TableStat[] = [];
  for (const { name } of tables) {
    try {
      const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM "${name}"`);
      stats.push({ name, rowCount: row?.c ?? 0 });
    } catch {
      stats.push({ name, rowCount: -1 });
    }
  }
  return stats;
}

export async function runIntegrityCheck(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  return rows.map((r) => r.integrity_check);
}

export async function runForeignKeyCheck(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ table: string; rowid: number; parent: string; fkid: number }>(
    'PRAGMA foreign_key_check'
  );
  if (rows.length === 0) return ['No foreign key violations found.'];
  return rows.map((r) => `Table: ${r.table} rowid=${r.rowid} parent=${r.parent} fkid=${r.fkid}`);
}

export async function vacuumDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('VACUUM');
}

export async function optimizeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA optimize');
  await db.execAsync('ANALYZE');
}

export async function getSchemaVersion(): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    return row?.user_version ?? 0;
  } catch {
    return 0;
  }
}

export async function validateSchema(): Promise<string[]> {
  const db = await getDatabase();
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  const issues: string[] = [];
  const expectedTables = [
    'workspace_settings', 'gram_panchayats', 'hamlets', 'persons', 'religious_places',
    'social_institutions', 'liquor_shops', 'firs', 'fir_accused', 'fir_karyvahi',
    'case_diaries', 'case_diary_karyvahi', 'predefined_formats', 'format_keys',
    'format_tags', 'format_usage_log', 'gd_entries', 'knowledge_entries',
    'investigation_checklists', 'checklist_items', 'nirodhatmak_karyvahi',
    'prarthna_patra', 'prarthna_patra_reports', 'nyayalay_documents',
    'nyayalay_persons', 'nyayalay_reports', 'nyayalay_checklist_items',
    'sys_formats', 'sys_format_versions', 'sys_format_audit',
  ];
  const found = new Set(tables.map((t) => t.name));
  for (const t of expectedTables) {
    if (!found.has(t)) issues.push(`Missing table: ${t}`);
  }
  if (issues.length === 0) issues.push('All expected tables present.');
  return issues;
}
