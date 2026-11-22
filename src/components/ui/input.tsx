/**
 * Universal Input System — Single Source of Truth for all InvestSuite form fields.
 *
 * Architecture Principles (strictly followed):
 *   • SSOT  — validation, keyboard mapping, formatting live here ONLY
 *   • Zero duplicate logic — no screen may re-implement any of this
 *   • Clean Architecture — pure UI component, zero business logic
 *   • Token-based — all colours/sizes from T (typography), THEME, H (headerTokens)
 *   • Backward compatible — the bare <Input> export still works as before
 *   • Extensible — add new types by extending INPUT_CONFIG only
 *
 * Supported types:
 *   text | multiline | number | decimal | mobile | telephone | age
 *   time | date | datetime | email | password | otp | search | pin
 *   aadhaar | vehicleNumber | registrationNumber | currency
 *
 * Usage:
 *   <Input type="mobile" label="Mobile" value={v} onChangeText={set} />
 *   <Input type="time"   label="Time"   value={v} onChangeText={set} />
 *   <Input type="age"    label="Age"    value={v} onChangeText={set} />
 *   <Input               label="Name"   value={v} onChangeText={set} />  ← bare = text
 */

import { courtPickSpecOf } from '@/lib/courtPick';
import { CourtPaperPick } from '@/components/formats/CourtPaperPick';
import { isMarkerDefault } from '@/lib/firFill';
import React, {
  forwardRef, memo, useEffect, useRef, useState, useCallback, useImperativeHandle,
} from 'react';
import {
  Platform, Pressable, Text, TextInput, View,
  type KeyboardTypeOptions, type ReturnKeyTypeOptions, type TextStyle, type ViewStyle,
} from 'react-native';
import { Calendar, ChevronDown, Eye, EyeOff, Lock, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { T } from '@/lib/typography';
import { THEME } from '@/lib/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { ItemGroupInput, parseItemGroupConfig } from './ItemGroupInput';
import { PAHAR_AUTO, paharFromTime, paharSource } from '@/lib/formatDerived';
import { useClearCopy } from '@/components/common/ClearCopyTools';
import { SentenceFieldInput } from './SentenceFieldInput';
import { HintLink, LabelWithHint } from './FieldHintLink';
import type { KeyDefForRender } from '@/lib/templateEngine';
import { multiChoiceSelected, multiChoiceToggle } from '@/lib/multiChoice';
import { CaseSuggest } from '@/components/common/CaseSuggest';
import { CourtSuggest } from '@/components/common/CourtSuggest';
import { isCourtKey } from '@/lib/courtNames';
import { changedLineIndex, isSewaKey, replaceLine } from '@/lib/sewaNames';
import type { CaseHit } from '@/lib/db/peopleRegistryRepo';
import { dateFormatOf, daysBetweenInclusive, daysSpecOf, formatDateValue, toIsoDate } from '@/lib/formatDerived';

// ─── Input Type Definitions ───────────────────────────────────────────────────

export type InputType =
  | 'text' | 'multiline' | 'number' | 'decimal' | 'mobile' | 'telephone'
  | 'age' | 'time' | 'date' | 'datetime' | 'email' | 'password' | 'otp'
  | 'search' | 'pin' | 'aadhaar' | 'vehicleNumber' | 'registrationNumber' | 'currency'
  // Police-specific types
  | 'firNumber' | 'gdNumber' | 'crimeNumber' | 'caseDiaryNumber'
  | 'petitionNumber' | 'pincode';

interface InputTypeConfig {
  keyboard:      KeyboardTypeOptions;
  maxLength?:    number;
  secure?:       boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKey?:    ReturnKeyTypeOptions;
}

// SSOT: every field-type's keyboard + constraints live here — screens declare NOTHING
const INPUT_CONFIG: Record<InputType, InputTypeConfig> = {
  text:               { keyboard: 'default',       autoCapitalize: 'sentences' },
  multiline:          { keyboard: 'default',       autoCapitalize: 'sentences' },
  number:             { keyboard: 'number-pad' },
  decimal:            { keyboard: 'decimal-pad' },
  mobile:             { keyboard: 'phone-pad',     maxLength: 13 },
  telephone:          { keyboard: 'phone-pad' },
  age:                { keyboard: 'number-pad',    maxLength: 3  },
  time:               { keyboard: 'number-pad',    maxLength: 5  },
  date:               { keyboard: 'default' },
  datetime:           { keyboard: 'default' },
  email:              { keyboard: 'email-address', autoCapitalize: 'none', returnKey: 'next' },
  password:           { keyboard: 'default',       secure: true, autoCapitalize: 'none' },
  otp:                { keyboard: 'number-pad',    maxLength: 6  },
  search:             { keyboard: 'web-search',    autoCapitalize: 'none', returnKey: 'search' },
  pin:                { keyboard: 'number-pad',    maxLength: 6  },
  aadhaar:            { keyboard: 'number-pad',    maxLength: 12 },
  vehicleNumber:      { keyboard: 'default',       autoCapitalize: 'characters', maxLength: 12 },
  registrationNumber: { keyboard: 'default',       autoCapitalize: 'characters' },
  currency:           { keyboard: 'decimal-pad' },
  // ── Police-specific types ──────────────────────────────────────────────
  firNumber:          { keyboard: 'default',       autoCapitalize: 'characters' },
  gdNumber:           { keyboard: 'number-pad' },
  crimeNumber:        { keyboard: 'default',       autoCapitalize: 'characters' },
  caseDiaryNumber:    { keyboard: 'default',       autoCapitalize: 'characters' },
  petitionNumber:     { keyboard: 'default',       autoCapitalize: 'characters' },
  pincode:            { keyboard: 'number-pad',    maxLength: 6  },
};

// ─── SSOT Formatters / Validators ─────────────────────────────────────────────

/** All input transformation / sanitisation lives here — zero duplication in screens */
function applyFormat(type: InputType, raw: string, prevValue: string): string {
  switch (type) {
    case 'mobile': {
      if (!raw.startsWith('+')) raw = '+' + raw.replace(/^\+*/, '');
      const digits = raw.slice(1).replace(/\D/g, '');
      const result = '+' + digits;
      return result.length <= 13 ? result : prevValue;
    }
    case 'age': {
      const d = raw.replace(/\D/g, '');
      return d.length <= 3 ? d : prevValue;
    }
    case 'time': {
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 0) return '';
      if (digits.length >= 3) {
        const hh = digits.slice(0, 2);
        const mm = digits.slice(2, 4);
        const h = parseInt(hh, 10);
        if (h > 23) return prevValue;
        return hh + ':' + mm;
      }
      return digits;
    }
    case 'number': {
      return raw.replace(/\D/g, '');
    }
    case 'decimal':
    case 'currency': {
      // Allow single decimal point; strip everything else non-numeric
      const parts = raw.replace(/[^0-9.]/g, '').split('.');
      if (parts.length > 2) return prevValue;
      return raw.replace(/[^0-9.]/g, '');
    }
    case 'otp':
    case 'pin': {
      return raw.replace(/\D/g, '');
    }
    case 'aadhaar': {
      return raw.replace(/\D/g, '').slice(0, 12);
    }
    case 'vehicleNumber': {
      return raw.toUpperCase();
    }
    case 'email': {
      return raw.replace(/\s/g, '').toLowerCase();
    }
    // ── Police-specific formatters ───────────────────────────────────────
    case 'firNumber':
    case 'crimeNumber':
    case 'caseDiaryNumber':
    case 'petitionNumber': {
      // Uppercase, strip leading/trailing spaces only — allow /, -, digits, letters
      return raw.toUpperCase();
    }
    case 'gdNumber': {
      // Numeric only (GD numbers are sequential integers)
      return raw.replace(/\D/g, '');
    }
    case 'pincode': {
      return raw.replace(/\D/g, '').slice(0, 6);
    }
    default:
      return raw;
  }
}

