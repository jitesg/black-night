import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import checklistItemsSeed from '../../../assets/seed/checklist_items_seed.json';
import { ensurePlaybookSeeded } from './playbookSeed';
import { logger } from '../logger';

// expo-sqlite's accepted bind-parameter type
type BindParams = SQLite.SQLiteBindValue[];

let db: SQLite.SQLiteDatabase | null = null;
let dbReady = false;
// Promise-based mutex: prevents concurrent getDatabase() calls from each
// opening a separate DB connection, which can cause WAL locking races during
// schema initialization and leave the module-level `db` pointer in an
// inconsistent state between sessions.
let _initPromise: Promise<void> | null = null;

// ── Write-serialization queue ─────────────────────────────────────────────────
// expo-sqlite's native driver does NOT serialize concurrent prepare/step/finalize
// cycles on its own. When two async functions (e.g. seedSystemContent and
// restoreDevContent) each call db.runAsync() without waiting for the other,
// their statement lifecycles can interleave, producing "Error finalizing
// statement" crashes.
//
// Fix: every db.runAsync / db.getFirstAsync / db.getAllAsync call is routed
// through _enqueue(), which chains each operation onto a single promise tail.
// This guarantees strict FIFO execution of all DB operations across all modules,
// with no changes to the public API surface.
//
// The queue is module-level (one per JS bundle) so it covers all callers that
// import getDatabase() from this file — seedManager, predefinedFormatRepo,
// all other repos — without any coordination between them.
let _writeQueue: Promise<unknown> = Promise.resolve();

function _enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = _writeQueue.then(() => fn(), () => fn());
  // Always advance the tail even if fn() rejects, so the queue never stalls.
  _writeQueue = next.catch(() => {});
  return next;
}

// Once we determine SQLite is non-functional we cache a single stub
// instance so all operations within the session share the same _mem store.
let _useStub = false;
let _stubSingleton: SQLite.SQLiteDatabase | null = null;

// ── Column-availability cache ─────────────────────────────────────────────────
// Populated in initializeSchema after every _ensureColumn pass.
// null  = not yet determined (stub path or pre-init) → treated as "available".
// true  = column confirmed present by _probeColumn.
// false = column absent even after migration attempt.
let _firKaryvahiHasSortOrder: boolean | null = null;

/**
 * Returns true when fir_karyvahi.sort_order is known to exist.
 * Called by firKaryvahiRepo to choose between two INSERT paths.
 *
 * Tri-state semantics:
 *   null  → not yet probed (stub / early call) → optimistically return true
 *           (stub INSERT never validates column names, so it always succeeds)
 *   true  → probed and confirmed present
 *   false → probed and column is absent; use the fallback INSERT
 */
export function isFirKaryvahiSortOrderAvailable(): boolean {
  return _firKaryvahiHasSortOrder !== false;
}

function _getStub(): SQLite.SQLiteDatabase {
  if (!_stubSingleton) {
    // Pre-populate _mem from any localStorage data written in a previous
    // session or before the last hot-reload — this is what makes the stub
    // "persistent" on the web preview.
    _loadStubFromStorage();
    _stubSingleton = makeStub();
  }
  return _stubSingleton;
}

// ─── In-memory store for web preview (SQLite unavailable on web) ──────────────
// Parses just enough SQL to support INSERT / UPDATE / SELECT used by this app.
//
// Persistence: _mem is the fast working store; every write is also flushed to
// localStorage (when available) so data survives React Fast Refresh hot-reloads
// and in-session navigation events that cause module re-evaluation on the web
// preview.  On iOS / Android the stub is never used (real SQLite runs there),
// so localStorage references are safe inside this web-only code path.
const _mem: Map<string, Record<string, unknown>[]> = new Map();
const _STUB_LS_PREFIX = '__investsuite_stub_';

/**
 * On stub creation, pre-populate _mem from any previously persisted
 * localStorage data.  Called once inside _getStub() before returning the
 * singleton.  Silently no-ops when localStorage is unavailable.
 */
function _loadStubFromStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(_STUB_LS_PREFIX)) {
        const tableName = key.slice(_STUB_LS_PREFIX.length);
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            _mem.set(tableName, JSON.parse(raw) as Record<string, unknown>[]);
          } catch { /* corrupt entry — skip */ }
        }
      }
    }
  } catch { /* localStorage access denied */ }
}

/**
 * Persist the current _mem state for `tableName` to localStorage so writes
 * survive hot-reloads and in-session navigations in the web preview.
 * Silently no-ops when localStorage is unavailable.
 */
function _persistStubTable(tableName: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      _STUB_LS_PREFIX + tableName,
      JSON.stringify(_mem.get(tableName) ?? [])
    );
  } catch { /* quota exceeded or access denied — in-memory only */ }
}

function _table(name: string): Record<string, unknown>[] {
  if (!_mem.has(name)) _mem.set(name, []);
  return _mem.get(name)!;
}

/**
 * Parse a single SQL token (non-`?` literal) to a JS value.
 * Handles: 'single-quoted strings', NULL/null, integers, decimals.
 */
function _parseLiteral(token: string): unknown {
  if (token.toUpperCase() === 'NULL') return null;
  if (token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1);
  const n = Number(token);
  if (!Number.isNaN(n)) return n;
  return token; // fallback: raw string
}

