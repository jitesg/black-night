/**
 * AccusedGroupInput — Repeatable accused-card group for format-filling screens.
 *
 * Architecture:
 *   • Pure UI component — zero business logic, zero DB calls.
 *   • Value is stored as a JSON array string: AccusedEntry[] → JSON.stringify().
 *   • Parent (fill.tsx / fill-format.tsx) keeps the JSON string in its `values`
 *     map under the key's key_name, identical to every other field.
 *   • One empty card is pre-seeded by the caller (or via initAccusedGroup()).
 *
 * Sub-fields per accused (fixed, not format-defined):
 *   name (required), fatherOrHusbandName, fullAddress (required), age,
 *   mobile, caste, gender, email, caughtBy
 *
 * Validation (inline per-card, blocks parent save via onValidChange):
 *   - name: required
 *   - fullAddress: required
 *   - age: 1-120 integer if provided
 *   - mobile: /^[6-9]\d{9}$/ if provided
 *   - email: basic pattern if provided
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { ChevronDown, ChevronUp, Copy, ScanLine, Sparkles, Trash2, UserPlus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AutocompleteInput } from '@/components/common/AutocompleteInput';
import { FIELD_KEYS } from '@/lib/db/fieldValueHistoryRepo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function useGroupTokens() {
  const { colorScheme } = useColorScheme();
  const t = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return {
    border:         t.border,
    text:           t.foreground,
    placeholder:    t.mutedForeground,
    bg:             t.background,
    label:          t.mutedForeground,
    muted:          t.mutedForeground,
    accent:         t.destructive,
    addBg:          t.accent,
    addBorder:      t.primary,
    addText:        t.primary,
    cardBg:         t.card,
    cardBorder:     t.border,
    cardBorderErr:  t.destructive,
    headerBg:       t.background,
    selectedBg:     t.accent,
    selectedBorder: t.primary,
    selectedText:   t.primary,
    errorText:      t.destructive,
    copyBg:         t.accent,
    copyBorder:     t.primary,
    copyText:       t.primary,
  } as const;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccusedEntry {
  /** Stable identity key — used as React list key, injected by init/parse helpers. */
  _id?: string;
  name: string;
  fatherOrHusbandName: string;
  fullAddress: string;
  age: string;
  mobile: string;
  caste: string;
  gender: 'पुरुष' | 'महिला' | 'अन्य' | '';
  /** Explicit connector before fatherOrHusbandName — officer's choice (v262+).
   *  Legacy entries (no field) fall back to पुत्र in the template engine. */
  relationType: 'पुत्र' | 'पुत्री' | 'पत्नी' | '';
  email: string;
  caughtBy: string;
  // legacy compat — old data may have 'address' instead of 'fullAddress'
  address?: string;
}

const EMPTY_ACCUSED: AccusedEntry = {
  name: '',
  fatherOrHusbandName: '',
  fullAddress: '',
  age: '',
  mobile: '',
  caste: '',
  gender: '',
  relationType: '',
  email: '',
  caughtBy: '',
};

const GENDER_OPTIONS: Array<'पुरुष' | 'महिला' | 'अन्य'> = ['पुरुष', 'महिला', 'अन्य'];
const RELATION_OPTIONS: Array<'पुत्र' | 'पुत्री' | 'पत्नी'> = ['पुत्र', 'पुत्री', 'पत्नी'];

// ─── Serialise / Deserialise helpers (exported for use in fill screens) ────────

/** Produce a fresh single-entry accused group value (pre-seed one empty card). */
export function initAccusedGroup(): string {
  return JSON.stringify([{ ...EMPTY_ACCUSED, _id: `acc_${Date.now()}_0` }]);
}

/** Parse a JSON string back to AccusedEntry[]. Falls back to one empty card.
 *  Migrates legacy 'address' field to 'fullAddress' transparently. */
