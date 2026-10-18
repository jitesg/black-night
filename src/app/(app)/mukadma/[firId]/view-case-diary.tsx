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
import { exportCaseDiaryToDocx } from '@/lib/caseDiaryExport';
import {
  getCaseDiaryById, getEntriesByDiary, deserializePlaces,
  type CaseDiary, type CaseDiaryEntry,
} from '@/lib/db/caseDiaryRepo';
import { getFIRById, type FIR } from '@/lib/db/firRepo';
import { FirBasisCard } from '@/components/caseDiary/FirBasisCard';

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
      <View className="flex-row items-center gap-3 px-4 py-3" style={{ backgroundColor: '#F8F9FB' }}>
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
        <View className="px-4 py-2 border-b border-border bg-purple-50">
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
      <View className="flex-row items-center gap-3 px-4 py-3" style={{ backgroundColor: '#FAFBFF' }}>
        <View className="w-6 h-6 rounded-full items-center justify-center bg-secondary">
          <Text className="text-foreground text-xs font-bold">{idx + 1}</Text>
        </View>
        <FileText size={13} color="#6B7280" />
        <Text className="flex-1 text-sm font-semibold text-muted-foreground">{t('fir.viewCaseDiary.narrativeLabel')}</Text>
      </View>
      {entry.narrative_template ? (
        <View className="px-4 py-2 border-b border-border bg-purple-50">
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

  // useFocusEffect so data refreshes when returning from add-entry screen
  useFocusEffect(
    useCallback(() => {
      if (!diaryId) { setLoading(false); return; }
      setLoading(true);
      (async () => {
        try {
          const [d, e, f] = await Promise.all([
            getCaseDiaryById(diaryId),
            getEntriesByDiary(diaryId),
            firId ? getFIRById(firId) : Promise.resolve(null),
          ]);
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
        actions={
          <View className="flex-row items-center gap-1.5">
            {/* Edit diary metadata (date/time/places) */}
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary' as never, params: { firId, diaryId } })}
              className="flex-row items-center gap-1 rounded-lg px-2 py-1.5 active:opacity-70 border border-border bg-card"
            >
              <Pencil size={11} color="#6B7280" />
              <Text className="text-[10px] font-bold text-muted-foreground">{t('fir.viewCaseDiary.editInfo')}</Text>
            </Pressable>
            {/* Edit entries */}
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary-karyvahi' as never, params: { firId, diaryId } })}
              className="flex-row items-center gap-1 rounded-lg px-2 py-1.5 active:opacity-70 border border-border bg-card"
            >
              <ListChecks size={11} color={NAVY} />
              <Text className="text-[10px] font-bold" style={{ color: NAVY }}>{t('fir.viewCaseDiary.editEntries')}</Text>
            </Pressable>
            {/* Export DOCX */}
            {entries.length > 0 && (
              <Pressable
                onPress={handleExport}
                disabled={exporting}
                className="flex-row items-center gap-1 rounded-lg px-2 py-1.5 active:opacity-70 border border-border bg-card"
              >
                {exporting
                  ? <ActivityIndicator size="small" color={NAVY} />
                  : <Download size={11} color="#059669" />}
                <Text className="text-[10px] font-bold" style={{ color: '#059669' }}>
                  {exporting ? t('fir.viewCaseDiary.exporting') : t('fir.viewCaseDiary.export')}
                </Text>
              </Pressable>
            )}
          </View>
        }
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