function isValidTime(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InputProps {
  // Type
  type?: InputType;

  // Content
  label?: string;
  /** format field tip → "ⓘ कैसे भरें?" at the right of the label line (FieldHintLink.tsx) */
  labelHint?: string;
  placeholder?: string;
  value: string;
  defaultValue?: string;

  // Validation state
  required?: boolean;
  errorText?: string;
  successText?: string;
  helperText?: string;

  // Behaviour
  disabled?: boolean;
  readOnly?: boolean;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  /**
   * Multiline only (owner: "flexible box"): start small (2 lines, or as tall as the placeholder example) and grow line by line
   * with the text instead of a fixed numberOfLines height. Opt-in per screen (मुकदमा + केस डायरी keep the old fixed height).
   */
  autoGrow?: boolean;
  maxLength?: number;

  // Decorators
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  prefix?: string;
  suffix?: string;

  // Interaction
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: ReturnKeyTypeOptions;
  onFocus?: () => void;
  onBlur?: () => void;
  onChangeText?: (v: string) => void;
  onSubmitEditing?: () => void;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;

  // Style overrides (discouraged — tokens preferred)
  style?: ViewStyle;
  containerStyle?: ViewStyle;

  // Legacy className support (used by the bare <Input> shadcn compat export)
  className?: string;

  /** ✕ / 📋 inside the filled box (name / father / address fields). */
  clearCopy?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Input = memo(forwardRef<TextInput, InputProps>(function Input(
  {
    type = 'text',
    label,
    labelHint,
    placeholder,
    value,
    required,
    errorText,
    successText,
    helperText,
    disabled = false,
    readOnly = false,
    editable,
    multiline: multilineProp,
    numberOfLines = 3,   // single-line default; multiline type uses 5 via FormatKeyInput
    autoGrow = false,
    maxLength: maxLengthProp,
    leftIcon,
    rightIcon,
    prefix,
    suffix,
    autoFocus,
    autoCapitalize: autoCapitalizeProp,
    returnKeyType,
    onFocus,
    onBlur,
    onChangeText,
    onSubmitEditing,
    accessibilityLabel,
    accessibilityHint,
    style,
    containerStyle,
    className,
    clearCopy,
  },
  ref
) {
  const { colorScheme } = useColorScheme();
  const C = {
    border:       colorScheme === 'dark' ? THEME.dark.border : THEME.light.border,
    borderFocus:  colorScheme === 'dark' ? THEME.dark.foreground : THEME.light.foreground,
    borderError:  colorScheme === 'dark' ? THEME.dark.destructive : THEME.light.destructive,
    borderOk:     '#16A34A',
    text:         colorScheme === 'dark' ? THEME.dark.foreground : THEME.light.foreground,
    placeholder:  colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
    bg:           colorScheme === 'dark' ? THEME.dark.card : THEME.light.card,
    bgDisabled:   colorScheme === 'dark' ? THEME.dark.secondary : THEME.light.secondary,
    label:        colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
    helper:       colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
    error:        colorScheme === 'dark' ? THEME.dark.destructive : THEME.light.destructive,
    success:      '#16A34A',
    iconMuted:    colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
  } as const;

  const cfg = INPUT_CONFIG[type];
  const internalRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => internalRef.current as TextInput);

  const [focused, setFocused] = useState(false);
  const [timeInvalid, setTimeInvalid] = useState(false);
  const [secure, setSecure] = useState(cfg.secure ?? false);
  const prevValue = useRef(value);

  // Resolve effective props from type config + overrides
  const isMultiline   = multilineProp ?? (type === 'multiline');
  const isDisabled    = disabled || readOnly || editable === false;
  const isPassword    = type === 'password';
  const isSearch      = type === 'search';
  const effectiveMaxLength = maxLengthProp ?? cfg.maxLength;
  const effectiveCap  = autoCapitalizeProp ?? cfg.autoCapitalize ?? 'sentences';
  const effectiveRK   = returnKeyType ?? cfg.returnKey ?? 'done';
  const effectiveKB   = cfg.keyboard;

  const hasError   = !!errorText || (type === 'time' && timeInvalid);
  const hasSuccess = !!successText && !hasError;

  const handleChangeText = useCallback((raw: string) => {
    if (!onChangeText) return;
    const formatted = applyFormat(type, raw, prevValue.current);
    prevValue.current = formatted;
    if (type === 'time') setTimeInvalid(false);
    onChangeText(formatted);
  }, [onChangeText, type]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    // mobile: insert '+' on first focus if empty
    if (type === 'mobile' && !value) onChangeText?.('+');
    onFocus?.();
  }, [onFocus, type, value, onChangeText]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    if (type === 'time' && value && !isValidTime(value)) setTimeInvalid(true);
    onBlur?.();
  }, [onBlur, type, value]);

  const handleClear = useCallback(() => {
    onChangeText?.('');
    internalRef.current?.focus();
  }, [onChangeText]);

  // ── Border color ──────────────────────────────────────────────────────────
  const borderColor = hasError
    ? C.borderError
    : hasSuccess
      ? C.borderOk
      : focused
        ? C.borderFocus
        : C.border;
  const borderWidth = focused ? 1.5 : 1;

  // ── Input container style ──────────────────────────────────────────────────
  const containerBaseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: isMultiline ? 'flex-start' : 'center',
    borderWidth,
    borderColor,
    borderRadius: 12,
    paddingHorizontal: T.space.md,
    paddingVertical: 11,
    backgroundColor: isDisabled ? C.bgDisabled : C.bg,
    // autoGrow: 2 lines minimum, then the box follows its text (no fixed number of lines)
    minHeight: isMultiline ? (autoGrow ? 2 * 24 + 22 : numberOfLines * 24 + 22) : T.minTouchTarget,
    gap: T.space.xs,
    ...(Platform.OS !== 'web' ? { borderCurve: 'continuous' } as unknown as ViewStyle : {}),
  };

  const tools = useClearCopy(value, (v) => onChangeText?.(v), !!clearCopy && !disabled && !readOnly);

  // ── Right slot ──────────────────────────────────────────────────────────────
  let rightSlot: React.ReactNode = rightIcon ?? null;
  if (isPassword) {
    rightSlot = (
      <Pressable
        onPress={() => setSecure((s) => !s)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={secure ? 'Show password' : 'Hide password'}
      >
        {secure
          ? <Eye   size={18} color={C.iconMuted} />
          : <EyeOff size={18} color={C.iconMuted} />}
      </Pressable>
    );
  } else if (isSearch && value.length > 0) {
    rightSlot = (
      <Pressable
        onPress={handleClear}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Clear"
      >
        <X size={14} color={C.iconMuted} />
      </Pressable>
    );
  }

  if (tools.icons) rightSlot = rightSlot ? <>{rightSlot}{tools.icons}</> : tools.icons;

  const inputStyle: TextStyle = {
    flex: 1,
    ...T.subhead,
    color: C.text,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    // Remove native outlines
    // @ts-ignore web-only
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0 } as TextStyle }),
  };

  const errorOrTimeMsg = type === 'time' && timeInvalid
    ? 'Enter a valid 24-hour time (HH:MM)'
    : errorText;

  const bottomMsg   = errorOrTimeMsg ?? successText ?? helperText;
  const bottomColor = hasError ? C.error : hasSuccess ? C.success : C.helper;

  return (
    <View style={[{ gap: T.space.xs }, containerStyle]}>
      {/* Label */}
      {label ? (
        <LabelWithHint hint={labelHint} title={typeof label === 'string' ? label : undefined}>
          <Text style={{ ...T.caption1, color: hasError ? C.error : C.label, fontWeight: T.weight.medium } as TextStyle}>
            {/* Labels from formats may already end in '*'; show only one */}
            {required && typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label}
            {required ? <Text style={{ color: C.error }}> *</Text> : null}
          </Text>
        </LabelWithHint>
      ) : null}

      {/* Input row */}
      <Pressable
        onPress={() => !isDisabled && internalRef.current?.focus()}
        style={[containerBaseStyle, style]}
        accessible={false}
      >
        {leftIcon ? (
          <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            {leftIcon}
          </View>
        ) : null}

        {prefix ? (
          <Text style={{ ...T.subhead, color: C.placeholder } as TextStyle}>{prefix}</Text>
        ) : null}

        <TextInput
          ref={internalRef}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder ?? (type === 'time' ? 'HH:MM' : undefined)}
          placeholderTextColor={C.placeholder}
          keyboardType={effectiveKB}
          secureTextEntry={secure}
          multiline={isMultiline}
          numberOfLines={isMultiline && !autoGrow ? numberOfLines : undefined}
          // grow with the text instead of scrolling inside the box (the page scrolls)
          scrollEnabled={isMultiline && autoGrow ? false : undefined}
          textAlignVertical={isMultiline ? 'top' : 'center'}
          editable={!isDisabled}
          maxLength={effectiveMaxLength}
          autoFocus={autoFocus}
          autoCapitalize={effectiveCap}
          returnKeyType={effectiveRK}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint}
          accessibilityRole={isSearch ? 'search' : 'none'}
          underlineColorAndroid="transparent"
          style={inputStyle}
          className={className}
        />

        {suffix ? (
          <Text style={{ ...T.subhead, color: C.placeholder } as TextStyle}>{suffix}</Text>
        ) : null}

        {rightSlot ? (
          <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            {rightSlot}
          </View>
        ) : null}
      </Pressable>

      {tools.notice}

      {/* Helper / error / success */}
      {bottomMsg ? (
        <Text style={{ ...T.caption1, color: bottomColor } as TextStyle}>
          {bottomMsg}
        </Text>
      ) : null}
    </View>
  );
}));

