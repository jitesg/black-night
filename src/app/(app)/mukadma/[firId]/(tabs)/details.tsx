import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';
import {
  View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, MapPin, Edit2, ListChecks, ChevronRight } from 'lucide-react-native';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { getFIRById, updateFIR, type FIR } from '@/lib/db/firRepo';
import { getAccusedByFIR, type FIRAccused } from '@/lib/db/firAccusedRepo';
import { getKaryvahiByFIR, type FIRKaryvahi, type KaryvahiStatus, type KaryvahiPriority } from '@/lib/db/firKaryvahiRepo';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
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
        <Text className="text-sm font-semibold text-muted-foreground">सहेजें / छोटा करें</Text>
      </Pressable>
    </View>
  );
}

// StyledInput removed — all fields use universal <Input>

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <Pressable
        onPress={() => setShow(true)}
        className="bg-secondary rounded-xl px-4 py-3 active:opacity-70 flex-row items-center justify-between"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || `Select ${label}`}
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
  const isPending = status === 'Pending';
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: isPending ? '#FEF3C7' : '#D1FAE5' }}>
      <Text className="text-xs font-semibold" style={{ color: isPending ? '#92400E' : '#065F46' }}>{status}</Text>
    </View>
  );
}

function AccusedRow({ accused }: { accused: FIRAccused }) {
  const BAIL_LABELS: Record<string, string> = { unknown: 'Status Unknown', in_jail: 'In Jail After Remand', on_bail: 'Out On Bail' };
  return (
    <View className="bg-secondary rounded-xl px-4 py-3 gap-1 mb-2">
      <Text className="text-sm font-semibold text-foreground">{accused.name ?? 'Unknown'}</Text>
      {accused.address ? <Text className="text-xs text-muted-foreground">{accused.address}</Text> : null}
      {accused.mobile ? <Text className="text-xs text-muted-foreground">📞 {accused.mobile}</Text> : null}
      <View className="flex-row items-center gap-2 mt-1">
        <View className="rounded-full px-2 py-0.5 bg-card border border-border">
          <Text className="text-xs text-muted-foreground">{BAIL_LABELS[accused.bail_status] ?? accused.bail_status}</Text>
        </View>
        {accused.next_remand_date ? (
          <Text className="text-xs text-amber-600">⏰ Next Remand: {accused.next_remand_date}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function FIRDetailsTab() {
  // ── firId resolution: single stableFirId = params.firId || activeFirId ───────
  // Identical pattern to karyvahi.tsx and case-diary.tsx — see karyvahi.tsx for
  // the full race-condition explanation.
  //
  // ROOT CAUSE OF "BLANK FIR DETAILS ON BACK":
  //   The previous code used useLocalSearchParams() alone (no context fallback).
  //   During tab navigation, expo-router may briefly emit { firId: undefined }
  //   before re-hydrating the param. The LEAVE cleanup was also incrementing
  //   requestCounterRef, which staled the in-flight load — leaving fir=null.
  //   Fixed by: single stableFirId memo (params || context), inFlightFirIdRef
  //   single-flight gate, mountedRef guard, and removing counter++ from LEAVE.
  const params = useLocalSearchParams<{ firId: string }>();
  const { activeFirId } = useFIRContext();

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
  // crimeType is read-only after FIR creation — no dropdown state needed

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

  // ── Lifecycle refs ───────────────────────────────────────────────────────────
  const mountedRef       = useRef(true);   // guards all setState after async awaits
  const hasDataRef       = useRef(false);  // true once first successful load completes
  const loadedFirIdRef   = useRef<string | undefined>(undefined);
  // Single-flight gate: if a load is already in-flight for this firId, skip.
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

  // ── load: single DB fetch, guarded against duplicate and stale writes ────────
  const load = useCallback(async () => {
    const t0 = Date.now();

    if (!stableFirId) {
      logger.warn(`[FIR_DETAILS_LOAD] WAITING — stableFirId undefined t=${t0}`);
      if (mountedRef.current) setLoading(false);
      return;
    }

    // Single-flight gate: prevents duplicate loads from useFocusEffect + retry
    if (inFlightFirIdRef.current === stableFirId) {
      logger.warn(`[FIR_DETAILS_LOAD] SKIP — already in-flight firId="${stableFirId}" t=${t0}`);
      return;
    }

    const requestedId = stableFirId;
    inFlightFirIdRef.current = requestedId;

    logger.warn(`[FIR_DETAILS_LOAD] START firId="${requestedId}" hasData=${hasDataRef.current} t=${t0}`);
    if (!hasDataRef.current && mountedRef.current) setLoading(true);

    try {
      const [f, acc, karyvahi] = await Promise.all([
        getFIRById(requestedId),
        getAccusedByFIR(requestedId),
        getKaryvahiByFIR(requestedId, 'DetailsTab'),
      ]);

      if (!mountedRef.current) {
        logger.warn(`[FIR_DETAILS_LOAD] UNMOUNTED — discarding`);
        return;
      }

      // Only write state if firId hasn't changed during the async work
      if (stableFirId === requestedId) {
        logger.warn(`[FIR_DETAILS_LOAD] END firId="${requestedId}" found=${!!f} elapsed=${Date.now() - t0}ms`);
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
      // Never clear an already-loaded FIR on a background refresh error.
      // Only clear on the very first load failure (no data yet).
      if (!hasDataRef.current && mountedRef.current) {
        setFir(null);
        setAccused([]);
      }
    } finally {
      inFlightFirIdRef.current = undefined;
      if (mountedRef.current) setLoading(false);
    }
  }, [stableFirId]);

  // ── Retry trigger: fires when stableFirId arrives after focus ────────────────
  useEffect(() => {
    if (!stableFirId) return;
    if (stableFirId !== loadedFirIdRef.current) {
      hasDataRef.current       = false;
      loadedFirIdRef.current   = undefined;
      inFlightFirIdRef.current = undefined; // clear stale in-flight for the previous firId
    }
    load();
  }, [stableFirId, load]);

  // ── useFocusEffect: reload on every screen focus (no counter++ in LEAVE) ─────
  //
  // KEY FIX: LEAVE no longer increments requestCounterRef. The previous code
  // incremented it in cleanup, which ran before the in-flight await resolved,
  // staling the load and leaving fir=null → blank details screen.
  useFocusEffect(useCallback(() => {
    logger.warn(`[FIR_DETAILS_FOCUS] ENTER stableFirId="${stableFirId ?? 'undefined'}" t=${Date.now()}`);
    load();
    return () => {
      logger.warn(`[FIR_DETAILS_FOCUS] LEAVE stableFirId="${stableFirId ?? 'undefined'}" t=${Date.now()}`);
    };
  }, [load, stableFirId]));

  const handleSave = async () => {
    if (!firNumber.trim()) { setError('FIR Number is required'); return; }
    // Chronology: Date of Occurrence must not be later than Date of Information
    if (dateOccurrence && dateInformation) {
      if (new Date(dateOccurrence) > new Date(dateInformation)) {
        setError('घटना की तारीख (Date of Occurrence) एफआईआर दर्ज तारीख (Date of Information) से बाद की नहीं हो सकती।');
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
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Phase 5: derive progress stats from karyvahi items
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
    MANDATORY:   '🔴 अनिवार्य',
    CONDITIONAL: '🟡 परिस्थितिनुसार',
    RECOMMENDED: '🟢 Recommended',
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
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <AppHeader title={fir?.complainant_name ?? 'FIR Details'} subtitle={fir?.fir_number ? `FIR No. ${fir.fir_number}` : undefined} showBack />

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

        {/* Phase 5: Checklist Progress Card */}
        {karyvahiStats.total > 0 && (
          <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
            {/* Header row */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ListChecks size={15} color="#6366F1" />
                <Text className="text-sm font-bold text-foreground">चेकलिस्ट प्रगति</Text>
              </View>
              <Pressable
                onPress={() => router.push(`/(app)/mukadma/${stableFirId}/pending-actions` as never)}
                className="flex-row items-center gap-1 active:opacity-60"
              >
                {karyvahiStats.pendingMandatory > 0 && (
                  <View className="rounded-full bg-red-100 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-red-600">
                      {karyvahiStats.pendingMandatory} लंबित
                    </Text>
                  </View>
                )}
                <ChevronRight size={14} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Overall bar */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">कुल पूर्ण</Text>
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
            {karyvahiStats.byPriority.map(({ priority, total: t, completed: c }) => (
              <View key={priority} className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs" style={{ color: PRIORITY_COLOR[priority] }}>
                    {PRIORITY_LABEL[priority]}
                  </Text>
                  <Text className="text-xs text-muted-foreground">{c}/{t}</Text>
                </View>
                <Progress
                  value={t > 0 ? (c / t) * 100 : 0}
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
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">Basic Information</Text>
          <Field label="FIR Number"><Input value={firNumber} onChangeText={setFirNumber} /></Field>
          <Field label="Section"><Input value={section} onChangeText={setSection} /></Field>
        </View>

        {/* Complainant */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">Complainant Details</Text>
          <Field label="Name"><Input value={cName} onChangeText={setCName} /></Field>
          <Field label="Full Address"><Input type="multiline" value={cAddress} onChangeText={setCAddress} numberOfLines={2} /></Field>
          <View className="flex-row gap-3">
            <View className="flex-1"><Field label="Mobile"><Input type="mobile" value={cMobile} onChangeText={setCMobile} /></Field></View>
            <View className="flex-1"><Field label="Alt. Mobile"><Input type="mobile" value={cAltMobile} onChangeText={setCAltMobile} /></Field></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><Field label="Jati"><Input value={cJati} onChangeText={setCJati} /></Field></View>
            <View className="flex-1"><Field label="Age"><Input type="age" value={cAge} onChangeText={setCAge} /></Field></View>
          </View>
        </View>

        {/* Incident */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">Incident Details</Text>
          <Field label="Ghatnasthal">
            <Input type="multiline" value={ghatnasthal} onChangeText={setGhatnasthal} leftIcon={<MapPin size={14} color="#6B7280" />} numberOfLines={2} />
          </Field>
          <Field label="Crime Type">
            {/* Read-only: crime type is locked after FIR creation */}
            <View className="bg-muted rounded-xl px-4 py-3">
              <Text className="text-sm text-muted-foreground">{crimeType || '—'}</Text>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              Crime Type FIR दर्ज होने के बाद बदला नहीं जा सकता (Investigation checklist इसी पर आधारित है)।
            </Text>
          </Field>
          <View className="flex-row gap-3">
            <View className="flex-1"><DateField label="Date of Occurrence" value={dateOccurrence} onChange={setDateOccurrence} /></View>
            <View className="flex-1"><Field label="Time"><Input type="time" value={timeOccurrence} onChangeText={setTimeOccurrence} /></Field></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><DateField label="Date of Information" value={dateInformation} onChange={setDateInformation} /></View>
            <View className="flex-1"><Field label="Time"><Input type="time" value={timeInformation} onChangeText={setTimeInformation} /></Field></View>
          </View>
        </View>

        {/* Accused */}
        {accused.length > 0 && (
          <View className="gap-3">
            <Text className="text-base font-bold text-foreground border-b border-border pb-2">
              Accused ({accused.length})
            </Text>
            {accused.map((a) => <AccusedRow key={a.id} accused={a} />)}
          </View>
        )}

        {/* Detailed Reports & Summary */}
        <View className="gap-4">
          <Text className="text-base font-bold text-foreground border-b border-border pb-2">Detailed Reports &amp; Summary</Text>
          <Text className="text-xs text-muted-foreground -mt-2">
            मुकदमा सारांश केस डायरी की पहली प्रविष्टि में स्वतः जुड़ जाएगा।
          </Text>
          <CollapsibleDocumentBox
            label="Nakal Chick Form"
            value={nakalChick}
            onChangeText={setNakalChick}
            placeholder="Nakal Chick details…"
          />
          <CollapsibleDocumentBox
            label="Nakal Rapat Form"
            value={nakalRapat}
            onChangeText={setNakalRapat}
            placeholder="Nakal Rapat details…"
          />
          <CollapsibleDocumentBox
            label="मुकदमा सारांश (Case Summary)"
            value={mukadmaSaransh}
            onChangeText={setMukadmaSaransh}
            placeholder="मुकदमे की संक्षिप्त कहानी / घटनाक्रम यहाँ लिखें…"
          />
        </View>

        {/* Status info */}
        <View className="bg-secondary rounded-2xl p-4 gap-1" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Status</Text>
          <Text className="text-sm text-foreground">
            Status is automatically computed from the <Text className="font-bold">Karyvahi</Text> tab.
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <StatusBadge status={fir?.status ?? 'Pending'} />
            <Text className="text-xs text-muted-foreground">
              {fir?.status === 'Finished' ? 'All karyvahi completed' : 'Some karyvahi pending'}
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
          <Text className="text-white font-bold text-base">{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
