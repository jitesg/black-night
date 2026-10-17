import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import {
  BackHandler, View, Text, ScrollView, Pressable, KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { router, useFocusEffect } from 'expo-router';
import {
  navigateToFIRTab,
} from '@/lib/firNavigation';
import {
  Plus, Trash2, ChevronDown, User, MapPin, Edit2, Sparkles,
} from 'lucide-react-native';
import { OcrScanModal } from '@/components/common/OcrScanModal';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { createFIR } from '@/lib/db/firRepo';
import { createAccused } from '@/lib/db/firAccusedRepo';
import { seedFIRKaryvahi } from '@/lib/db/firKaryvahiRepo';
import { getDatabase, getDbInstanceTag } from '@/lib/db/database';
import { getFlatCrimeTypes, type CrimeTypeMeta } from '@/lib/db/checklistRepo';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import { recordFieldValue, FIELD_KEYS } from '@/lib/db/fieldValueHistoryRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { FIRSectionAssistant, FIRSuggesterButton } from '@/components/law/FIRSectionAssistant';

// ─── Types ────────────────────────────────────────────────────────────────────

const FIR_OCR_FIELDS = [
  { key: 'fir_number', label: 'मुकदमा/FIR संख्या (FIR Number)' },
  { key: 'section', label: 'धाराएं (Sections / Acts)' },
  { key: 'complainant_name', label: 'वादी का नाम (Complainant Name)' },
  { key: 'complainant_address', label: 'वादी का पता (Complainant Address)' },
  { key: 'complainant_mobile', label: 'वादी का मोबाइल (Complainant Mobile)' },
  { key: 'ghatnasthal', label: 'घटनास्थल (Place of Occurrence)' },
  { key: 'accused_name', label: 'आरोपी/अभियुक्त का नाम (Accused Name)' },
  { key: 'accused_address', label: 'आरोपी का पता (Accused Address)' },
  { key: 'mukadma_saransh', label: 'मुकदमा सारांश (FIR Summary)' },
];

interface KnownAccused {
  id: string;
  name: string;
  address: string;
  mobile: string;
  altMobile: string;
  jati: string;
  age: string;
  bailStatus: 'unknown' | 'in_jail' | 'on_bail';
  remandNumber: string;
  dateOfRemand: string;
  nextRemandDate: string;
}

function mkAccused(): KnownAccused {
  return {
    id: Math.random().toString(36).slice(2),
    name: '', address: '', mobile: '', altMobile: '',
    jati: '', age: '', bailStatus: 'unknown',
    remandNumber: '', dateOfRemand: '', nextRemandDate: '',
  };
}

// ─── Small reusable helpers ───────────────────────────────────────────────────

function Field({ label, children, rightAction }: { label: string; children: React.ReactNode; rightAction?: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Text>
        {rightAction}
      </View>
      {children}
    </View>
  );
}

// ── CollapsibleDocumentBox ────────────────────────────────────────────────────
// Always starts collapsed; tap strip to expand, "सहेजें / छोटा करें" to minimize.
function CollapsibleDocumentBox({
  label, value, onChangeText, placeholder,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
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

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="py-3 border-b border-border mb-4">
      <Text className="text-base font-bold text-foreground">{title}</Text>
    </View>
  );
}

function SelectDropdown({
  label, value, options, placeholder, onSelect,
}: {
  label: string; value: string; options: readonly string[] | string[];
  placeholder?: string;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const displayPlaceholder = placeholder ?? `Select ${label}`;
  return (
    <Field label={label}>
      <Pressable
        onPress={() => { if (options.length > 0) setOpen(!open); }}
        className="flex-row items-center justify-between bg-secondary rounded-xl px-4 py-3 active:opacity-70"
      >
        <Text className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || displayPlaceholder}
        </Text>
        <ChevronDown size={16} color="#6B7280" />
      </Pressable>
      {open && options.length > 0 && (
        <View className="bg-card border border-border rounded-2xl mt-1 overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); setOpen(false); }}
              className="px-4 py-3 border-b border-border active:bg-secondary"
            >
              <Text className={`text-sm ${value === opt ? 'font-bold' : ''}`}
                style={{ color: value === opt ? '#6366F1' : '#111827' }}
              >{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Field>
  );
}

// ─── Flat Crime Type multi-select ─────────────────────────────────────────────
// Replaces the old two-level NestedCrimeTypeSelect + SubTypePicker.
// Each row shows "name_hi / name_en" (primary language first).
// Selection is stored as a flat string[] of crime-type ids.

function FlatCrimeTypeSelect({
  label,
  options,
  selectedIds,
  placeholder,
  onToggle,
}: {
  label: string;
  options: CrimeTypeMeta[];
  selectedIds: string[];
  placeholder?: string;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const displayPlaceholder = placeholder ?? t('fir.addFir.selectCrimeTypes');

  // Map id → meta for chip labels
  const metaById = new Map(options.map((o) => [o.id, o]));

  return (
    <Field label={label}>
      {/* Trigger row */}
      <Pressable
        onPress={() => { if (options.length > 0) setOpen((o) => !o); }}
        className="flex-row items-center justify-between bg-secondary rounded-xl px-4 py-3 active:opacity-70"
      >
        <Text className={`text-sm ${selectedIds.length > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selectedIds.length > 0
            ? t('fir.addFir.crimeTypesSelected_other', { count: selectedIds.length })
            : displayPlaceholder}
        </Text>
        <ChevronDown size={16} color="#6B7280" />
      </Pressable>

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 pt-1">
          {selectedIds.map((id) => {
            const meta = metaById.get(id);
            if (!meta) return null;
            return (
              <Pressable
                key={id}
                onPress={() => onToggle(id)}
                className="flex-row items-center gap-1 rounded-full px-3 py-1 active:opacity-70"
                style={{ backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' }}
              >
                <Text className="text-xs font-medium" style={{ color: '#6366F1' }}>{meta.name_hi}</Text>
                <Text className="text-xs font-bold ml-0.5" style={{ color: '#6366F1' }}>×</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Dropdown list */}
      {open && options.length > 0 && (
        <View
          className="bg-card border border-border rounded-2xl mt-1 overflow-hidden"
          style={{ borderCurve: 'continuous' }}
        >
          {options.map((opt, idx) => {
            const checked = selectedIds.includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => onToggle(opt.id)}
                className={`flex-row items-center gap-3 px-4 py-3 active:bg-secondary ${idx < options.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View
                  className="w-5 h-5 rounded items-center justify-center"
                  style={{
                    backgroundColor: checked ? '#6366F1' : '#fff',
                    borderWidth: 1.5,
                    borderColor: checked ? '#6366F1' : '#D1D5DB',
                  }}
                >
                  {checked && (
                    <Text className="text-white font-bold" style={{ fontSize: 11, lineHeight: 14 }}>✓</Text>
                  )}
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text
                    className="text-sm"
                    style={{ color: checked ? '#6366F1' : '#111827', fontWeight: checked ? '700' : '400' }}
                    numberOfLines={1}
                  >
                    {opt.name_hi}
                  </Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {opt.name_en}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setOpen(false)}
            className="items-center py-3 border-t border-border bg-secondary active:opacity-70"
          >
            <Text className="text-sm font-bold" style={{ color: '#6366F1' }}>{t('fir.addFir.done')}</Text>
          </Pressable>
        </View>
      )}
    </Field>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [show, setShow] = useState(false);
  const cleanLabel = label.replace(/\s*\*+\s*$/, '');
  const placeholder = isHi ? 'तारीख चुनें' : 'Select date';
  return (
    <Field label={label}>
      <Pressable
        onPress={() => setShow(true)}
        className="bg-secondary rounded-xl px-4 py-3 active:opacity-70 flex-row items-center justify-between"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || placeholder}
        </Text>
        <ChevronDown size={14} color="#9CA3AF" />
      </Pressable>
      <DatePickerModal
        visible={show}
        value={value}
        label={cleanLabel}
        onConfirm={(v) => { onChange(v); setShow(false); }}
        onClose={() => setShow(false)}
      />
    </Field>
  );
}

// ─── Accused card ─────────────────────────────────────────────────────────────

function AccusedCard({
  accused, index, onChange, onRemove,
}: {
  accused: KnownAccused; index: number;
  onChange: (id: string, field: keyof KnownAccused, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const BAIL_OPTIONS = [
    { label: t('fir.addFir.bailUnknown'), value: 'unknown' },
    { label: t('fir.addFir.bailInJail'), value: 'in_jail' },
    { label: t('fir.addFir.bailOnBail'), value: 'on_bail' },
  ];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-3" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="w-7 h-7 rounded-full bg-secondary items-center justify-center">
            <User size={14} color="#6B7280" />
          </View>
          <Text className="text-sm font-semibold text-foreground">{t('fir.addFir.accusedLabel', { n: index + 1 })}</Text>
        </View>
        <Pressable onPress={() => onRemove(accused.id)} className="p-1 active:opacity-60">
          <Trash2 size={16} color="#DC2626" />
        </Pressable>
      </View>

      <Field label={t('fir.addFir.fieldAccusedName')}>
        <Input value={accused.name} onChangeText={(v) => onChange(accused.id, 'name', v)} placeholder={t('fir.addFir.namePlaceholder')} />
      </Field>
      <Field label={t('fir.addFir.fieldAccusedAddress')}>
        <Input type="multiline" value={accused.address} onChangeText={(v) => onChange(accused.id, 'address', v)} placeholder={t('fir.addFir.addressPlaceholder')} numberOfLines={2} />
      </Field>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label={t('fir.addFir.fieldAccusedMobile')}>
            <Input type="mobile" value={accused.mobile} onChangeText={(v) => onChange(accused.id, 'mobile', v)} placeholder={t('fir.addFir.mobilePlaceholder')} />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={t('fir.addFir.fieldAccusedAltMobile')}>
            <Input type="mobile" value={accused.altMobile} onChangeText={(v) => onChange(accused.id, 'altMobile', v)} placeholder={t('fir.addFir.altMobilePlaceholder')} />
          </Field>
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label={t('fir.addFir.fieldAccusedJati')}>
            <Input value={accused.jati} onChangeText={(v) => onChange(accused.id, 'jati', v)} placeholder={t('fir.addFir.jatiPlaceholder')} />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={t('fir.addFir.fieldAccusedAge')}>
            <Input type="age" value={accused.age} onChangeText={(v) => onChange(accused.id, 'age', v)} placeholder={t('fir.addFir.agePlaceholder')} />
          </Field>
        </View>
      </View>

      {/* Status */}
      <Field label={t('fir.addFir.fieldBailStatus')}>
        <View className="flex-row flex-wrap gap-2">
          {BAIL_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => onChange(accused.id, 'bailStatus', opt.value)}
              className="rounded-full px-3 py-1.5 border active:opacity-70"
              style={{
                borderColor: accused.bailStatus === opt.value ? '#6366F1' : '#E5E7EB',
                backgroundColor: accused.bailStatus === opt.value ? '#EEF2FF' : '#fff',
              }}
            >
              <Text className="text-xs font-medium" style={{ color: accused.bailStatus === opt.value ? '#6366F1' : '#6B7280' }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Field>

      {accused.bailStatus === 'in_jail' && (
        <>
          <Field label={t('fir.addFir.fieldRemandNumber')}>
            <Input value={accused.remandNumber} onChangeText={(v) => onChange(accused.id, 'remandNumber', v)} placeholder={t('fir.addFir.fieldRemandNumber')} />
          </Field>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField label={t('fir.addFir.fieldDateOfRemand')} value={accused.dateOfRemand} onChange={(v) => onChange(accused.id, 'dateOfRemand', v)} />
            </View>
            <View className="flex-1">
              <DateField label={t('fir.addFir.fieldNextRemandDate')} value={accused.nextRemandDate} onChange={(v) => onChange(accused.id, 'nextRemandDate', v)} />
            </View>
          </View>
          {accused.nextRemandDate ? (
            <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <Text className="text-xs text-amber-700">⏰ Reminder set for next remand: {accused.nextRemandDate}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AddFIRScreen() {
  const { t } = useTranslation();
  const [firNumber, setFirNumber] = useState('');
  const [section, setSection] = useState('');
  const [isSuggesterOpen, setIsSuggesterOpen] = useState(false);
  // Complainant
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cMobile, setCMobile] = useState('');
  const [cAltMobile, setCAltMobile] = useState('');
  const [cJati, setCJati] = useState('');
  const [cAge, setCAge] = useState('');
  // Incident
  const [ghatnasthal, setGhatnasthal] = useState('');
  // selectedCrimeTypeIds: flat array of crime-type ids (v2)
  const [selectedCrimeTypeIds, setSelectedCrimeTypeIds] = useState<string[]>([]);
  // flatCrimeTypes: bilingual list for the picker (synchronous, from bundled seed)
  const [flatCrimeTypes, setFlatCrimeTypes] = useState<CrimeTypeMeta[]>([]);
  const [dateOccurrence, setDateOccurrence] = useState('');
  const [timeOccurrence, setTimeOccurrence] = useState('');
  const [dateInformation, setDateInformation] = useState('');
  const [timeInformation, setTimeInformation] = useState('');
  // Accused
  const [accusedType, setAccusedType] = useState<'known' | 'unknown'>('known');
  const [knownAccused, setKnownAccused] = useState<KnownAccused[]>([mkAccused()]);
  const [unknownCount, setUnknownCount] = useState('');
  // Forms
  const [nakalChick, setNakalChick] = useState('');
  const [nakalRapat, setNakalRapat] = useState('');
  const [mukadmaSaransh, setMukadmaSaransh] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Fix 1 & 2: track partial-save state so retry skips createFIR() and shows
  // a step-specific message instead of a generic one.
  const [partialFirId, setPartialFirId] = useState<string | null>(null);
  type FailedStep = 'karyvahi' | 'accused' | 'navigation' | null;
  const [failedStep, setFailedStep] = useState<FailedStep>(null);
  // ── Unsaved-changes protection ───────────────────────────────────────────
  const isDirty = useRef(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);

  const handleOcrApply = (extracted: Record<string, string>) => {
    isDirty.current = true;
    if (extracted.fir_number) setFirNumber(extracted.fir_number);
    if (extracted.section) setSection(extracted.section);
    if (extracted.complainant_name) setCName(extracted.complainant_name);
    if (extracted.complainant_address) setCAddress(extracted.complainant_address);
    if (extracted.complainant_mobile) setCMobile(extracted.complainant_mobile);
    if (extracted.ghatnasthal) setGhatnasthal(extracted.ghatnasthal);
    if (extracted.mukadma_saransh) setMukadmaSaransh(extracted.mukadma_saransh);
    if (extracted.accused_name && extracted.accused_name.trim()) {
      setKnownAccused((prev) => {
        const first = prev[0] ?? mkAccused();
        const updated: KnownAccused = {
          ...first,
          name: extracted.accused_name || first.name,
          address: extracted.accused_address || first.address,
        };
        return [updated, ...prev.slice(1)];
      });
    }
  };

  useEffect(() => {
    setFlatCrimeTypes(getFlatCrimeTypes());
  }, []);

  // ── Back navigation with unsaved-changes guard ───────────────────────────
  const handleBackPress = useCallback(() => {
    if (isDirty.current) { setShowDiscardDialog(true); } else { router.back(); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) { setShowDiscardDialog(true); return true; }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const updateAccused = useCallback((id: string, field: keyof KnownAccused, value: string) => {
    isDirty.current = true;
    setKnownAccused((prev) => prev.map((a) => a.id === id ? { ...a, [field]: value } : a));
  }, []);

  const removeAccused = useCallback((id: string) => {
    isDirty.current = true;
    setKnownAccused((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSave = async () => {
    if (!firNumber.trim()) { setError(t('fir.addFir.errorFIRRequired')); return; }
    if (!section.trim()) { setError(t('fir.addFir.errorSectionRequired')); return; }
    if (!cName.trim()) { setError(t('fir.addFir.errorNameRequired')); return; }

    if (selectedCrimeTypeIds.length === 0) { setError(t('fir.addFir.errorCrimeRequired')); return; }

    // Flat v2 encoding: "murder|robbery|ndps" — pipe-separated ids, no colons
    const encodedCrimeType = selectedCrimeTypeIds.join('|');

    // Chronology: Date of Occurrence must not be later than Date of Information
    if (dateOccurrence && dateInformation) {
      if (new Date(dateOccurrence) > new Date(dateInformation)) {
        setError('घटना की तारीख (Date of Occurrence) एफआईआर दर्ज तारीख (Date of Information) से बाद की नहीं हो सकती।');
        return;
      }
    }

    // Fix 3: validate unknown accused count before touching the DB.
    if (accusedType === 'unknown' && unknownCount.trim() !== '') {
      const parsed = parseInt(unknownCount.trim(), 10);
      if (isNaN(parsed) || parsed < 0 || String(parsed) !== unknownCount.trim()) {
        setError('Enter a valid number for unknown accused count');
        return;
      }
    }

    // Phase 3: strict enforcement — at least one accused must have a name
    if (accusedType === 'known') {
      const validCount = knownAccused.filter((a) => a.name.trim()).length;
      if (validCount === 0) {
        setError('Please enter a name for at least one accused.');
        return;
      }
      const incomplete = knownAccused.find(
        (a) =>
          !a.name.trim() &&
          (a.address.trim() || a.mobile.trim() || a.altMobile.trim() ||
           a.jati.trim()   || a.age.trim())
      );
      if (incomplete) {
        setError('Please enter a name for all added accused, or remove the empty one');
        return;
      }
    }

    setError('');
    setSaving(true);

    // ── TRACE INSTRUMENTATION ─────────────────────────────────────────────────
    const now = () => Date.now();
    logger.warn(`[TRACE] T0 handleSave START partialFirId=${partialFirId ?? 'null'} t=${now()}`);

    // Local mirrors of the two state variables.
    // React state setters (setPartialFirId / setFailedStep) only schedule a
    // re-render — they do NOT mutate the closure-captured values within this
    // same function call.  Without these locals, the outer catch block would
    // still read the OLD (pre-setter) values on the very first failure, showing
    // the generic "Failed to save FIR" message instead of the step-specific one.
    // These locals are kept in sync with every setter call so the outer catch
    // always reads the true current value regardless of render timing.
    let resolvedFirId: string | null = partialFirId;
    let localFailedStep: FailedStep = null;

    try {
      let firId: string;

      if (partialFirId) {
        // Fix 1: FIR row already exists from a previous failed attempt —
        // skip createFIR() entirely so we never create a duplicate.
        firId = partialFirId;
        logger.warn(`[TRACE] T1 SKIP createFIR — resuming with existing firId="${firId}" t=${now()}`);
      } else {
        // ── Step 1: Create the FIR row ──────────────────────────────────
        const t1a = now();
        const fir = await createFIR({
          fir_number: firNumber.trim(),
          section: section.trim(),
          complainant_name: cName.trim(),
          complainant_address: cAddress,
          complainant_mobile: cMobile,
          complainant_alt_mobile: cAltMobile,
          complainant_jati: cJati,
          complainant_age: cAge,
          ghatnasthal,
          crime_type: encodedCrimeType,
          date_of_occurrence: dateOccurrence,
          time_of_occurrence: timeOccurrence,
          date_of_information: dateInformation,
          time_of_information: timeInformation,
          nakal_chick: nakalChick,
          nakal_rapat: nakalRapat,
          mukadma_saransh: mukadmaSaransh.trim() || undefined,
          unknown_accused_count:
            accusedType === 'unknown' ? parseInt(unknownCount || '0', 10) : 0,
        });
        firId = fir.id;
        // Persist to state so the NEXT button press (new function call) resumes here.
        setPartialFirId(firId);
        // Mirror into local so the outer catch in THIS call sees it immediately.
        resolvedFirId = firId;
        logger.warn(
          `[TRACE] T1 FIR INSERT done` +
          ` id="${firId}"` +
          ` crime_type="${fir.crime_type}"` +
          ` elapsed=${now() - t1a}ms t=${now()}`
        );      }

      // ── Step 2: Seed all Karyvahi ────────────────────────────────────────
      // Re-run on every retry — seedFIRKaryvahi is idempotent (INSERT OR IGNORE).
      const t2a = now();
      logger.warn(`[TRACE] T2a seedFIRKaryvahi CALL firId="${firId}" t=${t2a}`);
      try {
        await seedFIRKaryvahi(firId, encodedCrimeType);
        logger.warn(`[TRACE] T2b seedFIRKaryvahi OK elapsed=${now() - t2a}ms t=${now()}`);

        // ── Q1+Q3 PROBE ──────────────────────────────────────────────────
        {
          const _dbQ1 = await getDatabase();
          const _tagQ1 = getDbInstanceTag();
          const _rowsQ1 = await _dbQ1.getAllAsync<{ id: string }>(
            'SELECT id FROM fir_karyvahi WHERE fir_id = ?', [firId]
          );
          logger.warn(
            `[TRACE] Q1+Q3 post-seed SELECT rows=${_rowsQ1.length}` +
            ` instance="${_tagQ1}" firId="${firId}" t=${now()}`
          );
        }
      } catch (seedErr) {
        logger.error(`[TRACE] T2b seedFIRKaryvahi FAILED elapsed=${now() - t2a}ms t=${now()}`, seedErr);
        setFailedStep('karyvahi');
        localFailedStep = 'karyvahi';
        throw seedErr;
      }

      // ── Step 3: Save known accused ──────────────────────────────────────
      const t3a = now();
      let accusedCount = 0;
      try {
        if (accusedType === 'known') {
          for (const a of knownAccused) {
            // Fix 4 guard already ran above — any card reaching here either
            // has a name or has all fields blank; skip the blank-all-fields ones.
            if (!a.name.trim()) continue;
            await createAccused({
              fir_id: firId, is_known: 1,
              name: a.name, address: a.address, mobile: a.mobile,
              alt_mobile: a.altMobile, jati: a.jati, age: a.age,
              bail_status: a.bailStatus, remand_number: a.remandNumber,
              date_of_remand: a.dateOfRemand, next_remand_date: a.nextRemandDate,
            });
            accusedCount++;
          }
        }
        logger.warn(`[TRACE] T3 accused INSERTs done count=${accusedCount} elapsed=${now() - t3a}ms t=${now()}`);
      } catch (accusedErr) {
        logger.error(`[TRACE] T3 accused INSERT FAILED elapsed=${now() - t3a}ms t=${now()}`, accusedErr);
        setFailedStep('accused');
        localFailedStep = 'accused';
        throw accusedErr;
      }

      // ── Step 4: Navigate ─────────────────────────────────────────────────
      // navigateToFIRTab uses the {pathname, params} object form so expo-router
      // injects firId by value — prevents the transient undefined firId flash.
      try {
        logger.warn(`[TRACE] T4 navigateToFIRTab CALL — ALL DB writes complete. firId="${firId}" t=${now()}`);
        navigateToFIRTab('karyvahi', firId, 'replace');
        logger.warn(`[TRACE] T4 navigateToFIRTab RETURNED (action queued) t=${now()}`);
      } catch (navErr) {
        logger.error(`[TRACE] T4 navigateToFIRTab FAILED t=${now()}`, navErr);
        setFailedStep('navigation');
        localFailedStep = 'navigation';
        throw navErr;
      }

      // All steps succeeded — clear partial-save state.
      setPartialFirId(null);
      setFailedStep(null);

      // ── Record field values for autocomplete (fire-and-forget) ──────────
      (async () => {
        try {
          await recordFieldValue(FIELD_KEYS.fir_number, firNumber.trim());
          await recordFieldValue(FIELD_KEYS.section,    section.trim());
          await recordFieldValue(FIELD_KEYS.person_name, cName.trim());
          await recordFieldValue(FIELD_KEYS.address,    cAddress.trim());
          await recordFieldValue(FIELD_KEYS.caste,      cJati.trim());
          await recordFieldValue(FIELD_KEYS.address,    ghatnasthal.trim());
          if (accusedType === 'known') {
            for (const a of knownAccused) {
              if (!a.name.trim()) continue;
              await recordFieldValue(FIELD_KEYS.person_name, a.name.trim());
              await recordFieldValue(FIELD_KEYS.address,     a.address.trim());
              await recordFieldValue(FIELD_KEYS.caste,       a.jati.trim());
            }
          }
        } catch { /* non-critical */ }
      })();

    } catch (e) {
      logger.warn('[AddFIR] handleSave error:', e);

      // Use local variables (not state) — state setters called above have NOT
      // yet flushed to the closure-captured values within this function call.
      if (resolvedFirId || localFailedStep) {
        const stepMsg =
          localFailedStep === 'karyvahi'   ? t('fir.addFir.errorKaryvahiFailed') :
          localFailedStep === 'accused'    ? t('fir.addFir.errorAccusedFailed') :
          localFailedStep === 'navigation' ? t('fir.addFir.errorNavFailed') :
          t('fir.addFir.errorSetupIncomplete');
        setError(
          `${t('fir.addFir.errorSavedButIncomplete')} ${stepMsg} ` +
          t('fir.addFir.errorRetry')
        );
      } else {
        setError(t('fir.addFir.errorFallback'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1 bg-background">
      {/* ── Discard-changes confirmation ─────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.addFir.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fir.addFir.discardDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              {t('fir.addFir.discardCancel')}
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>
              {t('fir.addFir.discardConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader
        title={t('fir.addFir.title')}
        onBack={handleBackPress}
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="rounded-xl px-4 py-2 active:opacity-70" style={{ backgroundColor: '#6366F1' }}>
            <Text className="text-white text-sm font-bold">{saving ? t('fir.addFir.saving') : t('fir.addFir.saveFIR')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-6 py-6 gap-6 pb-20"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : null}

        {/* ── OCR Auto-fill Action ── */}
        <Pressable
          onPress={() => setOcrModalVisible(true)}
          className="flex-row items-center justify-between p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 active:opacity-75"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="flex-1 flex-row items-center gap-3 mr-3">
            <View className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 items-center justify-center">
              <Sparkles size={18} color="#6366F1" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-foreground">Auto-fill via OCR Scan</Text>
              <Text className="text-[11px] text-muted-foreground">Scan complaint letter or FIR using AI</Text>
            </View>
          </View>
          <View className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600">
            <Text className="text-xs font-semibold text-white">Scan</Text>
          </View>
        </Pressable>

        {/* Basic Info */}
        <View>
          <SectionHeader title={t('fir.addFir.sectionBasic')} />
          <View className="gap-4">
            <Field label={t('fir.addFir.fieldFIRNumber')}>
              <Input value={firNumber} onChangeText={(v) => { isDirty.current = true; setFirNumber(v); }} placeholder={t('fir.addFir.firNumberPlaceholder')} />
            </Field>
            <Field
              label={t('fir.addFir.fieldSection')}
              rightAction={
                <FIRSuggesterButton onPress={() => setIsSuggesterOpen(true)} />
              }
            >
              <Input
                value={section}
                onChangeText={(v) => { isDirty.current = true; setSection(v); }}
                placeholder={t('fir.addFir.sectionPlaceholder')}
              />
              <FIRSectionAssistant
                section={section}
                onAddSection={(newSec) => {
                  isDirty.current = true;
                  setSection((prev) => {
                    const trimmed = prev.trim();
                    if (!trimmed) return newSec;
                    if (trimmed.includes(newSec)) return trimmed;
                    return `${trimmed}, ${newSec}`;
                  });
                }}
                incidentFacts={mukadmaSaransh || nakalRapat || nakalChick || ghatnasthal || ''}
                isSuggesterOpen={isSuggesterOpen}
                onCloseSuggester={() => setIsSuggesterOpen(false)}
              />
            </Field>
          </View>
        </View>

        {/* Complainant */}
        <View>
          <SectionHeader title={t('fir.addFir.sectionComplainant')} />
          <View className="gap-4">
            <Field label={t('fir.addFir.fieldName')}>
              <Input value={cName} onChangeText={(v) => { isDirty.current = true; setCName(v); }} placeholder={t('fir.addFir.namePlaceholder')} />
            </Field>
            <Field label={t('fir.addFir.fieldAddress')}>
              <Input type="multiline" value={cAddress} onChangeText={(v) => { isDirty.current = true; setCAddress(v); }} placeholder={t('fir.addFir.addressPlaceholder')} numberOfLines={2} />
            </Field>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label={t('fir.addFir.fieldMobile')}>
                  <Input type="mobile" value={cMobile} onChangeText={(v) => { isDirty.current = true; setCMobile(v); }} placeholder={t('fir.addFir.mobilePlaceholder')} />
                </Field>
              </View>
              <View className="flex-1">
                <Field label={t('fir.addFir.fieldAltMobile')}>
                  <Input type="mobile" value={cAltMobile} onChangeText={(v) => { isDirty.current = true; setCAltMobile(v); }} placeholder={t('fir.addFir.altMobilePlaceholder')} />
                </Field>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label={t('fir.addFir.fieldJati')}>
                  <Input value={cJati} onChangeText={(v) => { isDirty.current = true; setCJati(v); }} placeholder={t('fir.addFir.jatiPlaceholder')} />
                </Field>
              </View>
              <View className="flex-1">
                <Field label={t('fir.addFir.fieldAge')}>
                  <Input type="age" value={cAge} onChangeText={(v) => { isDirty.current = true; setCAge(v); }} placeholder={t('fir.addFir.agePlaceholder')} />
                </Field>
              </View>
            </View>
          </View>
        </View>

        {/* Incident */}
        <View>
          <SectionHeader title={t('fir.addFir.sectionIncident')} />
          <View className="gap-4">
            <Field label={t('fir.addFir.fieldGhatnasthal')}>
              <Input type="multiline" value={ghatnasthal} onChangeText={(v) => { isDirty.current = true; setGhatnasthal(v); }}
                placeholder={t('fir.addFir.ghatnasthalPlaceholder')} numberOfLines={2}
                leftIcon={<MapPin size={16} color="#6B7280" />} />
            </Field>
            <FlatCrimeTypeSelect
              label={t('fir.addFir.fieldCrimeType')}
              options={flatCrimeTypes}
              selectedIds={selectedCrimeTypeIds}
              placeholder={flatCrimeTypes.length === 0 ? t('fir.addFir.noChecklistsFound') : t('fir.addFir.selectCrimeTypes')}
              onToggle={(id) => {
                isDirty.current = true;
                setSelectedCrimeTypeIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              }}
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <DateField label={t('fir.addFir.fieldDateOccurrence')} value={dateOccurrence} onChange={(v) => { isDirty.current = true; setDateOccurrence(v); }} />
              </View>
              <View className="flex-1">
                <Field label={t('fir.addFir.fieldTimeOccurrence')}>
                  <Input type="time" value={timeOccurrence} onChangeText={(v) => { isDirty.current = true; setTimeOccurrence(v); }} />
                </Field>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <DateField label={t('fir.addFir.fieldDateInformation')} value={dateInformation} onChange={(v) => { isDirty.current = true; setDateInformation(v); }} />
              </View>
              <View className="flex-1">
                <Field label={t('fir.addFir.fieldTimeInformation')}>
                  <Input type="time" value={timeInformation} onChangeText={(v) => { isDirty.current = true; setTimeInformation(v); }} />
                </Field>
              </View>
            </View>
          </View>
        </View>

        {/* Accused */}
        <View>
          <SectionHeader title={t('fir.addFir.sectionAccused')} />
          <View className="flex-row gap-3 mb-4">
            {(['known', 'unknown'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => { isDirty.current = true; setAccusedType(type); }}
                className="flex-1 rounded-xl border py-2.5 items-center active:opacity-70"
                style={{
                  borderColor: accusedType === type ? '#6366F1' : '#E5E7EB',
                  backgroundColor: accusedType === type ? '#EEF2FF' : '#fff',
                }}
              >
                <Text className="text-sm font-semibold capitalize" style={{ color: accusedType === type ? '#6366F1' : '#6B7280' }}>
                  {type === 'known' ? t('fir.addFir.accusedKnown') : t('fir.addFir.accusedUnknown')}
                </Text>
              </Pressable>
            ))}
          </View>

          {accusedType === 'known' ? (
            <>
              {knownAccused.map((a, i) => (
                <AccusedCard key={a.id} accused={a} index={i} onChange={updateAccused} onRemove={removeAccused} />
              ))}
              <Pressable
                onPress={() => { isDirty.current = true; setKnownAccused((prev) => [...prev, mkAccused()]); }}
                className="flex-row items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl py-4 active:opacity-70"
              >
                <Plus size={16} color="#6B7280" />
                <Text className="text-sm text-muted-foreground font-medium">{t('fir.addFir.addAnotherAccused')}</Text>
              </Pressable>
            </>
          ) : (
            <Field label={t('fir.addFir.fieldTotalUnknown')}>
              <Input type="number" value={unknownCount} onChangeText={(v) => { isDirty.current = true; setUnknownCount(v); }} placeholder={t('fir.addFir.totalUnknownPlaceholder')} />
            </Field>
          )}
        </View>

        {/* Nakal Forms */}
        <View>
          <SectionHeader title={t('fir.addFir.sectionNakal')} />
          <View className="gap-4">
            <Field label={t('fir.addFir.fieldNakalChick')}>
              <DocumentEditor
                value={nakalChick}
                onChangeText={(v) => { isDirty.current = true; setNakalChick(v); }}
                title={t('fir.addFir.fieldNakalChick')}
                placeholder={t('fir.addFir.nakalChickPlaceholder')}
                minHeight={96}
                accessibilityLabel={t('fir.addFir.nakalChickAccessibility')}
              />
            </Field>
            <Field label={t('fir.addFir.fieldNakalRapat')}>
              <DocumentEditor
                value={nakalRapat}
                onChangeText={(v) => { isDirty.current = true; setNakalRapat(v); }}
                title={t('fir.addFir.fieldNakalRapat')}
                placeholder={t('fir.addFir.nakalRapatPlaceholder')}
                minHeight={96}
                accessibilityLabel={t('fir.addFir.nakalRapatAccessibility')}
              />
            </Field>
          </View>
        </View>

        {/* मुकदमा सारांश */}
        <View>
          <SectionHeader title="मुकदमा सारांश" />
          <Text className="text-xs text-muted-foreground mb-3 -mt-1">
            यह सारांश केस डायरी की पहली प्रविष्टि में स्वतः जुड़ जाएगा।
          </Text>
          <CollapsibleDocumentBox
            label="मुकदमा सारांश (Case Summary)"
            value={mukadmaSaransh}
            onChangeText={(v) => { isDirty.current = true; setMukadmaSaransh(v); }}
            placeholder="मुकदमे की संक्षिप्त कहानी / घटनाक्रम यहाँ लिखें…"
          />
        </View>
      </ScrollView>

      <OcrScanModal
        visible={ocrModalVisible}
        onClose={() => setOcrModalVisible(false)}
        fields={FIR_OCR_FIELDS}
        onApply={handleOcrApply}
        title="FIR / Mukadma OCR Scanner"
      />
    </KeyboardAvoidingView>
  );
}
