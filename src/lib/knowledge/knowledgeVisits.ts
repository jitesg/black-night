/**
 * Storage for ज्ञानकोष "हाल में देखा" / "सहेजे गए" — this phone only (expo-sqlite localStorage, like courtNameStore).
 * Any storage error → empty list / nothing saved; the screens keep working. Rules in knowledgeVisitsCore.ts.
 */
import 'expo-sqlite/localStorage/install';
import { useCallback, useEffect, useState } from 'react';
import { addVisit, isSaved, parseVisits, toggleSaved, type KnowledgeVisit } from './knowledgeVisitsCore';

declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;

const RECENT_KEY = 'investsuite:knowledge_recent';
const SAVED_KEY = 'investsuite:knowledge_saved';
const listeners = new Set<() => void>();

function read(key: string): KnowledgeVisit[] {
  try { return parseVisits(typeof localStorage !== 'undefined' ? localStorage?.getItem(key) : null); } catch { return []; }
}
function write(key: string, list: KnowledgeVisit[]): void {
  try { localStorage?.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
}

export function getRecentVisits(): KnowledgeVisit[] { return read(RECENT_KEY); }
export function getSavedVisits(): KnowledgeVisit[] { return read(SAVED_KEY); }

/** Call when a धारा / SOP / निर्णय / फर्द screen opens. */
export function recordKnowledgeVisit(item: Omit<KnowledgeVisit, 'at'>): void {
  write(RECENT_KEY, addVisit(read(RECENT_KEY), { ...item, at: Date.now() }));
}

/** Records the visit once per route (screens call it from an effect). */
export function useRecordKnowledgeVisit(item: Omit<KnowledgeVisit, 'at'> | null): void {
  const route = item?.route ?? '';
  const label = item?.label ?? '';
  useEffect(() => {
    if (item && route && label) recordKnowledgeVisit(item);
    // once per route / label
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, label]);
}

/** ⭐ state + toggle for one screen. */
export function useSavedToggle(item: Omit<KnowledgeVisit, 'at'> | null): { saved: boolean; toggle: () => void } {
  const route = item?.route ?? '';
  const [saved, setSaved] = useState(() => !!route && isSaved(read(SAVED_KEY), route));
  useEffect(() => {
    const sync = () => setSaved(!!route && isSaved(read(SAVED_KEY), route));
    sync();
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, [route]);
  const toggle = useCallback(() => {
    if (!item || !route) return;
    write(SAVED_KEY, toggleSaved(read(SAVED_KEY), { ...item, at: Date.now() }));
  }, [item, route]);
  return { saved, toggle };
}

/** Both lists, re-read whenever one changes (and when `refreshKey` changes, e.g. on screen focus). */
export function useKnowledgeVisitLists(refreshKey?: unknown): { recent: KnowledgeVisit[]; saved: KnowledgeVisit[] } {
  const [state, setState] = useState(() => ({ recent: getRecentVisits(), saved: getSavedVisits() }));
  useEffect(() => {
    const sync = () => setState({ recent: getRecentVisits(), saved: getSavedVisits() });
    sync();
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, [refreshKey]);
  return state;
}
