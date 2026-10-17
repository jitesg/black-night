/**
 * devSeedStore — Developer-only System Content working copy.
 *
 * Loads the bundled seed JSON as the initial state and persists any
 * additions / edits / deletions so work survives hot-reloads during
 * development.
 *
 * PERSISTENCE STRATEGY (auto-detected, no manual config required):
 *   Real SQLite (Android / iOS)  → AsyncStorage (device-persistent)
 *   SQLite Stub (Expo Web)       → localStorage  (tab-persistent)
 *
 * Every Save/Edit/Delete writes through TWO layers simultaneously:
 *   1. devContentPersistence (localStorage or AsyncStorage) — ring-buffer
 *      that survives Fast Refresh, hot reloads, browser refreshes, and
 *      app restarts.
 *   2. The live SQLite / Stub DB — immediate effect in the running session
 *      so screens that read from the DB see the change without a restart.
 *      (On stub this is _mem, which is already shared across the session.)
 *
 * On next cold start, seedManager.restoreDevContent() reads layer-1 and
 * re-applies it to the DB before any screen renders, so the content is
 * always present.
 *
 * PRODUCTION SAFETY: the entire module is designed to be used only from
 * components already gated by `__DEV__`.  Callers must gate themselves.
 *
 * Export: serialises the working copy back into the exact JSON shape used
 * by assets/seed/formats_seed.json and assets/seed/knowledge_seed.json so
 * the developer can copy the output into those files before the next build.
 */
import { useState, useCallback, useEffect } from 'react';
import Constants from 'expo-constants';
import formatsSeedData from '../../assets/seed/formats_seed.json';
import knowledgeSeedData from '../../assets/seed/knowledge_seed.json';
import circularsSeedData from '../../assets/seed/circulars_seed.json';
import {
  dcGet, dcSet, dcRemove, dcClearAll,
  DC_KEY_FORMATS, DC_KEY_KNOWLEDGE, DC_KEY_LAST_EXPORT,
} from './devContentPersistence';
// DB upsert helpers — used to write developer content into the live DB
// immediately so all screens reflect changes without a restart.
import { upsertDevFormat, deleteDevFormat } from './db/predefinedFormatRepo';
import { upsertDevKnowledge, deleteDevKnowledge } from './db/knowledgeRepo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeedFormatKey {
  key_name: string;
  label: string;
  field_type: string;
  is_required: number;
  sort_order: number;
  default_value?: string;
  dropdown_options?: string;
}

export interface SeedFormat {
  id: string;
  title: string;
  format_type: string;
  vivran: string;
  is_favorite: number;
  created_by: string;
  source: 'system';
  editable: 0;
  content_type: string;
  seed_version: number;
  app_version: string;
  last_updated: string;
  tags: string[];
  keys: SeedFormatKey[];
}

export interface SeedKnowledge {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  crime_type: string;
  description: string;
  tags: string;
  attachment_uris: string;
  source: 'system';
  editable: 0;
  content_type: string;
  seed_version: number;
  app_version: string;
  last_updated: string;
}

