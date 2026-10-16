/**
 * usePinnedItems — persistent pin/unpin/reorder for Dashboard
 *
 * Backed by AsyncStorage under key "investsuite:pinned_items".
 * Each PinnedItem has an id, label, icon key, color, and route.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'investsuite:pinned_items_v1';

export interface PinnedItem {
  id: string;
  label: string;
  /** lucide icon name string — rendered in AppDrawer/Dashboard */
  iconKey: string;
  color: string;
  route: string;
}

// Default pinned items shown on first launch
const DEFAULTS: PinnedItem[] = [
  { id: 'mukadma',      label: 'Mukadma',           iconKey: 'FileText',      color: '#7C3AED', route: '/(app)/mukadma' },
  { id: 'gd',           label: 'General Diary',      iconKey: 'BookMarked',    color: '#D97706', route: '/(app)/gd' },
  { id: 'knowledge',    label: 'Knowledge Base',     iconKey: 'Library',       color: '#0F766E', route: '/(app)/knowledge' },
  { id: 'halka',        label: 'My Halka',           iconKey: 'BookOpen',      color: '#1D6A9F', route: '/(app)/halka' },
];

export function usePinnedItems() {
  const [items, setItems] = useState<PinnedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PinnedItem[];
          setItems(Array.isArray(parsed) ? parsed : DEFAULTS);
        } else {
          setItems(DEFAULTS);
        }
      } catch {
        setItems(DEFAULTS);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist whenever items change (after initial load)
  const persist = useCallback(async (next: PinnedItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // silent — non-critical
    }
  }, []);

  const pinItem = useCallback((item: PinnedItem) => {
    setItems((prev) => {
      if (prev.find((p) => p.id === item.id)) return prev;
      const next = [...prev, item];
      persist(next);
      return next;
    });
  }, [persist]);

  const unpinItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const reorderItems = useCallback((next: PinnedItem[]) => {
    setItems(next);
    persist(next);
  }, [persist]);

  const isPinned = useCallback((id: string) => items.some((p) => p.id === id), [items]);

  return { items, loaded, pinItem, unpinItem, reorderItems, isPinned };
}
