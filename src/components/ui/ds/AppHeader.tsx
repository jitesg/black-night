/**
 * AppHeader — Universal 56dp app bar for InvestSuite.
 *
 * Replaces every custom header (ModuleHeader, ScreenHeader, DashboardHeader variants).
 * Covers: back button, icon-button actions, search slot, status bar colour.
 */
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Menu } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export interface AppHeaderProps {
  /** Primary title */
  title: string;
  /** Optional subtitle shown below title */
  subtitle?: string;
  /** Show back arrow — defaults to false */
  showBack?: boolean;
  /** Custom back handler */
  onBack?: () => void;
  /**
   * Drawer hamburger handler — when provided, renders a ☰ Menu icon on the
   * left in place of the back arrow. Mutually exclusive with showBack/onBack:
   * if both are supplied, onMenuPress takes precedence.
   */
  onMenuPress?: () => void;
  /** Right-hand icon buttons (max 3 recommended) */
  actions?: React.ReactNode;
  /**
   * Legacy alias for `actions` — accepted from ScreenHeader migration.
   * Prefer `actions` for new code.
   */
  rightActions?: React.ReactNode;
  /** Replace title area with a fully custom node */
  titleSlot?: React.ReactNode;
  /** Status bar style — defaults to 'dark' */
  statusBarStyle?: 'dark' | 'light';
  /** Transparent / no-border variant — legacy ScreenHeader prop, ignored */
  transparent?: boolean;
  /**
   * Legacy ScreenHeader colour variant — accepted but ignored;
   * AppHeader always uses the standard white surface.
   */
  variant?: string;
  /**
   * Legacy ScreenHeader item-count label — rendered as subtitle when
   * `subtitle` is not provided.
   */
  countLabel?: string;
}

export const AppHeader = memo(function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  onMenuPress,
  actions,
  rightActions,
  titleSlot,
  statusBarStyle = 'dark',
  transparent = false,
  variant: _variant,       // accepted, unused — silences TS2322
  countLabel,
}: AppHeaderProps) {
  // Resolve effective subtitle and actions from legacy aliases
  const effectiveSubtitle = subtitle ?? countLabel;
  const effectiveActions  = actions ?? rightActions;
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  // onMenuPress (drawer hamburger) takes full precedence over back button.
  // Bug 1 fix: derive shouldShowBack so passing onBack alone is enough to show
  // the back arrow — callers don't need to also pass showBack={true}.
  const shouldShowMenu = !!onMenuPress;
  const shouldShowBack = !shouldShowMenu && (showBack || !!onBack);

  // Bug 2 fix: wrap canGoBack() in try/catch — it may not exist in all
  // Expo Router versions and would otherwise throw at runtime.
  const handleBack = () => {
    if (onBack) { onBack(); return; }
    try {
      if (router.canGoBack()) router.back();
    } catch {
      router.back();
    }
  };

  const leftButton = shouldShowMenu ? (
    // Hamburger — opens Drawer
    <Pressable
      onPress={onMenuPress}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      hitSlop={8}
      style={{
        width: 48, height: 48,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 24,
      }}
      className="active:opacity-50"
    >
      <Menu size={22} color={c.foreground} strokeWidth={2} />
    </Pressable>
  ) : shouldShowBack ? (
    // Back arrow — returns to previous screen
    <Pressable
      onPress={handleBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      style={{
        width: 48, height: 48,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 24,
      }}
      className="active:opacity-50"
    >
      <ArrowLeft size={22} color={c.foreground} strokeWidth={2} />
    </Pressable>
  ) : (
    <View style={{ width: 16 }} />
  );

  const hasLeftIcon = shouldShowMenu || shouldShowBack;

  return (
    <View
      className="shadow-sm shadow-black/5"
      style={{
        paddingTop: insets.top,
        backgroundColor: c.card,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View style={{
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
      }}>
        {/* Left button: hamburger | back arrow | spacer */}
        {leftButton}

        {/* Title / custom slot */}
        <View style={{ flex: 1, justifyContent: 'center', marginLeft: hasLeftIcon ? 0 : 4 }}>
          {titleSlot ?? (
            <>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 17, fontWeight: '600',
                  color: c.foreground, letterSpacing: -0.2,
                }}
              >
                {title}
              </Text>
              {effectiveSubtitle ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, fontWeight: '500', color: c.mutedForeground, marginTop: 1 }}
                >
                  {effectiveSubtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Action buttons */}
        {effectiveActions ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8 }}>
            {effectiveActions}
          </View>
        ) : (
          <View style={{ width: 16 }} />
        )}
      </View>
    </View>
  );
});

/** Reusable icon button for AppHeader actions */
export const HeaderIconBtn = memo(function HeaderIconBtn({
  icon: Icon,
  onPress,
  label,
  badge,
  color,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  onPress: () => void;
  label: string;
  badge?: number;
  color?: string;
}) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const iconColor = color ?? c.foreground;
  const badgeBg = colorScheme === 'dark' ? '#F87171' : '#DC2626';
  const badgeTextColor = colorScheme === 'dark' ? '#0F172A' : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }}
      className="active:opacity-50"
    >
      <Icon size={22} color={iconColor} strokeWidth={1.8} />
      {badge != null && badge > 0 ? (
        <View style={{
          position: 'absolute', top: 8, right: 8,
          minWidth: 16, height: 16, borderRadius: 8,
          backgroundColor: badgeBg,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: badgeTextColor }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});