Input.displayName = 'Input';

// ─── FormatKeyInput ───────────────────────────────────────────────────────────
/**
 * SSOT replacement for the deleted RequiredFieldInput component.
 *
 * Renders a dynamic template key as a labelled <Input> with:
 *   • Red * for required fields
 *   • Inline error text (auto-dismissed on typing)
 *   • forwardRef for parent scroll-to-field
 *   • Automatic keyboard / type selection from field_type
 *
 * Props match the old RequiredFieldInput API for zero-diff call-site migration:
 *   keyDef   — FormatKey-compatible object
 *   value    — current string value
 *   onChange — (keyName: string, value: string) => void
 *   error    — optional validation error string
 */
export interface FormatKeyDef {
  id?: string;
  key_name: string;
  label?: string | null;
  field_type?: 'text' | 'multiline' | 'number' | 'date' | 'dropdown' | 'accused_group' | string;
  is_required?: number | boolean;
  default_value?: string | null;
  /** dropdown only: JSON array of strings or {value,label} objects (comma list also accepted). */
  dropdown_options?: string | null;
}

/**
 * Grey example text for a field ({"placeholder": "जैसे: …"} in dropdown_options) — shown in the empty box,
 * gone on typing, never printed.
 */
export function keyPlaceholder(raw: string | null | undefined): string | undefined {
  const t = String(raw ?? '').trim();
  if (!t.startsWith('{')) return undefined;
  try {
    const v = JSON.parse(t) as { placeholder?: unknown };
    return typeof v.placeholder === 'string' && v.placeholder.trim() ? v.placeholder : undefined;
  } catch { return undefined; }
}

