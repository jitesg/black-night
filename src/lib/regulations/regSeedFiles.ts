/// <reference types="expo/types/metro-require" />
/**
 * regSeedFiles.ts — every assets/seed/reg_seed_<n>.json, found at build time.
 *
 * Metro's require.context bundles all files matching the pattern, so later
 * data runs (L36+) only need to drop reg_seed_2.json, reg_seed_3.json … into
 * assets/seed — no code change. Each file uses the normal
 * {"knowledge":[...]} seed shape.
 */

export interface RegSeedRow {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  crime_type?: string;
  description?: string;
  tags?: string;
  attachment_uris?: string;
  source?: string;
  editable?: number | string;
  content_type?: string;
  seed_version?: number | string;
  app_version?: string;
  last_updated?: string;
}

export interface RegSeedFile {
  fileName: string;
  rows: RegSeedRow[];
  /** Set when the file could not be read (bad JSON / shape). */
  error?: string;
}

function fileNumber(name: string): number {
  const m = /reg_seed_(\d+)\.json$/.exec(name);
  return m ? Number(m[1]) : 0;
}

function loadRegSeedFiles(): RegSeedFile[] {
  let ctx: { keys(): string[]; (id: string): unknown };
  try {
    ctx = require.context('../../../assets/seed', false, /^\.\/reg_seed_\d+\.json$/);
  } catch (e) {
    console.warn('[regSeedFiles] require.context unavailable:', e);
    return [];
  }
  return ctx
    .keys()
    .sort((a, b) => fileNumber(a) - fileNumber(b))
    .map((key) => {
      const fileName = key.replace(/^\.\//, '');
      try {
        const data = ctx(key) as { knowledge?: RegSeedRow[] } | null;
        const rows = Array.isArray(data?.knowledge) ? data!.knowledge! : [];
        return {
          fileName,
          rows: rows.map((r) => ({
            ...r,
            category: r.category || 'Law',
            source: 'system',
            editable: 0,
            content_type: r.content_type || 'regulation',
            seed_version: Number(r.seed_version ?? 1) || 1,
          })),
        };
      } catch (e) {
        return { fileName, rows: [], error: e instanceof Error ? e.message : String(e) };
      }
    });
}

export const REG_SEED_FILES: RegSeedFile[] = loadRegSeedFiles();

export const REG_SEED_ROWS: RegSeedRow[] = REG_SEED_FILES.flatMap((f) => f.rows);
