import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';
import {
  View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, MapPin, Edit2, ListChecks, ChevronRight, Plus, Search, X, CheckSquare } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { getFIRById, updateFIR, type FIR } from '@/lib/db/firRepo';
import { getAccusedByFIR, type FIRAccused } from '@/lib/db/firAccusedRepo';
import { getKaryvahiByFIR, type FIRKaryvahi, type KaryvahiStatus, type KaryvahiPriority } from '@/lib/db/firKaryvahiRepo';
import { getCaseChecklists } from '@/lib/db/sopChecklistRepo';
import { getAll as getAllSops, getById as getSopById, type SopIndexEntry } from '@/ai/sopIndex';
import { Modal } from 'react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useFIRContext } from '@/context/FIRContext';
import { Input } from '@/components/ui/input';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { Progress } from '@/components/ui/progress';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Text>
      {children}
    </View>
  );
}

// ── CollapsibleDocumentBox ─────────────────────────────────────────────────────
// Collapsed: compact 3-line strip showing a preview of the content.
// Expanded:  full DocumentEditor with a "सहेजें / छोटा करें" minimize button.
// Always starts collapsed so the screen loads compact; tap to open.
function CollapsibleDocumentBox({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  if (!isExpanded) {
    return (
      <Pressable
        onPress={() => setIsExpanded(true)}
        className="bg-card border border-border rounded-2xl p-4 active:opacity-70 gap-2"
        style={{ borderCurve: 'continuous' }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Text>
          <Edit2 size={13} color="#9CA3AF" />
        </View>
        <Text className="text-sm text-foreground leading-5" numberOfLines={3}>
          {value.trim() || placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Text>
      <DocumentEditor
        value={value}
        onChangeText={onChangeText}
        title={label}
        placeholder={placeholder}
        minHeight={96}
        accessibilityLabel={label}
      />
      <Pressable
        onPress={() => setIsExpanded(false)}
        className="bg-secondary rounded-xl py-3 items-center justify-center active:opacity-70"
      >
        <Text className="text-sm font-semibold text-muted-foreground">{t('fir.saveOrCollapse')}</Text>
      </Pressable>
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <Pressable
        onPress={() => setShow(true)}
        className="bg-secondary rounded-xl px-4 py-3 active:opacity-70 flex-row items-center justify-between"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || t('fir.selectField', { label })}
        </Text>
        <ChevronDown size={14} color="#9CA3AF" />
      </Pressable>
      <DatePickerModal
        visible={show}
        value={value}
        label={label}
        onConfirm={(v) => { onChange(v); setShow(false); }}
        onClose={() => setShow(false)}
      />
    </Field>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const isPending = status === 'Pending';
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: isPending ? '#FEF3C7' : '#D1FAE5' }}>
      <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: isPending ? '#92400E' : '#065F46' }}>
        {isPending ? t('fir.statusPending') : t('fir.statusFinished')}
      </Text>
    </View>
  );
}