/** Parse dropdown_options → [{ value, label }]. */
export function parseDropdownOptions(raw: string | null | undefined): { value: string; label: string }[] {
  const t = String(raw ?? '').trim();
  if (!t) return [];
  try {
    let arr = JSON.parse(t) as unknown;
    // {"options": [...], "showIf": "..."} — list plus a show condition (formatShowIf.ts)
    if (arr && typeof arr === 'object' && !Array.isArray(arr)) arr = (arr as { options?: unknown }).options ?? [];
    if (Array.isArray(arr)) {
      return arr
        .map((o) => (typeof o === 'string'
          ? { value: o, label: o }
          : { value: String((o as { value?: unknown }).value ?? ''), label: String((o as { label?: unknown }).label ?? (o as { value?: unknown }).value ?? '') }))
        .filter((o) => o.value.trim());
    }
  } catch { /* not JSON → comma list */ }
  return t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => ({ value: x, label: x }));
}

export interface FormatKeyInputProps {
  keyDef: FormatKeyDef;
  value: string;
  onChange: (keyName: string, value: string) => void;
  error?: string;
  /** sentence fields: the whole form (other tokens in the card text are shown filled). */
  allValues?: Record<string, string>;
  allKeys?: KeyDefForRender[];
  /** multiline boxes start small and grow with the text (owner) — passed by the fill screens that want it. */
  autoGrow?: boolean;
}

function fieldTypeToInputType(ft: string | undefined): InputType {
  switch (ft) {
    case 'multiline': return 'multiline';
    case 'number':    return 'number';
    case 'decimal':   return 'decimal';   // अक्षांश / देशान्तर — keeps the "."
    case 'date':      return 'date';
    default:          return 'text';
  }
}

/**
 * How-to-write tip under a field ({"hint": "…"} in dropdown_options — owner: every 170/126/135 field) — never printed.
 */
export function keyHint(raw: string | null | undefined, fieldType?: string | null): string | undefined {
  const t = String(raw ?? '').trim();
  if (!t.startsWith('{')) return undefined;
  try {
    // a "sentence" field already uses "hint" for its own card prompt → its tip is under "tip"
    const v = JSON.parse(t) as { hint?: unknown; tip?: unknown };
    const h = fieldType === 'sentence' ? v.tip : v.hint;
    return typeof h === 'string' && h.trim() ? h.trim() : undefined;
  } catch { return undefined; }
}

export const FormatKeyInput = forwardRef<View, FormatKeyInputProps>((props, ref) => <FormatKeyField ref={ref} {...props} />);

