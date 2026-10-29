/**
 * AutocompleteInput — Reusable autocomplete-enabled text field.
 *
 * Design:
 *   • Drop-in replacement for the SimpleInput used inside AccusedGroupInput /
 *     PersonGroupInput cards.  Accepts identical props plus `fieldKey`.
 *   • On text change: debounce 250 ms → getSuggestions → render dropdown below.
 *   • Tapping a suggestion fills the field and immediately dismisses the list.
 *   • Dismisses on blur or outside tap.
 *   • DOES NOT show suggestions for blank prefix (no typing yet).
 *   • Reuses the Dark Gold color tokens shared with AccusedGroupInput /
 *     PersonGroupInput — no new visual language introduced.
 *
 * Usage (inside a group card):
 *   <AutocompleteInput
 *     fieldKey={FIELD_KEYS.person_name}
 *     value={entry.name}
 *     onChangeText={(v) => onChange(index, 'name', v)}
 *     placeholder="Name"
 *   />
 *
 * Usage (inside FormatKeyInput for plain text format keys):
 *   <AutocompleteInput fieldKey={FIELD_KEYS.section} value={v} onChangeText={set} />
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import {
  getSuggestions,
  type FieldKey,
  type FieldValueSuggestion,
} from '@/lib/db/fieldValueHistoryRepo';

function useAutocompleteTokens() {
  const { colorScheme } = useColorScheme();
  const t = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return {
    border: t.border, borderError: t.destructive, text: t.foreground,
    placeholder: t.mutedForeground, bg: t.background,
    dropdownBg: t.popover, dropdownBorder: t.border,
    itemText: t.popoverForeground, itemBorder: t.border,
    itemHover: t.accent, accent: t.primary, muted: t.mutedForeground,
  } as const;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AutocompleteInputProps {
  fieldKey: FieldKey;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  hasError?: boolean;
  /** Suppress the autocomplete dropdown even when fieldKey is provided.
   *  Useful when the parent temporarily wants plain-text behaviour. */
  disableSuggestions?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 250;

export const AutocompleteInput = memo(({
  fieldKey,
  value,
  onChangeText,
  onBlur,
  placeholder,
  multiline,
  keyboardType,
  hasError,
  disableSuggestions = false,
}: AutocompleteInputProps) => {
  const C = useAutocompleteTokens();
  const { settings } = useSettingsStore();
  const [suggestions, setSuggestions] = useState<FieldValueSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel debounce and blur timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);

    if (disableSuggestions) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await getSuggestions(fieldKey, text.trim(), 8, settings.typoTolerance);
        // Suppress dropdown when the only suggestion exactly matches the input
        if (results.length === 1 && results[0].value === text.trim()) {
          setShowDropdown(false);
          return;
        }
        if (results.length > 0) {
          setSuggestions(results);
          setShowDropdown(true);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch {
        // Non-critical — silently ignore DB errors during suggestion lookup
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, DEBOUNCE_MS);
  }, [fieldKey, onChangeText, disableSuggestions, settings.typoTolerance]);

  const handleSelectSuggestion = useCallback((selected: string) => {
    onChangeText(selected);
    setSuggestions([]);
    setShowDropdown(false);
  }, [onChangeText]);

  const handleBlur = useCallback(() => {
    // Small delay so a tap on a suggestion item fires before the blur hides the list.
    // Tracked in blurTimeoutRef so it can be cancelled on unmount (prevents memory leak).
    blurTimeoutRef.current = setTimeout(() => {
      setSuggestions([]);
      setShowDropdown(false);
    }, 150);
    onBlur?.();
  }, [onBlur]);

  return (
    <View style={{ position: 'relative' }}>
      {/* Text input */}
      <View style={{
        borderWidth: 1,
        borderColor: hasError ? C.borderError : C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: C.bg,
        minHeight: multiline ? 72 : 44,
      }}>
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
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
            ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } as never : {}),
          }}
        />
      </View>

      {/* Suggestions — in the normal flow right below the field (not floating):
          a floating list covered the multiline पता field itself and the fields below. */}
      {showDropdown && suggestions.length > 0 && (
        <View style={{
          marginTop: 4,
          backgroundColor: C.dropdownBg,
          borderWidth: 1,
          borderColor: C.dropdownBorder,
          borderRadius: 10,
          overflow: 'hidden',
          // Subtle elevation for Android
          ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
        }}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s.value}
              onPress={() => handleSelectSuggestion(s.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                borderBottomColor: C.itemBorder,
                backgroundColor: 'transparent',
              }}
              android_ripple={{ color: C.itemHover }}
            >
              <Text
                style={{ fontSize: 14, color: C.itemText }}
                numberOfLines={2}
              >
                {s.value}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

AutocompleteInput.displayName = 'AutocompleteInput';
