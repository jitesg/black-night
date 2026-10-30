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

import React, {
  forwardRef, memo, useRef, useState, useCallback, useImperativeHandle,
} from 'react';
import {
  Platform, Pressable, Text, TextInput, View,
  type KeyboardTypeOptions, type ReturnKeyTypeOptions, type TextStyle, type ViewStyle,
} from 'react-native';
import { Calendar, ChevronDown, Eye, EyeOff, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { T } from '@/lib/typography';
import { THEME } from '@/lib/theme';
import { DatePickerModal, dateStrToObj } from '@/components/common/DatePickerModal';
import { ItemGroupInput, parseItemGroupConfig } from './ItemGroupInput';

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
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Input = memo(forwardRef<TextInput, InputProps>(function Input(
  {
    type = 'text',
    label,
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
    minHeight: isMultiline ? numberOfLines * 24 + 22 : T.minTouchTarget,
    gap: T.space.xs,
    ...(Platform.OS !== 'web' ? { borderCurve: 'continuous' } as unknown as ViewStyle : {}),
  };

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
        <Text style={{ ...T.caption1, color: hasError ? C.error : C.label, fontWeight: T.weight.medium } as TextStyle}>
          {/* Labels from formats may already end in '*'; show only one */}
          {required && typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label}
          {required ? <Text style={{ color: C.error }}> *</Text> : null}
        </Text>
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
          numberOfLines={isMultiline ? numberOfLines : undefined}
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
}

function fieldTypeToInputType(ft: string | undefined): InputType {
  switch (ft) {
    case 'multiline': return 'multiline';
    case 'number':    return 'number';
    case 'date':      return 'date';
    default:          return 'text';
  }
}

export const FormatKeyInput = forwardRef<View, FormatKeyInputProps>(
  ({ keyDef, value, onChange, error }, ref) => {
    const fieldType = keyDef.field_type ?? 'text';
    const displayLabel = keyDef.label || keyDef.key_name;
    const required = Boolean(keyDef.is_required);

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
          required={required}
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
          required={required}
          error={error}
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
        />
      );
    }

    // ── Dropdown — one tap on an option (chips, like the संबंध प्रकार buttons) ──
    if (fieldType === 'dropdown') {
      const options = parseDropdownOptions(keyDef.dropdown_options);
      if (options.length) {
        return (
          <FormatKeyDropdownInput
            ref={ref}
            keyName={keyDef.key_name}
            options={options}
            value={value}
            onChange={onChange}
            error={error}
            displayLabel={displayLabel}
            required={required}
          />
        );
      }
    }

    const inputType = fieldTypeToInputType(fieldType);
    // multiline fields get 5 rows (~120 px) so police report text has breathing room
    const multilineLines = fieldType === 'multiline' ? 5 : undefined;
    return (
      <View ref={ref}>
        <Input
          type={inputType}
          label={displayLabel} // <Input> adds the red * for required fields
          placeholder={keyDef.default_value ?? `Enter ${displayLabel}`}
          value={value}
          onChangeText={(v) => onChange(keyDef.key_name, v)}
          errorText={error}
          required={required}
          {...(multilineLines !== undefined ? { numberOfLines: multilineLines } : {})}
        />
      </View>
    );
  }
);

// ── FormatKeyDropdownInput — option chips for field_type=dropdown ────────────

const FormatKeyDropdownInput = forwardRef<View, {
  keyName: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (keyName: string, value: string) => void;
  error?: string;
  displayLabel: string;
  required: boolean;
}>(({ keyName, options, value, onChange, error, displayLabel, required }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#4ADE80' : '#15803D';
  return (
    <View ref={ref} style={{ gap: T.space.xs }}>
      <Text style={{ ...T.caption1, color: error ? c.destructive : c.mutedForeground, fontWeight: T.weight.medium } as TextStyle}>
        {String(displayLabel).replace(/\s*\*+\s*$/, '')}
        {required ? <Text style={{ color: c.destructive }}> *</Text> : null}
      </Text>
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
                minWidth: 96, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
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

// ── FormatKeyCheckboxInput — tick box for field_type=checkbox ───────────────

const FormatKeyCheckboxInput = forwardRef<View, {
  keyName: string;
  value: string;
  onChange: (keyName: string, value: string) => void;
  displayLabel: string;
}>(({ keyName, value, onChange, displayLabel }, ref) => {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const green = colorScheme === 'dark' ? '#4ADE80' : '#15803D';
  const on = value.trim() !== '' && !/^(नहीं|no|false|0)$/i.test(value.trim());
  return (
    <View ref={ref}>
      <Pressable
        onPress={() => onChange(keyName, on ? '' : 'हाँ')}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={displayLabel}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
          borderWidth: on ? 2 : 1, borderColor: on ? green : c.border, backgroundColor: on ? `${green}14` : c.card,
        }}
      >
        <View style={{
          width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? green : c.mutedForeground,
          backgroundColor: on ? green : 'transparent', alignItems: 'center', justifyContent: 'center',
        }}>
          {on ? <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', lineHeight: 20 }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, fontWeight: on ? '700' : '500', color: on ? green : c.foreground }}>
          {String(displayLabel).replace(/\s*\*+\s*$/, '')}
        </Text>
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
}

const FormatKeyDateInput = forwardRef<View, FormatKeyDateInputProps>(
  ({ keyDef, value, onChange, error, displayLabel, required }, ref) => {
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
    const displayText = value || '';

    return (
      <View ref={ref} style={{ gap: T.space.xs }}>
        {/* Label */}
        <Text style={{ ...T.caption1, color: error ? C.error : C.label, fontWeight: T.weight.medium } as TextStyle}>
          {String(displayLabel).replace(/\s*\*+\s*$/, '')}
          {required ? <Text style={{ color: C.error }}> *</Text> : null}
        </Text>

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
            {displayText || `Select ${displayLabel}`}
          </Text>
          <ChevronDown size={15} color={C.iconMuted} />
        </Pressable>

        {/* Inline error */}
        {error ? (
          <Text style={{ ...T.caption1, color: C.error } as TextStyle}>{error}</Text>
        ) : null}

        {/* Date picker modal — reuses the same shared component used app-wide */}
        <DatePickerModal
          visible={showPicker}
          value={value}
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

export { Input as default };