const FormatKeyField = forwardRef<View, FormatKeyInputProps>(
  ({ keyDef, value, onChange, error, allValues, allKeys, autoGrow }, ref) => {
    const fieldType = keyDef.field_type ?? 'text';
    const displayLabel = keyDef.label || keyDef.key_name;
    const required = Boolean(keyDef.is_required);
    // "ⓘ कैसे भरें?" at the right end of the label line (owner, design B)
    const hint = keyHint(keyDef.dropdown_options, fieldType);

    // ── कुल दिवस (owner): worked out from two dates, locked — the report gets it from formatDerived ──
    const daysSpec = daysSpecOf(keyDef.dropdown_options);
    if (daysSpec) {
      return (
        <FormatKeyDaysBox
          ref={ref}
          displayLabel={displayLabel}
          days={daysBetweenInclusive(allValues?.[daysSpec.from], allValues?.[daysSpec.to])}
          bothSet={!!toIsoDate(allValues?.[daysSpec.from]) && !!toIsoDate(allValues?.[daysSpec.to])}
        />
      );
    }

    // ── Date field — dedicated date-picker trigger + modal ───────────────────
    if (fieldType === 'date') {
      return (
        <FormatKeyDateInput
          ref={ref}
          keyDef={keyDef}
          value={value}
          onChange={onChange}
          error={error}
          displayLabel={displayLabel}
          hint={hint}
          required={required}
        />
      );
    }

    // ── Sentence: situation card + tappable blanks (src/lib/sentenceField.ts) ──
    if (fieldType === 'sentence') {
      return (
        <SentenceFieldInput
          ref={ref}
          keyName={keyDef.key_name}
          configRaw={keyDef.dropdown_options}
          value={value}
          onChange={onChange}
          displayLabel={displayLabel}
          hint={hint}
          required={required}
          error={error}
          allValues={allValues}
          allKeys={allKeys}
        />
      );
    }

    // ── Item list (rows with format-defined columns, e.g. vehicles + drivers) ──
    if (fieldType === 'item_group') {
      return (
        <ItemGroupInput
          ref={ref}
          keyName={keyDef.key_name}
          config={parseItemGroupConfig(keyDef.dropdown_options)}
          value={value}
          onChange={onChange}
          displayLabel={displayLabel}
          hint={hint}
          required={required}
          error={error}
          allValues={allValues}
        />
      );
    }

    // ── Checkbox — tick = "हाँ", empty = not ticked (format text uses {{if:Key|…}}) ──
    if (fieldType === 'checkbox') {
      return (
        <FormatKeyCheckboxInput
          ref={ref}
          keyName={keyDef.key_name}
          value={value}
          onChange={onChange}
          displayLabel={displayLabel}
          hint={hint}
        />
      );
    }

    // ── Checklist — several ticks, value "A, B" (src/lib/multiChoice.ts) ──
    if (fieldType === 'multi_choice') {
      const options = parseDropdownOptions(keyDef.dropdown_options);
      if (options.length) {
        return (
          <FormatKeyMultiChoiceInput
            ref={ref}
            keyName={keyDef.key_name}
            options={options}
            value={value}
            onChange={onChange}
            error={error}
            displayLabel={displayLabel}
            hint={hint}
            required={required}
          />
        );
      }
    }

    // ── Dropdown — one tap on an option (chips, like the संबंध प्रकार buttons) ──
    if (fieldType === 'dropdown') {
      const options = parseDropdownOptions(keyDef.dropdown_options);
      if (options.length) {
        const dd = (
          <FormatKeyDropdownInput
            ref={ref}
            keyName={keyDef.key_name}
            options={options}
            value={value}
            onChange={onChange}
            error={error}
            displayLabel={displayLabel}
            hint={hint}
            required={required}
          />
        );
        // "न्यायालय से लंबित काग़ज़ चुनें" under this dropdown (key option courtPick / courtFill — src/lib/courtPick.ts)
        const pickSpec = courtPickSpecOf(keyDef.dropdown_options);
        if (pickSpec) {
          return (
            <View>
              {dd}
              <CourtPaperPick spec={pickSpec} choice={value} allValues={allValues} onChange={onChange} />
            </View>
          );
        }
        // पहर worked out from a time (formatDerived.ts): say what "समय से" will print
        const paharFrom = paharSource(keyDef.dropdown_options);
        if (!paharFrom) return dd;
        const auto = !value?.trim() || value.trim() === PAHAR_AUTO;
        const time = allValues?.[paharFrom] ?? '';
        const p = paharFromTime(time);
        return (
          <View style={{ gap: 4 }}>
            {dd}
            {auto ? (
              <Text className="text-xs" style={{ ...(p ? { color: '#15803D' } : {}) }}>
                {p ? `अपने आप: ${p} (समय ${time.trim()} से)` : 'समय भरने पर पहर अपने आप लगेगा'}
              </Text>
            ) : null}
          </View>
        );
      }
    }

    const inputType = fieldTypeToInputType(fieldType);
    // multiline fields get 5 rows (~120 px) so police report text has breathing room
    const multilineLines = fieldType === 'multiline' ? 5 : undefined;
    // सेवा में (owner): {"sewa": true} boxes list the owner's officers / offices for the line being typed
    if (isSewaKey(keyDef.dropdown_options) && inputType !== 'date') {
      return (
        <FormatSewaInput
          ref={ref}
          keyDef={keyDef}
          value={value}
          onChange={onChange}
          error={error}
          displayLabel={displayLabel}
          hint={hint}
          required={required}
          inputType={inputType}
          multilineProps={multilineLines !== undefined ? (autoGrow ? { autoGrow: true } : { numberOfLines: multilineLines }) : {}}
        />
      );
    }
    // न्यायालय के नाम (owner): court-name boxes ({"court": true}) list the owner's courts + own names while typing
    if (isCourtKey(keyDef.dropdown_options) && inputType !== 'date') {
      return (
        <FormatCourtInput
          ref={ref}
          keyDef={keyDef}
          value={value}
          onChange={onChange}
          error={error}
          displayLabel={displayLabel}
          hint={hint}
          required={required}
          inputType={inputType}
          multilineProps={multilineLines !== undefined ? (autoGrow ? { autoGrow: true } : { numberOfLines: multilineLines }) : {}}
        />
      );
    }
    // मु0अ0सं0 / धारा boxes (owner, "पूरे app से सुझाव" step 2): cases listed while typing; a pick fills both boxes
    const caseRole = caseRoleOf(keyDef.default_value);
    if (caseRole && inputType !== 'date') {
      const partner = allKeys?.find((k) => caseRoleOf(k.default_value) === (caseRole === 'no' ? 'sec' : 'no'))?.key_name;
      return (
        <FormatCaseInput
          ref={ref}
          keyDef={keyDef}
          value={value}
          onChange={onChange}
          error={error}
          role={caseRole}
          partnerKey={partner}
          displayLabel={displayLabel}
          hint={hint}
          required={required}
          inputType={inputType}
          multilineProps={multilineLines !== undefined ? (autoGrow ? { autoGrow: true } : { numberOfLines: multilineLines }) : {}}
        />
      );
    }
    return (
      <View ref={ref}>
        <Input
          type={inputType}
          label={displayLabel} // <Input> adds the red * for required fields
          labelHint={hint}
          placeholder={keyPlaceholder(keyDef.dropdown_options) ?? (isMarkerDefault(keyDef.default_value) ? undefined : keyDef.default_value) ?? `Enter ${displayLabel}`}
          value={value}
          onChangeText={(v) => onChange(keyDef.key_name, v)}
          errorText={error}
          required={required}
          // ✕ / 📋 in every typed format box (owner)
          clearCopy={inputType !== 'date'}
          {...(multilineLines !== undefined ? (autoGrow ? { autoGrow: true } : { numberOfLines: multilineLines }) : {})}
        />
      </View>
    );
  }
);

