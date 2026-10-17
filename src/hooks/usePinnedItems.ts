/**
 * usePinnedItems — persistent pin/unpin/reorder for Dashboard + Drawer
 *
 * Backed by AsyncStorage under key "investsuite:pinned_items_v1".
 * Each PinnedItem has an id, label, icon key, color, and route.
 *
 * The list lives in one shared store, so pinning from the drawer shows up
 * on the Home "Pinned" row straight away (and vice versa).
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'investsuite:pinned_items_v1';

export interface PinnedItem {
  id: string;
  /** English fallback label */
  label: string;
  /** i18n key for the label (drawer nav keys) */
  labelKey?: string;
  /** lucide icon name string — rendered in AppDrawer/Dashboard */
  iconKey: string;
  color: string;
  route: string;
}

// Label keys for items saved before labelKey existed.
const LABEL_KEYS: Record<string, string> = {
  mukadma: 'drawer.navMukadma',
  gd: 'drawer.navGd',
  nyayalay: 'drawer.navNyayalay',
  prarthna: 'drawer.navPrarthna',
  nirodhatmak: 'drawer.navNirodhatmak',
  halka: 'drawer.navHalka',
  knowledge: 'drawer.navKnowledge',
  formats: 'drawer.navFormats',
};

// Default pinned items shown on first launch
const DEFAULTS: PinnedItem[] = [
  { id: 'mukadma',   label: 'Mukadma',        labelKey: 'drawer.navMukadma',   iconKey: 'FileText',   color: '#7C3AED', route: '/(app)/mukadma' },
  { id: 'gd',        label: 'General Diary',  labelKey: 'drawer.navGd',        iconKey: 'BookMarked', color: '#D97706', route: '/(app)/gd' },
  { id: 'knowledge', label: 'Knowledge Base', labelKey: 'drawer.navKnowledge', iconKey: 'Library',    color: '#0F766E', route: '/(app)/knowledge' },
  { id: 'halka',     label: 'My Halka',       labelKey: 'drawer.navHalka',     iconKey: 'BookOpen',   color: '#1D6A9F', route: '/(app)/halka' },
];

// ── Shared store ──────────────────────────────────────────────────────────────
interface PinnedState { items: PinnedItem[]; loaded: boolean }

let state: PinnedState = { items: [], loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: PinnedState) {
  state = next;
  listeners.forEach((l) => l());
}

function withLabelKeys(items: PinnedItem[]): PinnedItem[] {
  return items.map((p) => (p.labelKey || !LABEL_KEYS[p.id] ? p : { ...p, labelKey: LABEL_KEYS[p.id] }));
}

function load() {
  if (loading) return;
  loading = (async () => {
    let items = DEFAULTS;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PinnedItem[];
        if (Array.isArray(parsed)) items = withLabelKeys(parsed);
      }
    } catch {
      // fall back to defaults
    }
    setState({ items, loaded: true });
  })();
}

function save(items: PinnedItem[]) {
  setState({ ...state, items });
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => state;

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePinnedItems() {
  const { items, loaded } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => { load(); }, []);

  const pinItem = useCallback((item: PinnedItem) => {
    if (state.items.some((p) => p.id === item.id)) return;
    save([...state.items, item]);
  }, []);

  const unpinItem = useCallback((id: string) => {
    save(state.items.filter((p) => p.id !== id));
  }, []);

  const reorderItems = useCallback((next: PinnedItem[]) => {
    save(next);
  }, []);

  const isPinned = useCallback((id: string) => items.some((p) => p.id === id), [items]);

  return { items, loaded, pinItem, unpinItem, reorderItems, isPinned };
}