export interface SeedExport {
  formatsJson: string;
  knowledgeJson: string;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SeedStats {
  totalFormats: number;
  totalKnowledge: number;
  totalSops: number;
  totalGuides: number;
  totalChecklists: number;
  lastExportTime: string | null;
}

// ─── Storage key aliases (re-exported from devContentPersistence) ─────────────
// Kept here so internal helpers can reference them without a second import.
const AS_FORMATS_KEY      = DC_KEY_FORMATS;
const AS_KNOWLEDGE_KEY    = DC_KEY_KNOWLEDGE;
const AS_LAST_EXPORT_KEY  = DC_KEY_LAST_EXPORT;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/** Simple UUID v4 (RFC 4122 compliant, no external deps). */
export function devGenUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface DevSeedStore {
  formats: SeedFormat[];
  knowledge: SeedKnowledge[];
  loading: boolean;
  stats: SeedStats;

  // Formats CRUD
  addFormat: (input: Omit<SeedFormat, 'id' | 'source' | 'editable' | 'seed_version' | 'app_version' | 'last_updated'>) => string | null;
  updateFormat: (id: string, input: Partial<Omit<SeedFormat, 'id' | 'source' | 'editable'>>) => void;
  deleteFormat: (id: string) => void;

  // Knowledge CRUD
  addKnowledge: (input: Omit<SeedKnowledge, 'id' | 'source' | 'editable' | 'seed_version' | 'app_version' | 'last_updated'>) => string | null;
  updateKnowledge: (id: string, input: Partial<Omit<SeedKnowledge, 'id' | 'source' | 'editable'>>) => void;
  deleteKnowledge: (id: string) => void;

  // Validation helpers
  isTitleDuplicateFormat: (title: string, excludeId?: string) => boolean;
  isTitleDuplicateKnowledge: (title: string, excludeId?: string) => boolean;

  // Export
  exportSeedJson: () => SeedExport;

  // Import
  importSeedJson: (rawJson: string) => ImportResult;

  // Reset to bundled seed
  resetToBundle: () => void;
}

const BUNDLED_FORMATS   = (formatsSeedData   as { formats:   SeedFormat[]   }).formats;
const RAW_BUNDLED_KNOWLEDGE = (knowledgeSeedData as { knowledge: SeedKnowledge[] }).knowledge;
const RAW_CIRCULARS = ((circularsSeedData as { knowledge?: SeedKnowledge[] })?.knowledge ?? []).map((k) => ({
  ...k,
  source: 'system' as const,
  editable: 0 as const,
  content_type: k.content_type || 'circular',
}));
const BUNDLED_KNOWLEDGE: SeedKnowledge[] = [
  ...RAW_BUNDLED_KNOWLEDGE.filter(
    (k) => !(k.source === 'system' && (k.category === 'Law' || k.category === 'Laws & Sections'))
  ),
  ...RAW_CIRCULARS,
];

export function useDevSeedStore(): DevSeedStore {
  const [formats,        setFormats       ] = useState<SeedFormat[]  >(BUNDLED_FORMATS);
  const [knowledge,      setKnowledge     ] = useState<SeedKnowledge[]>(BUNDLED_KNOWLEDGE);
  const [loading,        setLoading       ] = useState(true);
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);

  // ── Hydrate from persistent storage (localStorage or AsyncStorage) ─────────
  useEffect(() => {
    (async () => {
      try {
        const [fRaw, kRaw, expRaw] = await Promise.all([
          dcGet(AS_FORMATS_KEY),
          dcGet(AS_KNOWLEDGE_KEY),
          dcGet(AS_LAST_EXPORT_KEY),
        ]);
        if (fRaw)   setFormats(JSON.parse(fRaw) as SeedFormat[]);
        if (kRaw)   setKnowledge(JSON.parse(kRaw) as SeedKnowledge[]);
        if (expRaw) setLastExportTime(expRaw);
      } catch { /* fallback to bundled */ }
      setLoading(false);
    })();
  }, []);