// ── FormatCaseInput — मु0अ0सं0 / धारा box with case suggestions (owner) ─────────────────────────────

/** 'no' for a @FIR.fir_number box, 'sec' for a @FIR.section box, else null. */
function caseRoleOf(defaultValue: string | null | undefined): 'no' | 'sec' | null {
  const d = String(defaultValue ?? '');
  if (d.startsWith('@FIR.fir_number')) return 'no';
  if (d.startsWith('@FIR.section')) return 'sec';
  return null;
}

const FormatCaseInput = forwardRef<View, {
  keyDef: FormatKeyDef; value: string; onChange: (keyName: string, value: string) => void; error?: string;
  role: 'no' | 'sec'; partnerKey?: string; displayLabel: string; hint?: string; required: boolean; inputType: InputType;
  multilineProps: { autoGrow?: boolean; numberOfLines?: number };
}>(({ keyDef, value, onChange, error, role, partnerKey, displayLabel, hint, required, inputType, multilineProps }, ref) => {
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  const pick = (h: CaseHit) => {
    setFocused(false);
    // both boxes together (owner): this one and its partner
    onChange(keyDef.key_name, role === 'no' ? h.firNumber : h.section);
    if (partnerKey) onChange(partnerKey, role === 'no' ? h.section : h.firNumber);
  };
  return (
    <View ref={ref}>
      <Input
        type={inputType}
        label={displayLabel}
        labelHint={hint}
        placeholder={keyPlaceholder(keyDef.dropdown_options) ?? (isMarkerDefault(keyDef.default_value) ? undefined : keyDef.default_value) ?? `Enter ${displayLabel}`}
        value={value}
        onChangeText={(v) => onChange(keyDef.key_name, v)}
        onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 200); }}
        errorText={error}
        required={required}
        clearCopy
        {...multilineProps}
      />
      <CaseSuggest query={value} active={focused} onPick={pick} />
    </View>
  );
});
FormatCaseInput.displayName = 'FormatCaseInput';

// ── FormatCourtInput — न्यायालय के नाम box with court suggestions (owner) ─────────────────────────────

const FormatCourtInput = forwardRef<View, {
  keyDef: FormatKeyDef; value: string; onChange: (keyName: string, value: string) => void; error?: string;
  displayLabel: string; hint?: string; required: boolean; inputType: InputType;
  multilineProps: { autoGrow?: boolean; numberOfLines?: number };
}>(({ keyDef, value, onChange, error, displayLabel, hint, required, inputType, multilineProps }, ref) => {
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  return (
    <View ref={ref}>
      <Input
        type={inputType}
        label={displayLabel}
        labelHint={hint}
        placeholder={keyPlaceholder(keyDef.dropdown_options) ?? (isMarkerDefault(keyDef.default_value) ? undefined : keyDef.default_value) ?? `Enter ${displayLabel}`}
        value={value}
        onChangeText={(v) => onChange(keyDef.key_name, v)}
        onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 200); }}
        errorText={error}
        required={required}
        clearCopy
        {...multilineProps}
      />
      <CourtSuggest query={value} active={focused} onPick={(name) => { setFocused(false); onChange(keyDef.key_name, name); }} />
    </View>
  );
});
FormatCourtInput.displayName = 'FormatCourtInput';

// ── FormatSewaInput — "सेवा में" box with officer / office suggestions (owner) ─────────────────────────
// A सेवा में box may hold several lines (पद, सर्किल, जनपद …): the list follows the line being typed and a pick
// replaces only that line (sewaNames.changedLineIndex / replaceLine).

const FormatSewaInput = forwardRef<View, {
  keyDef: FormatKeyDef; value: string; onChange: (keyName: string, value: string) => void; error?: string;
  displayLabel: string; hint?: string; required: boolean; inputType: InputType;
  multilineProps: { autoGrow?: boolean; numberOfLines?: number };
}>(({ keyDef, value, onChange, error, displayLabel, hint, required, inputType, multilineProps }, ref) => {
  const [focused, setFocused] = useState(false);
  const [line, setLine] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  const lines = String(value ?? '').split('\n');
  const query = lines[Math.min(line, lines.length - 1)] ?? '';
  return (
    <View ref={ref}>
      <Input
        type={inputType}
        label={displayLabel}
        labelHint={hint}
        placeholder={keyPlaceholder(keyDef.dropdown_options) ?? (isMarkerDefault(keyDef.default_value) ? undefined : keyDef.default_value) ?? `Enter ${displayLabel}`}
        value={value}
        onChangeText={(v) => { setLine(changedLineIndex(String(value ?? ''), v)); onChange(keyDef.key_name, v); }}
        onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 200); }}
        errorText={error}
        required={required}
        clearCopy
        {...multilineProps}
      />
      <CourtSuggest
        kind="sewa"
        query={query}
        active={focused}
        onPick={(name) => { setFocused(false); onChange(keyDef.key_name, replaceLine(String(value ?? ''), line, name)); }}
      />
    </View>
  );
});
FormatSewaInput.displayName = 'FormatSewaInput';

// ── FormatKeyDaysBox — locked "कुल दिवस" (owner: filled from the two dates, the officer cannot change it) ──

