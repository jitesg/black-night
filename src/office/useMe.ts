/** Who this phone is (member + थाना), cached for the session; `reload` asks the server again. */
import { useCallback, useEffect, useState } from 'react';
import { getMe, type Me } from './officeApi';
import { friendlyError } from './officeCore';

let cached: Me | null = null;

export function setCachedMe(me: Me | null): void { cached = me; }

export function useMe() {
  const [me, setMe] = useState<Me | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try {
      const m = await getMe();
      cached = m;
      setMe(m);
      return m;
    } catch (e) {
      setError(friendlyError(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (!cached) void reload(); }, [reload]);
  return { me, loading, error, reload };
}
