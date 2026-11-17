// Bug 3 fix: removed unused imports — useCallback, isActionWorkflow,
// PPComplainant, PPAccused, HeaderIconBtn.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, BackHandler } from 'react-native';
import { T } from '@/lib/typography';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { PersonGroupInput, initPersonGroup, parsePersonGroup, type PersonEntry } from '@/components/ui/PersonGroupInput';
import { cardFromPPRow, ppRowFromCard, composeAddress } from '@/lib/personCard';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';
import { addPendingAttachments, type PendingAttachment } from '@/lib/db/attachmentRepo';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronDown, Calendar, Sparkles } from 'lucide-react-native';
import { OcrScanModal } from '@/components/common/OcrScanModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  createPrarthnaPatra,
  updatePrarthnaPatra,
  getPPWithDetails,
  PETITION_TYPES,
  PETITION_TYPE_LABELS,
  addDays,
  _todayString,
  type PetitionType,
} from '@/lib/db/prarthnaPatraRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// ── Constants ─────────────────────────────────────────────────────────────────
// BORDER and surface colour are theme-reactive — computed inside the component.

const PP_OCR_FIELDS = [
  { key: 'complainant_name', label: 'आवेदक का नाम (Complainant Name)' },
  { key: 'complainant_father', label: 'पिता/पति का नाम (Father/Husband Name)' },
  { key: 'complainant_mobile', label: 'मोबाइल नंबर (Mobile Number)' },
  { key: 'complainant_address', label: 'आवेदक का पता (Address)' },
  { key: 'complainant_village', label: 'गाँव/मोहल्ला (Village)' },
  { key: 'complainant_police_station', label: 'थाना (Police Station)' },
  { key: 'accused_name', label: 'विपक्षी/आरोपी का नाम (Accused Name)' },
  { key: 'accused_father', label: 'विपक्षी के पिता का नाम (Accused Father)' },
  { key: 'accused_address', label: 'विपक्षी का पता (Accused Address)' },
  { key: 'matter', label: 'प्रार्थना पत्र का विवरण (Complaint Matter)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDisplay(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

// ── People = group cards (owner, 2026-11-17: the format group card) ─────────────

/** Saved rows → group JSON (old rows keep their typed address). */
function rowsToGroup(rows: Array<Parameters<typeof cardFromPPRow>[0]>): string {
  return rows.length ? JSON.stringify(rows.map((r) => cardFromPPRow(r))) : initPersonGroup();
}

/** Put OCR text into the first card (empty boxes only). */
function ocrIntoFirst(json: string, x: { name?: string; father?: string; mobile?: string; address?: string }): string {
  const list = parsePersonGroup(json);
  const f: PersonEntry = { ...list[0] };
  if (x.name && !f.name.trim()) f.name = x.name;
  if (x.father && !f.fatherOrHusbandName.trim()) f.fatherOrHusbandName = x.father;
  if (x.mobile && !f.mobile.trim()) f.mobile = x.mobile.replace(/\D/g, '').slice(-10);
  if (x.address && !(f.village ?? '').trim() && !(f.house ?? '').trim()) {
    f.addrMode = 'free';
    f.fullAddress = x.address;
  }
  if (f.addrMode === 'parts') f.fullAddress = composeAddress(f);
  return JSON.stringify([f, ...list.slice(1)]);
}

// ── UI atoms ───────────────────────────────────────────────────────────────────

function useMuted(): string {
  const { colorScheme } = useColorScheme();
  return (colorScheme === 'dark' ? THEME.dark : THEME.light).mutedForeground;
}

function Section({ title }: { title: string }) {
  const muted = useMuted();
  return (
    <Text style={{
      ...T.micro, letterSpacing: 1.2, textTransform: 'uppercase',
      color: muted, marginTop: T.space.lg, marginBottom: T.space.sm,
    }}>
      {title}
    </Text>
  );
}

function FieldLabel({ label }: { label: string }) {
  const muted = useMuted();
  return <Text style={{ ...T.caption1, color: muted, fontWeight: T.weight.medium, marginBottom: T.space.xs }}>{label}</Text>;
}

import { Input } from '@/components/ui/input';

// InlineInput shim removed — all fields use universal <Input> from @/components/ui/input

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: T.space.md }}>
      <FieldLabel label={label} />
      {children}
      {error ? <Text style={{ ...T.caption2, color: '#DC2626', marginTop: 3 }}>{error}</Text> : null}
    </View>
  );
}