function makeStub(): SQLite.SQLiteDatabase {
  const stub = {
    execAsync: async () => {
      // no-op on stub — DDL / PRAGMA statements are silently ignored
    },

    runAsync: async (sql: string, params?: unknown[]) => {
      const p = params ?? [];
      const s = sql.replace(/\s+/g, ' ').trim();

      // ── INSERT INTO tableName (col1, col2, ...) VALUES (?, 'Pending', 0, NULL, ...) ──
      // Supports INSERT OR IGNORE / INSERT OR REPLACE prefixes.
      const ins = s.match(/^INSERT(?:\s+OR\s+\w+)?\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (ins) {
        const table   = ins[1];
        const cols    = ins[2].split(',').map((c) => c.trim());
        const tokens  = ins[3].split(',').map((t) => t.trim());

        // Validate column existence for known sensitive tables
        if (table === 'workspace_settings') {
          const valid = new Set(['id', 'police_station', 'district', 'state', 'halka', 'beat', 'officer_name', 'updated_at']);
          for (const col of cols) {
            if (!valid.has(col)) {
              throw new Error(`Error code 1: no such column: ${col}`);
            }
          }
        } else if (table === 'app_settings') {
          const valid = new Set(['key', 'value', 'updated_at']);
          for (const col of cols) {
            if (!valid.has(col)) {
              throw new Error(`Error code 1: no such column: ${col}`);
            }
          }
        } else if (table === 'knowledge_notes') {
          const valid = new Set(['entry_id', 'note', 'updated_at']);
          for (const col of cols) {
            if (!valid.has(col)) {
              throw new Error(`Error code 1: no such column: ${col}`);
            }
          }
        }
        const isIgnore  = /INSERT\s+OR\s+IGNORE/i.test(s);
        const isReplace = /INSERT\s+OR\s+REPLACE/i.test(s);
        let pi = 0;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          row[cols[i]] = tokens[i] === '?' ? p[pi++] : _parseLiteral(tokens[i]);
        }
        const rows = _table(table);
        // Honour OR IGNORE / OR REPLACE on the primary-key column (first col)
        const pkCol = cols[0];
        const pkVal = row[pkCol];
        const dupIdx = rows.findIndex((r) => r[pkCol] === pkVal);
        if (dupIdx !== -1) {
          if (isIgnore) {
            // skip — do not insert duplicate
            return { lastInsertRowId: 0, changes: 0 };
          } else if (isReplace) {
            rows.splice(dupIdx, 1, row);
          } else {
            // Plain INSERT with duplicate PK: replace (mirrors SQLite ABORT then re-insert
            // behaviour in the stub context where we never throw on PK conflict).
            rows.splice(dupIdx, 1, row);
          }
        } else {
          rows.push(row);
        }
        _persistStubTable(table);
        return { lastInsertRowId: 0, changes: 1 };
      }

      // ── UPDATE tableName SET … WHERE … ────────────────────────────────────
      //
      // Fully rewritten to handle:
      //   1. String-literal SET assignments  (e.g. status='published')
      //   2. NULL-literal SET assignments    (e.g. archived_at=NULL)
      //   3. Computed SET expressions        (e.g. version=version+1) — skipped (no side-effect)
      //   4. Parameterised SET assignments   (e.g. updated_at=?)
      //   5. Compound WHERE clauses          (e.g. WHERE id=? AND source='system')
      //      — previously the regex required WHERE col=?$ and dropped the whole
      //        UPDATE when extra AND conditions existed, silently losing every
      //        seedManager system-content update and every publishFormat call.
      //
      const updMatch = s.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
      if (updMatch) {
        const [, table, setClause, whereRaw] = updMatch;

        // ── Parse SET clause ─────────────────────────────────────────────────
        // Each assignment is: col = ? | col = 'literal' | col = NULL | col = expr
        const assignments = setClause.split(',').map((a) => a.trim());
        let pi = 0;  // index into bound params for SET assignments
        const updates: Array<{ col: string; val: unknown }> = [];
        for (const a of assignments) {
          const eqIdx  = a.indexOf('=');
          if (eqIdx === -1) continue;
          const colName = a.slice(0, eqIdx).trim();
          const rhs     = a.slice(eqIdx + 1).trim();
          if (rhs === '?') {
            updates.push({ col: colName, val: p[pi++] });
          } else if (/^NULL$/i.test(rhs)) {
            // e.g. archived_at=NULL
            updates.push({ col: colName, val: null });
          } else if (rhs.startsWith("'") && rhs.endsWith("'")) {
            // e.g. status='published', sync_status='pending'
            updates.push({ col: colName, val: rhs.slice(1, -1) });
          }
          // computed expressions (version=version+1) → intentionally skipped
        }

        // ── Parse WHERE clause ───────────────────────────────────────────────
        // Supports:
        //   col = ?                  (bound param — consumed from tail of p[])
        //   col = 'literal'
        //   col = integer
        //   col IS NULL
        //   col IS NOT NULL
        // Multiple conditions joined by AND.
        //
        // Bound ? in WHERE consume params from the END of p[], right-to-left,
        // mirroring real SQLite left-to-right binding but respecting that the
        // stub places WHERE params after SET params in the p[] array.
        const whereParts = whereRaw.split(/\s+AND\s+/i).map((w) => w.trim());
        // Count how many ? appear in the WHERE clause so we know the slice boundary
        const whereParamCount = whereParts.filter((w) => w.includes('?')).length;
        // WHERE-bound params are the last `whereParamCount` entries of p[].
        // SET-bound params are everything before that (already consumed above via pi).
        // We walk the WHERE params left-to-right through the WHERE-portion slice.
        let wpi = p.length - whereParamCount;

        type WhereCond =
          | { type: 'eq';     col: string; val: unknown }
          | { type: 'isNull'; col: string }
          | { type: 'notNull'; col: string };

        const conds: WhereCond[] = [];
        for (const part of whereParts) {
          const isNullM    = part.match(/^(\w+)\s+IS\s+NULL$/i);
          const notNullM   = part.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
          const eqParamM   = part.match(/^(\w+)\s*=\s*\?$/i);
          const eqLiteralM = part.match(/^(\w+)\s*=\s*('[^']*'|-?\d+(?:\.\d+)?)$/i);
          if (isNullM) {
            conds.push({ type: 'isNull', col: isNullM[1] });
          } else if (notNullM) {
            conds.push({ type: 'notNull', col: notNullM[1] });
          } else if (eqParamM) {
            conds.push({ type: 'eq', col: eqParamM[1], val: p[wpi++] });
          } else if (eqLiteralM) {
            conds.push({ type: 'eq', col: eqLiteralM[1], val: _parseLiteral(eqLiteralM[2]) });
          }
          // unrecognised condition → skip (safe: may match more rows than real SQLite, never fewer)
        }

        const rowMatches = (row: Record<string, unknown>): boolean =>
          conds.every((c) => {
            if (c.type === 'isNull')  return row[c.col] == null;
            if (c.type === 'notNull') return row[c.col] != null;
            return row[c.col] === c.val;
          });

        let changed = 0;
        for (const row of _table(table)) {
          if (rowMatches(row)) {
            updates.forEach(({ col, val }) => { row[col] = val; });
            changed++;
          }
        }
        _persistStubTable(table);
        return { lastInsertRowId: 0, changes: changed };
      }

      // ── DELETE FROM tableName WHERE col = ? ───────────────────────────────
      // Required by seedManager (DELETE FROM format_keys/format_tags WHERE format_id=?)
      // and by predefinedFormatRepo (DELETE FROM format_tags WHERE format_id=?).
      // Without this the stub silently dropped every DELETE, causing keys and tags
      // to accumulate indefinitely and triggering "Error finalizing statement" on
      // the real SQLite engine when duplicate-PK rows were re-inserted.
      const delMatch = s.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)$/i);
      if (delMatch) {
        const [, table, whereRaw2] = delMatch;
        const whereParts2  = whereRaw2.split(/\s+AND\s+/i).map((w) => w.trim());
        const wParamCount2 = whereParts2.filter((w) => w.includes('?')).length;
        let wpi2 = p.length - wParamCount2;

        type DelCond =
          | { type: 'eq';     col: string; val: unknown }
          | { type: 'isNull'; col: string }
          | { type: 'notNull'; col: string };

        const conds2: DelCond[] = [];
        for (const part of whereParts2) {
          const isNullM    = part.match(/^(\w+)\s+IS\s+NULL$/i);
          const notNullM   = part.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
          const eqParamM   = part.match(/^(\w+)\s*=\s*\?$/i);
          const eqLiteralM = part.match(/^(\w+)\s*=\s*('[^']*'|-?\d+(?:\.\d+)?)$/i);
          if (isNullM)    { conds2.push({ type: 'isNull',  col: isNullM[1] }); }
          else if (notNullM)  { conds2.push({ type: 'notNull', col: notNullM[1] }); }
          else if (eqParamM)  { conds2.push({ type: 'eq', col: eqParamM[1],   val: p[wpi2++] }); }
          else if (eqLiteralM){ conds2.push({ type: 'eq', col: eqLiteralM[1], val: _parseLiteral(eqLiteralM[2]) }); }
        }

        const rowDel = (row: Record<string, unknown>): boolean =>
          conds2.every((c) => {
            if (c.type === 'isNull')  return row[c.col] == null;
            if (c.type === 'notNull') return row[c.col] != null;
            return row[c.col] === c.val;
          });

        const before = _table(table).length;
        const kept   = _table(table).filter((r) => !rowDel(r));
        _mem.set(table, kept);
        _persistStubTable(table);
        return { lastInsertRowId: 0, changes: before - kept.length };
      }

      return { lastInsertRowId: 0, changes: 0 };
    },

    getFirstAsync: async <T>(sql: string, params?: unknown[]): Promise<T | null> => {
      // ── PRAGMA stubs (dev diagnostics screen) ─────────────────────────────
      // Real SQLite PRAGMA statements return a single-row result set.
      // The stub cannot query the in-memory store for storage metadata, so we
      // return safe, clearly-stub values so the dev diagnostics screen renders
      // meaningful labels instead of blank/zero fields.
      const pragmaFirstMap: Record<string, Record<string, unknown>> = {
        'pragma page_count':          { page_count: 1 },
        'pragma page_size':           { page_size: 4096 },
        'pragma freelist_count':      { freelist_count: 0 },
        'pragma user_version':        { user_version: 0 },
        'pragma integrity_check':     { integrity_check: 'ok (stub)' },
        'pragma integrity_check(1)':  { integrity_check: 'ok (stub)' },
        'pragma foreign_key_check':   {},
        'pragma optimize':            {},
      };
      const trimmedSql = (sql ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (trimmedSql in pragmaFirstMap) {
        const row = pragmaFirstMap[trimmedSql];
        return (Object.keys(row).length === 0 ? null : row) as T | null;
      }

      const rows = await stub.getAllAsync<T>(sql, params);
      return rows[0] ?? null;
    },

    getAllAsync: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
      const p = params ?? [];
      const s = sql.replace(/\s+/g, ' ').trim();

      // ── PRAGMA / sqlite_master stubs (dev diagnostics screen) ─────────────
      const trimmedForPragma = s.toLowerCase();
      if (trimmedForPragma.startsWith('pragma ')) {
        // Multi-row PRAGMA (e.g. PRAGMA integrity_check / foreign_key_check)
        if (/pragma\s+integrity_check/.test(trimmedForPragma)) {
          return [{ integrity_check: 'ok (stub)' } as unknown as T];
        }
        if (/pragma\s+foreign_key_check/.test(trimmedForPragma)) {
          return []; // no FK violations in the stub
        }
        return []; // all other PRAGMAs return empty on the stub
      }
      if (/select\s+.+from\s+sqlite_master/i.test(s)) {
        // Return each in-memory table name so the dev diagnostics table list populates
        const names = Array.from(_mem.keys());
        return names.map((n) => ({ name: n, type: 'table' } as unknown as T));
      }

      // ── Table alias helpers ───────────────────────────────────────────────
      // Repos use qualified column names (e.g. nd.created_at, k.id, ls.*)
      // that must be stripped to bare column names for _mem row access.
      // Build an alias→tableName map from FROM/JOIN clauses.
      const _aliasMap: Record<string, string> = {};
      const _fromAlias = s.match(/FROM\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/i);
      if (_fromAlias) {
        const tbl = _fromAlias[1];
        const alias = _fromAlias[2];
        if (alias && !/^(WHERE|JOIN|LEFT|INNER|ON|ORDER|GROUP|LIMIT|SELECT)$/i.test(alias)) {
          _aliasMap[alias] = tbl;
        }
        _aliasMap[tbl] = tbl; // table name also maps to itself
      }
      const _joinAliasRe = /(?:LEFT\s+|INNER\s+)?JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
      let _jm: RegExpExecArray | null;
      while ((_jm = _joinAliasRe.exec(s)) !== null) {
        const tbl = _jm[1];
        const alias = _jm[2];
        if (alias && !/^ON$/i.test(alias)) _aliasMap[alias] = tbl;
        _aliasMap[tbl] = tbl;
      }

      // Strip "alias." prefix from a column reference to get bare column name.
      // e.g. "nd.created_at" → "created_at", "k.id" → "id", "name" → "name"
      function _bareCol(ref: string): string {
        const dot = ref.indexOf('.');
        return dot === -1 ? ref.trim() : ref.slice(dot + 1).trim();
      }

      // ── FROM clause ───────────────────────────────────────────────────────
      const fromMatch = s.match(/FROM\s+(\w+)/i);
      if (!fromMatch) return [];

      if (fromMatch[1] === 'workspace_settings') {
        if (/\b(value|key)\b/i.test(s)) {
          throw new Error('Error code 1: no such column: ' + (/\bvalue\b/i.test(s) ? 'value' : 'key'));
        }
      }

      // ── COUNT(*) aggregate queries ────────────────────────────────────────
      // Run the WHERE filter normally and return [{alias: N}] so getFirstAsync
      // callers (e.g. updateFIRStatus) get the correct row count.
      const countMatch = s.match(/SELECT\s+COUNT\s*\(\s*\*\s*\)\s+(?:as\s+(\w+))?\s+FROM/i);

      // ── DISTINCT flag ─────────────────────────────────────────────────────
      const isDistinct = /SELECT\s+DISTINCT\b/i.test(s);

      // ── Base table rows ───────────────────────────────────────────────────
      let rows: Record<string, unknown>[] = [..._table(fromMatch[1])];

      // Snapshot the primary-table column names BEFORE any JOIN so that
      // DISTINCT deduplication can key exclusively on left-table columns.
      // Right-side bare spill-overs (columns absent from left row that were
      // written by the merge) must NOT influence the dedup key.
      const _primaryCols = new Set<string>(
        rows.length > 0 ? Object.keys(rows[0]) : []
      );

      // ── JOIN processing ───────────────────────────────────────────────────
      // Supports: LEFT JOIN and INNER JOIN with a single-column ON equality
      // condition.  Handles a compound ON with one optional extra AND clause
      // (e.g. LEFT JOIN nyayalay_persons np ON np.doc_id = nd.id AND np.deleted_at IS NULL).
      //
      // Pattern matched:  (LEFT|INNER)? JOIN <table> [alias] ON <lhs> = <rhs> [AND <extra>]
      //
      // For LEFT JOIN, right-side columns on non-matching rows are set to null
      // (required for the anti-join pattern: WHERE e.id IS NULL).
      const _joinRe = /(LEFT\s+|INNER\s+)?JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?\s+ON\s+([^\s]+)\s*=\s*([^\s]+)((?:\s+AND\s+[^\s]+\s+IS\s+NULL)?)/gi;
      let _ji: RegExpExecArray | null;
      while ((_ji = _joinRe.exec(s)) !== null) {
        const isLeft = !_ji[1] || /LEFT/i.test(_ji[1]);
        const joinTable = _ji[2];
        const joinAlias = _ji[3] && !/^ON$/i.test(_ji[3]) ? _ji[3] : joinTable;
        // ON lhs = rhs — normalise both sides to bare column names
        const onLhsRaw = _ji[4];
        const onRhsRaw = _ji[5];
        // Extra AND clause in ON (e.g. AND np.deleted_at IS NULL)
        const onExtraRaw = (_ji[6] ?? '').trim(); // e.g. "AND np.deleted_at IS NULL"
        const onLhs = _bareCol(onLhsRaw); // e.g. "fir_karyvahi_id"
        const onRhs = _bareCol(onRhsRaw); // e.g. "id"
        // Determine which bare-column name is in the left (base) table and
        // which is in the right (join) table.  We determine this by checking
        // which alias prefix corresponds to which table.
        //
        // Rule: if lhsRaw has a dot, check if its prefix is the base-table
        // alias; otherwise assume lhs belongs to the base table.
        const lhsAlias = onLhsRaw.includes('.') ? onLhsRaw.split('.')[0] : null;
        const rhsAlias = onRhsRaw.includes('.') ? onRhsRaw.split('.')[0] : null;
        // The join-table alias for matching
        const jtAliases = new Set([joinTable, joinAlias]);
        // Swap if lhs is the join-table side
        const baseKey = jtAliases.has(lhsAlias ?? '') ? onRhs : onLhs;
        const joinKey = jtAliases.has(lhsAlias ?? '') ? onLhs : onRhs;

        // Extra ON filter: strip the joining table's alias-prefix deleted_at check
        // e.g. "AND np.deleted_at IS NULL" — parse into col + "IS NULL" expectation
        let onExtraCol: string | null = null;
        let onExtraIsNull = false;
        if (onExtraRaw) {
          const exM = onExtraRaw.match(/AND\s+(\S+)\s+IS\s+(NOT\s+)?NULL/i);
          if (exM) {
            onExtraCol = _bareCol(exM[1]);
            onExtraIsNull = !exM[2]; // true = IS NULL, false = IS NOT NULL
          }
        }

        const rightTable = _table(joinTable);

        // Build a Map<joinKeyVal → rightRow[]> for O(n) lookup
        const rightIdx = new Map<unknown, Record<string, unknown>[]>();
        for (const rr of rightTable) {
          // Apply extra ON filter against the right-table row
          if (onExtraCol !== null) {
            const v = rr[onExtraCol];
            const isNullVal = v === null || v === undefined;
            if (onExtraIsNull !== isNullVal) continue; // does not satisfy ON extra condition
          }
          const kv = rr[joinKey];
          if (!rightIdx.has(kv)) rightIdx.set(kv, []);
          rightIdx.get(kv)!.push(rr);
        }

        const merged: Record<string, unknown>[] = [];
        for (const leftRow of rows) {
          const kv = leftRow[baseKey];
          const matches = rightIdx.get(kv);
          if (matches && matches.length > 0) {
            // Expand: one output row per right-side match (needed for DISTINCT+OR searches)
            for (const rr of matches) {
              // Merge strategy:
              //   • Alias-qualified keys (e.g. "e.id", "np.name") are ALWAYS written —
              //     WHERE conditions like `e.id IS NULL` depend on them exclusively.
              //   • Bare keys (e.g. "id", "name") are written ONLY when absent from
              //     the left row — this prevents right-side columns from clobbering
              //     left-side columns of the same name (e.g. right "id" must NOT
              //     overwrite left "id", which would break DISTINCT nd.* and anti-joins).
              const merged_row: Record<string, unknown> = { ...leftRow };
              for (const [k, v] of Object.entries(rr)) {
                merged_row[`${joinAlias}.${k}`] = v;       // alias-qualified — always
                if (!(k in merged_row)) merged_row[k] = v; // bare — only if absent
              }
              merged.push(merged_row);
            }
          } else if (isLeft) {
            // LEFT JOIN non-match: emit left row with right columns set to null.
            // Only alias-qualified keys are added (e.g. "e.id" = null) so that
            // WHERE e.id IS NULL matches. Bare keys are NOT added — adding a bare
            // null "id" would overwrite the left row's own "id" (same bug as above).
            const nullRight: Record<string, unknown> = {};
            const template = rightTable[0] ?? {};
            for (const k of Object.keys(template)) {
              nullRight[`${joinAlias}.${k}`] = null;        // alias-qualified null only
            }
            // Belt-and-suspenders: ensure the join key is definitely null under
            // its alias-qualified name (covers cases where rightTable is empty
            // and the template loop above never ran).
            nullRight[`${joinAlias}.${joinKey}`] = null;
            merged.push({ ...leftRow, ...nullRight });
          }
          // INNER JOIN: non-match rows are silently dropped
        }
        rows = merged;
      }

      // ── Alias-aware column SELECT expansion ───────────────────────────────
      // Handle "SELECT ls.*, g.name as gp_name FROM liquor_shops ls JOIN gram_panchayats g"
      // The merged rows already contain all columns; we need to produce the
      // correct aliased output columns (e.g. gp_name from g.name).
      // Extract "expr AS alias" pairs from SELECT clause.
      const selectClause = s.match(/^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s/i)?.[2] ?? '';
      const _colAliases: Array<{ expr: string; alias: string }> = [];
      if (selectClause !== '*') {
        // Split by comma but not inside parentheses
        const parts: string[] = [];
        let depth = 0, cur = '';
        for (const ch of selectClause) {
          if (ch === '(') { depth++; cur += ch; }
          else if (ch === ')') { depth--; cur += ch; }
          else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        if (cur.trim()) parts.push(cur.trim());

        for (const part of parts) {
          const asM = part.match(/^(.+?)\s+(?:AS\s+)?(\w+)$/i);
          if (asM) {
            _colAliases.push({ expr: asM[1].trim(), alias: asM[2] });
          }
        }
      }

      // ── WHERE clause filtering ────────────────────────────────────────────
      // Strips table-alias prefixes from column names before matching.
      const whereMatch = s.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/i);
      if (whereMatch) {
        let pi = 0;
        const conditions = whereMatch[1].split(/\s+AND\s+/i);
        for (const cond of conditions) {
          // Resolve alias-prefixed column (e.g. "nd.court_name" → "court_name",
          // "e.id" → "e.id" preserved in merged row)
          const resolveCol = (ref: string): string => {
            // Prefer exact key in merged row; fall back to bare name
            return ref.includes('.') ? ref : ref;
          };

          // Handle LOWER(TRIM(col)) = LOWER(TRIM(?)) — case-insensitive equality
          if (/LOWER\s*\(/i.test(cond)) {
            // Pattern 1: LOWER(TRIM(col)) = LOWER(TRIM(?))
            const lowerTrimEq = cond.match(
              /LOWER\s*\(\s*TRIM\s*\(\s*([\w.]+)\s*\)\s*\)\s*=\s*LOWER\s*\(\s*TRIM\s*\(\s*\?\s*\)\s*\)/i
            );
            if (lowerTrimEq && pi < p.length) {
              const col = resolveCol(lowerTrimEq[1]);
              const val = String(p[pi++]).toLowerCase().trim();
              rows = rows.filter((r) =>
                String(r[col] ?? r[_bareCol(col)] ?? '').toLowerCase().trim() === val
              );
              continue;
            }
            // Pattern 2: LOWER(col) = LOWER(?) — no TRIM wrappers
            const lowerEq = cond.match(
              /LOWER\s*\(\s*([\w.]+)\s*\)\s*=\s*LOWER\s*\(\s*\?\s*\)/i
            );
            if (lowerEq && pi < p.length) {
              const col = resolveCol(lowerEq[1]);
              const val = String(p[pi++]).toLowerCase().trim();
              rows = rows.filter((r) =>
                String(r[col] ?? r[_bareCol(col)] ?? '').toLowerCase().trim() === val
              );
              continue;
            }
            if (cond.includes('?')) pi++;
            continue;
          }

          // Skip aggregate functions (COUNT, COALESCE)
          if (/COALESCE|COUNT/i.test(cond)) {
            if (cond.includes('?')) pi++;
            continue;
          }

          // LIKE operator — with alias-aware column lookup
          const likeMatch = cond.match(/([\w.]+)\s+LIKE\s+\?/i);
          if (likeMatch) {
            const col = resolveCol(likeMatch[1]);
            const bare = _bareCol(col);
            const pattern = String(p[pi++] ?? '');
            const regexStr = pattern
              .replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/%/g, '.*')
              .replace(/_/g, '.');
            const re = new RegExp(`^${regexStr}$`, 'i');
            rows = rows.filter((r) => re.test(String(r[col] ?? r[bare] ?? '')));
            continue;
          }

          // LIKE inside an OR group, e.g. (col1 LIKE ? OR col2 LIKE ?)
          const orLikeBlock = cond.match(/^\s*\((.+)\)\s*$/);
          if (orLikeBlock) {
            const orParts = orLikeBlock[1].split(/\s+OR\s+/i);
            const orFilters: Array<(r: Record<string, unknown>) => boolean> = [];
            for (const part of orParts) {
              const likeP = part.trim().match(/([\w.]+)\s+LIKE\s+\?/i);
              if (likeP && pi < p.length) {
                const col = resolveCol(likeP[1]);
                const bare = _bareCol(col);
                const pattern = String(p[pi++] ?? '');
                const regexStr = pattern
                  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                  .replace(/%/g, '.*')
                  .replace(/_/g, '.');
                const re = new RegExp(`^${regexStr}$`, 'i');
                orFilters.push((r) => re.test(String(r[col] ?? r[bare] ?? '')));
              } else if (part.includes('?')) {
                pi++;
              }
            }
            if (orFilters.length > 0) {
              rows = rows.filter((r) => orFilters.some((f) => f(r as Record<string, unknown>)));
            }
            continue;
          }

          // IN operator: col IN (?, ?, ...)
          const inMatch = cond.match(/([\w.]+)\s+IN\s*\(([^)]+)\)/i);
          if (inMatch) {
            const col = resolveCol(inMatch[1]);
            const bare = _bareCol(col);
            const rawItems = inMatch[2].split(',').map((item) => item.trim());
            const vals = rawItems.map((item) => {
              if (item === '?') return p[pi++];
              return _parseLiteral(item);
            });
            rows = rows.filter((r) => {
              const val = r[col] ?? r[bare];
              return vals.includes(val);
            });
            continue;
          }

          // col = ? | col = literal | col IS NULL | col IS NOT NULL
          // All accept alias-qualified col names (e.g. k.is_completed, nd.deleted_at)
          const eq      = cond.match(/([\w.]+)\s*=\s*(\?|'[^']*'|-?\d+(?:\.\d+)?)/i);
          const notNull = cond.match(/([\w.]+)\s+IS\s+NOT\s+NULL/i);
          const isNull  = cond.match(/([\w.]+)\s+IS\s+NULL/i);

          if (eq) {
            const col  = resolveCol(eq[1]);
            const bare = _bareCol(col);
            const raw  = eq[2];
            const val  = raw === '?' ? p[pi++] : _parseLiteral(raw);
            rows = rows.filter((r) => (r[col] ?? r[bare]) === val);
          } else if (notNull) {
            const col  = resolveCol(notNull[1]);
            const bare = _bareCol(col);
            rows = rows.filter((r) => {
              const v = r[col] ?? r[bare];
              return v !== null && v !== undefined;
            });
          } else if (isNull) {
            const col  = resolveCol(isNull[1]);
            const bare = _bareCol(col);
            rows = rows.filter((r) => {
              // IS NULL check: for alias-qualified refs like "e.id", always use
              // the alias-qualified key first (set explicitly by the JOIN path).
              // Fall back to bare only when the qualified key was never written.
              const qualified = col !== bare ? col : null;
              const v = (qualified && qualified in r) ? r[qualified]
                      : (bare in r)                   ? r[bare]
                      : undefined;
              return v === null || v === undefined;
            });
          }
        }
      }

      // ── GROUP BY support ──────────────────────────────────────────────────
      // Handles queries like:
      //   SELECT category, COUNT(*) as cnt FROM knowledge_entries WHERE ... GROUP BY category
      const groupByMatch = s.match(/GROUP\s+BY\s+([\w.]+)/i);
      if (groupByMatch) {
        const groupColRaw = groupByMatch[1];
        const groupCol = _bareCol(groupColRaw);
        const countAliasMatch = s.match(/COUNT\([^)]*\)\s+(?:AS\s+)?(\w+)/i);
        const cntAlias = countAliasMatch ? countAliasMatch[1] : 'cnt';

        const groups = new Map<unknown, number>();
        for (const row of rows) {
          const key = row[groupCol] ?? row[groupColRaw];
          if (key !== undefined) {
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
        }
        const groupedRows: Record<string, unknown>[] = [];
        for (const [key, count] of groups.entries()) {
          groupedRows.push({
            [groupCol]: key,
            [cntAlias]: count,
          });
        }
        return groupedRows as unknown as T[];
      }

      // ── COUNT(*) short-circuit ────────────────────────────────────────────
      if (countMatch) {
        const alias = countMatch[1] ?? 'cnt';
        return [{ [alias]: rows.length } as unknown as T];
      }

      // ── DISTINCT deduplication ────────────────────────────────────────────
      // Keys exclusively on primary-table columns (captured before any JOIN).
      // Right-side bare spill-overs and alias-qualified keys are excluded so
      // that a document matching multiple joined rows (e.g. two nyayalay_persons
      // for the same document) correctly collapses to a single output row.
      if (isDistinct) {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const key = JSON.stringify(
            Object.fromEntries(
              Object.entries(r).filter(([k]) => _primaryCols.has(k))
            )
          );
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      // ── ORDER BY sorting ──────────────────────────────────────────────────
      // Parses: ORDER BY col [ASC|DESC] [, col2 [ASC|DESC]] ...
      // Strips table-alias prefixes (nd.created_at → created_at) before lookup.
      // Applied before LIMIT so LIMIT gets the correctly sorted window.
      const orderMatch = s.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/i);
      if (orderMatch) {
        const orderTerms = orderMatch[1].split(',').map((t) => t.trim());
        // Parse each term into { col, dir }
        const sortKeys = orderTerms.map((term) => {
          const parts = term.split(/\s+/);
          const rawCol = parts[0];
          const dir = (parts[1] ?? 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
          const col = _bareCol(rawCol);        // strip alias prefix
          const qualified = rawCol;            // keep original for fallback
          return { col, qualified, dir };
        });

        rows.sort((a, b) => {
          for (const { col, qualified, dir } of sortKeys) {
            // Try bare name first, then alias-qualified (for joined columns)
            const av = a[col] ?? a[qualified];
            const bv = b[col] ?? b[qualified];
            if (av === bv) continue;
            // null / undefined sort last regardless of direction
            if (av == null) return 1;
            if (bv == null) return -1;
            // Numeric comparison when both values are numbers
            if (typeof av === 'number' && typeof bv === 'number') {
              return dir * (av - bv);
            }
            // String comparison (covers ISO timestamps, text, mixed)
            const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return dir * cmp;
          }
          return 0;
        });
      }

      // ── LIMIT / OFFSET ────────────────────────────────────────────────────
      const limitMatch = s.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
      if (limitMatch) {
        const limit  = parseInt(limitMatch[1], 10);
        const offset = limitMatch[2] ? parseInt(limitMatch[2], 10) : 0;
        rows = rows.slice(offset, offset + limit);
      }

      // ── SELECT column-alias projection ────────────────────────────────────
      // Apply "expr AS alias" mappings (e.g. g.name as gp_name → gp_name)
      // so callers receive the expected column names.
      if (_colAliases.length > 0) {
        rows = rows.map((r) => {
          const out = { ...r };
          for (const { expr, alias } of _colAliases) {
            if (alias in out) continue; // already present
            const exprBare = _bareCol(expr);
            const val = r[expr] ?? r[exprBare];
            if (val !== undefined) out[alias] = val;
          }
          return out;
        });
      }

      return rows as unknown as T[];
    },

    // withTransactionAsync: required by seedFIRKaryvahi on web (stub path).
    // The stub is auto-commit (every runAsync is immediately visible), so there
    // is no real transaction semantics to implement. We simply await the task
    // callback — which runs all the INSERTs against _mem — then return.
    // On any thrown error we re-throw so seedFIRKaryvahi's outer catch works.
    withTransactionAsync: async (task: () => Promise<void>) => {
      await task();
    },

    // withExclusiveTransactionAsync: called by createPrarthnaPatraAtomic on
    // web. The stub has no real locking, but the auto-commit semantics are
    // identical to withTransactionAsync — just await the task and return.
    withExclusiveTransactionAsync: async (task: () => Promise<void>) => {
      await task();
    },

    closeAsync: async () => {},
  };
  return stub as unknown as SQLite.SQLiteDatabase;
}

// ── Q3 PROBE: DB instance identity tag ───────────────────────────────────────
// Every getDatabase() call returns this tag so logs can prove whether
// seedFIRKaryvahi and getKaryvahiByFIR are operating on the same instance.
// On native: always "native:singleton" (module-level `db` var).
// On web:    always "stub:singleton" (_stubSingleton var).
// If two different tags appear in logs for the same session → two instances.
let _dbInstanceTag = '';

export function getDbInstanceTag(): string { return _dbInstanceTag; }

/**
 * Returns true when the SQLite stub (in-memory + localStorage) is active.
 * This is the case on Expo Web where real SQLite is unavailable.
 * Used by DeveloperContentPersistence to pick the right storage backend.
 *
 * NOTE: Returns false until getDatabase() has been called at least once,
 * which is fine — DeveloperContentPersistence awaits getDatabase() before
 * making any storage decision.
 */
export function getIsUsingStub(): boolean { return _useStub; }

/**
 * Clears all persisted Web SQLite stub data:
 *   1. Wipes every table in the in-memory _mem Map.
 *   2. Removes all "__investsuite_stub_*" keys from localStorage.
 *
 * On native (iOS / Android) the stub is never used, so this is a no-op.
 * After calling this, the next getDatabase() call will re-run seedSystemContent
 * and restore a clean baseline from the bundled seed files.
 */
export function clearStubCache(): void {
  _mem.clear();
  if (typeof localStorage === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(_STUB_LS_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* access denied — in-memory already cleared */ }
}

/**
 * Writes pending WAL changes into the main database file, so copying the
 * file (backup) captures every change.
 */
export async function checkpointDatabase(): Promise<void> {
  if (_useStub) return;
  const instance = await getDatabase();
  await instance.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
}

/**
 * Closes the native connection before a backup file replaces the database.
 * The next getDatabase() call reopens it (and runs migrations).
 */
export async function closeDatabaseForRestore(): Promise<void> {
  if (_useStub || !db) return;
  try { await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);'); } catch { /* best effort */ }
  await db.closeAsync();
  db = null;
  dbReady = false;
  _initPromise = null;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Fast paths ─ decision already made for this session
  if (_useStub) {
    _dbInstanceTag = 'stub:singleton';
    return _getStub();
  }
  if (dbReady && db) {
    _dbInstanceTag = 'native:singleton';
    return db;
  }

  // Mutex: all concurrent callers share ONE init attempt, preventing multiple
  // DB connections from racing to modify schema at the same time.
  if (!_initPromise) {
    _initPromise = _openDatabase();
  }
  await _initPromise;

  if (_useStub) {
    _dbInstanceTag = 'stub:singleton';
    return _getStub();
  }
  return db!;
}

// ── Serialized DB API wrappers ────────────────────────────────────────────────
// All write (and read) operations across the entire app are routed through
// _enqueue() so that no two statement lifecycles ever interleave on the same
// SQLite connection.  The public signatures are identical to the raw
// SQLiteDatabase methods, so all callers (seedManager, repos, etc.) require
// zero changes.

/**
 * Serialized wrapper for db.runAsync.
 * Enqueues the call and returns its result once it is the only active
 * statement on the connection.
 */
export async function dbRunAsync(
  sql: string,
  params?: BindParams
): Promise<SQLite.SQLiteRunResult> {
  return _enqueue(async () => {
    const instance = await getDatabase();
    return instance.runAsync(sql, params ?? []);
  });
}

/**
 * Serialized wrapper for db.getFirstAsync.
 */
export async function dbGetFirstAsync<T>(
  sql: string,
  params?: BindParams
): Promise<T | null> {
  return _enqueue(async () => {
    const instance = await getDatabase();
    return instance.getFirstAsync<T>(sql, params ?? []);
  });
}

/**
 * Serialized wrapper for db.getAllAsync.
 */
export async function dbGetAllAsync<T>(
  sql: string,
  params?: BindParams
): Promise<T[]> {
  return _enqueue(async () => {
    const instance = await getDatabase();
    return instance.getAllAsync<T>(sql, params ?? []);
  });
}

async function _openDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync('investsuite.db');
    _dbInstanceTag = 'native:singleton';
    await db.execAsync('PRAGMA journal_mode = WAL;');
    // NOTE: PRAGMA foreign_keys = ON is intentionally omitted.
    // Enabling it causes SQLite's internal FK check to use a stale WAL
    // read-snapshot immediately after an INSERT on the parent table, making
    // every child INSERT fail with "FOREIGN KEY constraint failed" even though
    // the parent row was just committed. Referential integrity is enforced at
    // the application level (ensureChecklistKaryvahi checks FIR existence via
    // getFIRById before inserting; createAccused always receives a valid fir_id
    // from handleSave). Removing this PRAGMA eliminates the timing race without
    // any risk of orphaned rows.
    await initializeSchema(db);

    // Verify SQLite is actually writing + reading correctly.
    // On web, some platforms return a no-op handle that never throws but
    // silently drops every write, causing all SELECTs to return [].
    const probe = await db.getFirstAsync<{ v: number }>('SELECT 1 as v');
    if (!probe || probe.v !== 1) {
      throw new Error('SQLite probe failed — platform does not support SQLite');
    }

    dbReady = true;
  } catch (e) {
    console.warn('[InvestSuite] SQLite unavailable, using in-memory stub:', e);
    db = null;
    dbReady = false;
    _useStub = true;
  }
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  // Ensure app_settings table exists immediately before any migrations or seeds
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

  const statements = CREATE_TABLES_SQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    try {
      await database.execAsync(stmt + ';');
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const isAlter = /^\s*ALTER\s+TABLE/i.test(stmt);
      if (isAlter && (msg.includes('duplicate column') || msg.includes('already exists'))) {
        // Expected on fresh installs: column is already present in CREATE TABLE.
      } else if (isAlter) {
        // Unexpected ALTER TABLE failure — log the full SQL and error so we
        // can see what column/table is actually failing.
        console.error('[Schema] ALTER TABLE migration failed:', stmt.trim(), '|', e);
      } else {
        console.warn('[InvestSuite] Schema statement skipped:', e);
      }
    }
  }

  // ── Belt-and-suspenders column migrations ────────────────────────────────
  // The ALTER TABLE statements above cover OLD databases. But if they failed
  // for any reason (SQLite version quirk, schema timing, etc.), this second
  // pass ensures every critical column definitely exists before any INSERT runs.
  //
  // Strategy: plain ALTER TABLE, classify "duplicate column" as OK (already
  // added), log everything else as an error so it shows in crash reports.
  // NOT NULL is intentionally omitted from ALTER TABLE definitions because
  // some Android system SQLite versions reject NOT NULL in ADD COLUMN even
  // when a DEFAULT is supplied — NOT NULL is already enforced by the CREATE
  // TABLE on fresh installs and by app-level ? bindings on all installs.
  await _ensureColumn(database, 'fir_karyvahi', 'sort_order',  'INTEGER DEFAULT 0');
  await _ensureColumn(database, 'fir_karyvahi', 'deleted_at',  'INTEGER');
  await _ensureColumn(database, 'fir_karyvahi', 'precautions', 'TEXT');
  await _ensureColumn(database, 'knowledge_entries', 'crime_type', "TEXT DEFAULT ''");

  // ── v108: System Content Architecture ────────────────────────────────────
  // Additive columns only — existing rows receive safe defaults automatically.
  // source='user'  → all pre-existing entries become User Content (correct).
  // editable=1     → all pre-existing entries remain editable (correct).
  // seed_version   → used by SeedManager to decide upsert vs skip.
  await _ensureColumn(database, 'predefined_formats', 'source',       "TEXT DEFAULT 'user'");
  await _ensureColumn(database, 'predefined_formats', 'editable',     'INTEGER DEFAULT 1');
  await _ensureColumn(database, 'predefined_formats', 'content_type', 'TEXT');
  await _ensureColumn(database, 'predefined_formats', 'seed_version', 'INTEGER DEFAULT 0');
  await _ensureColumn(database, 'predefined_formats', 'app_version',  'TEXT');

  await _ensureColumn(database, 'knowledge_entries', 'source',        "TEXT DEFAULT 'user'");
  await _ensureColumn(database, 'knowledge_entries', 'editable',      'INTEGER DEFAULT 1');
  await _ensureColumn(database, 'knowledge_entries', 'content_type',  'TEXT');
  await _ensureColumn(database, 'knowledge_entries', 'seed_version',  'INTEGER DEFAULT 0');
  await _ensureColumn(database, 'knowledge_entries', 'app_version',   'TEXT');

  // ── v109: System Content Update Engine ───────────────────────────────────
  // content_hash  → djb2 hash of canonical content fields, used to detect
  //                 silent content changes even without a version bump.
  // last_updated  → ISO-8601 date string from the seed bundle (audit trail).
  await _ensureColumn(database, 'predefined_formats', 'content_hash', "TEXT DEFAULT ''");
  await _ensureColumn(database, 'predefined_formats', 'last_updated', "TEXT DEFAULT ''");

  await _ensureColumn(database, 'knowledge_entries', 'content_hash', "TEXT DEFAULT ''");
  await _ensureColumn(database, 'knowledge_entries', 'last_updated', "TEXT DEFAULT ''"  );

  // ── v115: System Format Management ───────────────────────────────────────
  // status: publish workflow — 'draft' | 'published' | 'archived'
  // Default 'published' keeps all existing formats visible to users.
  await _ensureColumn(database, 'predefined_formats', 'status',           "TEXT DEFAULT 'published'");
  await _ensureColumn(database, 'predefined_formats', 'sys_category',     "TEXT DEFAULT ''");
  await _ensureColumn(database, 'predefined_formats', 'sys_sub_category', "TEXT DEFAULT ''");
  await _ensureColumn(database, 'predefined_formats', 'change_notes',     "TEXT DEFAULT ''");
  await _ensureColumn(database, 'predefined_formats', 'published_at',     'INTEGER');
  await _ensureColumn(database, 'predefined_formats', 'archived_at',      'INTEGER');
  await _ensureColumn(database, 'predefined_formats', 'updated_by',       "TEXT DEFAULT ''");

  // ── v256: A4 rendering layout profile ─────────────────────────────────────
  // Stored as a JSON-serialised LayoutProfile object.
  // NULL means "use DEFAULT_LAYOUT_PROFILE" — safe default for all existing rows.
  await _ensureColumn(database, 'predefined_formats', 'layout_profile', 'TEXT');

  // ── v97: NirodhatmakKaryvahi Module — Village, Type, Date, Editor workflow ──
  // Moved from schema.ts raw ALTER TABLE to _ensureColumn so migrations are
  // idempotent and never emit duplicate-column warnings on re-runs.
  // Existing records receive safe defaults automatically.
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'proceeding_date',  "TEXT DEFAULT ''");
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'village_id',       "TEXT DEFAULT ''");
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'village_name',     "TEXT DEFAULT ''");
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'proceeding_type',  "TEXT DEFAULT 'अन्य'");
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'editor_content',   "TEXT DEFAULT ''");
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'status',           "TEXT DEFAULT 'Active'");
  await _ensureColumn(database, 'nirodhatmak_karyvahi', 'checklist_json',   "TEXT DEFAULT '{}'");

  // ── v130: Case Diary — places_visited + karyvahi completion traceability ─────
  // places_visited       → TEXT array of visited places (JSON-serialised string)
  // completed_by_diary_id → foreign key to the case diary that marked this
  //                         karyvahi complete; null = manually toggled / pending.
  await _ensureColumn(database, 'case_diaries',  'places_visited',        "TEXT DEFAULT ''");
  await _ensureColumn(database, 'fir_karyvahi',  'completed_by_diary_id', 'TEXT');
  // case_diary_karyvahi: store rich text vivran + format reference per entry
  await _ensureColumn(database, 'case_diary_karyvahi', 'sort_order', 'INTEGER DEFAULT 0');

  // ── v250: Executions & execution_count ────────────────────────────────────
  // execution_count is a cached derived field on fir_karyvahi.
  // It is NEVER set manually — recalcExecutionCount() recomputes it from
  // karyvahi_executions whenever an execution is added or removed.
  await _ensureColumn(database, 'fir_karyvahi', 'execution_count', 'INTEGER DEFAULT 0');
  // source: 'system' | 'user' — system karyvahi (seeded at FIR creation)
  // are not deletable from the detail screen.
  await _ensureColumn(database, 'fir_karyvahi', 'source', "TEXT DEFAULT 'system'");

  // ── Reminders v3: category, priority, case link, custom repeat, early
  // alert, repeat-until-done (nag), snooze, completion time.
  await _ensureColumn(database, 'reminders', 'category',     "TEXT DEFAULT 'general'");
  await _ensureColumn(database, 'reminders', 'priority',     "TEXT DEFAULT 'normal'");
  await _ensureColumn(database, 'reminders', 'fir_id',       "TEXT DEFAULT ''");
  await _ensureColumn(database, 'reminders', 'fir_label',    "TEXT DEFAULT ''");
  await _ensureColumn(database, 'reminders', 'repeat_days',  "TEXT DEFAULT ''");
  await _ensureColumn(database, 'reminders', 'early_min',    'INTEGER DEFAULT 0');
  await _ensureColumn(database, 'reminders', 'nag_min',      'INTEGER DEFAULT 0');
  await _ensureColumn(database, 'reminders', 'snooze_until', 'INTEGER DEFAULT 0');
  await _ensureColumn(database, 'reminders', 'completed_at', 'INTEGER');

  // ── v304: मुकदमा सारांश — Case Summary field on FIR ─────────────────────────
  // Optional long-form narrative summary stored directly on the fir record.
  // NULL / '' means "not set"; no default value needed (nullable TEXT).
  await _ensureColumn(database, 'firs', 'mukadma_saransh', 'TEXT');

  // ── Phase 1: Action Engine Upgrade — Priority + Rich Status ──────────────
  // checklist_items: template-level priority (seeded into fir_karyvahi on FIR creation)
  // fir_karyvahi:   per-instance priority, 5-state status, reason fields, due_date
  //
  // Backward-compatibility:
  //   • is_completed stays — kept in sync: COMPLETED → 1, all others → 0
  //   • All new columns have safe defaults so existing rows are untouched
  await _ensureColumn(database, 'checklist_items', 'priority', "TEXT DEFAULT 'MANDATORY'");
  await _ensureColumn(database, 'fir_karyvahi', 'priority',               "TEXT DEFAULT 'MANDATORY'");
  await _ensureColumn(database, 'fir_karyvahi', 'status',                 "TEXT DEFAULT 'PENDING'");
  await _ensureColumn(database, 'fir_karyvahi', 'not_applicable_reason',  'TEXT');
  await _ensureColumn(database, 'fir_karyvahi', 'deferred_reason',        'TEXT');
  await _ensureColumn(database, 'fir_karyvahi', 'due_date',               'TEXT');

  // ── Phase 3: Dependency Engine — action_conditions table + is_locked ────
  // action_conditions: links a blocker karyvahi to a dependent karyvahi.
  // fir_karyvahi.is_locked: 1 = waiting for blocker, 0 = free to execute.
  // Backward-safe: new table + additive column, no existing rows affected.
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS action_conditions (
        id           TEXT PRIMARY KEY,
        fir_id       TEXT NOT NULL,
        blocker_id   TEXT NOT NULL,
        dependent_id TEXT NOT NULL,
        created_at   INTEGER NOT NULL
      )
    `);
  } catch { /* ignore — table already exists */ }
  await _ensureColumn(database, 'fir_karyvahi', 'is_locked', 'INTEGER DEFAULT 0');

  // ── Phase 4: Document Automation — auto_generate_format_id on checklist_items ──
  // When non-null, completing this karyvahi suggests opening the linked predefined
  // format pre-filled so the officer can generate a document in one tap.
  await _ensureColumn(database, 'checklist_items', 'auto_generate_format_id', 'TEXT');
  // Bug fix: also add the same column to fir_karyvahi — seedFIRKaryvahi copies
  // auto_generate_format_id from the template item into every seeded fir_karyvahi
  // row; without this migration that INSERT always fails with "table has no column".
  await _ensureColumn(database, 'fir_karyvahi', 'auto_generate_format_id', 'TEXT');

  // ── Phase 6: Template Versioning ──────────────────────────────────────────
  // investigation_checklists.version — increment whenever the admin edits a
  // checklist so that snapshots can detect staleness.
  await _ensureColumn(database, 'investigation_checklists', 'version', 'INTEGER NOT NULL DEFAULT 1');

  // checklist_snapshot — records the full definition of each template item at
  // the moment a FIR is seeded.  Future edits to the template do not affect
  // any existing FIR; the FIR always reads from its own snapshot.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS checklist_snapshot (
      id                TEXT PRIMARY KEY,
      fir_id            TEXT NOT NULL REFERENCES firs(id),
      checklist_item_id TEXT NOT NULL,
      snapshot_json     TEXT NOT NULL,
      created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
  await database.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_cs_fir_id            ON checklist_snapshot(fir_id);`
  );
  await database.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_cs_checklist_item_id ON checklist_snapshot(checklist_item_id);`
  );
  await database.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_unique ON checklist_snapshot(fir_id, checklist_item_id);`
  );

  // ── Phase 2: Evidence Linking — karyvahi_evidence table ─────────────────
  // Each row links one media file (photo/doc) to one fir_karyvahi item.
  // local_uri  — file:// URI stored on-device (always present; no cloud upload yet)
  // mime_type  — MIME string e.g. "image/jpeg", "application/pdf"
  // caption    — optional user-supplied label for the file
  // created_at — Unix epoch seconds
  // Backward-safe: new table, no existing rows affected.
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS karyvahi_evidence (
        id          TEXT PRIMARY KEY,
        karyvahi_id TEXT NOT NULL,
        fir_id      TEXT NOT NULL,
        local_uri   TEXT NOT NULL,
        mime_type   TEXT NOT NULL DEFAULT 'image/jpeg',
        caption     TEXT,
        created_at  INTEGER NOT NULL
      )
    `);
  } catch { /* ignore — table already exists */ }

  // ── Prarthna Patra Module — additive column migrations ──────────────────
  await _ensureColumn(database, 'prarthna_patra',             'investigator_name', "TEXT DEFAULT ''");
  await _ensureColumn(database, 'prarthna_patra_complainants','jati',              "TEXT DEFAULT ''");
  // age + gender were added to the CREATE TABLE statement but _ensureColumn
  // guards were missing, so devices that opened the DB before that schema
  // change silently lack these columns — causing "table has no column named
  // age/gender" on INSERT and a silent "Failed to save" error.
  await _ensureColumn(database, 'prarthna_patra_complainants','age',               "TEXT DEFAULT ''");
  await _ensureColumn(database, 'prarthna_patra_complainants','gender',            "TEXT DEFAULT ''");
  await _ensureColumn(database, 'prarthna_patra_accused',     'jati',              "TEXT DEFAULT ''");
  await _ensureColumn(database, 'prarthna_patra_accused',     'age',               "TEXT DEFAULT ''");
  await _ensureColumn(database, 'prarthna_patra_accused',     'gender',            "TEXT DEFAULT ''");

  // ── v140: Knowledge Module — section_number ───────────────────────────────
  // Stores a reference number such as "BNS Section 302" or "SOP-04".
  // Optional freetext; meaningfully used for Law / SOP / Circular /
  // Court Judgment entries but harmless on Checklist / Police Format.
  // Nullable TEXT (DEFAULT '') so existing rows need no back-fill.
  await _ensureColumn(database, 'knowledge_entries', 'section_number', "TEXT DEFAULT ''");
  await _ensureColumn(database, 'knowledge_entries', 'simple_explanation', "TEXT DEFAULT ''");
  await _ensureColumn(database, 'knowledge_entries', 'simple_explanation_generated_at', 'INTEGER');

  // ── v150: Investigation Checklists — source / editable / crime_subtype ────
  // source:        'system' (owner-seeded) | 'user' (officer-created).
  //                Mirrors the same field on predefined_formats so the list
  //                screen can offer the same System / User / All filter tabs.
  //                Defaults to 'user' for rows created before this migration.
  // editable:      1 = may be edited by the officer; 0 = locked system record.
  //                Defaults to 1 for rows created before this migration.
  // crime_subtype: Optional secondary classifier (e.g. "Day Robbery" under
  //                crime_type "Theft"). The (crime_type, crime_subtype) pair
  //                must be unique at the application level — the add-checklist
  //                screen enforces this with a duplicate-warn dialog.
  await _ensureColumn(database, 'investigation_checklists', 'source',        "TEXT DEFAULT 'user'");
  await _ensureColumn(database, 'investigation_checklists', 'editable',      'INTEGER DEFAULT 1');
  await _ensureColumn(database, 'investigation_checklists', 'crime_subtype', "TEXT DEFAULT ''");

  // ── v202: checklist_items — source / editable for System/User filter ──────
  // source:   'system' (seeded) | 'user' (officer-created). Mirrors the same
  //           field on investigation_checklists so the new flat-item list screen
  //           can offer the same System / User / All filter tabs.
  // editable: 1 = officer may edit; 0 = locked system record.
  await _ensureColumn(database, 'checklist_items', 'source',   "TEXT DEFAULT 'user'");
  await _ensureColumn(database, 'checklist_items', 'editable', 'INTEGER DEFAULT 1');

  // ── format_usage_log.values_json (JSON blob for autocomplete backfill) ────
  await _ensureColumn(database, 'format_usage_log', 'values_json', 'TEXT');

  // ── v202: make checklist_items.checklist_id nullable ─────────────────────
  // The original schema had checklist_id NOT NULL (every item belonged to one
  // parent checklist). The new M2M model inserts checklist_id = NULL for
  // standalone items. SQLite cannot ALTER a column constraint, so we
  // recreate the table preserving all existing data.
  await _migrateChecklistItemsNullableChecklistId(database);

  // ── Post-migration column probe ───────────────────────────────────────────  // Confirms whether sort_order actually exists after the migration attempt.
  // _ensureColumn swallows unexpected errors; _probeColumn is the definitive
  // runtime truth.  The result is cached in _firKaryvahiHasSortOrder so that
  // firKaryvahiRepo can pick the correct INSERT path without ever querying
  // the schema again after startup.
  _firKaryvahiHasSortOrder = await _probeColumn(database, 'fir_karyvahi', 'sort_order');
  if (!_firKaryvahiHasSortOrder) {
    console.warn(
      '[Schema] fir_karyvahi.sort_order absent after migration — ' +
      'seedFIRKaryvahi will use the fallback INSERT path (created_at ordering).'
    );
  }

  await _ensureIndexes(database);

  // ── v280: Field Value History — one-time backfill ────────────────────────
  // field_value_history is a brand-new table; its CREATE TABLE is in schema.ts.
  // Run the backfill exactly once, guarded by the app_migrations sentinel row.
  await _backfillFieldValueHistory(database);

  // ── Diary queue flag — queued_for_diary on fir_karyvahi ──────────────────
  // 0 = not queued (default), 1 = officer has flagged this item for the
  // next Case Diary session via the "केस डायरी में जोड़ें" toggle in the
  // General karyvahi view. Safe default: existing rows get 0 (not queued).
  await _ensureColumn(database, 'fir_karyvahi', 'queued_for_diary', 'INTEGER NOT NULL DEFAULT 0');

  // ── Investigation Playbook: structured investigation steps ────────────────
  await _ensureColumn(database, 'checklist_items', 'step_code',      'TEXT');
  await _ensureColumn(database, 'checklist_items', 'phase',          'TEXT');
  await _ensureColumn(database, 'checklist_items', 'proves',         'TEXT');
  await _ensureColumn(database, 'checklist_items', 'condition_note', 'TEXT');
  await _ensureColumn(database, 'checklist_items', 'legal_basis',    'TEXT');
  await _ensureColumn(database, 'checklist_items', 'why_text',       'TEXT');
  await _ensureColumn(database, 'checklist_items', 'court_text',     'TEXT');
  await _ensureColumn(database, 'checklist_items', 'care_text',      'TEXT');
  await _ensureColumn(database, 'checklist_items', 'risk_text',      'TEXT');
  await _ensureColumn(database, 'checklist_items', 'steps_text',     'TEXT');
  await _ensureColumn(database, 'checklist_items', 'docs_text',      'TEXT');
  await _ensureColumn(database, 'fir_karyvahi',    'step_code',      'TEXT');

  // ── Flat taxonomy seed (v2) — checklist_items + checklist_item_subtypes ───
  // checklistItemsSeed.items are bundled with the app binary. Every item has:
  //   task_name, brief_description, priority, crime_types: string[]
  // We INSERT OR IGNORE so this is safe to run on every DB open (idempotent).
  // checklist_item_subtypes.crime_subtype is set to '' for all flat-taxonomy
  // items (the flat model has no subtypes; the column exists for legacy rows).
  await _seedChecklistItems(database);
  try {
    await ensurePlaybookSeeded(database);
  } catch (err) {
    logger.warn('[database] ensurePlaybookSeeded failed:', err);
  }
}

/**
 * One-time migration: make checklist_items.checklist_id nullable.
 *
 * The original schema defined checklist_id NOT NULL (items always had one
 * parent checklist). The v202 M2M model inserts checklist_id = NULL for
 * standalone items linked only via checklist_item_subtypes.
 *
 * SQLite cannot ALTER a column to drop NOT NULL, so we use the
 * CREATE new / INSERT SELECT / DROP old / RENAME pattern.
 * Guard: PRAGMA table_info notnull=0 means already nullable — skip.
 */
async function _migrateChecklistItemsNullableChecklistId(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  try {
    const info = await database.getAllAsync<{ name: string; notnull: number }>(
      `PRAGMA table_info(checklist_items)`
    );
    const col = info.find((c) => c.name === 'checklist_id');
    if (!col || col.notnull === 0) {
      // Already nullable (or table absent — schema CREATE TABLE will handle it)
      return;
    }
    await database.execAsync('BEGIN');
    await database.execAsync(`
      CREATE TABLE checklist_items_new (
        id                TEXT PRIMARY KEY,
        checklist_id      TEXT,
        serial_no         INTEGER NOT NULL DEFAULT 0,
        task_name         TEXT NOT NULL,
        brief_description TEXT NOT NULL DEFAULT '',
        sort_order        INTEGER NOT NULL DEFAULT 0,
        created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        updated_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        deleted_at        INTEGER,
        source            TEXT DEFAULT 'user',
        editable          INTEGER DEFAULT 1
      );
    `);
    await database.execAsync(`
      INSERT INTO checklist_items_new
        (id, checklist_id, serial_no, task_name, brief_description,
         sort_order, created_at, updated_at, deleted_at, source, editable)
      SELECT id, checklist_id, serial_no, task_name, brief_description,
             sort_order, created_at, updated_at, deleted_at, source, editable
      FROM checklist_items;
    `);
    await database.execAsync(`DROP TABLE checklist_items;`);
    await database.execAsync(`ALTER TABLE checklist_items_new RENAME TO checklist_items;`);
    await database.execAsync('COMMIT');
    console.info('[Schema] checklist_items.checklist_id migrated to nullable');
  } catch (e) {
    try { await database.execAsync('ROLLBACK'); } catch { /* ignore rollback error */ }
    console.error('[Schema] checklist_items nullable migration failed:', e);
  }
}

/**
 * One-time backfill of field_value_history from existing FIR, accused and
 * format_usage_log records.  Guarded by a sentinel row in app_migrations so
 * it never runs twice, even if initializeSchema() is called multiple times
 * within a session (e.g. after clearStubCache).
 *
 * Fields backfilled:
 *   firs             → fir_number, section, complainant_name,
 *                       complainant_address, complainant_jati, ghatnasthal
 *   fir_accused      → name, address, jati
 *   format_usage_log → values_json scanned for keys mapped to canonical keys
 *                       (section, fir_number, person_name, father_husband_name,
 *                        address, caste)
 *
 * The UPSERT logic mirrors recordFieldValue: dedupe on (field_key, LOWER(TRIM(value))).
 */
/**
 * Idempotent seed loader for the flat v2 crime taxonomy checklist items.
 *
 * Reads checklistItemsSeed (bundled JSON, 78 items) and populates two tables:
 *   checklist_items          — one row per item (INSERT OR IGNORE on id)
 *   checklist_item_subtypes  — one row per (item × crime_type) pair (INSERT OR IGNORE on id)
 *
 * The deterministic id strategy:
 *   checklist_items.id          = 'sys_ci_' + index (0-based)
 *   checklist_item_subtypes.id  = 'sys_cis_' + itemIndex + '_' + ctIndex
 *
 * Using INSERT OR IGNORE means this is safe to call on every DB open:
 *   • Fresh install  → all rows inserted
 *   • Subsequent opens → all INSERT OR IGNORE silently no-op
 *   • New item added to seed in a future app update → only the new row inserts
 *
 * checklist_item_subtypes.crime_subtype is '' for all flat-taxonomy rows
 * (the column exists for legacy nested rows; flat items have no subtype).
 */
async function _seedChecklistItems(database: SQLite.SQLiteDatabase): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const items = (checklistItemsSeed as { items: Array<{
    task_name: string;
    brief_description?: string;
    priority?: string;
    auto_generate_format_id?: string;
    crime_types: string[];
  }> }).items;

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = `sys_ci_${i}`;

      // INSERT OR IGNORE: skip if this system seed row already exists
      await database.runAsync(
        `INSERT OR IGNORE INTO checklist_items
           (id, checklist_id, serial_no, task_name, brief_description,
            priority, auto_generate_format_id, source, editable,
            sort_order, created_at, updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 'system', 0, ?, ?, ?)`,
        [
          itemId,
          i,
          item.task_name,
          item.brief_description ?? '',
          item.priority ?? 'MANDATORY',
          item.auto_generate_format_id ?? null,
          i,
          now,
          now,
        ]
      );

      // One checklist_item_subtypes row per crime_type entry
      const crimeTypes = Array.isArray(item.crime_types) ? item.crime_types : [];
      for (let j = 0; j < crimeTypes.length; j++) {
        const ct = crimeTypes[j];
        if (!ct) continue;
        await database.runAsync(
          `INSERT OR IGNORE INTO checklist_item_subtypes
             (id, checklist_item_id, crime_type, crime_subtype, created_at)
           VALUES (?, ?, ?, '', ?)`,
          [`sys_cis_${i}_${j}`, itemId, ct, now]
        );
      }
    }
    console.info(`[Seed] checklist_items seed loaded: ${items.length} items`);
  } catch (e) {
    console.error('[Seed] _seedChecklistItems failed:', e);
    // Non-fatal: log and continue — the app can still open FIRs,
    // it just won't have crime-specific checklist items this session.
  }
}

async function _backfillFieldValueHistory(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  const SENTINEL = 'backfill_field_value_history_v280';
  try {
    const already = await database.getFirstAsync<{ migration_name: string }>(
      `SELECT migration_name FROM app_migrations WHERE migration_name = ?`,
      [SENTINEL]
    );
    if (already) return; // already ran

    const now = Math.floor(Date.now() / 1000);

    // Helper: upsert a single (fieldKey, value) pair into field_value_history.
    // Silently skips blank/whitespace-only values.
    const upsert = async (fieldKey: string, rawValue: string | null | undefined) => {
      const trimmed = (rawValue ?? '').trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      const existing = await database.getFirstAsync<{ id: string }>(
        `SELECT id FROM field_value_history WHERE field_key = ? AND LOWER(TRIM(value)) = ?`,
        [fieldKey, normalized]
      );
      if (existing) {
        await database.runAsync(
          `UPDATE field_value_history SET use_count = use_count + 1, last_used_at = ? WHERE id = ?`,
          [now, existing.id]
        );
      } else {
        // generateUUID() not available in this scope — use SQLite's hex(randomblob)
        await database.runAsync(
          `INSERT INTO field_value_history (id, field_key, value, use_count, last_used_at)
           VALUES (lower(hex(randomblob(16))), ?, ?, 1, ?)`,
          [fieldKey, trimmed, now]
        );
      }
    };

    // ── Backfill from firs table ──────────────────────────────────────────
    const firs = await database.getAllAsync<{
      fir_number: string; section: string;
      complainant_name: string; complainant_address: string;
      complainant_jati: string; ghatnasthal: string;
    }>(
      `SELECT fir_number, section, complainant_name, complainant_address,
              complainant_jati, ghatnasthal
         FROM firs WHERE deleted_at IS NULL`
    );
    for (const row of firs) {
      await upsert('fir_number',         row.fir_number);
      await upsert('section',            row.section);
      await upsert('person_name',        row.complainant_name);
      await upsert('address',            row.complainant_address);
      await upsert('caste',              row.complainant_jati);
      await upsert('address',            row.ghatnasthal);
    }

    // ── Backfill from fir_accused table ───────────────────────────────────
    const accused = await database.getAllAsync<{
      name: string; address: string; jati: string;
    }>(
      `SELECT name, address, jati FROM fir_accused WHERE deleted_at IS NULL`
    );
    for (const row of accused) {
      await upsert('person_name', row.name);
      await upsert('address',     row.address);
      await upsert('caste',       row.jati);
    }

    // ── Backfill from format_usage_log.values_json ─────────────────────────
    // values_json is a JSON object; scan well-known key names that map to
    // canonical field keys.  Unknown keys are silently skipped.
    const FORMAT_KEY_MAP: Record<string, string> = {
      // section / धारा fields
      Section: 'section', section: 'section',
      Dhara: 'section', dhara: 'section',
      // FIR number
      FIRNumber: 'fir_number', FirNumber: 'fir_number', firNumber: 'fir_number',
      // person names
      AccusedName: 'person_name', VictimName: 'person_name',
      ComplainantName: 'person_name',
      // father/husband
      FatherName: 'father_husband_name', FatherOrHusbandName: 'father_husband_name',
      fatherOrHusbandName: 'father_husband_name',
      // address
      Address: 'address', FullAddress: 'address', fullAddress: 'address',
      Ghatnasthal: 'address',
      // caste
      Caste: 'caste', caste: 'caste', Jati: 'caste',
      // police station
      PoliceStation: 'police_station',
    };

    // ── Backfill from format_usage_log.values_json ─────────────────────────
    // values_json may not exist on older schema versions — wrap in try/catch
    // so a "no such column" error on first-install devices does not abort the
    // entire field_value_history backfill.
    try {
      const usageLogs = await database.getAllAsync<{ values_json: string }>(
        `SELECT values_json FROM format_usage_log WHERE values_json IS NOT NULL AND values_json != ''`
      );
      for (const log of usageLogs) {
        try {
          const parsed = JSON.parse(log.values_json) as Record<string, unknown>;
          for (const [k, v] of Object.entries(parsed)) {
            const canonical = FORMAT_KEY_MAP[k];
            if (canonical && typeof v === 'string') {
              await upsert(canonical, v);
            }
          }
        } catch { /* malformed JSON — skip */ }
      }
    } catch (e) {
      // Column or table missing on this device version — silently skip.
      console.warn('[Schema] format_usage_log.values_json backfill skipped:', e);
    }

    // Mark complete
    await database.runAsync(
      `INSERT OR IGNORE INTO app_migrations (migration_name, applied_at) VALUES (?, ?)`,
      [SENTINEL, now]
    );
    console.info('[Schema] field_value_history backfill complete');
  } catch (e) {
    // Non-fatal — autocomplete just starts with fewer suggestions
    console.warn('[Schema] field_value_history backfill failed (non-fatal):', e);
  }
}

/**
 * Creates performance indexes for frequently-queried columns.
 * Uses IF NOT EXISTS — safe to call on every app startup.
 * All indexes cover deleted_at=NULL paths used by every module list query.
 */
async function _ensureIndexes(database: SQLite.SQLiteDatabase): Promise<void> {
  const indexes = [
    // FIR — filter by status, sort by created_at
    `CREATE INDEX IF NOT EXISTS idx_firs_status ON firs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_firs_deleted_created ON firs(deleted_at, created_at)`,
    // FIR karyvahi — lookup by fir_id
    `CREATE INDEX IF NOT EXISTS idx_fir_karyvahi_fir_id ON fir_karyvahi(fir_id)`,
    // Case diaries — lookup by fir_id
    `CREATE INDEX IF NOT EXISTS idx_case_diaries_fir_id ON case_diaries(fir_id)`,
    // GD — filter by date, sort
    `CREATE INDEX IF NOT EXISTS idx_gd_prep_date ON gd_entries(preparation_date)`,
    `CREATE INDEX IF NOT EXISTS idx_gd_deleted_created ON gd_entries(deleted_at, created_at)`,
    // Prarthna Patra — filter by status, deadline
    `CREATE INDEX IF NOT EXISTS idx_pp_status ON prarthna_patra(status)`,
    `CREATE INDEX IF NOT EXISTS idx_pp_deadline ON prarthna_patra(deadline_date)`,
    `CREATE INDEX IF NOT EXISTS idx_pp_deleted_created ON prarthna_patra(deleted_at, created_at)`,
    // Nyayalay — filter by status, deadline
    `CREATE INDEX IF NOT EXISTS idx_nyl_status ON nyayalay_documents(status)`,
    `CREATE INDEX IF NOT EXISTS idx_nyl_deadline ON nyayalay_documents(deadline_date)`,
    `CREATE INDEX IF NOT EXISTS idx_nyl_deleted_created ON nyayalay_documents(deleted_at, created_at)`,
    // Knowledge — filter by category
    `CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category)`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_deleted ON knowledge_entries(deleted_at)`,
    // Halka — GP / person lookups
    `CREATE INDEX IF NOT EXISTS idx_hamlets_gp_id ON hamlets(gp_id)`,
    `CREATE INDEX IF NOT EXISTS idx_persons_gp_id ON persons(gp_id)`,
    `CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type)`,
    `CREATE INDEX IF NOT EXISTS idx_religious_places_gp_id ON religious_places(gp_id)`,
    `CREATE INDEX IF NOT EXISTS idx_social_institutions_gp_id ON social_institutions(gp_id)`,
    // Format usage
    `CREATE INDEX IF NOT EXISTS idx_format_usage_format_id ON format_usage_log(format_id)`,
    // predefined_formats — cover all filter/sort/search hot paths
    `CREATE INDEX IF NOT EXISTS idx_pf_status         ON predefined_formats(status)`,
    `CREATE INDEX IF NOT EXISTS idx_pf_format_type    ON predefined_formats(format_type)`,
    `CREATE INDEX IF NOT EXISTS idx_pf_title          ON predefined_formats(title)`,
    `CREATE INDEX IF NOT EXISTS idx_pf_created_by     ON predefined_formats(created_by)`,
    `CREATE INDEX IF NOT EXISTS idx_pf_last_used_at   ON predefined_formats(last_used_at)`,
    `CREATE INDEX IF NOT EXISTS idx_pf_created_at     ON predefined_formats(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_pf_deleted_status ON predefined_formats(deleted_at, status)`,
    // format_tags — tag search and per-format lookup
    `CREATE INDEX IF NOT EXISTS idx_ft_format_id      ON format_tags(format_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ft_tag             ON format_tags(tag)`,
    // Nirodhatmak
    `CREATE INDEX IF NOT EXISTS idx_nirodhatmak_deleted ON nirodhatmak_karyvahi(deleted_at)`,
    // karyvahi_evidence — fast lookup per karyvahi and per FIR
    `CREATE INDEX IF NOT EXISTS idx_karyvahi_evidence_karyvahi_id ON karyvahi_evidence(karyvahi_id)`,
    `CREATE INDEX IF NOT EXISTS idx_karyvahi_evidence_fir_id      ON karyvahi_evidence(fir_id)`,
    // action_conditions — lookup by blocker, dependent, and FIR
    `CREATE INDEX IF NOT EXISTS idx_ac_blocker_id   ON action_conditions(blocker_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ac_dependent_id ON action_conditions(dependent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ac_fir_id       ON action_conditions(fir_id)`,
    // Enforce uniqueness: one blocker→dependent pair per FIR (DELETE dupes first)
    `DELETE FROM action_conditions WHERE rowid NOT IN (
       SELECT MIN(rowid) FROM action_conditions GROUP BY fir_id, blocker_id, dependent_id
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ac_unique ON action_conditions(fir_id, blocker_id, dependent_id)`,
    // format_tags — enforce unique (format_id, tag) pairs at the DB level.
    // This prevents duplicate key warnings in React when the same tag is
    // accidentally stored twice for the same format (e.g. multiple seed runs,
    // upsertDevFormat loops, or import paths that lack UI-level dedup guards).
    // The DELETE below removes any pre-existing duplicates (keeping the oldest
    // row) before the UNIQUE INDEX is created, so the CREATE never fails on
    // databases that already contain duplicate rows.
    `DELETE FROM format_tags WHERE rowid NOT IN (
       SELECT MIN(rowid) FROM format_tags GROUP BY format_id, tag
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_format_tags_unique ON format_tags(format_id, tag)`,
    // field_value_history — prefix-match lookup per canonical field key
    `CREATE INDEX IF NOT EXISTS idx_fvh_key_value ON field_value_history(field_key, value)`,
  ];
  for (const sql of indexes) {
    try {
      await database.execAsync(sql);
    } catch {
      // Ignore — table may not exist yet on very first run before CREATE TABLE runs
    }
  }
}

