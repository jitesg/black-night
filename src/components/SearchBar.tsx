/**
 * SearchBar — MD3 Universal Search · Minimal Aesthetic
 *
 * Single component for the entire app.
 * Height: 48dp · Pill shape (rounded-full) · Animated focus ring
 * Variants:
 *   light (default) — white surface, dark text — standalone on light bg
 *   navy            — legacy alias; now renders identically to light
 *
 * Features:
 *   • Animated border-color + border-width on focus (Reanimated spring)
 *   • Clear (×) button when value present
 *   • Optional trailing slot (filter/sort icon)
 *   • No platform focus rings — custom ring only
 *   • accessibilityRole="search" + accessibilityLabel
 *   • Recent searches (per screen) shown under the box when it is focused and
 *     empty — tap to search again, × to remove one, "सब मिटाएँ" to clear
 *     (Settings → Search → history)
 *   • Settings → Search → instant search off: the search runs only when the
 *     keyboard's search key is pressed
 *   • Suggestions while typing (names, मु0अ0सं0, गाँव … of this screen) and, when the
 *     screen passes noResults, "क्या आपका मतलब …?" (Settings → Search → suggestions)
 *
 * TODO: The internal TextInput could be migrated to <Input type="search" />
 * once the universal Input supports: ref-forwarding into an Animated.View
 * container, an animated border-color/width controlled by an external
 * shared value, and a pill (borderRadius: 24) container shape.
 * The current Input uses a fixed borderRadius: 12 rectangle and manages
 * focus state internally — incompatible with SearchBar's animated container.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform, Pressable, ScrollView, Text, TextInput, View,
  type ReturnKeyTypeOptions, type TextStyle, type ViewStyle,
} from 'react-native';
import type { StyleProp } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { History, Search, X } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useRecentSearches } from '@/hooks/useSearchHistory';
import { didYouMeanFor, scopeForPath, suggestFor } from '@/lib/db/searchSuggestRepo';
import { useColorScheme } from 'nativewind';
import { T } from '@/lib/typography';
import { THEME } from '@/lib/theme';

// ─── Design tokens — theme-reactive (resolved per render via useSearchTokens) ─
// Light palette values are kept here as readable constants but the hook below
// selects the correct set based on the active color scheme.
const LIGHT_C = {
  border:       '#E5E7EB',
  focusBorder:  '#6366F1',
  foreground:   '#111827',
  iconMuted:    '#9CA3AF',
  surfaceMuted: '#F9FAFB',
  surfaceCard:  '#FFFFFF',
} as const;

const DARK_C = {
  border:       THEME.dark.border,       // #334155
  focusBorder:  THEME.dark.primary,      // #818CF8
  foreground:   THEME.dark.foreground,   // #F1F5F9
  iconMuted:    THEME.dark.mutedForeground, // #94A3B8
  surfaceMuted: THEME.dark.card,         // #1E293B
  surfaceCard:  '#263248',               // slightly lighter lifted surface on focus
} as const;

/** Returns the correct token set for the active colour scheme. */
function useSearchTokens() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK_C : LIGHT_C;
}

const CONTAINER_HEIGHT     = T.minTouchTarget; // 48dp
const CONTAINER_RADIUS     = CONTAINER_HEIGHT / 2; // pill
const CONTAINER_PH         = 14; // paddingHorizontal — between pill edge and icon
const CONTAINER_GAP        = T.space.sm; // 8dp — gap between row children

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** 'light' (default) or 'navy' (legacy alias — both now render identically) */
  variant?: 'navy' | 'light';
  autoFocus?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  /** Called after the internal focus animation fires — use to drive parent UI state */
  onFocus?: () => void;
  /** Called after the internal blur animation fires — use to drive parent UI state */
  onBlur?: () => void;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** @deprecated — unused; kept for backward-compat */
  resultCount?: number | null;
  inputStyle?: StyleProp<TextStyle>;
  /** Optional trailing node — filter icon, sort button, etc. */
  trailing?: React.ReactNode;
  collapsible?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Recent-search list key; defaults to the screen's route path. */
  historyKey?: string;
  /** The screen found nothing for the current text → offer a spelling fix. */
  noResults?: boolean;
}

// Stable base TextInput style — the color is overridden per-render via the
// hook so it cannot live at module level; we build it inside the component.
const BASE_INPUT_STYLE_STATIC: Omit<TextStyle, 'color'> = {
  flex: 1,
  ...T.subhead,
  paddingVertical: 0,
  backgroundColor: 'transparent',
  borderWidth: 0,
  // Web-only: suppress the native browser focus outline; irrelevant on iOS/Android.
  ...Platform.select({ web: { outlineWidth: 0, outline: 'none' } as TextStyle }),
};