// ── Date Picker Field ─────────────────────────────────────────────────────────

function DatePickerField({
  label, value, onChange, error, helperText,
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; helperText?: string;
}) {
  const [open, setOpen] = useState(false);
  const { colorScheme: scheme } = useColorScheme();
  const palette = scheme === 'dark' ? THEME.dark : THEME.light;
  const BORDER  = palette.border;
  const SURFACE = palette.card;

  return (
    <View style={{ marginBottom: T.space.md - 4 }}>
      <FieldLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1, borderColor: error ? '#DC2626' : BORDER,
          borderRadius: 10, paddingHorizontal: T.space.md - 4, paddingVertical: T.space.sm + 2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: SURFACE,
        }}
        accessibilityLabel={`Pick ${label}`}
      >
        <Text style={{ ...T.subhead, color: value ? palette.foreground : palette.mutedForeground }}>
          {value ? formatDisplay(value) : `Select ${label}`}
        </Text>
        <Calendar size={15} color="#9CA3AF" />
      </Pressable>
      {error ? <Text style={{ ...T.caption2, color: '#DC2626', marginTop: 3 }}>{error}</Text> : null}
      {helperText && !error ? (
        <Text style={{ ...T.caption2, color: palette.mutedForeground, marginTop: 3 }}>{helperText}</Text>
      ) : null}
      <DatePickerModal
        visible={open}
        value={value || _todayString()}
        label={label}
        onConfirm={(v) => { onChange(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

// ── Type Picker ───────────────────────────────────────────────────────────────

function TypePicker({
  value, onChange, error,
}: { value: PetitionType | null; onChange: (v: PetitionType) => void; error?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { colorScheme: scheme } = useColorScheme();
  const palette = scheme === 'dark' ? THEME.dark : THEME.light;
  const BORDER  = palette.border;
  const SURFACE = palette.card;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1, borderColor: error ? '#DC2626' : BORDER,
          borderRadius: 10, paddingHorizontal: T.space.md - 4, paddingVertical: T.space.sm + 2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: SURFACE,
        }}
      >
        <Text style={{ ...T.subhead, color: value ? palette.foreground : palette.mutedForeground }}>
          {value ? PETITION_TYPE_LABELS[value] : t('prarthnaPatra.form.selectPetitionType')}
        </Text>
        <ChevronDown size={15} color="#9CA3AF" />
      </Pressable>
      {error ? <Text style={{ ...T.caption2, color: '#DC2626', marginTop: 3 }}>{error}</Text> : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('prarthnaPatra.form.selectPetitionTypeDialog')}</AlertDialogTitle>
          </AlertDialogHeader>
          <ScrollView style={{ maxHeight: 360 }}>
            {PETITION_TYPES.map((tItem) => (
              <Pressable
                key={tItem}
                onPress={() => { onChange(tItem); setOpen(false); }}
                style={{
                  paddingVertical: T.space.md - 4, paddingHorizontal: T.space.md,
                  borderBottomWidth: 1, borderBottomColor: BORDER,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Text style={{ ...T.subhead, color: palette.foreground }}>{PETITION_TYPE_LABELS[tItem]}</Text>
                {value === tItem && <Text style={{ ...T.subhead, color: palette.primary }}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setOpen(false)}><Text>{t('common.cancel')}</Text></AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AddPrarthnaPatraScreen() {
  const { t } = useTranslation();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;

  // Theme-reactive surface tokens
  const { colorScheme: scheme } = useColorScheme();
  const palette = scheme === 'dark' ? THEME.dark : THEME.light;
  const BORDER  = palette.border;
  const SURFACE = palette.card;

  const [petitionType, setPetitionType] = useState<PetitionType | null>(null);
  const [dateOfReceipt, setDateOfReceipt] = useState(_todayString());
  // Feature 2: default deadline = today + 10 for all types
  const [deadlineDate, setDeadlineDate] = useState(() => addDays(_todayString(), 10));
  const [matter, setMatter] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [investigatorName, setInvestigatorName] = useState('');
  const [complainants, setComplainants] = useState<string>(() => initPersonGroup());
  const [accused, setAccused] = useState<string>(() => initPersonGroup());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const savedRef = useRef(false);
  /** ids of the rows read for edit — a card with one of these updates that row */
  const originalIds = useRef<Set<string>>(new Set());
  const isInitializing = useRef(true);
  const savingRef = useRef(false);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);

  const handleOcrApply = (extracted: Record<string, string>) => {
    setIsDirty(true);
    if (extracted.matter && extracted.matter.trim()) {
      setMatter((prev) => (prev ? `${prev}\n${extracted.matter}` : extracted.matter));
    }
    const addr = [extracted.complainant_address, extracted.complainant_village ? `ग्राम ${extracted.complainant_village}` : '',
      extracted.complainant_police_station ? `थाना ${extracted.complainant_police_station}` : ''].filter((v) => v && v.trim()).join(' ');
    setComplainants((prev) => ocrIntoFirst(prev, {
      name: extracted.complainant_name, father: extracted.complainant_father, mobile: extracted.complainant_mobile, address: addr,
    }));
    if (extracted.accused_name && extracted.accused_name.trim()) {
      setAccused((prev) => ocrIntoFirst(prev, { name: extracted.accused_name, father: extracted.accused_father, address: extracted.accused_address }));
    }
  };

  // Feature 2: auto-set deadline = dateOfReceipt + 10 on every type / receipt change
  const handleTypeChange = (t: PetitionType) => {
    setPetitionType(t);
    setDeadlineDate(addDays(dateOfReceipt || _todayString(), 10));
  };

  const handleReceiptDateChange = (v: string) => {
    setDateOfReceipt(v);
    setDeadlineDate(addDays(v, 10));
  };

  // Load for edit mode
  useEffect(() => {
    if (!editId) {
      isInitializing.current = false;
      return;
    }
    (async () => {
      const pp = await getPPWithDetails(editId);
      if (!pp) {
        isInitializing.current = false;
        return;
      }
      setPetitionType(pp.petition_type);
      setDateOfReceipt(pp.date_of_receipt);
      setDeadlineDate(pp.deadline_date);
      setMatter(pp.matter);
      setInvestigatorName(pp.investigator_name);
      originalIds.current = new Set([...pp.complainants.map((c) => c.id), ...pp.accused.map((a) => a.id)]);
      setComplainants(rowsToGroup(pp.complainants.map((c) => ({ ...c, father: c.father_husband_name }))));
      setAccused(rowsToGroup(pp.accused.map((a) => ({ ...a, father: a.father_name }))));
      // Fix 2: wrap in setTimeout so the dirty-state useEffect cannot fire
      // before React has flushed the batched setState calls above. Without
      // this, isInitializing.current flips to false synchronously inside the
      // async IIFE, and the subsequent render triggered by setState sees
      // isInitializing=false → incorrectly marks the form dirty on edit load.
      setTimeout(() => { isInitializing.current = false; }, 0);
    })();
  }, [editId]);

  useEffect(() => {
    if (isInitializing.current) return;
    if (!savedRef.current) setIsDirty(true);
  }, [petitionType, dateOfReceipt, deadlineDate, matter, investigatorName, complainants, accused]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDirty) { setBackDialogOpen(true); return true; }
      return false;
    });
    return () => sub.remove();
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty) { setBackDialogOpen(true); } else { router.back(); }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!petitionType) e.petitionType = t('prarthnaPatra.form.errorPetitionType');
    if (!dateOfReceipt) e.dateOfReceipt = t('prarthnaPatra.form.errorDateOfReceipt');
    if (!matter.trim()) e.matter = t('prarthnaPatra.form.errorMatter');
    if (!parsePersonGroup(complainants)[0]?.name.trim()) e.complainant0 = t('prarthnaPatra.form.errorComplainantRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    // Bug 5 fix: synchronous guard prevents a second in-flight save when the
    // user double-taps Save before the first async operation completes.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // Fix 3: safe payload — omit undefined id, strict name filter on accused,
      // keep age as string (DB column is TEXT DEFAULT '').
      const ids = (e: PersonEntry) => (originalIds.current.has(e._id ?? '') ? { id: e._id as string } : {});
      const cPayload = parsePersonGroup(complainants)
        .filter((c, i) => i === 0 || c.name.trim() !== '')
        .map((c) => {
          const { father, remarks: _r, ...row } = ppRowFromCard(c, false);
          return { ...ids(c), ...row, father_husband_name: father };
        });
      const aPayload = parsePersonGroup(accused)
        .filter((a) => a.name.trim() !== '')
        .map((a) => {
          const { father, ...row } = ppRowFromCard(a, true);
          return { ...ids(a), ...row, father_name: father, remarks: row.remarks ?? '' };
        });

      if (isEdit && editId) {
        await updatePrarthnaPatra(editId, {
          petition_type: petitionType!, date_of_receipt: dateOfReceipt,
          deadline_date: deadlineDate, matter,
          investigator_name: investigatorName,
          complainants: cPayload as Parameters<typeof updatePrarthnaPatra>[1]['complainants'],
          accused: aPayload as Parameters<typeof updatePrarthnaPatra>[1]['accused'],
        });
      } else {
        const created = await createPrarthnaPatra({
          petition_type: petitionType!, date_of_receipt: dateOfReceipt,
          deadline_date: deadlineDate, matter,
          investigator_name: investigatorName,
          complainants: cPayload,
          accused: aPayload,
        });
        if (pendingFiles.length) await addPendingAttachments('pp', created.id, pendingFiles);
      }
      savedRef.current = true;
      setIsDirty(false);
      router.back();
    } catch (err: unknown) {
      // Fix 4: retain field-level errors; show exact DB error message for easier
      // debugging instead of replacing all errors with a generic string.
      const msg = err instanceof Error ? err.message : t('prarthnaPatra.form.errorSaveFailed');
      console.error('[PP] handleSave failed:', err);
      setErrors((prev) => ({ ...prev, general: t('prarthnaPatra.form.errorPrefix', { msg }) }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <AppHeader
          title={isEdit ? t('prarthnaPatra.form.editTitle') : t('prarthnaPatra.form.addTitle')}
          subtitle={t('prarthnaPatra.form.subtitle')}
          onBack={handleBack}
          rightActions={
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: '#1E3A5F', borderRadius: 10,
                paddingHorizontal: T.space.md - 2, paddingVertical: T.space.xs + 3,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ ...T.footnote, fontWeight: T.weight.bold, color: '#fff' }}>
                {saving ? t('common.saving') : t('common.save')}
              </Text>
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errors.general ? (
            <Text style={{ ...T.footnote, color: '#DC2626', marginTop: T.space.sm }}>{errors.general}</Text>
          ) : null}

          {/* ── OCR Auto-fill Action ── */}
          <Pressable
            onPress={() => setOcrModalVisible(true)}
            className="flex-row items-center justify-between p-3.5 mb-4 rounded-2xl bg-primary/10 border border-primary/25 active:opacity-75"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-1 flex-row items-center gap-3 mr-3">
              <View className="w-9 h-9 rounded-xl bg-primary/20 items-center justify-center">
                <Sparkles size={18} color="#2D52B8" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-foreground">{t('prarthnaPatra.form.ocrScanBtn')}</Text>
                <Text className="text-[11px] text-muted-foreground">{t('prarthnaPatra.form.ocrScanDesc')}</Text>
              </View>
            </View>
            <View className="shrink-0 px-3 py-1.5 rounded-xl bg-primary">
              <Text className="text-xs font-semibold text-white">{t('prarthnaPatra.form.ocrScan')}</Text>
            </View>
          </Pressable>

          {/* ── Petition Type ── */}
          <Section title={t('prarthnaPatra.form.sectionPetitionType')} />
          <TypePicker value={petitionType} onChange={handleTypeChange} error={errors.petitionType} />

          {/* ── Petition Info ── */}
          <Section title={t('prarthnaPatra.form.sectionPetitionDetails')} />
          <Field label={t('prarthnaPatra.form.investigatorLabel')}>
            <Input
              value={investigatorName}
              onChangeText={setInvestigatorName}
              placeholder={t('prarthnaPatra.form.investigatorPlaceholder')}
            />
          </Field>

          {/* ── Dates ── */}
          <Section title={t('prarthnaPatra.form.sectionDates')} />
          <View style={{ flexDirection: 'row', gap: T.space.sm + 2 }}>
            <View style={{ flex: 1 }}>
              <DatePickerField
                label={t('prarthnaPatra.form.dateOfReceipt')}
                value={dateOfReceipt}
                onChange={handleReceiptDateChange}
                error={errors.dateOfReceipt}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DatePickerField
                label={t('prarthnaPatra.form.deadlineDate')}
                value={deadlineDate}
                onChange={setDeadlineDate}
                error={errors.deadlineDate}
                helperText={deadlineDate ? t('prarthnaPatra.form.deadlineHelper') : undefined}
              />
            </View>
          </View>

          {/* ── Complainants ── */}
          <Section title={petitionType === 'बीट सूचना' ? t('prarthnaPatra.form.sectionComplainantSourceDetails') : t('prarthnaPatra.form.sectionComplainantDetails')} />
          {errors.complainant0 ? (
            <Text style={{ ...T.caption2, color: '#DC2626', marginBottom: 4 }}>{errors.complainant0}</Text>
          ) : null}
          <View style={{ marginBottom: T.space.xs }}>
            <PersonGroupInput
              keyName="pp_avedak"
              value={complainants}
              onChange={(_k, v) => {
                setComplainants(v);
                if (errors.complainant0 && parsePersonGroup(v)[0]?.name.trim()) setErrors((prev) => ({ ...prev, complainant0: '' }));
              }}
              role="avedak"
              addressOptional
            />
          </View>

          {/* ── Matter ── */}
          <Section title={petitionType === 'NCR' ? t('prarthnaPatra.form.sectionComplaintDetails') : t('prarthnaPatra.form.sectionMatter')} />
          <View style={{ marginBottom: T.space.xs }}>
            <DocumentEditor
              value={matter}
              onChangeText={(v) => {
                setMatter(v);
                // Fix 5: clear matter error as soon as the user types
                if (errors.matter) setErrors((prev) => ({ ...prev, matter: '' }));
              }}
              title={t('prarthnaPatra.form.matterTitle')}
              placeholder={t('prarthnaPatra.form.matterPlaceholder')}
              minHeight={120}
              error={!!errors.matter}
              accessibilityLabel={t('prarthnaPatra.form.matterTitle')}
            />
            {errors.matter ? <Text style={{ ...T.caption2, color: '#DC2626', marginTop: 3 }}>{errors.matter}</Text> : null}
          </View>

          {/* ── संलग्न कागज़ (owner) — edit: saved at once; new: kept until सहेजें ── */}
          <View style={{ marginTop: T.space.sm, marginBottom: T.space.xs }}>
            <AttachmentsSection
              module="pp"
              parentId={isEdit ? editId : null}
              pending={pendingFiles}
              onPendingChange={(f) => { setPendingFiles(f); setIsDirty(true); }}
              accent="#2D52B8"
            />
          </View>

          {/* ── Accused ── */}
          <Section title={t('prarthnaPatra.form.sectionAccusedDetails')} />
          <View style={{ marginBottom: T.space.xs }}>
            <PersonGroupInput
              keyName="pp_vipakshi"
              value={accused}
              onChange={(_k, v) => setAccused(v)}
              role="vipakshi"
              addressOptional
            />
          </View>

          {/* Status note */}
          <View style={{ marginTop: T.space.md, backgroundColor: palette.muted, borderRadius: 10, padding: T.space.sm + 2 }}>
            <Text style={{ ...T.caption1, color: palette.mutedForeground, lineHeight: 18 }}>
              {t('prarthnaPatra.form.statusNote')}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Back protection dialog */}
      <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('prarthnaPatra.form.unsavedDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('prarthnaPatra.form.unsavedDialogDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialogOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => { setBackDialogOpen(false); setIsDirty(false); router.back(); }}>
              <Text>{t('common.discard')}</Text>
            </AlertDialogAction>
            <AlertDialogAction onPress={() => { setBackDialogOpen(false); handleSave(); }}>
              <Text>{t('common.save')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OcrScanModal
        visible={ocrModalVisible}
        onClose={() => setOcrModalVisible(false)}
        fields={PP_OCR_FIELDS}
        onApply={handleOcrApply}
        title={t('prarthnaPatra.form.ocrModalTitle')}
      />
    </KeyboardAvoidingView>
  );
}
