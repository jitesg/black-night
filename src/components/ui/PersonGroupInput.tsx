/**
 * PersonGroupInput — Repeatable person-card group for format-filling screens.
 *
 * Architecture mirrors AccusedGroupInput exactly:
 *   • Pure UI component — zero business logic, zero DB calls.
 *   • Value stored as a JSON array string: PersonEntry[] → JSON.stringify().
 *   • Parent keeps the JSON string in its `values` map under the key's key_name.
 *   • One empty card is pre-seeded via initPersonGroup().
 *
 * Sub-fields per person:
 *   name (required), fullAddress (required), age, mobile, caste, gender, email
 *
 * Validation (inline per-card, blocks parent save via onValidChange):
 *   - name: required
 *   - fullAddress: required
 *   - age: 1-120 integer if provided
 *   - mobile: /^[6-9]\d{9}$/ if provided
 *   - email: basic pattern if provided
 *
 * Same-Address button:
 *   Cards at index > 0 show a button to copy fullAddress from a previous card.
 *   - Exactly 1 prior card  → single tap copies directly.
 *   - 2+ prior cards        → tapping opens an inline mini-picker to choose which.
 */

import { FirPeopleButton } from '@/components/formats/FirPeopleButton';
import { PPPeopleButton } from '@/components/formats/PPPeopleButton';
import { avedakCardWord, type GroupRole } from '@/lib/ppPeople';
import {
  ADOPT_SUBS, ID_TYPES, RELATION_CHIPS, TRANS_SUBS, addrModeOf, chipOf, composeAddress, fatherLabel, genderOfRelation, hasAddress,
  personCardDefaults, relationWord, type AddrMode, type RelationChip,
} from '@/lib/personCard';
import { LabelWithHint } from './FieldHintLink';
import { insertIntoGroup, toCard } from '@/lib/firPeople';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { ChevronDown, ChevronUp, Copy, ScanLine, Sparkles, Trash2, UserPlus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AutocompleteInput } from '@/components/common/AutocompleteInput';
import { FIELD_KEYS } from '@/lib/db/fieldValueHistoryRepo';
import { getAllGramPanchayats } from '@/lib/db/gramPanchayatRepo';
import { getAllHamlets } from '@/lib/db/hamletRepo';
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

export interface PersonEntry {
  /** Stable identity key — used as React list key, injected by init/parse helpers. */
  _id?: string;
  name: string;
  /** Split out from the old combined "name & father/husband" field (v259). */
  fatherOrHusbandName: string;
  fullAddress: string;
  age: string;
  mobile: string;
  caste: string;
  gender: 'पुरुष' | 'महिला' | 'ट्रांसजेंडर' | 'अन्य' | '';
  /** The printed connector before fatherOrHusbandName (owner, 2026-11-17): पुत्र / पुत्री / पत्नी / संतान / गुरु / दत्तक पुत्र / दत्तक पुत्री
   *  (lib/personCard.ts). Legacy entries (no field) fall back to पुत्र in the template engine. */
  relationType: string;
  email: string;
  /** पता in parts (owner): fullAddress is built from them in 'parts' mode; old cards stay 'free' (one typed address). */
  addrMode?: AddrMode;
  house?: string;
  village?: string;
  villageKind?: string;
  thana?: string;
  district?: string;
  /** "＋ और जानकारी" */
  altMobile?: string;
  idType?: string;
  idNumber?: string;
  remarks?: string;
}

const EMPTY_PERSON: PersonEntry = {
  name: '',
  fatherOrHusbandName: '',
  fullAddress: '',
  age: '',
  mobile: '',
  caste: '',
  gender: '',
  relationType: '',
  email: '',
};

/** A new card: पता in parts, थाना / जनपद from सेटिंग (owner). */
function newPerson(id?: string): PersonEntry {
  const d = personCardDefaults();
  const e: PersonEntry = { ...EMPTY_PERSON, addrMode: 'parts', house: '', village: '', villageKind: 'ग्राम', thana: d.thana, district: d.district };
  e.fullAddress = composeAddress(e);
  return id ? { ...e, _id: id } : e;
}

