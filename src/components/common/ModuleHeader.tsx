/**
 * ModuleHeader — MD3 AppHeader used by every InvestSuite module list screen.
 *
 * Material Design 3 · Minimal Aesthetic
 * Migrated from Police Navy to clean white surface.
 * All existing callers continue to work unchanged — API is 100% backward-compatible.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────┐
 *   │  [safe-area top]                                   │
 *   │  ← (back)  subtitle               [rightActions]  │  ← 44dp row
 *   │            Title                                   │
 *   │            countLabel (optional)                   │
 *   ├────────────────────────────────────────────────────┤
 *   │  children  (SearchBar, filter chips, etc.)         │
 *   │  [8dp bottom pad]  ─────── hairline ───────────────│
 *   └────────────────────────────────────────────────────┘
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

// Legacy constant kept so no callers break
const NAVY = H.navy;

export interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  countLabel?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightActions?: React.ReactNode;
  /** @deprecated — ignored; header is always white in MD3 Minimal. */
  backgroundColor?: string;
  containerStyle?: ViewStyle;
  children?: React.ReactNode;
}

export const ModuleHeader = memo(function ModuleHeader({
  title,
  subtitle,
  countLabel,
  showBackButton = true,
  onBack,
  rightActions,
  backgroundColor: _ignored,
  containerStyle,
  children,
}: ModuleHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const handleBack = onBack ?? (() => router.back());

  // backgroundColor prop is now ignored — MD3 Minimal uses theme surface always
  void _ignored;

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
        {/* App-bar row */}
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

        {children}
      </View>
    </>
  );
});
