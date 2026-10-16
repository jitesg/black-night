/**
 * ScreenHeader — MD3 AppHeader for all InvestSuite screens.
 *
 * Material Design 3 · Minimal Aesthetic
 * Total height: safe-area-top + 44dp content row + 8dp bottom pad = 52dp usable
 *
 * Two variants (kept for backward-compat — both now use the same minimal surface):
 *   light  (default) — white bg, dark text, hairline bottom border
 *   navy             — kept as alias; renders identical to light (no more navy header)
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  [safe-area top]                                    │
 *   │  ← back  [iconBadge?]  subtitle / title  [actions] │  ← 44dp row
 *   │  [children: search bar, filter chips, etc.]         │
 *   │  [8dp bottom pad]  ──────────────── hairline ───────│
 *   └─────────────────────────────────────────────────────┘
 */
import { memo } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { H } from '@/lib/headerTokens';
import { T } from '@/lib/typography';
import { THEME } from '@/lib/theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  countLabel?: string;
  /** 'light' (default) or 'navy' (now renders identically to light — legacy compat) */
  variant?: 'light' | 'navy';
  showBackButton?: boolean;
  onBack?: () => void;
  iconBadge?: React.ReactNode;
  rightActions?: React.ReactNode;
  children?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  subtitle,
  countLabel,
  variant = 'light',
  showBackButton = true,
  onBack,
  iconBadge,
  rightActions,
  children,
  containerStyle,
}: ScreenHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  // MD3 Minimal: theme-aware surface — variant kept for backward-compat only
  void variant;

  const handleBack = onBack ?? (() => router.back());

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.card} />
      <View
        style={[
          {
            backgroundColor: colors.card,
            paddingTop: top + H.safeGap,
            paddingBottom: H.bottomPad,
            paddingHorizontal: H.horizontalPad,
            gap: H.searchGap,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          containerStyle,
        ]}
      >
        {/* ── App-bar row ───────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: H.rowGap,
            minHeight: H.appBarHeight,
          }}
        >
          {/* Back button */}
          {showBackButton && (
            <Pressable
              onPress={handleBack}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              className="active:opacity-60"
              style={{
                width: H.iconBtnSize,
                height: H.iconBtnSize,
                borderRadius: H.iconBtnRadius,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: H.iconBtnBg,
              }}
            >
              <ArrowLeft size={H.iconSize} color={colors.foreground} />
            </Pressable>
          )}

          {iconBadge}

          {/* Title block */}
          <View style={{ flex: 1 }}>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={{ ...T.headerSubtitle, color: colors.mutedForeground, marginBottom: 1 }}
              >
                {subtitle}
              </Text>
            ) : null}
            <Text numberOfLines={1} style={{ ...T.headerTitle, color: colors.foreground }}>
              {title}
            </Text>
            {countLabel ? (
              <Text
                numberOfLines={1}
                style={{ ...T.headerCount, color: colors.mutedForeground, marginTop: 1 }}
              >
                {countLabel}
              </Text>
            ) : null}
          </View>

          {rightActions ?? null}
        </View>

        {/* ── Optional content below app bar ────────────────────────────── */}
        {children}
      </View>
    </>
  );
});