/** An entry read from JSON: old cards with a typed address stay 'free'; empty old cards get the new parts. */
function normaliseEntry(raw: Partial<PersonEntry>, id: string): PersonEntry {
  const merged: PersonEntry = { ...EMPTY_PERSON, ...raw, _id: raw._id ?? id } as PersonEntry;
  const mode = addrModeOf(merged);
  if (mode === 'parts' && merged.thana === undefined && !merged.village && !merged.house) {
    const d = personCardDefaults();
    return { ...merged, addrMode: 'parts', villageKind: merged.villageKind ?? 'ग्राम', thana: d.thana, district: d.district, fullAddress: composeAddress({ thana: d.thana, district: d.district }) };
  }
  return { ...merged, addrMode: mode };
}

const ADDRESS_PARTS: Array<keyof PersonEntry> = ['house', 'village', 'villageKind', 'thana', 'district'];

// ─── Serialise / Deserialise helpers (exported for fill screens) ──────────────

/** Produce a fresh single-entry person group value. */
export function initPersonGroup(): string {
  return JSON.stringify([newPerson(`per_${Date.now()}_0`)]);
}

/** Parse a JSON string back to PersonEntry[]. Falls back to one empty card. */
export function parsePersonGroup(jsonStr: string): PersonEntry[] {
  if (!jsonStr) return [newPerson(`per_${Date.now()}_0`)];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // inject stable _id if missing (legacy data); old cards keep their typed address
      return (parsed as PersonEntry[]).map((e, i) => normaliseEntry(e, `per_${Date.now()}_${i}`));
    }
  } catch { /* fall through */ }
  return [newPerson(`per_${Date.now()}_0`)];
}

// ─── Validation helpers ────────────────────────────────────────────────────────

type CardErrors = Partial<Record<keyof PersonEntry, string>>;

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePersonEntry(e: PersonEntry, msgs: {
  nameRequired: string;
  addressRequired: string;
  ageInvalid: string;
  mobileInvalid: string;
  emailInvalid: string;
}): CardErrors {
  const errs: CardErrors = {};
  if (!e.name.trim())        errs.name = msgs.nameRequired;
  // '' = address optional; parts mode needs ग्राम or मकान / मोहल्ला (थाना / जनपद come prefilled)
  if (msgs.addressRequired && !hasAddress(e)) errs.fullAddress = msgs.addressRequired;
  if ((e.altMobile ?? '').trim() && !MOBILE_RE.test((e.altMobile ?? '').trim())) errs.altMobile = msgs.mobileInvalid;
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

function hasCardErrors(errs: CardErrors) { return Object.keys(errs).length > 0; }

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
      {required && typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label}{required && <Text style={{ color: C.accent }}> *</Text>}
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
  onFocus?: () => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  hasError?: boolean;
}
const SimpleInput = memo(({
  C, value, onChangeText, onBlur, onFocus, placeholder, multiline, keyboardType, hasError,
}: SimpleInputProps) => (
  <View style={{
    borderWidth: 1,
    borderColor: hasError ? C.cardBorderErr : C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.bg, minHeight: multiline ? 72 : 44,
  }}>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      onFocus={onFocus}
      placeholder={placeholder}
      placeholderTextColor={C.placeholder}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      style={{ flex: 1, fontSize: 14, color: C.text, paddingVertical: 0, backgroundColor: 'transparent' }}
    />
  </View>
));
SimpleInput.displayName = 'SimpleInput';

