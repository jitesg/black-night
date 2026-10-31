/**
 * SentenceFieldInput — field_type "sentence" (owner's "कार्ड + रंगीन खाली जगह").
 * Situation cards on top; the chosen card's sentence below with tappable blanks:
 *   yellow = to fill, green = filled, blue = choice (tap to change).
 * Tapping a blank opens a small sheet (typing box / options / आज-कल, plus
 * "पिछली बार लिखा" for remembered blanks). Rules live in src/lib/sentenceField.ts.
 */
import 'expo-sqlite/localStorage/install';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { T } from '@/lib/typography';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { generateReport, type KeyDefForRender } from '@/lib/templateEngine';
import {
  findCard, parseSentenceConfig, parseSentenceValue, pendingSlots, serializeSentenceValue,
  slotText, slotVisible, splitCardText, todayDmy, type SentenceConfig, type SentenceValue,
} from '@/lib/sentenceField';

declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;
const RECENT_KEY = (slot: string) => `investsuite:sentence_recent:${slot}`;

function loadRecent(slot: string): string[] {
  try {
    const v = JSON.parse((typeof localStorage !== 'undefined' && localStorage?.getItem(RECENT_KEY(slot))) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : [];
  } catch { return []; }
}
function saveRecent(slot: string, text: string) {
  const t = text.trim();
  if (!t) return;
  try {
    const next = [t, ...loadRecent(slot).filter((x) => x !== t)].slice(0, 5);
    if (typeof localStorage !== 'undefined') localStorage?.setItem(RECENT_KEY(slot), JSON.stringify(next));
  } catch { /* storage off */ }
}

/** Renders other {{tokens}} of a text piece with the current form values (keeps edge spaces). */
function renderPiece(text: string, values: Record<string, string>, keys: KeyDefForRender[]): string {
  const lead = /^\s*/.exec(text)?.[0] ?? '';
  const trail = /\s*$/.exec(text)?.[0] ?? '';
  const core = text.trim();
  if (!core) return text;
  try {
    return lead + generateReport(core, values, keys).replace(/ {2,}/g, ' ').trim() + trail;
  } catch { return text; }
}

export const SentenceFieldInput = forwardRef<View, {
  keyName: string;
  configRaw: string | null | undefined;
  value: string;
  onChange: (keyName: string, value: string) => void;
  displayLabel: string;
  required?: boolean;
  error?: string;
  allValues?: Record<string, string>;
  allKeys?: KeyDefForRender[];
}>(({ keyName, configRaw, value, onChange, displayLabel, required, error, allValues, allKeys }, ref) => {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = THEME[dark ? 'dark' : 'light'];
  const green = dark ? '#4ADE80' : '#15803D';
  const col = {
    todo: { bg: dark ? '#78350F' : '#FEF3C7', fg: dark ? '#FCD34D' : '#B45309' },
    ok: { bg: dark ? '#14532D' : '#DCFCE7', fg: dark ? '#86EFAC' : '#15803D' },
    pick: { bg: dark ? '#1E3A8A' : '#DBEAFE', fg: dark ? '#93C5FD' : '#1D4ED8' },
  };
  const cfg: SentenceConfig = useMemo(() => parseSentenceConfig(configRaw), [configRaw]);
  const v: SentenceValue = useMemo(() => parseSentenceValue(value), [value]);
  const values = useMemo(() => allValues ?? {}, [allValues]);
  const keys = useMemo(() => allKeys ?? [], [allKeys]);
  const card = findCard(cfg, v.card);
  const pending = card ? pendingSlots(cfg, v, values) : [];
  const [sheet, setSheet] = useState<string | null>(null); // slot name, or '__extra'

  const save = (next: SentenceValue) => onChange(keyName, serializeSentenceValue(next));
  const pickCard = (id: string) => {
    const base = v.legacy ? { card: id, s: {}, extra: v.legacy } : { ...v, card: id };
    save(base);
  };

  return (
    <View ref={ref} style={{ gap: T.space.sm }}>
      <View style={{ borderWidth: 1.5, borderColor: error ? c.destructive : c.border, borderRadius: 16, padding: 14, gap: 10, backgroundColor: c.card }}>
        <View>
          <Text style={{ fontSize: 15.5, lineHeight: 24, fontWeight: '700', color: c.foreground }}>
            {String(displayLabel).replace(/\s*\*+\s*$/, '')}
            {required ? <Text style={{ color: c.destructive }}> *</Text> : null}
          </Text>
          <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.mutedForeground }}>
            {card ? 'कार्ड बदलना हो तो दूसरा छुएँ' : (cfg.hint ?? 'एक कार्ड छुएँ')}
          </Text>
        </View>

        {/* Cards: grid before a choice, a sliding row after */}
        {card ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
            {cfg.cards.map((cd) => {
              const on = cd.id === v.card;
              return (
                <Pressable key={cd.id} onPress={() => pickCard(cd.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: on ? 2 : 1, borderColor: on ? green : c.border, backgroundColor: on ? `${green}14` : c.background }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 21, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>{cd.icon ? `${cd.icon} ` : ''}{cd.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cfg.cards.map((cd) => (
              <Pressable key={cd.id} onPress={() => pickCard(cd.id)} accessibilityRole="button"
                style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.background }}>
                {cd.icon ? <Text style={{ fontSize: 19, lineHeight: 26 }}>{cd.icon}</Text> : null}
                <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: c.foreground }}>{cd.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Old typed text (saved before this field had cards) */}
        {!card && v.legacy ? (
          <Text style={{ fontSize: 14, lineHeight: 22, color: c.foreground, backgroundColor: c.background, borderRadius: 12, padding: 10 }}>{v.legacy}</Text>
        ) : null}

        {/* The sentence with blanks */}
        {card ? (
          <View style={{ backgroundColor: c.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text selectable={false} style={{ fontSize: 16, lineHeight: 30, color: c.foreground }}>
              {splitCardText(card.text).map((p, i) => {
                if (p.kind === 'text') return <Text key={i}>{renderPiece(p.text, values, keys)}</Text>;
                const slot = cfg.slots[p.name];
                if (!slotVisible(slot, values)) return <Text key={i}>{renderPiece(slot?.whenHidden ?? '', values, keys)}</Text>;
                const t = slotText(slot, v.s[p.name]);
                const kind = slot?.type === 'choice' ? 'pick' : t ? 'ok' : 'todo';
                const label = t || slot?.label || p.name;
                const icon = slot?.type === 'choice' ? ' ▾' : t ? '' : ' ✎';
                return (
                  <Text key={i}>
                    {slot?.before ?? ''}
                    <Text onPress={() => setSheet(p.name)} suppressHighlighting={false} accessibilityRole="button"
                      style={{ backgroundColor: col[kind].bg, color: col[kind].fg, fontWeight: '700' }}>
                      {` ${label}${icon} `}
                    </Text>
                    {slot?.after ?? ''}
                  </Text>
                );
              })}
              {v.extra.trim() ? (
                <Text> <Text onPress={() => setSheet('__extra')} style={{ backgroundColor: col.ok.bg, color: col.ok.fg, fontWeight: '700' }}>{` ${v.extra.trim()} `}</Text></Text>
              ) : null}
            </Text>
          </View>
        ) : null}

        {card ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '700', color: pending.length ? col.todo.fg : green }}>
              {pending.length ? `● ${pending.length} जगह भरना बाकी` : '✓ विवरण पूरा'}
            </Text>
            <Pressable onPress={() => setSheet('__extra')} hitSlop={8}>
              <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '700', color: green }}>{v.extra.trim() ? '✎ अतिरिक्त बदलें' : `＋ ${cfg.extraLabel ?? 'और कुछ लिखें'}`}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {error ? <Text style={{ ...T.caption1, color: c.destructive } as TextStyle}>{error}</Text> : null}

      {sheet ? (
        <SlotSheet
          key={sheet}
          name={sheet}
          cfg={cfg}
          current={sheet === '__extra' ? v.extra : (v.s[sheet] ?? slotText(cfg.slots[sheet], undefined))}
          onClose={() => setSheet(null)}
          onDone={(text) => {
            if (sheet === '__extra') save({ ...v, extra: text });
            else {
              if (cfg.slots[sheet]?.remember) saveRecent(sheet, text);
              save({ ...v, s: { ...v.s, [sheet]: text } });
            }
            setSheet(null);
          }}
        />
      ) : null}
    </View>
  );
});
SentenceFieldInput.displayName = 'SentenceFieldInput';

function SlotSheet({ name, cfg, current, onClose, onDone }: {
  name: string; cfg: SentenceConfig; current: string; onClose: () => void; onDone: (text: string) => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = THEME[dark ? 'dark' : 'light'];
  const green = dark ? '#4ADE80' : '#15803D';
  const isExtra = name === '__extra';
  const slot = isExtra ? { label: cfg.extraLabel ?? 'और कुछ लिखें', type: 'multiline' as const } : (cfg.slots[name] ?? {});
  const [text, setText] = useState(current);
  const [kb, setKb] = useState(0);
  const recent = useMemo(() => (!isExtra && slot.remember ? loadRecent(name) : []), [isExtra, slot.remember, name]);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress}
      style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? green : c.border, backgroundColor: on ? `${green}14` : c.background }}>
      <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>{label}</Text>
    </Pressable>
  );
  const yesterday = todayDmy(new Date(Date.now() - 86400000));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)' }} />
      <View style={{ backgroundColor: c.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 10, paddingBottom: 16 + Math.max(NAV_BAR_INSET, kb) }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center' }} />
        <Text style={{ fontSize: 16, lineHeight: 25, fontWeight: '700', color: c.foreground }}>{('title' in slot && slot.title) || slot.label || name}</Text>

        {slot.type === 'choice' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(slot.options ?? []).map((o) => chip(o, o === text, () => onDone(o)))}
          </View>
        ) : (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline={slot.type === 'multiline'}
              keyboardType={slot.type === 'date' ? 'numbers-and-punctuation' : 'default'}
              placeholder={slot.placeholder ?? slot.label}
              placeholderTextColor={c.mutedForeground}
              onSubmitEditing={slot.type === 'multiline' ? undefined : () => onDone(text)}
              style={{
                borderWidth: 2, borderColor: green, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
                fontSize: 16, lineHeight: 24, color: c.foreground, backgroundColor: c.background,
                minHeight: slot.type === 'multiline' ? 96 : undefined, textAlignVertical: slot.type === 'multiline' ? 'top' : 'center',
              }}
            />
            {slot.type === 'date' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {chip(`आज (${todayDmy()})`, text === todayDmy(), () => setText(todayDmy()))}
                {chip(`कल (${yesterday})`, text === yesterday, () => setText(yesterday))}
              </View>
            ) : null}
            {recent.length ? (
              <>
                <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.mutedForeground }}>पिछली बार लिखा:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {recent.map((r) => chip(r, r === text, () => setText(r)))}
                </View>
              </>
            ) : null}
            <Pressable onPress={() => onDone(text)} style={{ backgroundColor: green, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: dark ? '#052E16' : '#FFFFFF', fontSize: 15, lineHeight: 22, fontWeight: '700' }}>ठीक है</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}
