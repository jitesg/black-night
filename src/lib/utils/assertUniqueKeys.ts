/**
 * Development-only duplicate key detector.
 *
 * Wrap any array before passing it to .map(…key=…) to get an early warning
 * in the Metro console whenever two items would produce the same React key.
 *
 * Usage:
 *   {assertUniqueKeys(tags, 'FormatCard.tags', format.id).map((tag, idx) => (
 *     <View key={`${idx}-${tag}`} … />
 *   ))}
 *
 * In production builds the function is a no-op identity that is tree-shaken
 * away by Metro's minifier (dead-code elimination on __DEV__ === false).
 */
export function assertUniqueKeys<T>(
  items: T[],
  component: string,
  context?: string,
  keySelector: (item: T) => string = (item) => String(item),
): T[] {
  if (__DEV__) {
    const seen = new Map<string, number>();
    const duplicates: Array<{ key: string; firstIndex: number; dupIndex: number }> = [];

    items.forEach((item, idx) => {
      const key = keySelector(item);
      if (seen.has(key)) {
        duplicates.push({ key, firstIndex: seen.get(key)!, dupIndex: idx });
      } else {
        seen.set(key, idx);
      }
    });

    if (duplicates.length > 0) {
      const ctx = context ? ` [context: ${context}]` : '';
      console.warn(
        `[DuplicateKey] ${component}${ctx} — ` +
        `${duplicates.length} duplicate(s) detected in a ${items.length}-item array.\n` +
        duplicates
          .map((d) => `  • key="${d.key}" appears at index ${d.firstIndex} AND ${d.dupIndex}`)
          .join('\n') +
        '\n  Fix: ensure each item has a stable unique id, or use `${idx}-${value}` as key.',
      );
    }
  }
  return items;
}
