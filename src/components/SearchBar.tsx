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
 *
 * TODO: The internal TextInput could be migrated to <Input type="search" />
 * once the universal Input supports: ref-forwarding into an Animated.View
 * container, an animated border-color/width controlled by an external
 * shared value, and a pill (borderRadius: 24) container shape.
 * The current Input uses a fixed borderRadius: 12 rectangle and manages
 * focus state internally — incompatible with SearchBar's animated container.
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform, Pressable, TextInput,
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
import { Search, X } from 'lucide-react-native';
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
}: SearchBarProps) {
  const C = useSearchTokens();
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
    setIsFocused(true);
    focused.value = withSpring(1, { damping: 18, stiffness: 220 });
    onFocusProp?.();
  }, [focused, onFocusProp]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focused.value = withSpring(0, { damping: 18, stiffness: 220 });
    onBlurProp?.();
    if (collapsible && !value) {
      setExpanded(false);
      onExpandedChange?.(false);
    }
  }, [focused, onBlurProp, collapsible, value, onExpandedChange]);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleCollapse = useCallback(() => {
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

  if (!collapsible) {
    return (
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
          containerStyle,
        ]}
      >
        <Search size={16} color={iconColor} />

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
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
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          accessibilityRole="search"
          clearButtonMode="never"
        />

        {value.length > 0 && (
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
    );
  }

  return (
    <Animated.View
      style={isExpanded ? containerStyle : { alignSelf: 'flex-start' }}
    >
      {!isExpanded ? (
        <Animated.View
        >
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
        </Animated.View>
      ) : (
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
            value={value}
            onChangeText={onChangeText}
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
            onSubmitEditing={onSubmitEditing}
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
    </Animated.View>
  );
});
