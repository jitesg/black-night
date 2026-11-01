/**
 * हाल के कार्य — every report made from a predefined format (owner's idea, kept forever).
 * Card: format, पहचान (मु0अ0सं0 / name / vehicle), module tag + time; खोलें (A4, Word, edit in
 * formats/preview), Word, हटाएँ. Rules: src/lib/reportRecordCore.ts, data: src/lib/db/reportRecordRepo.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { BookOpen, Eye, FileClock, FileText, NotebookPen, Pencil, Scale, Scroll, Search, ShieldAlert, Trash2 } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import { deleteReportRecord, listReportRecords } from '@/lib/db/reportRecordRepo';
import { groupByDay, isDraftRecord, matchesRecord, moduleLabel, timeLabel, type RecordRange, type ReportRecord } from '@/lib/reportRecordCore';
import { openReportRecord } from '@/lib/reportRecordOpen';

const MODULE_LOOK: Record<string, { icon: typeof FileText; color: string }> = {
  'न्यायालय': { icon: Scale, color: '#3B82F6' },
  'GD': { icon: BookOpen, color: '#F59E0B' },
  'निरोधात्मक': { icon: ShieldAlert, color: '#EF4444' },
  'प्रार्थना पत्र': { icon: Scroll, color: '#14B8A6' },
  'केस डायरी': { icon: NotebookPen, color: '#8B5CF6' },
};
const lookOf = (label: string) => MODULE_LOOK[label] ?? { icon: FileText, color: '#64748B' };

const RANGES: { key: RecordRange; label: string }[] = [
  { key: 'today', label: 'आज' },
  { key: 'week', label: 'इस हफ़्ते' },
  { key: 'all', label: 'सभी' },
];

export default function RecentTasksScreen() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = THEME[dark ? 'dark' : 'light'];
  const [range, setRange] = useState<RecordRange>('today');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ReportRecord[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (r: RecordRange) => {
    try { setRows(await listReportRecords(r)); } catch { setRows([]); }
  }, []);
  useFocusEffect(useCallback(() => { void load(range); }, [load, range]));

  const shown = useMemo(() => (rows ?? []).filter((r) => matchesRecord(r, query)), [rows, query]);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  const exportWord = async (r: ReportRecord) => {
    setBusyId(r.id);
    try {
      const { exportReportToDocx } = await import('@/lib/reportDocxExport');
      await exportReportToDocx(r.edited_html || r.marked_text, r.format_title);
    } catch (e) {
      Alert.alert('Word फ़ाइल नहीं बनी', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  // A half-filled form from the Formats list → continue filling it.
  const continueDraft = (r: ReportRecord) => {
    if (!r.format_id) return;
    router.push(`/(app)/formats/fill?formatId=${encodeURIComponent(r.format_id)}&draftId=${encodeURIComponent(r.id)}` as never);
  };
  const open = (r: ReportRecord) => (isDraftRecord(r) ? continueDraft(r) : openReportRecord(r));

  const remove = (r: ReportRecord) => {
    Alert.alert(isDraftRecord(r) ? 'अधूरा ड्राफ़्ट हटाएँ?' : 'रिपोर्ट हटाएँ?', `"${r.format_title}" हाल के कार्य से हट जाएगी।`, [
      { text: 'रद्द करें', style: 'cancel' },
      { text: 'हटाएँ', style: 'destructive', onPress: async () => { await deleteReportRecord(r.id); void load(range); } },
    ]);
  };

  const chip = (on: boolean) => ({
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, borderWidth: on ? 1.5 : 1,
    borderColor: on ? c.primary : c.border, backgroundColor: on ? `${c.primary}22` : 'transparent',
  });
  const btn = (color: string) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: `${color}66`,
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AppHeader title="हाल के कार्य" subtitle={rows ? `${shown.length} रिपोर्ट · हमेशा सुरक्षित` : undefined} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: c.card }}>
          <Search size={16} color={c.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="खोजें — नाम, मु0अ0सं0, प्रारूप…"
            placeholderTextColor={c.mutedForeground}
            style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: c.foreground }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {RANGES.map((r) => (
            <Pressable key={r.key} onPress={() => setRange(r.key)} style={chip(range === r.key)}>
              <Text style={{ fontSize: 13.5, lineHeight: 20, fontWeight: range === r.key ? '700' : '500', color: range === r.key ? c.primary : c.foreground }}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        {rows === null ? <ActivityIndicator color={c.primary} style={{ marginTop: 30 }} /> : null}
        {rows !== null && !shown.length ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
            <FileText size={32} color={c.mutedForeground} />
            <Text style={{ fontSize: 14, lineHeight: 22, color: c.mutedForeground, textAlign: 'center' }}>
              {query ? 'कोई रिपोर्ट नहीं मिली' : range === 'today' ? 'आज अभी कोई रिपोर्ट नहीं बनी' : 'अभी कोई रिपोर्ट नहीं'}
            </Text>
            <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.mutedForeground, textAlign: 'center' }}>प्रारूप भरकर जो भी रिपोर्ट बनेगी, यहाँ अपने-आप सहेजी जाएगी।</Text>
          </View>
        ) : null}

        {groups.map((g) => (
          <View key={g.title} style={{ gap: 10 }}>
            <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '700', color: c.mutedForeground }}>{g.title}</Text>
            {g.items.map((r) => {
              const draft = isDraftRecord(r);
              const label = draft ? 'अधूरा' : moduleLabel(r.module);
              const look = draft ? { icon: FileClock, color: '#D97706' } : lookOf(label);
              const Icon = look.icon;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => open(r)}
                  style={{
                    flexDirection: 'row', gap: 11, padding: 12, borderRadius: 16, borderWidth: 1.5,
                    borderColor: dark ? '#3A4556' : '#D6DEEA', backgroundColor: dark ? '#1E2530' : c.card,
                  }}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: look.color, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Icon size={15} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 14.5, lineHeight: 22, fontWeight: '700', color: c.foreground }}>{r.format_title}</Text>
                    {r.summary ? <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.mutedForeground }}>{r.summary}</Text> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: 9, backgroundColor: `${look.color}33` }}>
                        <Text style={{ fontSize: 11, lineHeight: 17, fontWeight: '700', color: dark ? '#E2E8F0' : look.color }}>{label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, lineHeight: 18, color: c.mutedForeground }}>
                        {draft ? `${timeLabel(r.created_at)} · रिपोर्ट अभी नहीं बनी` : `${timeLabel(r.created_at)}${r.edited_html ? ' · संपादित' : ''}`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      {draft ? (
                        <Pressable onPress={() => continueDraft(r)} style={btn('#D97706')} hitSlop={4}>
                          <Pencil size={13} color="#D97706" />
                          <Text style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '700', color: '#D97706' }}>आगे भरें</Text>
                        </Pressable>
                      ) : (
                        <>
                          <Pressable onPress={() => openReportRecord(r)} style={btn(c.foreground)} hitSlop={4}>
                            <Eye size={13} color={c.foreground} />
                            <Text style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '700', color: c.foreground }}>खोलें</Text>
                          </Pressable>
                          <Pressable onPress={() => exportWord(r)} disabled={busyId === r.id} style={btn('#10B981')} hitSlop={4}>
                            {busyId === r.id ? <ActivityIndicator size={13} color="#10B981" /> : <FileText size={13} color="#10B981" />}
                            <Text style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '700', color: '#10B981' }}>Word</Text>
                          </Pressable>
                        </>
                      )}
                      <Pressable onPress={() => remove(r)} style={btn('#EF4444')} hitSlop={4} accessibilityLabel="हटाएँ">
                        <Trash2 size={13} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