  // ── Persist helpers — write to localStorage (web) or AsyncStorage (native) ─
  const persistFormats = useCallback(async (next: SeedFormat[]) => {
    await dcSet(AS_FORMATS_KEY, JSON.stringify(next));
  }, []);
  const persistKnowledge = useCallback(async (next: SeedKnowledge[]) => {
    await dcSet(AS_KNOWLEDGE_KEY, JSON.stringify(next));
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const isTitleDuplicateFormat = useCallback((title: string, excludeId?: string): boolean => {
    const t = title.trim().toLowerCase();
    return formats.some((f) => f.title.trim().toLowerCase() === t && f.id !== excludeId);
  }, [formats]);

  const isTitleDuplicateKnowledge = useCallback((title: string, excludeId?: string): boolean => {
    const t = title.trim().toLowerCase();
    return knowledge.some((k) => k.title.trim().toLowerCase() === t && k.id !== excludeId);
  }, [knowledge]);

  // ── Formats CRUD ───────────────────────────────────────────────────────────
  const addFormat = useCallback((
    input: Omit<SeedFormat, 'id' | 'source' | 'editable' | 'seed_version' | 'app_version' | 'last_updated'>
  ): string | null => {
    if (!input.title.trim()) return null;
    const newId = devGenUUID();
    const item: SeedFormat = {
      ...input,
      id: newId,
      source: 'system',
      editable: 0,
      seed_version: 1,
      app_version: currentAppVersion(),
      last_updated: todayIso(),
    };
    const next = [...formats, item];
    setFormats(next);
    // Layer 1: persist to localStorage / AsyncStorage (survives refresh)
    persistFormats(next);
    // Layer 2: write to live DB immediately (no restart required)
    upsertDevFormat(item).catch(() => {});
    return newId;
  }, [formats, persistFormats]);

  const updateFormat = useCallback((
    id: string,
    input: Partial<Omit<SeedFormat, 'id' | 'source' | 'editable'>>
  ) => {
    const next = formats.map((f) =>
      f.id === id
        ? {
            ...f,
            ...input,
            source: 'system' as const,
            editable: 0 as const,
            seed_version: (f.seed_version ?? 1) + 1,
            app_version: currentAppVersion(),
            last_updated: todayIso(),
          }
        : f
    );
    setFormats(next);
    persistFormats(next);
    // Also update live DB
    const updated = next.find((f) => f.id === id);
    if (updated) upsertDevFormat(updated).catch(() => {});
  }, [formats, persistFormats]);

  const deleteFormat = useCallback((id: string) => {
    const next = formats.filter((f) => f.id !== id);
    setFormats(next);
    persistFormats(next);
    // Soft-delete from live DB
    deleteDevFormat(id).catch(() => {});
  }, [formats, persistFormats]);

  // ── Knowledge CRUD ─────────────────────────────────────────────────────────
  const addKnowledge = useCallback((
    input: Omit<SeedKnowledge, 'id' | 'source' | 'editable' | 'seed_version' | 'app_version' | 'last_updated'>
  ): string | null => {
    if (!input.title.trim()) return null;
    const newId = devGenUUID();
    const item: SeedKnowledge = {
      ...input,
      id: newId,
      source: 'system',
      editable: 0,
      seed_version: 1,
      app_version: currentAppVersion(),
      last_updated: todayIso(),
    };
    const next = [...knowledge, item];
    setKnowledge(next);
    persistKnowledge(next);
    upsertDevKnowledge(item).catch(() => {});
    return newId;
  }, [knowledge, persistKnowledge]);

  const updateKnowledge = useCallback((
    id: string,
    input: Partial<Omit<SeedKnowledge, 'id' | 'source' | 'editable'>>
  ) => {
    const next = knowledge.map((k) =>
      k.id === id
        ? {
            ...k,
            ...input,
            source: 'system' as const,
            editable: 0 as const,
            seed_version: (k.seed_version ?? 1) + 1,
            app_version: currentAppVersion(),
            last_updated: todayIso(),
          }
        : k
    );
    setKnowledge(next);
    persistKnowledge(next);
    const updated = next.find((k) => k.id === id);
    if (updated) upsertDevKnowledge(updated).catch(() => {});
  }, [knowledge, persistKnowledge]);

  const deleteKnowledge = useCallback((id: string) => {
    const next = knowledge.filter((k) => k.id !== id);
    setKnowledge(next);
    persistKnowledge(next);
    deleteDevKnowledge(id).catch(() => {});
  }, [knowledge, persistKnowledge]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportSeedJson = useCallback((): SeedExport => {
    const now = new Date().toLocaleString();
    setLastExportTime(now);
    dcSet(AS_LAST_EXPORT_KEY, now).catch(() => {});
    return {
      formatsJson:   JSON.stringify({ formats }, null, 2),
      knowledgeJson: JSON.stringify({ knowledge }, null, 2),
    };
  }, [formats, knowledge]);

  // ── Import ─────────────────────────────────────────────────────────────────
  const importSeedJson = useCallback((rawJson: string): ImportResult => {
    const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      result.errors.push('Invalid JSON: could not parse input.');
      return result;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      result.errors.push('Invalid structure: root must be a JSON object.');
      return result;
    }

    const obj = parsed as Record<string, unknown>;
    const hasFormats   = Array.isArray(obj.formats);
    const hasKnowledge = Array.isArray(obj.knowledge);

    if (!hasFormats && !hasKnowledge) {
      result.errors.push('Invalid structure: JSON must contain a "formats" or "knowledge" array.');
      return result;
    }

    // ── Import formats ───────────────────────────────────────────────────────
    if (hasFormats) {
      let nextFormats = [...formats];
      for (const raw of obj.formats as unknown[]) {
        const item = raw as Partial<SeedFormat>;
        if (!item.id || typeof item.id !== 'string') {
          result.errors.push(`Format missing id: "${item.title ?? 'unknown'}"`);
          continue;
        }
        if (!item.title || typeof item.title !== 'string') {
          result.errors.push(`Format missing title (id: ${item.id})`);
          continue;
        }
        const existing = nextFormats.find((f) => f.id === item.id);
        if (!existing) {
          // New UUID — insert with system overrides
          nextFormats.push({
            ...item as SeedFormat,
            source: 'system',
            editable: 0,
            seed_version: item.seed_version ?? 1,
            app_version:  item.app_version  ?? currentAppVersion(),
            last_updated: item.last_updated  ?? todayIso(),
            tags: Array.isArray(item.tags) ? item.tags : [],
            keys: Array.isArray(item.keys) ? item.keys : [],
          });
          result.added++;
        } else if ((item.seed_version ?? 1) > (existing.seed_version ?? 1)) {
          // Newer version — update
          nextFormats = nextFormats.map((f) =>
            f.id === item.id ? { ...f, ...item as SeedFormat, source: 'system', editable: 0 } : f
          );
          result.updated++;
        } else {
          // Same or older version — skip
          result.skipped++;
        }
      }
      setFormats(nextFormats);
      persistFormats(nextFormats);
    }

    // ── Import knowledge ─────────────────────────────────────────────────────
    if (hasKnowledge) {
      let nextKnowledge = [...knowledge];
      for (const raw of obj.knowledge as unknown[]) {
        const item = raw as Partial<SeedKnowledge>;
        if (!item.id || typeof item.id !== 'string') {
          result.errors.push(`Knowledge missing id: "${item.title ?? 'unknown'}"`);
          continue;
        }
        if (!item.title || typeof item.title !== 'string') {
          result.errors.push(`Knowledge missing title (id: ${item.id})`);
          continue;
        }
        const existing = nextKnowledge.find((k) => k.id === item.id);
        if (!existing) {
          nextKnowledge.push({
            ...item as SeedKnowledge,
            source: 'system',
            editable: 0,
            seed_version: item.seed_version ?? 1,
            app_version:  item.app_version  ?? currentAppVersion(),
            last_updated: item.last_updated  ?? todayIso(),
            tags:            item.tags            ?? '',
            attachment_uris: item.attachment_uris ?? '[]',
          });
          result.added++;
        } else if ((item.seed_version ?? 1) > (existing.seed_version ?? 1)) {
          nextKnowledge = nextKnowledge.map((k) =>
            k.id === item.id ? { ...k, ...item as SeedKnowledge, source: 'system', editable: 0 } : k
          );
          result.updated++;
        } else {
          result.skipped++;
        }
      }
      setKnowledge(nextKnowledge);
      persistKnowledge(nextKnowledge);
    }

    return result;
  }, [formats, knowledge, persistFormats, persistKnowledge]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetToBundle = useCallback(() => {
    setFormats(BUNDLED_FORMATS);
    setKnowledge(BUNDLED_KNOWLEDGE);
    setLastExportTime(null);
    dcClearAll().catch(() => {});
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: SeedStats = {
    totalFormats:    formats.length,
    totalKnowledge:  knowledge.length,
    totalSops:       [...formats, ...knowledge].filter((i) => i.content_type === 'sop').length,
    totalGuides:     knowledge.filter((k) => k.content_type === 'guide').length,
    totalChecklists: knowledge.filter((k) => k.content_type === 'checklist').length,
    lastExportTime,
  };

  return {
    formats,
    knowledge,
    loading,
    stats,
    addFormat,
    updateFormat,
    deleteFormat,
    addKnowledge,
    updateKnowledge,
    deleteKnowledge,
    isTitleDuplicateFormat,
    isTitleDuplicateKnowledge,
    exportSeedJson,
    importSeedJson,
    resetToBundle,
  };
}