/**
 * Ensures `column` exists in `table` by attempting ALTER TABLE ADD COLUMN.
 *
 * Uses ALTER TABLE directly (not PRAGMA table_info) because:
 * – PRAGMA table_info via getAllAsync() may return empty results on some
 *   expo-sqlite builds, causing an incorrect "column exists" determination
 *   and silently skipping the migration.
 * – SQLite's own "duplicate column name" error is the reliable signal that
 *   the column is already present.
 *
 * Note: definitions intentionally omit NOT NULL because SQLite (and some
 * Android system SQLite builds) rejects NOT NULL in ALTER TABLE ADD COLUMN.
 */
/**
 * Confirms whether a column exists in a table by issuing a zero-row SELECT.
 *
 * • Returns true  when SQLite accepts the column reference.
 * • Returns false when SQLite throws "no such column" (column absent).
 *
 * Used after every _ensureColumn attempt so that firKaryvahiRepo can pick
 * the correct INSERT path without re-querying the schema at write time.
 * Safe to call with LIMIT 0 — no rows are transferred; the query completes
 * in microseconds on any device.
 */
async function _probeColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string
): Promise<boolean> {
  try {
    await database.getAllAsync(`SELECT ${column} FROM ${table} LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}

async function _ensureColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      // Column already present — this is the normal path for all app restarts
      // after the first successful migration.
    } else {
      // Something unexpected — log clearly so it surfaces in crash reports.
      console.error(`[Schema] _ensureColumn FAILED for ${table}.${column}:`, e);
    }
  }
}

// Generate UUID v4
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
