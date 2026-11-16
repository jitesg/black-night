/** कागज़ + सदस्य together (dashboard, कागज़ list, send screen). Kept between screens so tab switches are instant. */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listMembers, type MemberRow } from './officeApi';
import { friendlyError, isOfficeRole, memberTitle } from './officeCore';
import { listTasks } from './taskApi';
import type { TaskListRow } from './taskCore';

let cache: { tasks: TaskListRow[]; members: MemberRow[] } | null = null;

export function invalidateOfficeData(): void { cache = null; }

export function useOfficeData() {
  const [tasks, setTasks] = useState<TaskListRow[]>(cache?.tasks ?? []);
  const [members, setMembers] = useState<MemberRow[]>(cache?.members ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([listTasks(), listMembers()]);
      cache = { tasks: t, members: m };
      setTasks(t); setMembers(m); setError('');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const officers = members.filter((m) => !isOfficeRole(m.role));
  const nameOf = (id: string | null | undefined) => {
    const m = members.find((x) => x.id === id);
    return m ? memberTitle(m) : 'हटाया गया सदस्य';
  };
  return { tasks, members, officers, nameOf, loading, error, reload };
}
