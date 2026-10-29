/**
 * ItemGroupInput — field_type "item_group": a list of rows whose columns come
 * from the format itself (key.dropdown_options = {"columns": [...], "addLabel": "..."}).
 * Used by the DL / RC letter (vehicles with their drivers). The value is a JSON
 * array of row objects; the template reads it with {{each:/count:/any:}}.
 *
 * Column types: text (default), "choice" (option chips), "check" (tick = "हाँ").
 */
import React, { forwardRef, useMemo } from 'react';
import { Pressable, Text, TextInput, View, type TextStyle } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { T } from '@/lib/typography';
import { THEME } from '@/lib/theme';

export interface ItemColumn {
  key: string;
  label: string;
  type?: 'text' | 'choice' | 'check';
  options?: string[];
  default?: string;
}

export interface ItemGroupConfig { columns: ItemColumn[]; addLabel?: string; itemLabel?: string }

type Row = Record<string, string>;

export function parseItemGroupConfig(raw: string | null | undefined): ItemGroupConfig {
  try {
    const v = JSON.parse(String(raw ?? ''));
    const cols = Array.isArray(v) ? v : v?.columns;
    if (Array.isArray(cols)) {
      return {
        columns: cols.filter((c) => c && c.key).map((c) => ({ ...c, key: String(c.key), label: String(c.label ?? c.key) })),
        addLabel: typeof v?.addLabel === 'string' ? v.addLabel : undefined,
        itemLabel: typeof v?.itemLabel === 'string' ? v.itemLabel : undefined,
      };
    }
  } catch { /* bad config */ }
  return { columns: [] };
}

const isOn = (v: string | undefined) => !!v?.trim() && !/^(नहीं|no|false|0)$/i.test(v.trim());

function newRow(cols: ItemColumn[]): Row {
  const r: Row = {};
  for (const c of cols) r[c.key] = c.default ?? '';
  return r;
}

function parseRows(value: string, cols: ItemColumn[]): Row[] {
  try {
    const v = JSON.parse(value || '[]');
    if (Array.isArray(v) && v.length) {
      return v.map((r) => {
        const row = newRow(cols);
        for (const c of cols) if (r && r[c.key] != null) row[c.key] = String(r[c.key]);
        return row;
      });
    }
  } catch { /* start fresh */ }
  return [newRow(cols)];
}

export const ItemGroupInput = forwardRef<View, {
  keyName: string;
  config: ItemGroupConfig;
  value: string;
  onChange: (keyName: string, value: string) => void;
  displayLabel: string;
  required?: boolean;
  error?: string;
}>(({ keyName, config, value, onChange, displayLabel, required, error }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#4ADE80' : '#15803D';
  const cols = config.columns;
  const rows = useMemo(() => parseRows(value, cols), [value, cols]);
  const save = (next: Row[]) => onChange(keyName, JSON.stringify(next));
  const setCell = (i: number, k: string, v: string) => save(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const itemLabel = config.itemLabel ?? 'वाहन';

  return (
    <View ref={ref} style={{ gap: T.space.sm }}>
      <Text style={{ ...T.caption1, color: error ? c.destructive : c.mutedForeground, fontWeight: T.weight.medium } as TextStyle}>
        {String(displayLabel).replace(/\s*\*+\s*$/, '')}
        {required ? <Text style={{ color: c.destructive }}> *</Text> : null}
      </Text>

      {rows.map((row, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, gap: 10, backgroundColor: c.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '700', color: c.foreground }}>{itemLabel} {i + 1}</Text>
            {rows.length > 1 ? (
              <Pressable onPress={() => save(rows.filter((_, n) => n !== i))} hitSlop={10} accessibilityLabel={`${itemLabel} ${i + 1} हटाएं`}>
                <Trash2 size={18} color={c.destructive} />
              </Pressable>
            ) : null}
          </View>

          {cols.map((col) => {
            const v = row[col.key] ?? '';
            if (col.type === 'check') {
              const on = isOn(v);
              return (
                <Pressable
                  key={col.key}
                  onPress={() => setCell(i, col.key, on ? '' : 'हाँ')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? green : c.mutedForeground,
                    backgroundColor: on ? green : 'transparent', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 18 }}>✓</Text> : null}
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: c.foreground }}>{col.label}</Text>
                </Pressable>
              );
            }
            if (col.type === 'choice' && col.options?.length) {
              return (
                <View key={col.key} style={{ gap: 6 }}>
                  <Text style={{ ...T.caption1, color: c.mutedForeground } as TextStyle}>{col.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {col.options.map((o) => {
                      const on = v === o;
                      return (
                        <Pressable
                          key={o}
                          onPress={() => setCell(i, col.key, o)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                            borderWidth: on ? 2 : 1, borderColor: on ? green : c.border, backgroundColor: on ? `${green}14` : c.card,
                          }}
                        >
                          <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>{o}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            }
            return (
              <View key={col.key} style={{ gap: 4 }}>
                <Text style={{ ...T.caption1, color: c.mutedForeground } as TextStyle}>{col.label}</Text>
                <TextInput
                  value={v}
                  onChangeText={(t) => setCell(i, col.key, t)}
                  placeholder={col.label}
                  placeholderTextColor={c.mutedForeground}
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                    fontSize: 15, lineHeight: 22, color: c.foreground, backgroundColor: c.background,
                  }}
                />
              </View>
            );
          })}
        </View>
      ))}

      <Pressable
        onPress={() => save([...rows, newRow(cols)])}
        accessibilityRole="button"
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
          borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: green,
        }}
      >
        <Plus size={18} color={green} />
        <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: '700', color: green }}>{(config.addLabel ?? `और ${itemLabel} जोड़ें`).replace(/^\+\s*/, '')}</Text>
      </Pressable>
      {error ? <Text style={{ ...T.caption1, color: c.destructive } as TextStyle}>{error}</Text> : null}
    </View>
  );
});

ItemGroupInput.displayName = 'ItemGroupInput';