export function parseAccusedGroup(jsonStr: string): AccusedEntry[] {
  if (!jsonStr) return [{ ...EMPTY_ACCUSED, _id: `acc_${Date.now()}_0` }];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as AccusedEntry[]).map((e, i) => ({
        ...EMPTY_ACCUSED,
        ...e,
        // migrate legacy 'address' → 'fullAddress'
        fullAddress: e.fullAddress || e.address || '',
        // inject stable _id if missing (legacy data)
        _id: e._id ?? `acc_${Date.now()}_${i}`,
      }));
    }
  } catch { /* fall through */ }
  return [{ ...EMPTY_ACCUSED, _id: `acc_${Date.now()}_0` }];
}

// ─── Validation helpers ────────────────────────────────────────────────────────

type CardErrors = Partial<Record<keyof AccusedEntry, string>>;

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation is called outside React components, so we pass translated strings in.
function validateAccusedEntry(e: AccusedEntry, msgs: {
  nameRequired: string;
  addressRequired: string;
  ageInvalid: string;
  mobileInvalid: string;
  emailInvalid: string;
}): CardErrors {
  const errs: CardErrors = {};
  if (!e.name.trim())          errs.name = msgs.nameRequired;
  if (!e.fullAddress.trim())   errs.fullAddress = msgs.addressRequired;
  if (e.age.trim()) {
    const n = parseInt(e.age, 10);
    if (isNaN(n) || n < 1 || n > 120) errs.age = msgs.ageInvalid;
  }
  if (e.mobile.trim() && !MOBILE_RE.test(e.mobile.trim())) {
    errs.mobile = msgs.mobileInvalid;
  }
  if (e.email.trim() && !EMAIL_RE.test(e.email.trim())) {
    errs.email = msgs.emailInvalid;
  }
  return errs;
}

function hasCardErrors(errs: CardErrors) {
  return Object.keys(errs).length > 0;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface FieldRowProps {
  C: ReturnType<typeof useGroupTokens>;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}
const FieldRow = memo(({ C, label, required, error, children }: FieldRowProps) => (
  <View style={{ gap: 4 }}>
    <Text style={{ fontSize: 12, color: C.label, fontWeight: '500' }}>
      {required && typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label}
      {required && <Text style={{ color: C.accent }}> *</Text>}
    </Text>
    {children}
    {error ? <Text style={{ fontSize: 11, color: C.errorText, marginTop: 2 }}>{error}</Text> : null}
  </View>
));
FieldRow.displayName = 'FieldRow';

interface SimpleInputProps {
  C: ReturnType<typeof useGroupTokens>;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  hasError?: boolean;
}
const SimpleInput = memo(({
  C, value, onChangeText, onBlur, placeholder, multiline, keyboardType, hasError,
}: SimpleInputProps) => (
  <View style={{
    borderWidth: 1,
    borderColor: hasError ? C.cardBorderErr : C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.bg,
    minHeight: multiline ? 72 : 44,
  }}>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={C.placeholder}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      style={{
        flex: 1,
        fontSize: 14,
        color: C.text,
        paddingVertical: 0,
        backgroundColor: 'transparent',
      }}
    />
  </View>
));
SimpleInput.displayName = 'SimpleInput';

interface GenderPickerProps {
  C: ReturnType<typeof useGroupTokens>;
  value: AccusedEntry['gender'];
  onSelect: (g: 'पुरुष' | 'महिला' | 'अन्य') => void;
  labels: [string, string, string]; // [male, female, other]
}
const GenderPicker = memo(({ C, value, onSelect, labels }: GenderPickerProps) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {GENDER_OPTIONS.map((opt, i) => {
      const selected = value === opt;
      return (
        <Pressable
          key={opt}
          onPress={() => onSelect(opt)}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1.5,
            alignItems: 'center',
            backgroundColor: selected ? C.selectedBg : C.bg,
            borderColor: selected ? C.selectedBorder : C.border,
          }}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: selected ? '600' : '400',
            color: selected ? C.selectedText : C.text,
          }}>
            {labels[i]}
          </Text>
        </Pressable>
      );
    })}
  </View>
));
GenderPicker.displayName = 'GenderPicker';