// सम्बन्ध: 5 chips + sub-chips for ट्रांसजेंडर (संतान / गुरु) and दत्तक (पुत्र / पुत्री) — owner, 2026-11-17
interface RelationPickerProps {
  C: ReturnType<typeof useGroupTokens>;
  value: string;
  onSelect: (r: string) => void;
}
const RelationPicker = memo(({ C, value, onSelect }: RelationPickerProps) => {
  const { chip, sub } = chipOf(value);
  // a chip with sub-chips stays open even before a sub-chip is picked
  const [openChip, setOpenChip] = useState<RelationChip | ''>(chip);
  useEffect(() => { if (chip) setOpenChip(chip); }, [chip]);
  const shown = chip || openChip;
  const subs = shown === 'ट्रांसजेंडर' ? TRANS_SUBS : shown === 'दत्तक' ? ADOPT_SUBS : null;
  const pick = (c: RelationChip) => {
    setOpenChip(c);
    if (c === 'ट्रांसजेंडर' || c === 'दत्तक') onSelect(relationWord(c, chip === c ? sub : ''));
    else onSelect(c);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {RELATION_CHIPS.map((opt) => {
          const selected = shown === opt;
          return (
            <Pressable key={opt} onPress={() => pick(opt)} style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5,
              alignItems: 'center', flexGrow: 1,
              backgroundColor: selected ? C.selectedBg : C.bg,
              borderColor: selected ? C.selectedBorder : C.border,
            }}>
              <Text style={{ fontSize: 13, fontWeight: selected ? '600' : '400', color: selected ? C.selectedText : C.text }}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {subs ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
          borderWidth: 1, borderStyle: 'dashed', borderColor: C.copyBorder, backgroundColor: C.copyBg,
          borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 11, color: C.copyText }}>{shown === 'दत्तक' ? 'दत्तक:' : 'किसके नाम से:'}</Text>
          {subs.map((s) => {
            const selected = chip === shown && sub === s;
            return (
              <Pressable key={s} onPress={() => onSelect(relationWord(shown as RelationChip, s))} style={{
                paddingVertical: 3, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                backgroundColor: selected ? C.selectedBg : C.cardBg,
                borderColor: selected ? C.selectedBorder : C.copyBorder,
              }}>
                <Text style={{ fontSize: 12, fontWeight: selected ? '600' : '400', color: selected ? C.selectedText : C.text }}>
                  {s === 'गुरु' ? 'अभिभावक / गुरु' : s}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});
RelationPicker.displayName = 'RelationPicker';

// ─── Small chips (ग्राम / कस्बा, पहचान पत्र) ─────────────────────────────────────
interface MiniChipsProps {
  C: ReturnType<typeof useGroupTokens>;
  options: readonly string[];
  value: string;
  onSelect: (v: string) => void;
  allowClear?: boolean;
}
const MiniChips = memo(({ C, options, value, onSelect, allowClear }: MiniChipsProps) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
    {options.map((o) => {
      const selected = value === o;
      return (
        <Pressable key={o} onPress={() => onSelect(allowClear && selected ? '' : o)} style={{
          paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1,
          backgroundColor: selected ? C.selectedBg : C.bg,
          borderColor: selected ? C.selectedBorder : C.border,
        }}>
          <Text style={{ fontSize: 12, fontWeight: selected ? '600' : '400', color: selected ? C.selectedText : C.text }}>{o}</Text>
        </Pressable>
      );
    })}
  </View>
));
MiniChips.displayName = 'MiniChips';

// ─── ग्राम / मजरा box with हल्का village suggestions ───────────────────────────
type VillageSuggestion = { name: string; note: string };
let villageCache: VillageSuggestion[] | null = null;
let villageLoading: Promise<VillageSuggestion[]> | null = null;
function loadVillages(): Promise<VillageSuggestion[]> {
  if (villageCache) return Promise.resolve(villageCache);
  if (!villageLoading) {
    villageLoading = Promise.all([getAllGramPanchayats().catch(() => []), getAllHamlets().catch(() => [])])
      .then(([gps, hamlets]) => {
        const seen = new Set<string>();
        const out: VillageSuggestion[] = [];
        for (const g of gps) if (g.name && !seen.has(g.name)) { seen.add(g.name); out.push({ name: g.name, note: 'ग्राम पंचायत' }); }
        for (const h of hamlets) if (h.name && !seen.has(h.name)) { seen.add(h.name); out.push({ name: h.name, note: h.gp_name ? `मजरा (ग्रा0पं0 ${h.gp_name})` : 'मजरा' }); }
        villageCache = out;
        return out;
      })
      .finally(() => { villageLoading = null; });
  }
  return villageLoading;
}

interface VillageInputProps {
  C: ReturnType<typeof useGroupTokens>;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
}
const VillageInput = memo(({ C, value, onChangeText, onBlur, hasError }: VillageInputProps) => {
  const [focused, setFocused] = useState(false);
  const [all, setAll] = useState<VillageSuggestion[]>(villageCache ?? []);
  useEffect(() => {
    if (!focused || villageCache) return;
    let alive = true;
    loadVillages().then((v) => { if (alive) setAll(v); }).catch(() => {});
    return () => { alive = false; };
  }, [focused]);
  const q = value.trim().toLowerCase();
  const list = focused && q
    ? all.filter((v) => v.name.toLowerCase().includes(q) && v.name.toLowerCase() !== q).slice(0, 6)
    : [];
  return (
    <View style={{ gap: 4 }}>
      <SimpleInput
        C={C}
        value={value}
        onChangeText={onChangeText}
        onBlur={() => { setTimeout(() => setFocused(false), 150); onBlur?.(); }}
        onFocus={() => setFocused(true)}
        placeholder="जैसे: भग्तिन खेड़ा"
        hasError={hasError}
      />
      {list.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.cardBg, overflow: 'hidden' }}>
          {list.map((v, i) => (
            <Pressable key={v.name} onPress={() => { onChangeText(v.name); setFocused(false); }} style={{
              paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center',
              borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: C.border,
            }}>
              <Text style={{ fontSize: 13, color: C.text }}>{v.name}</Text>
              <Text style={{ fontSize: 11, color: C.muted }}>· {v.note}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});
VillageInput.displayName = 'VillageInput';

// ─── Same-Address picker ───────────────────────────────────────────────────────
interface AddressPickerProps {
  C: ReturnType<typeof useGroupTokens>;
  priorEntries: PersonEntry[];
  onPick: (from: PersonEntry) => void;
  onClose: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}
const AddressPicker = memo(({ C, priorEntries, onPick, onClose, t }: AddressPickerProps) => (
  <View style={{ borderWidth: 1, borderColor: C.copyBorder, borderRadius: 10, backgroundColor: C.copyBg, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.copyBorder }}>
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: C.copyText }}>{t('group.person.addressPickerTitle')}</Text>
      <Pressable onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={14} color={C.muted} />
      </Pressable>
    </View>
    {priorEntries.map((e, i) => (
      <Pressable key={i} onPress={() => onPick(e)} style={{
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: i < priorEntries.length - 1 ? 1 : 0, borderBottomColor: C.copyBorder,
      }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: '500' }} numberOfLines={1}>
          {`${i + 1}. ${e.name.trim() || t('group.person.cardTitle', { number: i + 1 })}`}
        </Text>
        {hasAddress(e)
          ? <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }} numberOfLines={2}>{e.fullAddress.trim()}</Text>
          : <Text style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>{t('group.person.noAddressFilled')}</Text>}
      </Pressable>
    ))}
  </View>
));
AddressPicker.displayName = 'AddressPicker';

// ─── Single person card ───────────────────────────────────────────────────────

interface PersonCardProps {
  C: ReturnType<typeof useGroupTokens>;
  index: number;
  entry: PersonEntry;
  collapsed: boolean;
  cardErrors: CardErrors;
  touched: Set<string>;
  onToggleCollapse: (i: number) => void;
  onChange: (i: number, field: keyof PersonEntry, value: string) => void;
  onBlur: (i: number, field: keyof PersonEntry) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
  onScanPress: (i: number) => void;
  isScanning: boolean;
  scanError?: string;
  onDismissScanError?: () => void;
  /** Full entries array — card slices internally to derive priorEntries */
  allEntries: PersonEntry[];
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** आवेदक समूह: "आवेदक" / "आवेदिका" on the card (owner) */
  roleBadge?: string;
}

const PersonCard = memo(({
  C, index, entry, collapsed, cardErrors, touched,
  onToggleCollapse, onChange, onBlur, onRemove, canRemove,
  onScanPress, isScanning, scanError, onDismissScanError,
  allEntries, t, roleBadge,
}: PersonCardProps) => {
  const priorEntries = allEntries.slice(0, index);
  const [showPicker, setShowPicker] = useState(false);
  const hasErr = hasCardErrors(cardErrors);
  const fieldErr = (f: keyof PersonEntry) => touched.has(f as string) ? cardErrors[f] : undefined;

  // "+ और जानकारी": open when something is already filled there
  const [showMore, setShowMore] = useState(() =>
    !!((entry.altMobile ?? '').trim() || (entry.idNumber ?? '').trim() || (entry.email ?? '').trim() || (entry.remarks ?? '').trim()));
  const parts = addrModeOf(entry) === 'parts';

  /** Same पता as an earlier card: parts (or the typed address) copied over. */
  const copyFrom = useCallback((from: PersonEntry) => {
    if (addrModeOf(from) === 'parts') {
      onChange(index, 'addrMode', 'parts');
      for (const k of ['house', 'villageKind', 'thana', 'district', 'village'] as const) onChange(index, k, from[k] ?? '');
    } else {
      onChange(index, 'addrMode', 'free');
      onChange(index, 'fullAddress', from.fullAddress);
    }
  }, [onChange, index]);

  const handleCopyAddress = useCallback(() => {
    if (priorEntries.length === 1) copyFrom(priorEntries[0]);
    else setShowPicker((p) => !p);
  }, [priorEntries, copyFrom]);

  const handlePickAddress = useCallback((from: PersonEntry) => {
    copyFrom(from);
    setShowPicker(false);
  }, [copyFrom]);

  const summary = entry.name.trim()
    ? `${entry.name.trim()}${entry.gender ? ` (${entry.gender})` : ''}`
    : t('group.person.cardTitle', { number: index + 1 });

  return (
    <View style={{
      borderWidth: hasErr ? 1.5 : 1,
      borderColor: hasErr ? C.cardBorderErr : C.cardBorder,
      borderRadius: 14, backgroundColor: C.cardBg, overflow: 'hidden',
    }}>
      {/* Header */}
      <Pressable onPress={() => onToggleCollapse(index)} style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: hasErr ? '#FFF5F5' : C.headerBg,
        paddingHorizontal: 14, paddingVertical: 11, gap: 8,
      }}>
        <View style={{
          width: 24, height: 24, borderRadius: 12,
          backgroundColor: hasErr ? '#FEE2E2' : '#E5E7EB',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: hasErr ? '#B91C1C' : '#374151' }}>
            {index + 1}
          </Text>
        </View>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.text }} numberOfLines={1}>{summary}</Text>
        {roleBadge ? (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#92400E' }}>{roleBadge}</Text>
          </View>
        ) : null}
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

      {/* Body */}
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
              placeholder={t('group.person.namePlaceholder')}
              hasError={!!fieldErr('name')}
            />
          </FieldRow>

          <FieldRow C={C} label={t('group.fields.relationType')}>
            <RelationPicker
              C={C}
              value={entry.relationType}
              onSelect={(r) => onChange(index, 'relationType', r)}
            />
          </FieldRow>

          <FieldRow C={C} label={fatherLabel(entry.relationType)} error={fieldErr('fatherOrHusbandName')}>
            <AutocompleteInput
              fieldKey={FIELD_KEYS.father_husband_name}
              value={entry.fatherOrHusbandName}
              onChangeText={(v) => onChange(index, 'fatherOrHusbandName', v)}
              onBlur={() => onBlur(index, 'fatherOrHusbandName')}
              placeholder={t('group.person.fatherPlaceholder')}
              hasError={!!fieldErr('fatherOrHusbandName')}
            />
          </FieldRow>

          {/* fullAddress + Same-Address button */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: C.label, fontWeight: '500', flex: 1 }}>
                {parts ? 'पता' : t('group.fields.fullAddress')} <Text style={{ color: C.accent }}>*</Text>
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
            {parts ? (
              <View style={{ gap: 6 }}>
                <FieldRow C={C} label="मकान नं0 / मोहल्ला (वैकल्पिक)">
                  <SimpleInput C={C} value={entry.house ?? ''} onChangeText={(v) => onChange(index, 'house', v)} placeholder="जैसे: मकान 12, गांधी नगर" />
                </FieldRow>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 12, color: C.label, fontWeight: '500' }}>
                    {entry.villageKind === 'कस्बा' ? 'कस्बा' : 'ग्राम / मजरा'}
                  </Text>
                  <MiniChips C={C} options={['ग्राम', 'कस्बा']} value={entry.villageKind === 'कस्बा' ? 'कस्बा' : 'ग्राम'} onSelect={(v) => onChange(index, 'villageKind', v)} />
                </View>
                <VillageInput C={C} value={entry.village ?? ''} onChangeText={(v) => onChange(index, 'village', v)}
                  onBlur={() => onBlur(index, 'fullAddress')} hasError={!!fieldErr('fullAddress')} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <FieldRow C={C} label="थाना">
                      <SimpleInput C={C} value={entry.thana ?? ''} onChangeText={(v) => onChange(index, 'thana', v)} placeholder="थाना" />
                    </FieldRow>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldRow C={C} label="जनपद">
                      <SimpleInput C={C} value={entry.district ?? ''} onChangeText={(v) => onChange(index, 'district', v)} placeholder="जनपद" />
                    </FieldRow>
                  </View>
                </View>
                {entry.fullAddress.trim() ? (
                  <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.copyBorder, backgroundColor: C.copyBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
                    <Text style={{ fontSize: 12.5, color: C.copyText }}>📍 {entry.fullAddress}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <AutocompleteInput
                fieldKey={FIELD_KEYS.address}
                value={entry.fullAddress}
                onChangeText={(v) => onChange(index, 'fullAddress', v)}
                onBlur={() => onBlur(index, 'fullAddress')}
                placeholder={t('group.person.addressPlaceholder')}
                multiline
                hasError={!!fieldErr('fullAddress')}
              />
            )}
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

          <Pressable onPress={() => setShowMore((v) => !v)} style={{
            borderWidth: 1.5, borderStyle: 'dashed', borderColor: showMore ? C.copyBorder : C.border,
            borderRadius: 10, paddingVertical: 8, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: showMore ? C.copyText : C.muted }}>
              {showMore ? '− और जानकारी छिपाएँ' : '＋ और जानकारी'}
            </Text>
          </Pressable>
          {showMore ? (
            <View style={{ gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10 }}>
              <FieldRow C={C} label="दूसरा मोबाइल" error={fieldErr('altMobile')}>
                <SimpleInput C={C} value={entry.altMobile ?? ''}
                  onChangeText={(v) => onChange(index, 'altMobile', v.replace(/\D/g, '').slice(0, 10))}
                  onBlur={() => onBlur(index, 'altMobile')}
                  placeholder={t('group.fields.mobilePlaceholder')} keyboardType="phone-pad" hasError={!!fieldErr('altMobile')} />
              </FieldRow>
              <FieldRow C={C} label="पहचान पत्र">
                <MiniChips C={C} options={ID_TYPES} value={entry.idType ?? ''} onSelect={(v) => onChange(index, 'idType', v)} allowClear />
                <SimpleInput C={C} value={entry.idNumber ?? ''} onChangeText={(v) => onChange(index, 'idNumber', v)} placeholder="नंबर" />
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
              <FieldRow C={C} label="टिप्पणी">
                <SimpleInput C={C} value={entry.remarks ?? ''} onChangeText={(v) => onChange(index, 'remarks', v)}
                  placeholder="जैसे: पहले भी शिकायत, घर पर नहीं मिलता" multiline />
              </FieldRow>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
});
PersonCard.displayName = 'PersonCard';

// ─── Main export ───────────────────────────────────────────────────────────────

export interface PersonGroupInputProps {
  label?: string;
  value: string;
  onChange: (keyName: string, jsonValue: string) => void;
  onValidChange?: (keyName: string, isValid: boolean) => void;
  keyName: string;
  error?: string;
  /** Exactly one person (FIR वादी): no count badge, no "+ add" button. */
  single?: boolean;
  /** Address may stay empty (format key option {"addressOptional": true}, e.g. सुपुर्दगी लेने वाला). */
  addressOptional?: boolean;
  /** format field tip → "ⓘ कैसे भरें?" on the label line */
  hint?: string;
  /** आवेदक / विपक्षी समूह (key option {"role": …}, ppPeople.ts): word badge, own add label, "प्रार्थना पत्र से भरें" */
  role?: GroupRole;
}

export const PersonGroupInput = memo(({
  label, value, onChange, onValidChange, keyName, error, single, addressOptional, hint, role,
}: PersonGroupInputProps) => {
  const C = useGroupTokens();
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('group.person.defaultLabel');

  const validationMsgs = {
    nameRequired:    t('group.validation.nameRequired'),
    addressRequired: addressOptional ? '' : t('group.validation.addressRequired'),
    ageInvalid:      t('group.validation.ageInvalid'),
    mobileInvalid:   t('group.validation.mobileInvalid'),
    emailInvalid:    t('group.validation.emailInvalid'),
  };

  const entries = parsePersonGroup(value);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const [collapsedSet, setCollapsedSet] = React.useState<Set<number>>(new Set());
  const [allCardErrors, setAllCardErrors] = React.useState<CardErrors[]>(() =>
    entries.map((e) => validatePersonEntry(e, validationMsgs))
  );
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

  const prevLenRef = useRef(entries.length);
  useEffect(() => {
    if (prevLenRef.current !== entries.length) {
      setAllCardErrors(entries.map((e) => validatePersonEntry(e, validationMsgs)));
      setTouchedSets(entries.map((_, i) => touchedSets[i] ?? new Set<string>()));
      prevLenRef.current = entries.length;
    }
  }, [entries.length]);

  // Cards replaced from outside with the same count ("📁 मुकदमे से भरें" fills the blank card) → errors follow the new cards
  const prevValueRef = useRef(value);
  const reportValidityRef = useRef<((errors: CardErrors[]) => void) | null>(null);
  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    const next = entries.map((e) => validatePersonEntry(e, validationMsgs));
    setAllCardErrors(next);
    reportValidityRef.current?.(next);
  }, [value]);

  const reportValidity = useCallback((errors: CardErrors[]) => {
    if (!onValidChange) return;
    onValidChange(keyName, !errors.some(hasCardErrors));
  }, [onValidChange, keyName]);
  reportValidityRef.current = reportValidity;

  const toggleCollapse = useCallback((i: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const emit = useCallback((next: PersonEntry[]) => {
    onChange(keyName, JSON.stringify(next));
    const newErrors = next.map((e) => validatePersonEntry(e, validationMsgs));
    setAllCardErrors(newErrors);
    reportValidity(newErrors);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyName, onChange, reportValidity]);

  const handleChange = useCallback((i: number, field: keyof PersonEntry, val: string) => {
    const updated = entriesRef.current.map((e, idx) => {
      if (idx !== i) return e;
      const next = { ...e, [field]: val } as PersonEntry;
      // लिंग from the सम्बन्ध (owner: no gender buttons)
      if (field === 'relationType') {
        const g = genderOfRelation(val);
        if (g) next.gender = g as PersonEntry['gender'];
      }
      // पता parts → the full address every format prints
      if (ADDRESS_PARTS.includes(field) && addrModeOf(next) === 'parts') {
        next.addrMode = 'parts';
        next.fullAddress = composeAddress(next);
      }
      // a scanned / typed whole address on a card with no parts filled → keep it as typed
      if (field === 'fullAddress' && val.trim() && !(next.village ?? '').trim() && !(next.house ?? '').trim()) next.addrMode = 'free';
      return next;
    });
    entriesRef.current = updated;
    entriesRef.current = updated; // several changes in one go (copy पता, scan) build on each other
    emit(updated);
  }, [emit]);

  const handleBlur = useCallback((i: number, field: keyof PersonEntry) => {
    setTouchedSets((prev) => prev.map((s, idx) => idx === i ? new Set([...s, field as string]) : s));
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
          const fieldKeys: Array<keyof PersonEntry> = ['name', 'fatherOrHusbandName', 'fullAddress', 'age', 'mobile'];
          for (const key of fieldKeys) {
            const returnedVal = (json.fields as Record<string, unknown>)[key];
            if (typeof returnedVal === 'string' && returnedVal.trim()) {
              const existingVal = currentCard[key];
              const empty = key === 'fullAddress' ? !hasAddress(currentCard) : typeof existingVal === 'string' && !existingVal.trim();
              if (empty) {
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
    setCollapsedSet(new Set(entries.map((_, i) => i)));
    setTouchedSets((prev) => [...prev, new Set<string>()]);
    emit([...entries, newPerson(`per_${Date.now()}_${entries.length}`)]);
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
      {/* label (+ "ⓘ कैसे भरें?") and the count; the full-width "मुकदमे से … भरें" button below (owner, design B) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <LabelWithHint hint={hint} title={String(resolvedLabel)}>
            <Text style={{ fontSize: 12, color: C.label, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {resolvedLabel}
            </Text>
          </LabelWithHint>
        </View>
        {single ? null : (
          <View style={{ backgroundColor: '#F0F9FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, color: '#0369A1', fontWeight: '500' }}>
              {t('group.person.countBadge', { count: entries.length })}
            </Text>
          </View>
        )}
      </View>
      {/* "मुकदमे से भरें" (owner) — only inside a format fill screen */}
      <FirPeopleButton
        multi={!single}
        onInsert={(people) => onChange(keyName, single
          ? JSON.stringify([toCard(people[0], false, 0)])
          : insertIntoGroup(value, people.map((p, n) => toCard(p, false, n))))}
      />
      {role ? (
        <PPPeopleButton
          role={role}
          onInsert={(cards) => onChange(keyName, single ? JSON.stringify(cards.slice(0, 1)) : insertIntoGroup(value, cards))}
        />
      ) : null}

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
        <PersonCard
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
          t={t}
          roleBadge={role === 'avedak' && entry.name.trim() ? avedakCardWord(entry as unknown as Record<string, unknown>) : undefined}
        />
      ))}

      {single ? null : (
        <Pressable onPress={handleAdd} style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          borderWidth: 1.5, borderColor: C.addBorder, borderStyle: 'dashed',
          borderRadius: 12, paddingVertical: 12, backgroundColor: C.addBg,
        }}>
          <UserPlus size={15} color={C.addText} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.addText }}>
            {role === 'avedak' ? '+ आवेदक जोड़ें' : role === 'vipakshi' ? '+ विपक्षी जोड़ें' : t('group.person.addBtn')}
          </Text>
        </Pressable>
      )}

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

PersonGroupInput.displayName = 'PersonGroupInput';
