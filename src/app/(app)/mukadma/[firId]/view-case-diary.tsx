/**
 * view-case-diary.tsx — Read-only expanded view of a Case Diary.
 * Shows the unified timeline: Narrative + Karyvahi entries in sequence_order.
 * Route: /(app)/mukadma/[firId]/view-case-diary?diaryId=<uuid>
 */
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { stripHtmlTags } from '@/lib/stringUtils';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Clock, MapPin, BookOpen, CheckCircle2, FileText, CheckSquare, Download, Pencil, ListChecks } from 'lucide-react-native';
import { exportCaseDiaryToDocx, loadParchaParas } from '@/lib/caseDiaryExport';
import {
  getCaseDiaryById, getEntriesByDiary, deserializePlaces, getCaseDiariesByFIR,
  type CaseDiary, type CaseDiaryEntry,
} from '@/lib/db/caseDiaryRepo';
import { getFIRById, type FIR } from '@/lib/db/firRepo';
import { FirBasisCard } from '@/components/caseDiary/FirBasisCard';
import { CaseDiaryA4Preview } from '@/components/caseDiary/CaseDiaryA4Preview';
import { parchaHtml } from '@/lib/caseDiaryParcha';

import { useColorScheme } from 'nativewind';

const NAVY = '#6366F1';

function MetaRow({ icon: Icon, value }: { icon: React.ComponentType<{ size: number; color: string }>; value: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon size={13} color="#9CA3AF" />
      <Text className="text-sm text-muted-foreground">{value}</Text>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-4">
      {label}
    </Text>
  );
}

// ── Timeline entry cards — READ-ONLY ─────────────────────────────────────────

function KaryvahiEntryCard({ entry, idx }: {
  entry: CaseDiaryEntry; idx: number;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-3 px-4 py-3 bg-secondary">
        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: NAVY }}>
          <Text className="text-white text-xs font-bold">{idx + 1}</Text>
        </View>
        <CheckSquare size={13} color={NAVY} />
        <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={2}>
          {entry.karyvahi_name ?? '—'}
        </Text>
        <CheckCircle2 size={16} color="#16a34a" />
      </View>
      {entry.format_used ? (
        <View className="px-4 py-2 border-b border-border bg-purple-50 dark:bg-purple-500/15">
          <Text className="text-xs font-semibold" style={{ color: '#7C3AED' }}>{t('fir.viewCaseDiary.formatLabel', { title: entry.format_used })}</Text>
        </View>
      ) : null}
      {entry.vivran ? (
        <View className="px-4 py-4">
          <Text className="text-sm text-foreground leading-6">{stripHtmlTags(entry.vivran)}</Text>
        </View>
      ) : (
        <View className="px-4 py-4">
          <Text className="text-xs text-muted-foreground italic">{t('fir.viewCaseDiary.noVivran')}</Text>
        </View>
      )}
    </View>
  );
}