interface RelationPickerProps {
  C: ReturnType<typeof useGroupTokens>;
  value: AccusedEntry['relationType'];
  onSelect: (r: 'पुत्र' | 'पुत्री' | 'पत्नी') => void;
}
const RelationPicker = memo(({ C, value, onSelect }: RelationPickerProps) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {RELATION_OPTIONS.map((opt) => {
      const selected = value === opt;
      return (
        <Pressable
          key={opt}
          onPress={() => onSelect(opt)}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1.5,
            alignItems: 'center',
            backgroundColor: selected ? C.selectedBg : C.bg,
            borderColor: selected ? C.selectedBorder : C.border,
          }}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: selected ? '600' : '400',
            color: selected ? C.selectedText : C.text,
          }}>
            {opt}
          </Text>
        </Pressable>
      );
    })}
  </View>
));
RelationPicker.displayName = 'RelationPicker';

// ─── Same-Address picker (mirrors PersonGroupInput) ───────────────────────────
interface AddressPickerProps {
  C: ReturnType<typeof useGroupTokens>;
  priorEntries: AccusedEntry[];
  onPick: (addr: string) => void;
  onClose: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}
const AddressPicker = memo(({ C, priorEntries, onPick, onClose, t }: AddressPickerProps) => (
  <View style={{ borderWidth: 1, borderColor: C.copyBorder, borderRadius: 10, backgroundColor: C.cardBg, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.copyBorder }}>
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: C.copyText }}>{t('group.person.addressPickerTitle')}</Text>
      <Pressable onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={14} color={C.muted} />
      </Pressable>
    </View>
    {priorEntries.map((e, i) => (
      <Pressable key={i} onPress={() => onPick(e.fullAddress || e.address || '')} style={{
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: i < priorEntries.length - 1 ? 1 : 0, borderBottomColor: C.copyBorder,
      }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: '500' }} numberOfLines={1}>
          {`${i + 1}. ${(e.name ?? '').trim() || t('group.accused.cardTitle', { number: i + 1 })}`}
        </Text>
        {(e.fullAddress || e.address || '').trim()
          ? <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }} numberOfLines={2}>{(e.fullAddress || e.address || '').trim()}</Text>
          : <Text style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>{t('group.person.noAddressFilled')}</Text>}
      </Pressable>
    ))}
  </View>
));
AddressPicker.displayName = 'AddressPicker';

// ─── Single accused card ───────────────────────────────────────────────────────

