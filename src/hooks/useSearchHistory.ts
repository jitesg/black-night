/**
 * useSearchHistory — AsyncStorage-backed recent-search list.
 *
 * - Key:   'investsuite:search_history_v1'
 * - Stores last 15 unique queries, most-recent-first.
 * - Respects settings.searchHistory toggle:
 *     OFF → addToHistory is a no-op; existing history is neither shown nor
 *           deleted (re-enabling restores it).
 *     ON  → normal record + display.
 * - Shared across all modules (no per-module namespace).
 *   If you need module-level isolation, prefix queries with e.g. 'gd:'.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@/hooks/useSettingsStore';

const HISTORY_KEY = 'investsuite:search_history_v1';
const MAX_ITEMS = 15;

export function useSearchHistory() {
  const { settings } = useSettingsStore();
  const [history, setHistory] = useState<string[]>([]);

  // Load on mount — always load so toggling back on restores existing history.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (raw) setHistory(JSON.parse(raw) as string[]);
      } catch { /* ignore */ }
    })();
  }, []);

  const addToHistory = useCallback(async (query: string) => {
    if (!settings.searchHistory) return; // no-op when feature is disabled
    const trimmed = query.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      const deduped = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, MAX_ITEMS);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(deduped)).catch(() => null);
      return deduped;
    });
  }, [settings.searchHistory]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY).catch(() => null);
  }, []);

  const removeFromHistory = useCallback(async (query: string) => {
    setHistory((prev) => {
      const updated = prev.filter((q) => q !== query);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(() => null);
      return updated;
    });
  }, []);

  return { history, addToHistory, clearHistory, removeFromHistory };
}

// ─── Per-screen recent searches (SearchBar) ──────────────────────────────────
const RECENT_PREFIX = 'investsuite:recent_search:';
const RECENT_MAX = 8;
const recentCache = new Map<string, string[]>();

/**
 * Recent searches for one screen (scope = route path). Shown by SearchBar when the
 * box is focused and empty. Respects settings.searchHistory (off → nothing saved/shown).
 */
export function useRecentSearches(scope: string) {
  const { settings } = useSettingsStore();
  const key = RECENT_PREFIX + scope;
  const [items, setItems] = useState<string[]>(() => recentCache.get(key) ?? []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key).then((raw) => {
      if (!alive || !raw) return;
      try {
        const list = JSON.parse(raw) as string[];
        recentCache.set(key, list);
        setItems(list);
      } catch { /* ignore */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  const save = useCallback((list: string[]) => {
    recentCache.set(key, list);
    setItems(list);
    AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => null);
  }, [key]);

  const add = useCallback((q: string) => {
    if (!settings.searchHistory) return;
    const t = q.trim().replace(/\s+/g, ' ');
    if (t.length < 2) return;
    const prev = recentCache.get(key) ?? [];
    // Typing "रा" → "राम": keep only the longer one.
    const rest = prev.filter((x) => x !== t && !t.startsWith(x));
    save([t, ...rest].slice(0, RECENT_MAX));
  }, [key, save, settings.searchHistory]);

  const remove = useCallback((q: string) => save((recentCache.get(key) ?? []).filter((x) => x !== q)), [key, save]);
  const clear = useCallback(() => save([]), [save]);

  return { recent: settings.searchHistory ? items : [], add, remove, clear };
}
