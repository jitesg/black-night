// Bug 3 fix: removed unused imports — useCallback, isActionWorkflow,
// PPComplainant, PPAccused, HeaderIconBtn.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, Pressable, KeyboardAvoidingView,
  BackHandler, Modal, FlatList,
} from 'react-native';
import { T } from '@/lib/typography';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Plus, Trash2, ChevronDown, Calendar, Copy, Sparkles } from 'lucide-react-native';
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
import { getWorkspaceSettings } from '@/lib/db/workspaceRepo';
import { getAllGramPanchayats } from '@/lib/db/gramPanchayatRepo';
import { getAllHamlets } from '@/lib/db/hamletRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// ── Constants ─────────────────────────────────────────────────────────────────
// BORDER and surface colour are theme-reactive — computed inside the component.

/** The 5 "Same As" fields shared between Complainant and Accused */
const SAME_AS_FIELDS = ['full_address', 'village', 'police_station', 'district', 'jati'] as const;

const PP_OCR_FIELDS = [
  { key: 'complainant_name', label: 'वादी का नाम (Complainant Name)' },
  { key: 'complainant_father', label: 'पिता/पति का नाम (Father/Husband Name)' },
  { key: 'complainant_mobile', label: 'मोबाइल नंबर (Mobile Number)' },
  { key: 'complainant_address', label: 'वादी का पता (Address)' },
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

// ── Form types ────────────────────────────────────────────────────────────────

interface ComplainantForm {
  _key: string; id?: string;
  name: string; father_husband_name: string; mobile: string; alternate_mobile: string;
  full_address: string; village: string; police_station: string; district: string;
  age: string; gender: string; jati: string;
}
interface AccusedForm {
  _key: string; id?: string;
  name: string; father_name: string; mobile: string; alternate_mobile: string;
  full_address: string; village: string; police_station: string; district: string;
  jati: string; age: string; gender: string; remarks: string;
}
function emptyComplainant(): ComplainantForm {
  return {
    _key: Math.random().toString(36).slice(2),
    name: '', father_husband_name: '', mobile: '', alternate_mobile: '',
    full_address: '', village: '', police_station: '', district: '',
    age: '', gender: '', jati: '',
  };
}
function emptyAccused(): AccusedForm {
  return {
    _key: Math.random().toString(36).slice(2),
    name: '', father_name: '', mobile: '', alternate_mobile: '',
    full_address: '', village: '', police_station: '', district: '',
    jati: '', age: '', gender: '', remarks: '',
  };
}

// ── UI atoms ───────────────────────────────────────────────────────────────────

function Section({ title }: { title: string }) {
  return (
    <Text style={{
      ...T.micro, letterSpacing: 1.2, textTransform: 'uppercase',
      color: '#6B7280', marginTop: T.space.lg, marginBottom: T.space.sm,
    }}>
      {title}
    </Text>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={{ ...T.caption1, color: '#6B7280', fontWeight: T.weight.medium, marginBottom: T.space.xs }}>{label}</Text>;
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
        <Text style={{ ...T.caption2, color: '#6B7280', marginTop: 3 }}>{helperText}</Text>
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
                  borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Text style={{ ...T.subhead, color: palette.foreground }}>{PETITION_TYPE_LABELS[tItem]}</Text>
                {value === tItem && <Text style={{ ...T.subhead, color: '#1E3A5F' }}>✓</Text>}
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
  const [investigatorName, setInvestigatorName] = useState('');
  const [complainants, setComplainants] = useState<ComplainantForm[]>([emptyComplainant()]);
  const [accused, setAccused] = useState<AccusedForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const savedRef = useRef(false);
  const isInitializing = useRef(true);
  const savingRef = useRef(false);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);

  const handleOcrApply = (extracted: Record<string, string>) => {
    setIsDirty(true);
    if (extracted.matter && extracted.matter.trim()) {
      setMatter((prev) => (prev ? `${prev}\n${extracted.matter}` : extracted.matter));
    }
    setComplainants((prev) => {
      const first = prev[0] ?? emptyComplainant();
      const updated: ComplainantForm = {
        ...first,
        name: extracted.complainant_name || first.name,
        father_husband_name: extracted.complainant_father || first.father_husband_name,
        mobile: extracted.complainant_mobile || first.mobile,
        full_address: extracted.complainant_address || first.full_address,
        village: extracted.complainant_village || first.village,
        police_station: extracted.complainant_police_station || first.police_station,
      };
      return [updated, ...prev.slice(1)];
    });
    if (extracted.accused_name && extracted.accused_name.trim()) {
      setAccused((prev) => {
        const first = prev[0] ?? emptyAccused();
        const updated: AccusedForm = {
          ...first,
          name: extracted.accused_name || first.name,
          father_name: extracted.accused_father || first.father_name,
          full_address: extracted.accused_address || first.full_address,
        };
        return [updated, ...prev.slice(1)];
      });
    }
  };

  // Feature 1: village suggestions from Halka (GP names + hamlet names)
  const [villageSuggestions, setVillageSuggestions] = useState<string[]>([]);
  // activeVillageField: { side: 'complainant'|'accused', idx, field }
  const [activeVillageField, setActiveVillageField] = useState<{
    side: 'complainant' | 'accused'; idx: number;
  } | null>(null);

  // Feature 1: load all GP + hamlet names once on mount
  useFocusEffect(useCallback(() => {
    (async () => {
      const [gps, hamlets] = await Promise.all([
        getAllGramPanchayats(),
        // getAllHamlets returns HamletWithGP which has .name
        getAllHamlets ? getAllHamlets() : Promise.resolve([]),
      ]);
      const names = [
        ...gps.map((g) => g.name),
        ...hamlets.map((h: { name: string }) => h.name),
      ];
      // deduplicate
      setVillageSuggestions([...new Set(names)]);
    })();
  }, []));

  // Feature 1: workspace defaults for police_station + district
  useFocusEffect(useCallback(() => {
    if (isEdit) return; // edit mode: keep existing values
    (async () => {
      const ws = await getWorkspaceSettings();
      if (!ws) return;
      const ps = ws.police_station ?? '';
      const dist = ws.district ?? '';
      if (!ps && !dist) return;
      setComplainants((prev) => prev.map((c, i) =>
        i === 0
          ? {
              ...c,
              police_station: c.police_station || ps,
              district: c.district || dist,
            }
          : c
      ));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

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
      setComplainants(
        pp.complainants.length > 0
          ? pp.complainants.map((c) => ({
              _key: c.id, id: c.id,
              name: c.name, father_husband_name: c.father_husband_name,
              mobile: c.mobile, alternate_mobile: c.alternate_mobile,
              full_address: c.full_address, village: c.village,
              police_station: c.police_station, district: c.district,
              age: c.age, gender: c.gender, jati: c.jati,
            }))
          : [emptyComplainant()]
      );
      setAccused(
        pp.accused.map((a) => ({
          _key: a.id, id: a.id,
          name: a.name, father_name: a.father_name,
          mobile: a.mobile, alternate_mobile: a.alternate_mobile,
          full_address: a.full_address, village: a.village,
          police_station: a.police_station, district: a.district,
          jati: a.jati, age: a.age, gender: a.gender, remarks: a.remarks,
        }))
      );
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

  // Feature 1: "Same As" one-time copy between Complainant[0] and Accused[0]
  const handleSameAs = () => {
    const c0 = complainants[0];
    const a0 = accused[0];
    if (!c0 && !a0) return;

    // Determine which side is more filled (complainant wins ties)
    const cFilled = SAME_AS_FIELDS.filter((f) => c0?.[f]?.trim()).length;
    const aFilled = SAME_AS_FIELDS.filter((f) => a0?.[f]?.trim()).length;

    if (cFilled >= aFilled) {
      // Copy complainant → accused[0] (create accused if none)
      const patch: Partial<AccusedForm> = {};
      SAME_AS_FIELDS.forEach((f) => { patch[f] = c0?.[f] ?? ''; });
      if (accused.length === 0) {
        setAccused([{ ...emptyAccused(), ...patch }]);
      } else {
        setAccused((prev) => prev.map((a, i) => i === 0 ? { ...a, ...patch } : a));
      }
    } else {
      // Copy accused[0] → complainant[0]
      const patch: Partial<ComplainantForm> = {};
      SAME_AS_FIELDS.forEach((f) => { patch[f] = a0?.[f] ?? ''; });
      setComplainants((prev) => prev.map((c, i) => i === 0 ? { ...c, ...patch } : c));
    }
  };

  // Feature 1: village autocomplete helpers
  const getVillageMatches = (query: string): string[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return villageSuggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  };

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
    if (!complainants[0]?.name.trim()) e.complainant0 = t('prarthnaPatra.form.errorComplainantRequired');
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
      const cPayload = complainants
        .filter((c, i) => i === 0 || (c.name && c.name.trim() !== ''))
        .map((c) => ({
          ...(c.id ? { id: c.id } : {}),
          name: (c.name || '').trim(),
          father_husband_name: c.father_husband_name,
          mobile: c.mobile,
          alternate_mobile: c.alternate_mobile,
          full_address: c.full_address,
          village: c.village,
          police_station: c.police_station,
          district: c.district,
          age: c.age,
          gender: c.gender,
          jati: c.jati,
        }));
      const aPayload = accused
        .filter((a) => a.name && a.name.trim() !== '')
        .map((a) => ({
          ...(a.id ? { id: a.id } : {}),
          name: (a.name || '').trim(),
          father_name: a.father_name,
          mobile: a.mobile,
          alternate_mobile: a.alternate_mobile,
          full_address: a.full_address,
          village: a.village,
          police_station: a.police_station,
          district: a.district,
          jati: a.jati,
          age: a.age,
          gender: a.gender,
          remarks: a.remarks,
        }));

      if (isEdit && editId) {
        await updatePrarthnaPatra(editId, {
          petition_type: petitionType!, date_of_receipt: dateOfReceipt,
          deadline_date: deadlineDate, matter,
          investigator_name: investigatorName,
          complainants: cPayload as Parameters<typeof updatePrarthnaPatra>[1]['complainants'],
          accused: aPayload as Parameters<typeof updatePrarthnaPatra>[1]['accused'],
        });
      } else {
        await createPrarthnaPatra({
          petition_type: petitionType!, date_of_receipt: dateOfReceipt,
          deadline_date: deadlineDate, matter,
          investigator_name: investigatorName,
          complainants: cPayload,
          accused: aPayload,
        });
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

  // Complainant helpers
  const updateComplainant = (idx: number, field: keyof ComplainantForm, val: string) => {
    setComplainants((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };
  const addComplainant = () => setComplainants((p) => [...p, emptyComplainant()]);
  const removeComplainant = (idx: number) => {
    if (complainants.length === 1) return;
    setComplainants((p) => p.filter((_, i) => i !== idx));
  };

  // Accused helpers
  const updateAccused = (idx: number, field: keyof AccusedForm, val: string) => {
    setAccused((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };
  const addAccused = () => setAccused((p) => [...p, emptyAccused()]);
  const removeAccused = (idx: number) => setAccused((p) => p.filter((_, i) => i !== idx));

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
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
          {complainants.map((c, idx) => {
            const villageMatches = getVillageMatches(c.village);
            const showVillageSug = activeVillageField?.side === 'complainant' && activeVillageField.idx === idx && villageMatches.length > 0;
            return (
              <View
                key={c._key}
                style={{
                  borderWidth: 1, borderColor: BORDER, borderRadius: 14,
                  padding: T.space.md - 2, marginBottom: T.space.sm + 2, backgroundColor: SURFACE,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: T.space.sm + 2 }}>
                  <Text style={{ ...T.footnote, fontWeight: T.weight.semibold, color: palette.foreground }}>
                    {t('prarthnaPatra.form.complainantCardTitle', { number: idx + 1 })}
                  </Text>
                  {complainants.length > 1 && (
                    <Pressable onPress={() => removeComplainant(idx)}>
                      <Trash2 size={15} color="#DC2626" />
                    </Pressable>
                  )}
                </View>
                <Field label={t('prarthnaPatra.form.fieldName')} error={idx === 0 ? errors.complainant0 : undefined}>
                  <Input
                    value={c.name}
                    onChangeText={(v) => {
                      updateComplainant(idx, 'name', v);
                      // Fix 5: clear complainant0 error as soon as the user types
                      if (idx === 0 && errors.complainant0) setErrors((prev) => ({ ...prev, complainant0: '' }));
                    }}
                    placeholder={t('prarthnaPatra.form.fieldFullName')}
                  />
                </Field>
                <Field label={t('prarthnaPatra.form.fieldFatherHusband')}>
                  <Input value={c.father_husband_name} onChangeText={(v) => updateComplainant(idx, 'father_husband_name', v)} placeholder={t('prarthnaPatra.form.placeholderFatherHusband')} />
                </Field>
                <View style={{ flexDirection: 'row', gap: T.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldMobile')}>
                      <Input type="mobile" value={c.mobile} onChangeText={(v) => updateComplainant(idx, 'mobile', v)} placeholder={t('prarthnaPatra.form.fieldMobile')} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldAltMobile')}>
                      <Input type="mobile" value={c.alternate_mobile} onChangeText={(v) => updateComplainant(idx, 'alternate_mobile', v)} placeholder={t('prarthnaPatra.form.fieldAltMobile')} />
                    </Field>
                  </View>
                </View>
                <Field label={t('prarthnaPatra.form.fieldFullAddress')}>
                  <Input type="multiline" value={c.full_address} onChangeText={(v) => updateComplainant(idx, 'full_address', v)} numberOfLines={2} placeholder={t('prarthnaPatra.form.fieldFullAddress')} />
                </Field>
                {/* Village with autocomplete */}
                <View>
                  <Field label={t('prarthnaPatra.form.fieldVillage')}>
                    <Input
                      value={c.village}
                      onChangeText={(v) => {
                        updateComplainant(idx, 'village', v);
                        setActiveVillageField({ side: 'complainant', idx });
                      }}
                      onFocus={() => setActiveVillageField({ side: 'complainant', idx })}
                      onBlur={() => setActiveVillageField(null)}
                      placeholder={t('prarthnaPatra.form.placeholderVillage')}
                    />
                  </Field>
                  {showVillageSug && (
                    <View style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      zIndex: 999,
                      borderWidth: 1, borderColor: BORDER, borderRadius: 10,
                      backgroundColor: SURFACE, marginTop: 2,
                      overflow: 'hidden',
                    }}>
                      {villageMatches.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            updateComplainant(idx, 'village', s);
                            setActiveVillageField(null);
                          }}
                          onPressIn={() => {
                            updateComplainant(idx, 'village', s);
                            setActiveVillageField(null);
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
                        >
                          <Text style={{ ...T.footnote, color: palette.foreground }}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: T.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldDistrict')}>
                      <Input value={c.district} onChangeText={(v) => updateComplainant(idx, 'district', v)} placeholder={t('prarthnaPatra.form.fieldDistrict')} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldPoliceStation')}>
                      <Input value={c.police_station} onChangeText={(v) => updateComplainant(idx, 'police_station', v)} placeholder={t('prarthnaPatra.form.fieldPoliceStation')} />
                    </Field>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: T.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldCaste')}>
                      <Input value={c.jati} onChangeText={(v) => updateComplainant(idx, 'jati', v)} placeholder={t('prarthnaPatra.form.fieldCaste')} />
                    </Field>
                  </View>
                  <View style={{ width: 68 }}>
                    <Field label={t('prarthnaPatra.form.fieldAge')}>
                      <Input type="age" value={c.age} onChangeText={(v) => updateComplainant(idx, 'age', v)} placeholder={t('prarthnaPatra.form.fieldAge')} />
                    </Field>
                  </View>
                  <View style={{ width: 84 }}>
                    <Field label={t('prarthnaPatra.form.fieldGender')}>
                      <Input value={c.gender} onChangeText={(v) => updateComplainant(idx, 'gender', v)} placeholder={t('prarthnaPatra.form.placeholderGender')} />
                    </Field>
                  </View>
                </View>
              </View>
            );
          })}
          <Pressable
            onPress={addComplainant}
            style={{
              borderWidth: 1, borderStyle: 'dashed', borderColor: BORDER,
              borderRadius: 10, padding: T.space.sm + 3, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: T.space.sm - 2, marginBottom: T.space.xs,
            }}
          >
            <Plus size={14} color="#6B7280" />
            <Text style={{ ...T.footnote, color: '#6B7280' }}>{t('prarthnaPatra.form.addAnotherComplainant')}</Text>
          </Pressable>

          {/* ── Same As Toggle ── */}
          <Pressable
            onPress={handleSameAs}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: T.space.sm - 2, paddingVertical: T.space.sm + 2,
              borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
              backgroundColor: '#F9FAFB', marginVertical: T.space.sm,
            }}
          >
            <Copy size={13} color="#4B5563" />
            <Text style={{ ...T.footnote, color: '#4B5563', fontWeight: T.weight.medium }}>
              {t('prarthnaPatra.form.sameAs')}
            </Text>
          </Pressable>

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

          {/* ── Accused ── */}
          <Section title={t('prarthnaPatra.form.sectionAccusedDetails')} />
          {accused.map((a, idx) => {
            const villageMatches = getVillageMatches(a.village);
            const showVillageSug = activeVillageField?.side === 'accused' && activeVillageField.idx === idx && villageMatches.length > 0;
            return (
              <View
                key={a._key}
                style={{
                  borderWidth: 1, borderColor: BORDER, borderRadius: 14,
                  padding: T.space.md - 2, marginBottom: T.space.sm + 2, backgroundColor: SURFACE,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: T.space.sm + 2 }}>
                  <Text style={{ ...T.footnote, fontWeight: T.weight.semibold, color: palette.foreground }}>
                    {t('prarthnaPatra.form.accusedCardTitle', { number: idx + 1 })}
                  </Text>
                  <Pressable onPress={() => removeAccused(idx)}>
                    <Trash2 size={15} color="#DC2626" />
                  </Pressable>
                </View>
                <Field label={t('prarthnaPatra.form.fieldNameOptional')}>
                  <Input value={a.name} onChangeText={(v) => updateAccused(idx, 'name', v)} placeholder={t('prarthnaPatra.form.fieldFullName')} />
                </Field>
                <Field label={t('prarthnaPatra.form.fieldFatherName')}>
                  <Input value={a.father_name} onChangeText={(v) => updateAccused(idx, 'father_name', v)} placeholder={t('prarthnaPatra.form.placeholderFatherName')} />
                </Field>
                <View style={{ flexDirection: 'row', gap: T.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldMobile')}>
                      <Input type="mobile" value={a.mobile} onChangeText={(v) => updateAccused(idx, 'mobile', v)} placeholder={t('prarthnaPatra.form.fieldMobile')} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldAltMobile')}>
                      <Input type="mobile" value={a.alternate_mobile} onChangeText={(v) => updateAccused(idx, 'alternate_mobile', v)} placeholder={t('prarthnaPatra.form.fieldAltMobile')} />
                    </Field>
                  </View>
                </View>
                <Field label={t('prarthnaPatra.form.fieldFullAddress')}>
                  <Input type="multiline" value={a.full_address} onChangeText={(v) => updateAccused(idx, 'full_address', v)} numberOfLines={2} placeholder={t('prarthnaPatra.form.fieldFullAddress')} />
                </Field>
                {/* Village with autocomplete */}
                <View>
                  <Field label={t('prarthnaPatra.form.fieldVillage')}>
                    <Input
                      value={a.village}
                      onChangeText={(v) => {
                        updateAccused(idx, 'village', v);
                        setActiveVillageField({ side: 'accused', idx });
                      }}
                      onFocus={() => setActiveVillageField({ side: 'accused', idx })}
                      onBlur={() => setActiveVillageField(null)}
                      placeholder={t('prarthnaPatra.form.placeholderVillage')}
                    />
                  </Field>
                  {showVillageSug && (
                    <View style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      zIndex: 999,
                      borderWidth: 1, borderColor: BORDER, borderRadius: 10,
                      backgroundColor: SURFACE, marginTop: 2,
                      overflow: 'hidden',
                    }}>
                      {villageMatches.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            updateAccused(idx, 'village', s);
                            setActiveVillageField(null);
                          }}
                          onPressIn={() => {
                            updateAccused(idx, 'village', s);
                            setActiveVillageField(null);
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
                        >
                          <Text style={{ ...T.footnote, color: palette.foreground }}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: T.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldDistrict')}>
                      <Input value={a.district} onChangeText={(v) => updateAccused(idx, 'district', v)} placeholder={t('prarthnaPatra.form.fieldDistrict')} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldPoliceStation')}>
                      <Input value={a.police_station} onChangeText={(v) => updateAccused(idx, 'police_station', v)} placeholder={t('prarthnaPatra.form.fieldPoliceStation')} />
                    </Field>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: T.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('prarthnaPatra.form.fieldCaste')}>
                      <Input value={a.jati} onChangeText={(v) => updateAccused(idx, 'jati', v)} placeholder={t('prarthnaPatra.form.fieldCaste')} />
                    </Field>
                  </View>
                  <View style={{ width: 72 }}>
                    <Field label={t('prarthnaPatra.form.fieldAge')}>
                      <Input type="age" value={a.age} onChangeText={(v) => updateAccused(idx, 'age', v)} placeholder={t('prarthnaPatra.form.fieldAge')} />
                    </Field>
                  </View>
                  <View style={{ width: 84 }}>
                    <Field label={t('prarthnaPatra.form.fieldGender')}>
                      <Input value={a.gender} onChangeText={(v) => updateAccused(idx, 'gender', v)} placeholder={t('prarthnaPatra.form.placeholderGender')} />
                    </Field>
                  </View>
                </View>
                <Field label={t('prarthnaPatra.form.fieldRemarks')}>
                  <Input type="multiline" value={a.remarks} onChangeText={(v) => updateAccused(idx, 'remarks', v)} numberOfLines={2} placeholder={t('prarthnaPatra.form.fieldRemarks')} />
                </Field>
              </View>
            );
          })}
          <Pressable
            onPress={addAccused}
            style={{
              borderWidth: 1, borderStyle: 'dashed', borderColor: BORDER,
              borderRadius: 10, padding: T.space.sm + 3, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: T.space.sm - 2, marginBottom: T.space.xs,
            }}
          >
            <Plus size={14} color="#6B7280" />
            <Text style={{ ...T.footnote, color: '#6B7280' }}>{t('prarthnaPatra.form.addAnotherAccused')}</Text>
          </Pressable>

          {/* Status note */}
          <View style={{ marginTop: T.space.md, backgroundColor: '#F3F4F6', borderRadius: 10, padding: T.space.sm + 2 }}>
            <Text style={{ ...T.caption1, color: '#6B7280', lineHeight: 18 }}>
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