interface AccusedCardProps {
  C: ReturnType<typeof useGroupTokens>;
  index: number;
  entry: AccusedEntry;
  collapsed: boolean;
  cardErrors: CardErrors;
  touched: Set<string>;
  onToggleCollapse: (i: number) => void;
  onChange: (i: number, field: keyof AccusedEntry, value: string) => void;
  onBlur: (i: number, field: keyof AccusedEntry) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
  onScanPress: (i: number) => void;
  isScanning: boolean;
  scanError?: string;
  onDismissScanError?: () => void;
  /** Full entries array — card slices internally to derive priorEntries */
  allEntries: AccusedEntry[];
  genderLabels: [string, string, string];
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const AccusedCard = memo(({
  C, index, entry, collapsed, cardErrors, touched,
  onToggleCollapse, onChange, onBlur, onRemove, canRemove,
  onScanPress, isScanning, scanError, onDismissScanError,
  allEntries, genderLabels, t,
}: AccusedCardProps) => {
  const priorEntries = allEntries.slice(0, index);
  const hasErr = hasCardErrors(cardErrors);
  const fieldErr = (f: keyof AccusedEntry) =>
    touched.has(f as string) ? cardErrors[f] : undefined;

  const [showPicker, setShowPicker] = useState(false);

  const handleCopyAddress = useCallback(() => {
    if (priorEntries.length === 1) {
      onChange(index, 'fullAddress', priorEntries[0].fullAddress || priorEntries[0].address || '');
    } else {
      setShowPicker((p) => !p);
    }
  }, [priorEntries, onChange, index]);

  const handlePickAddress = useCallback((addr: string) => {
    onChange(index, 'fullAddress', addr);
    setShowPicker(false);
  }, [onChange, index]);

  const summary = (entry.name ?? '').trim()
    ? `${entry.name.trim()}${entry.gender ? ` (${entry.gender})` : ''}`
    : t('group.accused.cardTitle', { number: index + 1 });

  return (
    <View style={{
      borderWidth: hasErr ? 1.5 : 1,
      borderColor: hasErr ? C.cardBorderErr : C.cardBorder,
      borderRadius: 14,
      backgroundColor: C.cardBg,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <Pressable
        onPress={() => onToggleCollapse(index)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: hasErr ? '#FFF5F5' : C.headerBg,
          paddingHorizontal: 14,
          paddingVertical: 11,
          gap: 8,
        }}
      >
        <View style={{
          width: 24, height: 24, borderRadius: 12,
          backgroundColor: hasErr ? '#FEE2E2' : '#E5E7EB',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: hasErr ? '#B91C1C' : '#374151' }}>
            {index + 1}
          </Text>
        </View>

        <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.text }} numberOfLines={1}>
          {summary}
        </Text>

        <Pressable
          onPress={() => onScanPress(index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
          accessibilityLabel={t('group.scan.button')}
        >
          {isScanning ? (
            <ActivityIndicator size={16} color={C.selectedText} />
          ) : (
            <ScanLine size={16} color={C.muted} />
          )}
        </Pressable>

        {canRemove && (
          <Pressable onPress={() => onRemove(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Trash2 size={16} color={C.accent} />
          </Pressable>
        )}
        {collapsed ? <ChevronDown size={16} color={C.muted} /> : <ChevronUp size={16} color={C.muted} />}
      </Pressable>

      {/* Card body */}
      {!collapsed && (
        <View style={{ padding: 14, gap: 14 }}>
          {isScanning && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: C.selectedBg,
              borderRadius: 10,
              padding: 10,
              borderWidth: 1,
              borderColor: C.selectedBorder,
            }}>
              <ActivityIndicator size="small" color={C.selectedText} />
              <Text style={{ fontSize: 12, color: C.selectedText, fontWeight: '500' }}>
                {t('group.scan.scanning')}
              </Text>
            </View>
          )}

          {scanError ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: C.bg,
              borderRadius: 10,
              padding: 10,
              borderWidth: 1,
              borderColor: C.cardBorderErr,
              gap: 8,
            }}>
              <Text style={{ fontSize: 12, color: C.errorText, flex: 1 }}>{scanError}</Text>
              {onDismissScanError && (
                <Pressable onPress={onDismissScanError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={C.muted} />
                </Pressable>
              )}
            </View>
          ) : null}
          <FieldRow C={C} label={t('group.fields.name')} required error={fieldErr('name')}>
            <AutocompleteInput
              fieldKey={FIELD_KEYS.person_name}
              value={entry.name}
              onChangeText={(v) => onChange(index, 'name', v)}
              onBlur={() => onBlur(index, 'name')}
              placeholder={t('group.accused.namePlaceholder')}
              hasError={!!fieldErr('name')}
            />
          </FieldRow>

          {/* relationType picker — sits above fatherOrHusbandName */}
          <FieldRow C={C} label={t('group.fields.relationType')}>
            <RelationPicker
              C={C}
              value={entry.relationType}
              onSelect={(r) => onChange(index, 'relationType', r)}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.fields.fatherOrHusband')}>
            <AutocompleteInput
              fieldKey={FIELD_KEYS.father_husband_name}
              value={entry.fatherOrHusbandName}
              onChangeText={(v) => onChange(index, 'fatherOrHusbandName', v)}
              placeholder={t('group.accused.fatherPlaceholder')}
            />
          </FieldRow>

          {/* fullAddress with Same Address button (2nd+ cards) */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: C.label, fontWeight: '500', flex: 1 }}>
                {t('group.fields.fullAddress')} <Text style={{ color: C.accent }}>*</Text>
              </Text>
              {priorEntries.length > 0 && (
                <Pressable onPress={handleCopyAddress} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: C.copyBg, borderWidth: 1, borderColor: C.copyBorder,
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Copy size={11} color={C.copyText} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: C.copyText }}>
                    {priorEntries.length === 1
                      ? t('group.person.sameAddressFirst')
                      : t('group.person.copyAddress')}
                  </Text>
                </Pressable>
              )}
            </View>
            {showPicker && (
              <AddressPicker C={C} priorEntries={priorEntries} onPick={handlePickAddress} onClose={() => setShowPicker(false)} t={t} />
            )}
            {fieldErr('fullAddress') && (
              <Text style={{ fontSize: 11, color: C.errorText }}>{fieldErr('fullAddress')}</Text>
            )}
            <AutocompleteInput
              fieldKey={FIELD_KEYS.address}
              value={entry.fullAddress}
              onChangeText={(v) => onChange(index, 'fullAddress', v)}
              onBlur={() => onBlur(index, 'fullAddress')}
              placeholder={t('group.accused.addressPlaceholder')}
              multiline
              hasError={!!fieldErr('fullAddress')}
            />
          </View>