function AccusedRow({ accused }: { accused: FIRAccused }) {
  const { t } = useTranslation();
  const BAIL_LABELS: Record<string, string> = {
    unknown: t('fir.bailUnknown'),
    in_jail: t('fir.bailInJail'),
    on_bail: t('fir.bailOnBail'),
  };
  return (
    <View className="bg-secondary rounded-xl px-4 py-3 gap-1 mb-2">
      <Text className="text-sm font-semibold text-foreground">{accused.name ?? t('fir.accusedUnknown')}</Text>
      {accused.address ? <Text className="text-xs text-muted-foreground">{accused.address}</Text> : null}
      {accused.mobile ? <Text className="text-xs text-muted-foreground">📞 {accused.mobile}</Text> : null}
      <View className="flex-row items-center gap-2 mt-1">
        <View className="rounded-full bg-card border border-border px-2.5 py-1">
          <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{BAIL_LABELS[accused.bail_status] ?? accused.bail_status}</Text>
        </View>
        {accused.next_remand_date ? (
          <Text className="text-xs text-amber-600">⏰ {t('fir.nextRemandPrefix')}: {accused.next_remand_date}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function FIRDetailsTab() {
  const params = useLocalSearchParams<{ firId: string }>();
  const { activeFirId } = useFIRContext();
  const { t } = useTranslation();

  const stableFirId = useMemo((): string | undefined => {
    const fromParams  = params.firId?.trim();
    const fromContext = activeFirId?.trim();
    const paramsOk    = !!fromParams  && fromParams  !== 'undefined';
    const contextOk   = !!fromContext && fromContext !== 'undefined';
    const final       = paramsOk ? fromParams : contextOk ? fromContext : undefined;
    logger.warn(
      `[FIR_DETAILS_ID_RESOLVE]` +
      ` params="${params.firId ?? 'undefined'}"` +
      ` context="${activeFirId ?? 'undefined'}"` +
      ` finalStable="${final ?? 'undefined'}" t=${Date.now()}`
    );
    return final;
  }, [params.firId, activeFirId]);

  const [fir, setFir] = useState<FIR | null>(null);
  const [accused, setAccused] = useState<FIRAccused[]>([]);
  const [karyvahiItems, setKaryvahiItems] = useState<FIRKaryvahi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [firNumber, setFirNumber] = useState('');
  const [section, setSection] = useState('');
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cMobile, setCMobile] = useState('');
  const [cAltMobile, setCAltMobile] = useState('');
  const [cJati, setCJati] = useState('');
  const [cAge, setCAge] = useState('');
  const [ghatnasthal, setGhatnasthal] = useState('');
  const [crimeType, setCrimeType] = useState('');
  const [dateOccurrence, setDateOccurrence] = useState('');
  const [timeOccurrence, setTimeOccurrence] = useState('');
  const [dateInformation, setDateInformation] = useState('');
  const [timeInformation, setTimeInformation] = useState('');
  const [nakalChick, setNakalChick] = useState('');
  const [nakalRapat, setNakalRapat] = useState('');
  const [mukadmaSaransh, setMukadmaSaransh] = useState('');

  // ── SOP Checklists State (Task L30) ──────────────────────────────────────────
  const [caseChecklists, setCaseChecklists] = useState<
    Array<{ sop_id: string; total_steps: number; done_steps: number; progress_percent: number }>
  >([]);
  const [sopPickerOpen, setSopPickerOpen] = useState(false);
  const [sopSearchQuery, setSopSearchQuery] = useState('');
  const [sopSelectedCrime, setSopSelectedCrime] = useState<string>('सभी');

  const allSops = useMemo(() => getAllSops(), []);
  const allCrimeCategories = useMemo(() => {
    const crimes = new Set<string>();
    allSops.forEach((s) => {
      if (s.crime) crimes.add(s.crime);
    });
    return ['सभी', ...Array.from(crimes).slice(0, 10)];
  }, [allSops]);

  const filteredSops = useMemo(() => {
    return allSops.filter((s) => {
      const matchCrime = sopSelectedCrime === 'सभी' || s.crime === sopSelectedCrime;
      if (!matchCrime) return false;
      if (!sopSearchQuery.trim()) return true;
      const q = sopSearchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.crime.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [allSops, sopSelectedCrime, sopSearchQuery]);

  // ── Lifecycle refs ───────────────────────────────────────────────────────────
  const mountedRef       = useRef(true);   // guards all setState after async awaits
  const hasDataRef       = useRef(false);  // true once first successful load completes
  const loadedFirIdRef   = useRef<string | undefined>(undefined);
  const inFlightFirIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    logger.warn(`[FIR_DETAILS_MOUNT] stableFirId="${stableFirId ?? 'undefined'}" t=${Date.now()}`);
    return () => {
      mountedRef.current = false;
      logger.warn(`[FIR_DETAILS_UNMOUNT] t=${Date.now()}`);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const t0 = Date.now();

    if (!stableFirId) {
      logger.warn(`[FIR_DETAILS_LOAD] WAITING — stableFirId undefined t=${t0}`);
      if (mountedRef.current) setLoading(false);
      return;
    }

    if (inFlightFirIdRef.current === stableFirId) {
      logger.warn(`[FIR_DETAILS_LOAD] SKIP — already in-flight firId="${stableFirId}" t=${t0}`);
      return;
    }

    const requestedId = stableFirId;
    inFlightFirIdRef.current = requestedId;

    logger.warn(`[FIR_DETAILS_LOAD] START firId="${requestedId}" hasData=${hasDataRef.current} t=${t0}`);
    if (!hasDataRef.current && mountedRef.current) setLoading(true);

    try {
      // Load one query at a time, FIR first. Running them in parallel on the
      // single SQLite connection could fail on Android, and Promise.all then
      // threw away the FIR too — the details screen showed empty fields.
      const f = await getFIRById(requestedId);
      const safe = async <T,>(label: string, q: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await q(); } catch (e) {
          logger.warn(`[FIR_DETAILS_LOAD] ${label} failed:`, e);
          return fallback;
        }
      };
      const acc = await safe('accused', () => getAccusedByFIR(requestedId), [] as FIRAccused[]);
      const karyvahi = await safe('karyvahi', () => getKaryvahiByFIR(requestedId, 'DetailsTab'), [] as FIRKaryvahi[]);
      const chklists = await safe('checklists', () => getCaseChecklists(requestedId), [] as Awaited<ReturnType<typeof getCaseChecklists>>);

      if (!mountedRef.current) {
        logger.warn(`[FIR_DETAILS_LOAD] UNMOUNTED — discarding`);
        return;
      }

      if (stableFirId === requestedId) {
        logger.warn(`[FIR_DETAILS_LOAD] END firId="${requestedId}" found=${!!f} elapsed=${Date.now() - t0}ms`);
        const formatted = (chklists || []).map((c) => {
          const meta = getSopById(c.sop_id);
          const total = meta?.steps?.length || 1;
          const done = c.done_count;
          const percent = Math.min(100, Math.round((done / total) * 100));
          return {
            sop_id: c.sop_id,
            total_steps: total,
            done_steps: done,
            progress_percent: percent,
          };
        });
        setCaseChecklists(formatted);
        if (f) {
          setFir(f);
          setFirNumber(f.fir_number);
          setSection(f.section);
          setCName(f.complainant_name);
          setCAddress(f.complainant_address ?? '');
          setCMobile(f.complainant_mobile ?? '');
          setCAltMobile(f.complainant_alt_mobile ?? '');
          setCJati(f.complainant_jati ?? '');
          setCAge(f.complainant_age ?? '');
          setGhatnasthal(f.ghatnasthal ?? '');
          setCrimeType(f.crime_type);
          setDateOccurrence(f.date_of_occurrence ?? '');
          setTimeOccurrence(f.time_of_occurrence ?? '');
          setDateInformation(f.date_of_information ?? '');
          setTimeInformation(f.time_of_information ?? '');
          setNakalChick(f.nakal_chick ?? '');
          setNakalRapat(f.nakal_rapat ?? '');
          setMukadmaSaransh(f.mukadma_saransh ?? '');
        }
        setAccused(acc);
        setKaryvahiItems(karyvahi);
        hasDataRef.current    = true;
        loadedFirIdRef.current = requestedId;
      }
    } catch (e) {
      logger.warn('[FIR_DETAILS_LOAD] ERROR:', e);
      if (!hasDataRef.current && mountedRef.current) {
        setFir(null);
        setAccused([]);
      }
    } finally {
      inFlightFirIdRef.current = undefined;
      if (mountedRef.current) setLoading(false);
    }
  }, [stableFirId]);

  useEffect(() => {
    if (!stableFirId) return;
    if (stableFirId !== loadedFirIdRef.current) {
      hasDataRef.current       = false;
      loadedFirIdRef.current   = undefined;
      inFlightFirIdRef.current = undefined;
    }
    load();
  }, [stableFirId, load]);

  useFocusEffect(useCallback(() => {
    logger.warn(`[FIR_DETAILS_FOCUS] ENTER stableFirId="${stableFirId ?? 'undefined'}" t=${Date.now()}`);
    load();
    return () => {
      logger.warn(`[FIR_DETAILS_FOCUS] LEAVE stableFirId="${stableFirId ?? 'undefined'}" t=${Date.now()}`);
    };
  }, [load, stableFirId]));

  const handleSave = async () => {
    if (!firNumber.trim()) { setError(t('fir.firNumberRequired')); return; }
    // Chronology: Date of Occurrence must not be later than Date of Information
    if (dateOccurrence && dateInformation) {
      if (new Date(dateOccurrence) > new Date(dateInformation)) {
        setError(t('fir.occurrenceDateOrderError'));
        return;
      }
    }
    setError('');
    setSaving(true);
    try {
      await updateFIR(stableFirId!, {
        fir_number: firNumber.trim(), section: section.trim(),
        complainant_name: cName.trim(), complainant_address: cAddress,
        complainant_mobile: cMobile, complainant_alt_mobile: cAltMobile,
        complainant_jati: cJati, complainant_age: cAge,
        ghatnasthal,
        date_of_occurrence: dateOccurrence, time_of_occurrence: timeOccurrence,
        date_of_information: dateInformation, time_of_information: timeInformation,
        nakal_chick: nakalChick, nakal_rapat: nakalRapat,
        mukadma_saransh: mukadmaSaransh,
      });
      const updated = await getFIRById(stableFirId!);
      if (updated && mountedRef.current) setFir(updated);
    } catch {
      setError(t('fir.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const karyvahiStats = useMemo(() => {
    const effectiveStatus = (i: FIRKaryvahi): KaryvahiStatus =>
      (i.execution_count ?? 0) > 0 ? 'COMPLETED' : ((i.status as KaryvahiStatus) ?? 'PENDING');
    const total     = karyvahiItems.length;
    const completed = karyvahiItems.filter(i => effectiveStatus(i) === 'COMPLETED').length;
    const byPriority = (['MANDATORY', 'CONDITIONAL', 'RECOMMENDED'] as KaryvahiPriority[]).map(p => {
      const subset = karyvahiItems.filter(i => ((i.priority as KaryvahiPriority) ?? 'MANDATORY') === p);
      const done   = subset.filter(i => effectiveStatus(i) === 'COMPLETED').length;
      return { priority: p, total: subset.length, completed: done };
    }).filter(s => s.total > 0);
    const pendingMandatory = karyvahiItems.filter(i =>
      ((i.priority as KaryvahiPriority) ?? 'MANDATORY') === 'MANDATORY' &&
      effectiveStatus(i) !== 'COMPLETED'
    ).length;
    return { total, completed, byPriority, pendingMandatory };
  }, [karyvahiItems]);

  const PRIORITY_LABEL: Record<KaryvahiPriority, string> = {
    MANDATORY:   t('fir.priorityMandatory'),
    CONDITIONAL: t('fir.priorityConditional'),
    RECOMMENDED: t('fir.priorityRecommended'),
  };
  const PRIORITY_COLOR: Record<KaryvahiPriority, string> = {
    MANDATORY:   '#DC2626',
    CONDITIONAL: '#D97706',
    RECOMMENDED: '#16A34A',
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1 bg-background">
      <AppHeader title={fir?.complainant_name ?? t('fir.firDetails')} subtitle={fir?.fir_number ? `${t('fir.firNoPrefix')} ${fir.fir_number}` : undefined} showBack />

      <ScrollView
        contentContainerClassName="px-6 py-5 gap-6 pb-24"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : null}

        {/* Checklist Progress Card */}
        {karyvahiStats.total > 0 && (
          <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
            {/* Header row */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ListChecks size={15} color="#6366F1" />
                <Text className="text-sm font-bold text-foreground">{t('fir.checklistProgress')}</Text>
              </View>
              <Pressable
                onPress={() => router.push(`/(app)/mukadma/${stableFirId}/pending-actions` as never)}
                className="flex-row items-center gap-1 active:opacity-60"
              >
                {karyvahiStats.pendingMandatory > 0 && (
                  <View className="rounded-full bg-red-100 px-2.5 py-1 dark:bg-red-500/15">
                    <Text textBreakStrategy="simple" className="text-xs font-semibold text-red-600 dark:text-red-300">
                      {t('fir.pendingCount', { count: karyvahiStats.pendingMandatory })}
                    </Text>
                  </View>
                )}
                <ChevronRight size={14} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Overall bar */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">{t('fir.totalCompleted')}</Text>
                <Text className="text-xs font-semibold" style={{ color: karyvahiStats.completed === karyvahiStats.total ? '#16A34A' : '#6366F1' }}>
                  {karyvahiStats.completed}/{karyvahiStats.total} · {Math.round((karyvahiStats.completed / karyvahiStats.total) * 100)}%
                </Text>
              </View>
              <Progress
                value={(karyvahiStats.completed / karyvahiStats.total) * 100}
                className="h-2"
                indicatorClassName={karyvahiStats.completed === karyvahiStats.total ? 'bg-green-500' : 'bg-primary'}
              />
            </View>

            {/* Per-priority bars */}
            {karyvahiStats.byPriority.map(({ priority, total: tot, completed: c }) => (
              <View key={priority} className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs" style={{ color: PRIORITY_COLOR[priority] }}>
                    {PRIORITY_LABEL[priority]}
                  </Text>
                  <Text className="text-xs text-muted-foreground">{c}/{tot}</Text>
                </View>
                <Progress
                  value={tot > 0 ? (c / tot) * 100 : 0}
                  className="h-1.5"
                  indicatorClassName={
                    priority === 'MANDATORY'   ? 'bg-red-500' :
                    priority === 'CONDITIONAL' ? 'bg-amber-500' : 'bg-green-500'
                  }
                />
              </View>
            ))}
          </View>
        )}

        {/* Basic */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">{t('fir.basicInfo')}</Text>
          <Field label={t('fir.firNumber')}><Input value={firNumber} onChangeText={setFirNumber} /></Field>
          <Field label={t('fir.section')}><Input value={section} onChangeText={setSection} /></Field>
        </View>

        {/* Complainant */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">{t('fir.complainantDetails')}</Text>
          <Field label={t('fir.name')}><Input value={cName} onChangeText={setCName} /></Field>
          <Field label={t('fir.fullAddress')}><Input type="multiline" value={cAddress} onChangeText={setCAddress} numberOfLines={2} /></Field>
          <View className="flex-row gap-3">
            <View className="flex-1"><Field label={t('fir.mobile')}><Input type="mobile" value={cMobile} onChangeText={setCMobile} /></Field></View>
            <View className="flex-1"><Field label={t('fir.altMobile')}><Input type="mobile" value={cAltMobile} onChangeText={setCAltMobile} /></Field></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><Field label={t('fir.jati')}><Input value={cJati} onChangeText={setCJati} /></Field></View>
            <View className="flex-1"><Field label={t('fir.age')}><Input type="age" value={cAge} onChangeText={setCAge} /></Field></View>
          </View>
        </View>

        {/* Incident */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">{t('fir.incidentDetails')}</Text>
          <Field label={t('fir.ghatnasthal')}>
            <Input type="multiline" value={ghatnasthal} onChangeText={setGhatnasthal} leftIcon={<MapPin size={14} color="#6B7280" />} numberOfLines={2} />
          </Field>
          <Field label={t('fir.crimeType')}>
            {/* Read-only: crime type is locked after FIR creation */}
            <View className="bg-muted rounded-xl px-4 py-3">
              <Text className="text-sm text-muted-foreground">{crimeType || '—'}</Text>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              {t('fir.crimeTypeLockNotice')}
            </Text>
          </Field>
          <View className="flex-row gap-3">
            <View className="flex-1"><DateField label={t('fir.dateOfOccurrence')} value={dateOccurrence} onChange={setDateOccurrence} /></View>
            <View className="flex-1"><Field label={t('fir.time')}><Input type="time" value={timeOccurrence} onChangeText={setTimeOccurrence} /></Field></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><DateField label={t('fir.dateOfInformation')} value={dateInformation} onChange={setDateInformation} /></View>
            <View className="flex-1"><Field label={t('fir.time')}><Input type="time" value={timeInformation} onChangeText={setTimeInformation} /></Field></View>
          </View>
        </View>

        {/* Accused */}
        {accused.length > 0 && (
          <View className="gap-3">
            <Text className="text-base font-bold text-foreground border-b border-border pb-2">
              {t('fir.accusedSectionTitle', { count: accused.length })}
            </Text>
            {accused.map((a) => <AccusedRow key={a.id} accused={a} />)}
          </View>
        )}

        {/* Detailed Reports & Summary */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">{t('fir.detailedReportsAndSummary')}</Text>
          <Text className="text-xs text-muted-foreground -mt-2">
            {t('fir.summaryAutoAddNotice')}
          </Text>
          <CollapsibleDocumentBox
            label={t('fir.nakalChickForm')}
            value={nakalChick}
            onChangeText={setNakalChick}
            placeholder={t('fir.nakalChickPlaceholder')}
          />
          <CollapsibleDocumentBox
            label={t('fir.nakalRapatForm')}
            value={nakalRapat}
            onChangeText={setNakalRapat}
            placeholder={t('fir.nakalRapatPlaceholder')}
          />
          <CollapsibleDocumentBox
            label={t('fir.mukadmaSaranshTitle')}
            value={mukadmaSaransh}
            onChangeText={setMukadmaSaransh}
            placeholder={t('fir.mukadmaSaranshPlaceholder')}
          />
        </View>

        {/* SOP चेकलिस्ट Section (Task L30) */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between border-b border-border pb-2">
            <View className="flex-row items-center gap-2">
              <CheckSquare size={18} color="#0F766E" />
              <Text className="text-base font-bold text-foreground">SOP चेकलिस्ट</Text>
              {caseChecklists.length > 0 && (
                <View className="bg-primary/10 rounded-full px-2.5 py-1">
                  <Text textBreakStrategy="simple" className="text-xs font-bold text-primary">{caseChecklists.length}</Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => setSopPickerOpen(true)}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl bg-primary active:opacity-70"
            >
              <Plus size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-primary-foreground">+ SOP जोड़ें</Text>
            </Pressable>
          </View>

          {caseChecklists.length > 0 ? (
            <View className="gap-2.5">
              {caseChecklists.map((item) => {
                const sopMeta = getSopById(item.sop_id);
                const title = sopMeta?.title || item.sop_id;
                const targetId = sopMeta?.kid || item.sop_id;

                return (
                  <Pressable
                    key={item.sop_id}
                    onPress={() =>
                      router.push(
                        `/(app)/knowledge/${targetId}?tab=checklist&caseId=${stableFirId}` as any
                      )
                    }
                    className="p-3.5 rounded-xl border border-border bg-card active:opacity-70 shadow-sm shadow-black/5"
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-foreground leading-5" numberOfLines={1}>
                          {title}
                        </Text>
                        {sopMeta?.crime ? (
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            {sopMeta.crime}
                          </Text>
                        ) : null}
                      </View>
                      <View className="items-end">
                        <Text className="text-xs font-bold text-primary">
                          {item.done_steps}/{item.total_steps} ({item.progress_percent}%)
                        </Text>
                        <ChevronRight size={14} color="#9CA3AF" />
                      </View>
                    </View>

                    <View className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                      <View
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${item.progress_percent}%` }}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View className="p-4 rounded-xl border border-dashed border-border bg-muted/20 items-center justify-center">
              <Text className="text-xs text-muted-foreground text-center">
                इस केस से कोई SOP चेकलिस्ट नहीं जुड़ी है। &apos;+ SOP जोड़ें&apos; पर टैप करके विवेचना चेकलिस्ट प्रारंभ करें।
              </Text>
            </View>
          )}
        </View>

        {/* Status info */}
        <View className="bg-secondary rounded-2xl p-4 gap-1" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">{t('fir.statusTitle')}</Text>
          <Text className="text-sm text-foreground">
            {t('fir.statusAutoComputedNotice')}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <StatusBadge status={fir?.status ?? 'Pending'} />
            <Text className="text-xs text-muted-foreground">
              {fir?.status === 'Finished' ? t('fir.statusAllFinished') : t('fir.statusSomePending')}
            </Text>
          </View>
        </View>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="rounded-2xl py-4 items-center active:opacity-80"
          style={{ backgroundColor: '#6366F1', borderCurve: 'continuous' }}
        >
          <Text className="text-white font-bold text-base">{saving ? t('common.saving') : t('common.saveChanges')}</Text>
        </Pressable>
      </ScrollView>

      {/* ── SOP Picker Modal (+ SOP जोड़ें) ── */}
      <Modal
        visible={sopPickerOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSopPickerOpen(false)}
      >
        <Pressable
          onPress={() => setSopPickerOpen(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-card border-t border-border rounded-t-3xl max-h-[85%] p-4 gap-3 shadow-2xl"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-2 border-b border-border">
              <View>
                <Text className="text-base font-bold text-foreground">
                  SOP चुनें और चेकलिस्ट जोड़ें
                </Text>
                <Text className="text-xs text-muted-foreground">
                  विवेचना के लिए उपयुक्त मानक संचालन प्रक्रिया चुनें
                </Text>
              </View>
              <Pressable
                onPress={() => setSopPickerOpen(false)}
                hitSlop={8}
                className="p-1 rounded-full bg-muted"
              >
                <X size={18} color="#6B7280" />
              </Pressable>
            </View>

            {/* Search Box */}
            <View className="flex-row items-center bg-muted/30 border border-border rounded-xl px-3 py-2 gap-2">
              <Search size={16} color="#9CA3AF" />
              <TextInput
                value={sopSearchQuery}
                onChangeText={setSopSearchQuery}
                placeholder="SOP खोजें (उदा. हत्या, साइबर, जब्ती)…"
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-sm text-foreground p-0"
              />
              {sopSearchQuery ? (
                <Pressable onPress={() => setSopSearchQuery('')} hitSlop={8}>
                  <X size={14} color="#9CA3AF" />
                </Pressable>
              ) : null}
            </View>

            {/* Crime Category Chips */}
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-1.5 py-1"
              >
                {allCrimeCategories.map((crime) => {
                  const isSel = sopSelectedCrime === crime;
                  return (
                    <Pressable
                      key={crime}
                      onPress={() => setSopSelectedCrime(crime)}
                      className={`px-3 py-1.5 rounded-full border ${
                        isSel
                          ? 'bg-primary border-primary'
                          : 'bg-muted/40 border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSel ? 'text-primary-foreground' : 'text-foreground'
                        }`}
                      >
                        {crime}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* SOP List */}
            <ScrollView className="max-h-96 gap-2">
              {filteredSops.length > 0 ? (
                filteredSops.map((sop) => (
                  <Pressable
                    key={sop.id}
                    onPress={() => {
                      setSopPickerOpen(false);
                      router.push(
                        `/(app)/knowledge/${sop.kid || sop.id}?tab=checklist&caseId=${stableFirId}` as any
                      );
                    }}
                    className="p-3 rounded-xl border border-border bg-card active:opacity-70 mb-2 shadow-sm shadow-black/5"
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-foreground leading-5">
                          {sop.title}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <View className="px-2 py-0.5 rounded bg-primary/10">
                            <Text className="text-[10px] font-bold text-primary">
                              {sop.src}
                            </Text>
                          </View>
                          <Text className="text-xs text-muted-foreground">
                            {sop.crime}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color="#9CA3AF" className="mt-1" />
                    </View>
                  </Pressable>
                ))
              ) : (
                <View className="p-8 items-center justify-center">
                  <Text className="text-xs text-muted-foreground text-center">
                    कोई SOP नहीं मिला। कृपया अन्य शब्द या श्रेणी चुनें।
                  </Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