export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  variant: _variant = 'light',
  autoFocus = false,
  returnKeyType = 'search',
  onSubmitEditing,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  accessibilityLabel,
  containerStyle,
  inputStyle,
  trailing,
  collapsible = false,
  onExpandedChange,
  historyKey,
  noResults = false,
}: SearchBarProps) {
  const C = useSearchTokens();
  const { t } = useTranslation();
  const pathname = usePathname();
  const { settings } = useSettingsStore();
  const instant = settings.instantSearch !== false;
  const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches(historyKey ?? pathname ?? 'global');

  // Text in the box. Instant search: same as `value`. Otherwise it is a draft
  // that reaches the screen only when the keyboard's search key is pressed.
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const shown = instant ? value : draft;
  const handleChangeText = useCallback((text: string) => {
    if (instant) onChangeText(text);
    else setDraft(text);
  }, [instant, onChangeText]);
  const handleSubmit = useCallback(() => {
    if (!instant) onChangeText(draft);
    addRecent(instant ? value : draft);
    onSubmitEditing?.();
  }, [instant, draft, value, onChangeText, addRecent, onSubmitEditing]);
  // Instant search: remember a search once typing pauses.
  useEffect(() => {
    if (!instant || value.trim().length < 2) return;
    const id = setTimeout(() => addRecent(value), 1500);
    return () => clearTimeout(id);
  }, [instant, value, addRecent]);

  // Recent list shows while focused; hiding waits a moment so a tap on a chip lands.
  const [showRecent, setShowRecent] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const pickRecent = useCallback((q: string) => {
    setDraft(q);
    onChangeText(q);
    addRecent(q);
  }, [onChangeText, addRecent]);

  // Suggestions while typing + spelling fix when nothing was found.
  const scope = useMemo(() => scopeForPath(historyKey ?? pathname), [historyKey, pathname]);
  const suggestOn = settings.smartSuggestions !== false && !!scope;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!suggestOn || !showRecent || !shown.trim()) { setSuggestions([]); return; }
    let alive = true;
    const id = setTimeout(() => {
      suggestFor(scope, shown, 8).then((list) => { if (alive) setSuggestions(list); }).catch(() => {});
    }, 200);
    return () => { alive = false; clearTimeout(id); };
  }, [suggestOn, scope, shown, showRecent]);
  const [fix, setFix] = useState<string | null>(null);
  useEffect(() => {
    if (!suggestOn || !noResults || !value.trim()) { setFix(null); return; }
    let alive = true;
    const id = setTimeout(() => {
      didYouMeanFor(scope, value).then((f) => { if (alive) setFix(f); }).catch(() => {});
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [suggestOn, scope, value, noResults]);
  const inputRef = useRef<TextInput>(null);
  // `focused` (Reanimated shared value) drives the animated container style on
  // the UI thread. `isFocused` (React state) derives the JS-thread icon color.
  // Both are intentionally kept: shared values cannot be read synchronously on
  // the JS thread, so isFocused is the correct pattern for iconColor. There is
  // no redundant state — each serves a distinct rendering layer.
  const focused = useSharedValue(0);
  const [isFocused, setIsFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isExpanded = collapsible ? expanded : true;

  const handleFocus = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowRecent(true);
    setIsFocused(true);
    focused.value = withSpring(1, { damping: 18, stiffness: 220 });
    onFocusProp?.();
  }, [focused, onFocusProp]);

  const handleBlur = useCallback(() => {
    hideTimer.current = setTimeout(() => setShowRecent(false), 250);
    setIsFocused(false);
    focused.value = withSpring(0, { damping: 18, stiffness: 220 });
    onBlurProp?.();
    if (collapsible && !value) {
      setExpanded(false);
      onExpandedChange?.(false);
    }
  }, [focused, onBlurProp, collapsible, value, onExpandedChange]);

  const handleClear = useCallback(() => {
    setDraft('');
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleCollapse = useCallback(() => {
    setDraft('');
    setShowRecent(false);
    onChangeText('');
    // Reset the focus look right away; blur can arrive after the input has
    // unmounted, which left the focus border stuck on.
    setIsFocused(false);
    focused.value = 0;
    setExpanded(false);
    onExpandedChange?.(false);
    inputRef.current?.blur();
  }, [onChangeText, onExpandedChange, focused]);

  const handleExpand = useCallback(() => {
    setExpanded(true);
    onExpandedChange?.(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [onExpandedChange]);

  const animatedContainer = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focused.value,
      [0, 1],
      [C.border, C.focusBorder],
    ),
    borderWidth: interpolate(focused.value, [0, 1], [1, 1.5]),
    backgroundColor: interpolateColor(
      focused.value,
      [0, 1],
      [C.surfaceMuted, C.surfaceCard],
    ),
  }));

  // iconColor is derived from JS-thread focus state — memoized to avoid object churn.
  const iconColor = isFocused ? C.foreground : C.iconMuted;

  // Merged input style — recomputed when C (theme) or inputStyle prop changes.
  const mergedInputStyle = useMemo<StyleProp<TextStyle>>(
    () => [BASE_INPUT_STYLE_STATIC, { color: C.foreground }, inputStyle],
    [C, inputStyle],
  );

  const recentRow = showRecent && !shown && recent.length > 0 ? (
    <View style={{ marginTop: 8, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.iconMuted }}>{t('search.recent', 'हाल की खोजें')}</Text>
        <Pressable onPress={clearRecent} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.focusBorder }}>{t('search.clearRecent', 'सब मिटाएँ')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6 }}>
        {recent.map((q) => (
          <View
            key={q}
            style={{
              flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 16, borderWidth: 1,
              borderColor: C.border, backgroundColor: C.surfaceMuted, paddingLeft: 10, paddingRight: 2,
            }}
          >
            <Pressable onPress={() => pickRecent(q)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityRole="button" accessibilityLabel={q}>
              <History size={12} color={C.iconMuted} />
              <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 12.5, color: C.foreground, maxWidth: 170 }}>{q}</Text>
            </Pressable>
            <Pressable onPress={() => removeRecent(q)} hitSlop={6} style={{ padding: 6 }} accessibilityLabel={t('search.removeRecent', 'हटाएँ')}>
              <X size={11} color={C.iconMuted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const suggestRow = showRecent && shown.trim() && suggestions.length > 0 ? (
    <View style={{ marginTop: 8, gap: 6 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.iconMuted, paddingHorizontal: 4 }}>{t('search.suggestions', 'सुझाव')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6 }}>
        {suggestions.map((q) => (
          <Pressable
            key={q}
            onPress={() => pickRecent(q)}
            accessibilityRole="button"
            accessibilityLabel={q}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, borderRadius: 16, borderWidth: 1,
              borderColor: C.border, backgroundColor: C.surfaceMuted, paddingHorizontal: 10,
            }}
          >
            <Search size={12} color={C.iconMuted} />
            <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 12.5, color: C.foreground, maxWidth: 200 }}>{q}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const fixRow = fix && noResults && value.trim() ? (
    <Pressable onPress={() => pickRecent(fix)} accessibilityRole="button" style={{ marginTop: 8, paddingHorizontal: 4 }}>
      <Text textBreakStrategy="simple" style={{ fontSize: 13, color: C.iconMuted }}>
        {t('search.didYouMean', 'क्या आपका मतलब')}{' '}
        <Text style={{ fontWeight: '800', color: C.focusBorder, textDecorationLine: 'underline' }}>{fix}</Text>
        {' '}{t('search.didYouMeanEnd', 'था?')}
      </Text>
    </Pressable>
  ) : null;

  if (!collapsible) {
    return (
      <View style={containerStyle}>
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: CONTAINER_RADIUS,
            paddingHorizontal: CONTAINER_PH,
            gap: CONTAINER_GAP,
            height: CONTAINER_HEIGHT,
          },
          animatedContainer,
        ]}
      >
        <Search size={16} color={iconColor} />

        <TextInput
          ref={inputRef}
          value={shown}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.iconMuted}
          style={mergedInputStyle}
          underlineColorAndroid="transparent"
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType={returnKeyType}
          onSubmitEditing={handleSubmit}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          accessibilityRole="search"
          clearButtonMode="never"
        />

        {shown.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="active:opacity-50"
            accessibilityLabel="Clear search"
          >
            <X size={14} color={iconColor} />
          </Pressable>
        )}

        {trailing}
      </Animated.View>
      {recentRow}
      {suggestRow}
      {fixRow}
      </View>
    );
  }

  return (
    <Animated.View
      style={isExpanded ? containerStyle : { alignSelf: 'flex-start' }}
    >
      {/* Separate keys + a plain View for the collapsed button: sharing one
          view with the expanded state left Reanimated's animated border and
          background stuck on it (square focus box around the search icon). */}
      {!isExpanded ? (
        <View key="collapsed">
          <Pressable
            onPress={handleExpand}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? 'Expand search'}
            style={{
              width: CONTAINER_HEIGHT,
              height: CONTAINER_HEIGHT,
              borderRadius: CONTAINER_RADIUS,
              backgroundColor: C.surfaceMuted,
              borderWidth: 1,
              borderColor: C.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={18} color={C.iconMuted} />
          </Pressable>
        </View>
      ) : (
        <Animated.View
          key="expanded"
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: CONTAINER_RADIUS,
              paddingHorizontal: CONTAINER_PH,
              gap: CONTAINER_GAP,
              height: CONTAINER_HEIGHT,
            },
            animatedContainer,
          ]}
        >
          <Search size={16} color={iconColor} />

          <TextInput
            ref={inputRef}
            value={shown}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            placeholderTextColor={C.iconMuted}
            style={mergedInputStyle}
            underlineColorAndroid="transparent"
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus={autoFocus}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType={returnKeyType}
            onSubmitEditing={handleSubmit}
            accessibilityLabel={accessibilityLabel ?? placeholder}
            accessibilityRole="search"
            clearButtonMode="never"
          />

          <Pressable
            onPress={handleCollapse}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="active:opacity-50"
            accessibilityLabel="Close search"
          >
            <X size={14} color={iconColor} />
          </Pressable>

          {trailing}
        </Animated.View>
      )}
      {isExpanded ? recentRow : null}
      {isExpanded ? suggestRow : null}
      {isExpanded ? fixRow : null}
    </Animated.View>
  );
});