          <FieldRow C={C} label={t('group.fields.age')} error={fieldErr('age')}>
            <SimpleInput
              C={C}
              value={entry.age}
              onChangeText={(v) => onChange(index, 'age', v.replace(/\D/g, '').slice(0, 3))}
              onBlur={() => onBlur(index, 'age')}
              placeholder={t('group.fields.ageUnit')}
              keyboardType="number-pad"
              hasError={!!fieldErr('age')}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.fields.mobile')} error={fieldErr('mobile')}>
            <SimpleInput
              C={C}
              value={entry.mobile}
              onChangeText={(v) => onChange(index, 'mobile', v.replace(/\D/g, '').slice(0, 10))}
              onBlur={() => onBlur(index, 'mobile')}
              placeholder={t('group.fields.mobilePlaceholder')}
              keyboardType="phone-pad"
              hasError={!!fieldErr('mobile')}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.fields.caste')}>
            <AutocompleteInput
              fieldKey={FIELD_KEYS.caste}
              value={entry.caste}
              onChangeText={(v) => onChange(index, 'caste', v)}
              placeholder={t('group.fields.casteOptional')}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.fields.gender')}>
            <GenderPicker
              C={C}
              value={entry.gender}
              onSelect={(g) => onChange(index, 'gender', g)}
              labels={genderLabels}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.fields.email')} error={fieldErr('email')}>
            <SimpleInput
              C={C}
              value={entry.email}
              onChangeText={(v) => onChange(index, 'email', v.trim())}
              onBlur={() => onBlur(index, 'email')}
              placeholder={t('group.fields.emailPlaceholder')}
              keyboardType="email-address"
              hasError={!!fieldErr('email')}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.accused.caughtByLabel')}>
            <SimpleInput
              C={C}
              value={entry.caughtBy}
              onChangeText={(v) => onChange(index, 'caughtBy', v)}
              placeholder={t('group.accused.caughtByPlaceholder')}
            />
          </FieldRow>
        </View>
      )}
    </View>
  );
});
AccusedCard.displayName = 'AccusedCard';

// ─── Main export ───────────────────────────────────────────────────────────────

export interface AccusedGroupInputProps {
  label?: string;
  value: string;
  onChange: (keyName: string, jsonValue: string) => void;
  /** Called whenever the overall validity of this group changes. */
  onValidChange?: (keyName: string, isValid: boolean) => void;
  keyName: string;
  error?: string;
}