const FormatKeyDaysBox = forwardRef<View, { displayLabel: string; days: string; bothSet: boolean }>(
  ({ displayLabel, days, bothSet }, ref) => {
    const { colorScheme } = useColorScheme();
    const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
    const wrong = bothSet && !days; // "कब तक" before "कब से"
    return (
      <View ref={ref} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: c.mutedForeground }}>{displayLabel}</Text>
          <Lock size={14} color={c.mutedForeground} />
        </View>
        <View
          accessibilityLabel={days ? `${displayLabel} ${days} दिवस` : displayLabel}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14,
            borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: wrong ? c.destructive : c.border, backgroundColor: c.muted,
          }}
        >
          {days ? (
            <>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.foreground }}>{days} दिवस</Text>
              <Text style={{ fontSize: 12, color: c.primary }}>✓ अपने-आप</Text>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: c.mutedForeground }}>दोनों तारीख चुनें — अपने-आप भरेगा</Text>
          )}
        </View>
        {wrong ? <Text style={{ fontSize: 12, color: c.destructive }}>{'"कब तक" की तारीख "कब से" के बाद की होनी चाहिए'}</Text> : null}
      </View>
    );
  },
);
FormatKeyDaysBox.displayName = 'FormatKeyDaysBox';

// ── FormatKeyDropdownInput — option chips for field_type=dropdown ────────────