function NarrativeEntryCard({ entry, idx }: {
  entry: CaseDiaryEntry; idx: number;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-3 px-4 py-3 bg-secondary">
        <View className="w-6 h-6 rounded-full items-center justify-center bg-secondary">
          <Text className="text-foreground text-xs font-bold">{idx + 1}</Text>
        </View>
        <FileText size={13} color="#6B7280" />
        <Text className="flex-1 text-sm font-semibold text-muted-foreground">{t('fir.viewCaseDiary.narrativeLabel')}</Text>
      </View>
      {entry.narrative_template ? (
        <View className="px-4 py-2 border-b border-border bg-purple-50 dark:bg-purple-500/15">
          <Text className="text-xs font-semibold" style={{ color: '#7C3AED' }}>{t('fir.viewCaseDiary.formatLabel', { title: entry.narrative_template })}</Text>
        </View>
      ) : null}
      <View className="px-4 py-4">
        {entry.narrative_text ? (
          <Text className="text-sm text-foreground leading-6">{stripHtmlTags(entry.narrative_text)}</Text>
        ) : (
          <Text className="text-xs text-muted-foreground italic">{t('fir.viewCaseDiary.noNarrative')}</Text>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ViewCaseDiaryScreen() {
  const { firId, diaryId } = useLocalSearchParams<{ firId: string; diaryId: string }>();
  const { t } = useTranslation();
  const [diary, setDiary]         = useState<CaseDiary | null>(null);
  const [entries, setEntries]     = useState<CaseDiaryEntry[]>([]);
  const [fir, setFir]             = useState<FIR | null>(null);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [diaryNo, setDiaryNo] = useState<number | null>(null);
  const [a4Html, setA4Html] = useState('');
  const dark = useColorScheme().colorScheme === 'dark';
  const AC = dark
    ? { info: '#9CAFA3', entries: '#A5B4FC', a4: '#FBBF24', export: '#4ADE80' }
    : { info: '#6B7280', entries: NAVY, a4: '#B45309', export: '#059669' };
  // A4 प्रीव्यू = the same पर्चा layout as the Word export (owner's sample)
  const openA4 = async () => {
    if (!diary) return;
    try {
      setA4Html(parchaHtml(await loadParchaParas(diary.fir_id, diary.id)));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'A4 प्रीव्यू नहीं बन सका');
    }
  };

  // useFocusEffect so data refreshes when returning from add-entry screen
  useFocusEffect(
    useCallback(() => {
      if (!diaryId) { setLoading(false); return; }
      setLoading(true);
      (async () => {
        try {
          const [d, e, f, all] = await Promise.all([
            getCaseDiaryById(diaryId),
            getEntriesByDiary(diaryId),
            firId ? getFIRById(firId) : Promise.resolve(null),
            firId ? getCaseDiariesByFIR(firId) : Promise.resolve([]),
          ]);
          const pos = [...all].sort((a, b) => a.created_at - b.created_at).findIndex((x) => x.id === diaryId);
          setDiaryNo(pos >= 0 ? pos + 1 : null);
          setDiary(d);
          setEntries(e);
          if (f) setFir(f);
        } catch { /* ignore */ }
        finally { setLoading(false); }
      })();
    }, [diaryId, firId]),
  );

  const handleExport = async () => {
    if (!diaryId || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await exportCaseDiaryToDocx(diaryId);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (!diary) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <BookOpen size={32} color="#9CA3AF" />
        <Text className="text-base font-bold text-foreground text-center">{t('fir.viewCaseDiary.notFound')}</Text>
        <Pressable onPress={() => router.back()} className="rounded-xl px-5 py-3 mt-2 active:opacity-70" style={{ backgroundColor: NAVY }}>
          <Text className="text-white text-sm font-bold">{t('fir.viewCaseDiary.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const places    = deserializePlaces(diary.places_visited);
  // updated_at is a Unix epoch in seconds — multiply by 1000 for JS Date
  const lastMod   = new Date(diary.updated_at * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const karyvahiCount  = entries.filter((e) => e.entry_type === 'karyvahi').length;
  const narrativeCount = entries.filter((e) => e.entry_type === 'narrative').length;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={diary.preparation_date}
        subtitle={t('fir.viewCaseDiary.subtitle')}
        showBack
      />
      {/* Actions under the header (in the header they ran off the screen next to 🤖 / 🔔). Owner: one row, 4 equal buttons, same
          height (34), label on one line — Android measured the Hindi labels too wide (empty space, "निर्यात" pushed to a 2nd row). */}
      <View className="flex-row items-center gap-2 px-5 pt-3 pb-1">
        {[
          {
            key: 'info', label: t('fir.viewCaseDiary.editInfo'), color: AC.info, Icon: Pencil,
            onPress: () => router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary' as never, params: { firId, diaryId } }),
          },
          {
            key: 'entries', label: 'प्रविष्टियाँ', a11y: t('fir.viewCaseDiary.editEntries'), color: AC.entries, Icon: ListChecks,
            onPress: () => router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary-karyvahi' as never, params: { firId, diaryId } }),
          },
          { key: 'a4', label: 'A4', color: AC.a4, Icon: FileText, onPress: openA4 },
          ...(entries.length > 0 ? [{
            key: 'export', label: exporting ? t('fir.viewCaseDiary.exporting') : t('fir.viewCaseDiary.export'), color: AC.export,
            Icon: Download, onPress: handleExport, busy: exporting,
          }] : []),
        ].map((b) => (
          <Pressable
            key={b.key}
            onPress={b.onPress}
            disabled={'busy' in b ? !!b.busy : false}
            accessibilityRole="button"
            accessibilityLabel={'a11y' in b ? b.a11y : b.label}
            className="flex-1 flex-row items-center justify-center gap-1.5 active:opacity-70 border border-border bg-card"
            style={{ height: 34, borderRadius: 10, paddingHorizontal: 6 }}
          >
            {'busy' in b && b.busy
              ? <ActivityIndicator size="small" color={b.color} />
              : <b.Icon size={12} color={b.color} />}
            <Text
              numberOfLines={1}
              textBreakStrategy="simple"
              style={{ flexShrink: 1, fontSize: 12, fontWeight: '700', color: b.color, includeFontPadding: false }}
            >
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <CaseDiaryA4Preview
        visible={!!a4Html}
        html={a4Html}
        title={`केस डायरी${diaryNo ? ` संख्या ${String(diaryNo).padStart(2, '0')}` : ''} — A4 प्रीव्यू`}
        onClose={() => setA4Html('')}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ── FIR आधार Collapsible Card ────────────────────────────────────── */}
        <FirBasisCard fir={fir} />

        {/* Export error banner */}
        {exportError ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex-row items-center gap-2">
            <Text className="text-sm text-destructive flex-1">{exportError}</Text>
            <Pressable onPress={() => setExportError('')} className="p-1 active:opacity-60">
              <Text className="text-xs text-muted-foreground">✕</Text>
            </Pressable>
          </View>
        ) : null}
        {/* Diary summary */}
        <View className="bg-card border border-border rounded-2xl p-5 gap-3" style={{ borderCurve: 'continuous' }}>
          <Text className="text-base font-bold text-foreground">{diary.preparation_date}</Text>
          {(diary.start_time || diary.end_time) ? (
            <MetaRow icon={Clock} value={`${diary.start_time ?? '—'}  →  ${diary.end_time ?? '—'}`} />
          ) : null}
          {places.length > 0 ? (
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <MapPin size={13} color="#9CA3AF" />
                <Text className="text-sm text-muted-foreground font-semibold">{t('fir.viewCaseDiary.placesVisited')}</Text>
              </View>
              <View className="flex-row flex-wrap gap-2 pl-5">
                {places.map((p) => (
                  <View key={p} className="bg-secondary rounded-full px-2.5 py-1">
                    <Text textBreakStrategy="simple" className="text-xs text-foreground">{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View className="flex-row items-center justify-between pt-1 border-t border-border">
            <View className="flex-row items-center gap-3">
              {karyvahiCount > 0 && (
                <View className="flex-row items-center gap-1">
                  <CheckCircle2 size={13} color="#16a34a" />
                  <Text className="text-xs font-semibold" style={{ color: '#16a34a' }}>
                    {karyvahiCount} karyvahi
                  </Text>
                </View>
              )}
              {narrativeCount > 0 && (
                <View className="flex-row items-center gap-1">
                  <FileText size={13} color="#6B7280" />
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {narrativeCount} narrative
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-muted-foreground">Modified {lastMod}</Text>
          </View>
        </View>

        {/* Timeline */}
        {entries.length > 0 ? (
          <>
            <SectionLabel label={t('fir.viewCaseDiary.timeline', { count: entries.length })} />
            {entries.map((entry, i) =>
              entry.entry_type === 'narrative'
                ? <NarrativeEntryCard key={entry.id} entry={entry} idx={i} />
                : <KaryvahiEntryCard key={entry.id} entry={entry} idx={i} />
            )}
          </>
        ) : (
          <View className="items-center py-10 gap-3">
            <View className="w-12 h-12 rounded-2xl bg-secondary items-center justify-center">
              <BookOpen size={20} color="#9CA3AF" />
            </View>
            <Text className="text-sm text-muted-foreground text-center">
              {t('fir.viewCaseDiary.noEntries')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