export const AccusedGroupInput = memo(({
  label, value, onChange, onValidChange, keyName, error,
}: AccusedGroupInputProps) => {
  const C = useGroupTokens();
  const { t } = useTranslation();
  const defaultLabel = t('group.accused.defaultLabel');
  const resolvedLabel = label ?? defaultLabel;

  const validationMsgs = {
    nameRequired:    t('group.validation.nameRequired'),
    addressRequired: t('group.validation.addressRequired'),
    ageInvalid:      t('group.validation.ageInvalid'),
    mobileInvalid:   t('group.validation.mobileInvalid'),
    emailInvalid:    t('group.validation.emailInvalid'),
  };

  // Stable array — only rebuilds when locale changes
  const genderLabels = useMemo<[string, string, string]>(() => [
    t('group.gender.male'),
    t('group.gender.female'),
    t('group.gender.other'),
  ], [t]);

  const entries = parseAccusedGroup(value);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const [collapsedSet, setCollapsedSet] = React.useState<Set<number>>(new Set());
  // Per-card: map of field → error string
  const [allCardErrors, setAllCardErrors] = React.useState<CardErrors[]>(() =>
    entries.map((e) => validateAccusedEntry(e, validationMsgs))
  );
  // Per-card: set of fields that have been touched (blurred or save attempted)
  const [touchedSets, setTouchedSets] = React.useState<Set<string>[]>(() => entries.map(() => new Set<string>()));

  // Scan state per card
  const [scanTargetIndex, setScanTargetIndex] = useState<number | null>(null);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [scanErrorMap, setScanErrorMap] = useState<Record<number, string>>({});
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } catch { /* ignore on non-android */ }
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 4500);
  }, []);

  // Keep validation state in sync when entries array length changes
  const prevLenRef = useRef(entries.length);
  useEffect(() => {
    if (prevLenRef.current !== entries.length) {
      setAllCardErrors(entries.map((e) => validateAccusedEntry(e, validationMsgs)));
      setTouchedSets(entries.map((_, i) => touchedSets[i] ?? new Set<string>()));
      prevLenRef.current = entries.length;
    }
  }, [entries.length]);

  // Report overall validity to parent
  const reportValidity = useCallback((errors: CardErrors[]) => {
    if (!onValidChange) return;
    const anyErr = errors.some(hasCardErrors);
    onValidChange(keyName, !anyErr);
  }, [onValidChange, keyName]);

  const toggleCollapse = useCallback((i: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const emit = useCallback((next: AccusedEntry[]) => {
    onChange(keyName, JSON.stringify(next));
    const newErrors = next.map((e) => validateAccusedEntry(e, validationMsgs));
    setAllCardErrors(newErrors);
    reportValidity(newErrors);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyName, onChange, reportValidity]);

  const handleChange = useCallback((i: number, field: keyof AccusedEntry, val: string) => {
    const updated = entriesRef.current.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    entriesRef.current = updated;
    emit(updated);
  }, [emit]);

  const handleBlur = useCallback((i: number, field: keyof AccusedEntry) => {
    setTouchedSets((prev) => {
      const next = prev.map((s, idx) => idx === i ? new Set([...s, field as string]) : s);
      return next;
    });
  }, []);

  const handleOpenScanDialog = useCallback((i: number) => {
    setScanTargetIndex(i);
    setScanErrorMap((prev) => ({ ...prev, [i]: '' }));
  }, []);

  const handleDismissScanError = useCallback((i: number) => {
    setScanErrorMap((prev) => ({ ...prev, [i]: '' }));
  }, []);

  const handleScan = useCallback(async (targetIdx: number, source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setScanErrorMap((prev) => ({ ...prev, [targetIdx]: t('group.scan.permissionDenied') }));
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          base64: true,
          quality: 0.7,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setScanErrorMap((prev) => ({ ...prev, [targetIdx]: t('group.scan.permissionDenied') }));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          base64: true,
          quality: 0.7,
        });
      }

      if (result.canceled || !result.assets || !result.assets[0]?.base64) {
        return;
      }

      setScanningIndex(targetIdx);
      setScanErrorMap((prev) => ({ ...prev, [targetIdx]: '' }));

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-extract-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: result.assets[0].base64,
          mimeType: 'image/jpeg',
          fields: [
            { key: 'name', label: 'Full name' },
            { key: 'fatherOrHusbandName', label: "Father's or husband's name" },
            { key: 'fullAddress', label: 'Full address' },
            { key: 'age', label: 'Age in years' },
            { key: 'mobile', label: '10-digit mobile number' },
          ],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Request failed with status ${res.status}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }

      if (json.fields && typeof json.fields === 'object') {
        const currentCard = entriesRef.current[targetIdx];
        if (currentCard) {
          const fieldKeys: Array<keyof AccusedEntry> = ['name', 'fatherOrHusbandName', 'fullAddress', 'age', 'mobile'];
          for (const key of fieldKeys) {
            const returnedVal = (json.fields as Record<string, unknown>)[key];
            if (typeof returnedVal === 'string' && returnedVal.trim()) {
              const existingVal = currentCard[key];
              if (typeof existingVal === 'string' && !existingVal.trim()) {
                let formatted = returnedVal.trim();
                if (key === 'age') formatted = formatted.replace(/\D/g, '').slice(0, 3);
                if (key === 'mobile') formatted = formatted.replace(/\D/g, '').slice(0, 10);
                handleChange(targetIdx, key, formatted);
              }
            }
          }
        }
        showToast(t('group.scan.successToast'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('group.scan.error');
      setScanErrorMap((prev) => ({ ...prev, [targetIdx]: msg }));
    } finally {
      setScanningIndex(null);
    }
  }, [handleChange, showToast, t]);

  const handleAdd = useCallback(() => {
    const next = [...entries, { ...EMPTY_ACCUSED }];
    setCollapsedSet(new Set(entries.map((_, i) => i)));
    setTouchedSets((prev) => [...prev, new Set<string>()]);
    emit(next);
  }, [entries, emit]);

  const handleRemove = useCallback((i: number) => {
    if (entries.length <= 1) return;
    const next = entries.filter((_, idx) => idx !== i);
    setCollapsedSet((prev) => {
      const n = new Set<number>();
      prev.forEach((ci) => { if (ci < i) n.add(ci); else if (ci > i) n.add(ci - 1); });
      return n;
    });
    setTouchedSets((prev) => prev.filter((_, idx) => idx !== i));
    emit(next);
  }, [entries, emit]);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 12, color: C.label, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
          {resolvedLabel}
        </Text>
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, color: C.muted, fontWeight: '500' }}>
            {t('group.accused.countBadge', { count: entries.length })}
          </Text>
        </View>
      </View>

      {/* Toast / Snackbar banner */}
      {toastMsg ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: C.selectedBg,
          borderColor: C.selectedBorder,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        }}>
          <Sparkles size={16} color={C.selectedText} />
          <Text style={{ fontSize: 12, color: C.selectedText, fontWeight: '500', flex: 1 }}>
            {toastMsg}
          </Text>
          <Pressable onPress={() => setToastMsg('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={C.muted} />
          </Pressable>
        </View>
      ) : null}

      {entries.map((entry, i) => (
        <AccusedCard
          key={entry._id ?? i}
          C={C}
          index={i}
          entry={entry}
          collapsed={collapsedSet.has(i)}
          cardErrors={allCardErrors[i] ?? {}}
          touched={touchedSets[i] ?? new Set()}
          onToggleCollapse={toggleCollapse}
          onChange={handleChange}
          onBlur={handleBlur}
          onRemove={handleRemove}
          canRemove={entries.length > 1}
          onScanPress={handleOpenScanDialog}
          isScanning={scanningIndex === i}
          scanError={scanErrorMap[i]}
          onDismissScanError={() => handleDismissScanError(i)}
          allEntries={entries}
          genderLabels={genderLabels}
          t={t}
        />
      ))}

      <Pressable
        onPress={handleAdd}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          borderWidth: 1.5, borderColor: C.addBorder, borderStyle: 'dashed',
          borderRadius: 12, paddingVertical: 12, backgroundColor: C.addBg,
        }}
      >
        <UserPlus size={15} color={C.addText} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.addText }}>{t('group.accused.addBtn')}</Text>
      </Pressable>

      {error ? <Text style={{ fontSize: 12, color: C.accent }}>{error}</Text> : null}

      {/* Scan Document AlertDialog */}
      <AlertDialog
        open={scanTargetIndex !== null}
        onOpenChange={(open) => {
          if (!open) setScanTargetIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('group.scan.dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('group.scan.dialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel onPress={() => setScanTargetIndex(null)}>
              <Text>{t('group.scan.cancel')}</Text>
            </AlertDialogCancel>
            <Pressable
              onPress={() => {
                const idx = scanTargetIndex;
                setScanTargetIndex(null);
                if (idx !== null) {
                  handleScan(idx, 'gallery');
                }
              }}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.cardBg,
                paddingHorizontal: 16,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: C.text }}>
                {t('group.scan.chooseGallery')}
              </Text>
            </Pressable>
            <AlertDialogAction
              onPress={() => {
                const idx = scanTargetIndex;
                setScanTargetIndex(null);
                if (idx !== null) {
                  handleScan(idx, 'camera');
                }
              }}
            >
              <Text className="text-white font-semibold">{t('group.scan.takePhoto')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
});

AccusedGroupInput.displayName = 'AccusedGroupInput';

