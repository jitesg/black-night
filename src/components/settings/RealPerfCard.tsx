/** Dev options → Performance: real measured numbers (perfLog + DB facts). Read-only. */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { perfSnapshot } from '@/lib/perfLog';
import { getDatabase } from '@/lib/db/database';

export function RealPerfCard() {
  const [db, setDb] = useState<{ sizeKb: number; byType: { t: string; n: number }[] } | null>(null);
  const snap = perfSnapshot();
  useEffect(() => {
    (async () => {
      try {
        const d = await getDatabase();
        const pc = await d.getFirstAsync<{ page_count: number }>('PRAGMA page_count');
        const ps = await d.getFirstAsync<{ page_size: number }>('PRAGMA page_size');
        const rows = await d.getAllAsync<{ t: string | null; n: number }>(
          `SELECT COALESCE(content_type, '(none)') AS t, COUNT(*) AS n FROM knowledge_entries WHERE deleted_at IS NULL GROUP BY content_type ORDER BY n DESC`,
        );
        setDb({ sizeKb: Math.round(((pc?.page_count ?? 0) * (ps?.page_size ?? 0)) / 1024), byType: rows.map((r) => ({ t: r.t ?? '(none)', n: r.n })) });
      } catch { setDb({ sizeKb: 0, byType: [] }); }
    })();
  }, []);
  const line = (k: string, v: string) => (
    <View key={k} className="flex-row justify-between py-1">
      <Text className="text-xs text-muted-foreground">{k}</Text>
      <Text className="text-xs font-semibold text-foreground">{v}</Text>
    </View>
  );
  const ms = (n?: number) => (n == null ? '—' : `${n} ms`);
  return (
    <View className="bg-card border border-border rounded-2xl p-4" style={{ borderCurve: 'continuous' }}>
      <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Measured (real)</Text>
      {line('Cold start → first screen', ms(snap.firstScreenMs))}
      {line('Seed load', ms(snap.seedMs))}
      {line('Last search', ms(snap.lastSearchMs))}
      {line('DB size', db ? `${db.sizeKb} KB` : '…')}
      {(db?.byType ?? []).map((r) => line(`rows · ${r.t}`, String(r.n)))}
    </View>
  );
}