const FormatKeyDropdownInput = forwardRef<View, {
  keyName: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (keyName: string, value: string) => void;
  error?: string;
  displayLabel: string;
  required: boolean;
  hint?: string;
}>(({ keyName, options, value, onChange, error, displayLabel, required, hint }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#4ADE80' : '#15803D';
  return (
    <View ref={ref} style={{ gap: T.space.xs }}>
      <LabelWithHint hint={hint} title={displayLabel}>
        <Text style={{ ...T.caption1, color: error ? c.destructive : c.mutedForeground, fontWeight: T.weight.medium } as TextStyle}>
          {String(displayLabel).replace(/\s*\*+\s*$/, '')}
          {required ? <Text style={{ color: c.destructive }}> *</Text> : null}
        </Text>
      </LabelWithHint>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(keyName, o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              style={{
                // compact chip, a little bigger than a pill (owner: the old 96px-wide boxes were too big)
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, alignItems: 'center',
                borderWidth: on ? 2 : 1, borderColor: on ? green : (error ? c.destructive : c.border),
                backgroundColor: on ? `${green}14` : c.card,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={{ ...T.caption1, color: c.destructive } as TextStyle}>{error}</Text> : null}
    </View>
  );
});

FormatKeyDropdownInput.displayName = 'FormatKeyDropdownInput';

// ── FormatKeyMultiChoiceInput — checklist for field_type=multi_choice ─────────

const FormatKeyMultiChoiceInput = forwardRef<View, {
  keyName: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (keyName: string, value: string) => void;
  error?: string;
  displayLabel: string;
  required: boolean;
  hint?: string;
}>(({ keyName, options, value, onChange, error, displayLabel, required, hint }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#4ADE80' : '#15803D';
  const selected = multiChoiceSelected(value);
  const order = options.map((o) => o.value);
  return (
    <View ref={ref} style={{ gap: T.space.xs }}>
      <LabelWithHint hint={hint} title={displayLabel}>
        <Text style={{ ...T.caption1, color: error ? c.destructive : c.mutedForeground, fontWeight: T.weight.medium } as TextStyle}>
          {String(displayLabel).replace(/\s*\*+\s*$/, '')}
          {required ? <Text style={{ color: c.destructive }}> *</Text> : null}
          {selected.length ? <Text style={{ color: green, fontWeight: '700' }}>{`  (${selected.length} चुने)`}</Text> : null}
        </Text>
      </LabelWithHint>
      <View style={{ borderWidth: 1, borderColor: error ? c.destructive : c.border, borderRadius: 12, backgroundColor: c.card, overflow: 'hidden' }}>
        {options.map((o, i) => {
          const on = selected.includes(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(keyName, multiChoiceToggle(value, o.value, order))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9,
                borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: on ? `${green}14` : 'transparent',
              }}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? green : c.mutedForeground,
                backgroundColor: on ? green : 'transparent', alignItems: 'center', justifyContent: 'center',
              }}>
                {on ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 18 }}>✓</Text> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>
                {`${i + 1}. ${o.label}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={{ ...T.caption1, color: c.destructive } as TextStyle}>{error}</Text> : null}
    </View>
  );
});

FormatKeyMultiChoiceInput.displayName = 'FormatKeyMultiChoiceInput';

// ── FormatKeyCheckboxInput — tick box for field_type=checkbox ───────────────

/** "अंत में लिखें: "…"" → title "अंत में लिखें" + note ""…""; also "(…)" after a title. Short labels stay whole. */
export function splitTickLabel(label: string): { title: string; note: string } {
  const l = String(label ?? '').replace(/\s*\*+\s*$/, '').trim();
  const m = /^(.{2,40}?)\s*(?::|—|–)\s*(.+)$/.exec(l) ?? /^(.{2,40}?)\s*(\(.+\))$/.exec(l);
  // never split inside a quote (नीचे "दिनांक : " की लाइन)
  if (!m || (m[1].match(/"/g) ?? []).length % 2 === 1) return { title: l, note: '' };
  return { title: m[1].trim(), note: m[2].trim() };
}

/**
 * Format tick (field_type=checkbox) — owner, design B: a row with the title (+ small ⓘ) and a light note under it, and an
 * on / off switch on the right. Value "हाँ" / '' as before (printing unchanged). THEME colours, light + dark.
 */
const FormatKeyCheckboxInput = forwardRef<View, {
  keyName: string;
  value: string;
  onChange: (keyName: string, value: string) => void;
  displayLabel: string;
  hint?: string;
}>(({ keyName, value, onChange, displayLabel, hint }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#22C55E' : '#16A34A';
  const on = value.trim() !== '' && !/^(नहीं|no|false|0)$/i.test(value.trim());
  const { title, note } = splitTickLabel(displayLabel);
  return (
    <View ref={ref}>
      <Pressable
        onPress={() => onChange(keyName, on ? '' : 'हाँ')}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={displayLabel}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12,
          borderWidth: 1, borderColor: c.border, backgroundColor: c.card,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flexShrink: 1, fontSize: 14, lineHeight: 21, fontWeight: '600', color: c.foreground }}>{title}</Text>
            <HintLink text={hint} title={displayLabel} iconOnly />
          </View>
          {note ? (
            <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.mutedForeground, marginTop: 1 }}>{note}</Text>
          ) : null}
        </View>
        {/* on / off switch */}
        <View style={{ width: 42, height: 25, borderRadius: 13, padding: 3, justifyContent: 'center', backgroundColor: on ? green : (colorScheme === 'dark' ? '#3A4A40' : '#D1D5DB') }}>
          <View style={{
            width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFFFFF', alignSelf: on ? 'flex-end' : 'flex-start',
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }} />
        </View>
      </Pressable>
    </View>
  );
});

FormatKeyCheckboxInput.displayName = 'FormatKeyCheckboxInput';

// ── FormatKeyDateInput — date-picker sub-component for field_type=date ─────────

interface FormatKeyDateInputProps {
  keyDef: FormatKeyDef;
  value: string;
  onChange: (keyName: string, value: string) => void;
  error?: string;
  displayLabel: string;
  required: boolean;
  hint?: string;
}

const FormatKeyDateInput = forwardRef<View, FormatKeyDateInputProps>(
  ({ keyDef, value, onChange, error, displayLabel, required, hint }, ref) => {
    const { colorScheme } = useColorScheme();
    const C = {
      border:       colorScheme === 'dark' ? THEME.dark.border : THEME.light.border,
      borderFocus:  colorScheme === 'dark' ? THEME.dark.foreground : THEME.light.foreground,
      borderError:  colorScheme === 'dark' ? THEME.dark.destructive : THEME.light.destructive,
      borderOk:     '#16A34A',
      text:         colorScheme === 'dark' ? THEME.dark.foreground : THEME.light.foreground,
      placeholder:  colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
      bg:           colorScheme === 'dark' ? THEME.dark.card : THEME.light.card,
      bgDisabled:   colorScheme === 'dark' ? THEME.dark.secondary : THEME.light.secondary,
      label:        colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
      helper:       colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
      error:        colorScheme === 'dark' ? THEME.dark.destructive : THEME.light.destructive,
      success:      '#16A34A',
      iconMuted:    colorScheme === 'dark' ? THEME.dark.mutedForeground : THEME.light.mutedForeground,
    } as const;

    const [showPicker, setShowPicker] = useState(false);

    const borderColor = error ? C.borderError : C.border;
    // {"dateFormat": "dd/mm/yyyy"} (owner, 35(3) नोटिस) → the box shows the date that way; the picker always gets YYYY-MM-DD.
    const dateFmt = dateFormatOf(keyDef.dropdown_options);
    const displayText = dateFmt ? formatDateValue(value || '', dateFmt) : (value || '');
    const pickerValue = dateFmt ? toIsoDate(value) : value;

    return (
      <View ref={ref} style={{ gap: T.space.xs }}>
        {/* Label */}
        <LabelWithHint hint={hint} title={displayLabel}>
          <Text style={{ ...T.caption1, color: error ? C.error : C.label, fontWeight: T.weight.medium } as TextStyle}>
            {String(displayLabel).replace(/\s*\*+\s*$/, '')}
            {required ? <Text style={{ color: C.error }}> *</Text> : null}
          </Text>
        </LabelWithHint>

        {/* Tappable trigger row — visually matches the Input component */}
        <Pressable
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${displayLabel}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor,
            borderRadius: 12,
            paddingHorizontal: T.space.md,
            paddingVertical: 11,
            backgroundColor: C.bg,
            minHeight: T.minTouchTarget,
            gap: T.space.xs,
            ...(Platform.OS !== 'web' ? { borderCurve: 'continuous' } as unknown as ViewStyle : {}),
          }}
        >
          <Calendar size={16} color={displayText ? C.text : C.placeholder} style={{ marginRight: 2 }} />
          <Text
            style={{
              flex: 1,
              ...T.subhead,
              color: displayText ? C.text : C.placeholder,
            } as TextStyle}
            numberOfLines={1}
          >
            {displayText || (dateFmt ? 'तारीख चुनें (dd/mm/yyyy)' : `Select ${displayLabel}`)}
          </Text>
          {dateFmt && !required && displayText ? (
            <Pressable onPress={() => onChange(keyDef.key_name, '')} hitSlop={10} accessibilityLabel="तारीख हटाएँ">
              <X size={16} color={C.iconMuted} />
            </Pressable>
          ) : (
            <ChevronDown size={15} color={C.iconMuted} />
          )}
        </Pressable>

        {/* Inline error */}
        {error ? (
          <Text style={{ ...T.caption1, color: C.error } as TextStyle}>{error}</Text>
        ) : null}

        {/* Date picker modal — reuses the same shared component used app-wide */}
        <DatePickerModal
          visible={showPicker}
          value={pickerValue}
          label={displayLabel}
          onConfirm={(v) => {
            onChange(keyDef.key_name, v);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      </View>
    );
  }
);
FormatKeyDateInput.displayName = 'FormatKeyDateInput';

FormatKeyInput.displayName = 'FormatKeyInput';
FormatKeyField.displayName = 'FormatKeyField';

export { Input as default };
