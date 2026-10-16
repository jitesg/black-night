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

  return { history, addToHistory, clearHistory };
}
