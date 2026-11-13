/**
 * ItemGroupInput — field_type "item_group": a list of rows whose columns come
 * from the format itself (key.dropdown_options = {"columns": [...], "addLabel": "..."}).
 * Used by the DL / RC letter (vehicles with their drivers). The value is a JSON
 * array of row objects; the template reads it with {{each:/count:/any:}}.
 *
 * Column types: text (default), "choice" (option chips), "check" (tick = "हाँ"), "multiline" (big box),
 * "ref" (chips with the names typed in another list — {ref: "Accused"}; formatDerived.ts copies that row's fields).
 * "startEmpty": no card until "+" is pressed (optional lists).
 */
import { LabelWithHint } from './FieldHintLink';
import { FirPeopleButton } from '@/components/formats/FirPeopleButton';
import { insertIntoGroup, isPersonItemGroup, toItemRow } from '@/lib/firPeople';
import React, { forwardRef, useMemo } from 'react';
import { Pressable, Text, TextInput, View, type TextStyle } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { T } from '@/lib/typography';
import { useClearCopy } from '@/components/common/ClearCopyTools';
import { THEME } from '@/lib/theme';
import { evalShowIf } from '@/lib/formatShowIf';

export interface ItemColumn {
  key: string;
  label: string;
  type?: 'text' | 'choice' | 'check' | 'multiline' | 'ref';
  options?: string[];
  default?: string;
  /** type 'ref': the other item_group key, and its column shown on the chips (default 'name'). */
  ref?: string;
  refLabel?: string;
  /** Shown only when the condition holds for THIS row, e.g. "kind=मुकदमे का माल" (formatShowIf syntax). */
  showIf?: string;
}

export interface ItemGroupConfig { columns: ItemColumn[]; addLabel?: string; itemLabel?: string; startEmpty?: boolean }

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
        startEmpty: v?.startEmpty === true,
      };
    }
  } catch { /* bad config */ }
  return { columns: [] };
}

/** Names (and अभियुक्ता tick) typed in another list, for a 'ref' column. */
function refRows(raw: string | undefined, label: string): { name: string; mahila: boolean }[] {
  try {
    const v = JSON.parse(raw || '[]');
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    return v
      .map((r) => ({ name: String(r?.[label] ?? '').trim(), mahila: isOn(String(r?.mahila ?? '')) }))
      .filter((r) => r.name && !seen.has(r.name) && (seen.add(r.name), true));
  } catch { return []; }
}

const isOn = (v: string | undefined) => !!v?.trim() && !/^(नहीं|no|false|0)$/i.test(v.trim());

function newRow(cols: ItemColumn[]): Row {
  const r: Row = {};
  for (const c of cols) r[c.key] = c.default ?? '';
  return r;
}

function parseRows(value: string, cols: ItemColumn[], startEmpty = false): Row[] {
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
  return startEmpty ? [] : [newRow(cols)];
}

export const ItemGroupInput = forwardRef<View, {
  keyName: string;
  config: ItemGroupConfig;
  value: string;
  onChange: (keyName: string, value: string) => void;
  displayLabel: string;
  /** "ⓘ कैसे भरें?" at the right of the label line */
  hint?: string;
  required?: boolean;
  error?: string;
  /** The whole form — 'ref' columns list the rows of another list from it. */
  allValues?: Record<string, string>;
}>(({ keyName, config, value, onChange, displayLabel, required, error, allValues, hint }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#4ADE80' : '#15803D';
  const cols = config.columns;
  const rows = useMemo(() => parseRows(value, cols, config.startEmpty), [value, cols, config.startEmpty]);
  const save = (next: Row[]) => onChange(keyName, JSON.stringify(next));
  const setCell = (i: number, k: string, v: string) => save(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const itemLabel = config.itemLabel ?? 'वाहन';

  return (
    <View ref={ref} style={{ gap: T.space.sm }}>
      <LabelWithHint hint={hint} title={String(displayLabel)}>
        <Text style={{ ...T.caption1, color: error ? c.destructive : c.mutedForeground, fontWeight: T.weight.medium } as TextStyle}>
          {String(displayLabel).replace(/\s*\*+\s*$/, '')}
          {required ? <Text style={{ color: c.destructive }}> *</Text> : null}
        </Text>
      </LabelWithHint>
      {/* "📁 मुकदमे से भरें" (owner): lists that hold people (name column) */}
      {isPersonItemGroup(cols) ? (
        <FirPeopleButton
          onInsert={(people) => onChange(keyName, insertIntoGroup(JSON.stringify(rows), people.map((p) => toItemRow(p, cols)), newRow(cols)))}
        />
      ) : null}

      {rows.map((row, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, gap: 10, backgroundColor: c.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '700', color: c.foreground }}>{itemLabel} {i + 1}</Text>
            {rows.length > 1 || config.startEmpty ? (
              <Pressable onPress={() => save(rows.filter((_, n) => n !== i))} hitSlop={10} accessibilityLabel={`${itemLabel} ${i + 1} हटाएं`}>
                <Trash2 size={18} color={c.destructive} />
              </Pressable>
            ) : null}
          </View>

          {cols.map((col) => {
            if (col.showIf && !evalShowIf(col.showIf, row)) return null;
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
            if (col.type === 'ref' && col.ref) {
              const people = refRows(allValues?.[col.ref], col.refLabel || 'name');
              return (
                <View key={col.key} style={{ gap: 6 }}>
                  <Text style={{ ...T.caption1, color: c.mutedForeground } as TextStyle}>{col.label}</Text>
                  {people.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {people.map((pp) => {
                        const on = v === pp.name;
                        return (
                          <Pressable
                            key={pp.name}
                            onPress={() => setCell(i, col.key, on ? '' : pp.name)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                              borderWidth: on ? 2 : 1, borderColor: on ? green : c.border, backgroundColor: on ? `${green}14` : c.card,
                            }}
                          >
                            <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>
                              {pp.name}{pp.mahila ? ' (अभियुक्ता)' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ ...T.caption1, color: c.mutedForeground } as TextStyle}>पहले ऊपर नाम भरें — यहाँ उनमें से चुनें</Text>
                  )}
                  {v && !people.some((pp) => pp.name === v) ? (
                    <Text style={{ ...T.caption1, color: c.destructive } as TextStyle}>{`"${v}" अब ऊपर की सूची में नहीं है — फिर से चुनें`}</Text>
                  ) : null}
                </View>
              );
            }
            return <ItemTextCell key={col.key} label={col.label} value={v} multiline={col.type === 'multiline'} onChange={(t) => setCell(i, col.key, t)} />;
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

/** One typed cell of a row — with ✕ / 📋 like the other format boxes (owner). */
function ItemTextCell({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const tools = useClearCopy(value, onChange);
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ ...T.caption1, color: c.mutedForeground } as TextStyle}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', borderWidth: 1, borderColor: c.border, borderRadius: 10,
        paddingLeft: 12, paddingRight: 6, backgroundColor: c.background,
      }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={label}
          placeholderTextColor={c.mutedForeground}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : undefined}
          style={{ flex: 1, paddingVertical: 10, fontSize: 15, lineHeight: 22, color: c.foreground, minHeight: multiline ? 110 : undefined }}
        />
        {tools.icons}
      </View>
      {tools.notice}
    </View>
  );
}
