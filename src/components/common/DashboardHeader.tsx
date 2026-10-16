/**
 * DashboardHeader — Compact enterprise-grade app bar
 *
 * Height: safe-area + 48dp content row
 * Layout: [☰ Menu] — [IS · InvestSuite / Investigation Operating System] — [🔔 Bell]
 *
 * Theme-aware: reads useColorScheme + THEME so dark mode is honoured.
 * IS badge accent (indigo) is kept fixed — brand identity, not a surface color.
 */
import { View, Text, Pressable } from 'react-native';
import { T } from '@/lib/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Bell } from 'lucide-react-native';
import { H } from '@/lib/headerTokens';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

// IS badge — fixed indigo brand accent (intentional, not a surface color)
const INDIGO_BADGE_BG     = '#6366F115';
const INDIGO_BADGE_BORDER = 'rgba(99,102,241,0.25)';
const INDIGO_BADGE_TEXT   = '#6366F1';
const INDIGO_DOT          = '#6366F1';

// ── Sub-component: icon button ────────────────────────────────────────────────
function HeaderIconBtn({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="items-center justify-center active:opacity-50"
      style={{
        width: H.iconBtnSize,
        height: H.iconBtnSize,
        borderRadius: H.iconBtnRadius,
      }}
    >
      {children}
    </Pressable>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export type DashboardHeaderProps = {
  onMenuPress: () => void;
  onBellPress?: () => void;
  unreadCount?: number;
  syncStatus?: 'online' | 'syncing' | 'offline';
  aiStatus?: boolean;
};

const SYNC_COLORS: Record<string, string> = {
  online:  '#10B981',
  syncing: '#F59E0B',
  offline: '#EF4444',
};

// ── Component ─────────────────────────────────────────────────────────────────
export function DashboardHeader({
  onMenuPress,
  onBellPress,
  unreadCount = 0,
  syncStatus,
  aiStatus,
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const showBadge  = unreadCount > 0;

  return (
    <View
      className="shadow-sm shadow-black/5"
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: H.horizontalPad,
          gap: H.rowGap,
        }}
      >
        {/* ── Left: Hamburger ──────────────────────────────────────── */}
        <HeaderIconBtn onPress={onMenuPress} accessibilityLabel="Open navigation menu">
          <Menu size={H.iconSize} color={colors.foreground} strokeWidth={2} />
        </HeaderIconBtn>

        {/* ── Center: Brand mark ───────────────────────────────────── */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {/* "IS" badge — fixed indigo brand accent */}
          <View
            style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: INDIGO_BADGE_BG,
              borderWidth: 1, borderColor: INDIGO_BADGE_BORDER,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text
              style={{ ...T.caption2, fontWeight: '800', color: INDIGO_BADGE_TEXT, letterSpacing: 0.3 }}
            >
              IS
            </Text>
          </View>

          {/* Wordmark + subtitle */}
          <View>
            <Text
              style={{ ...T.callout, fontWeight: '700', letterSpacing: -0.2, lineHeight: 19, color: colors.foreground }}
            >
              InvestSuite
            </Text>
            <Text
              style={{ ...T.micro, fontWeight: '400', letterSpacing: 0.1, lineHeight: 13, color: colors.mutedForeground }}
            >
              Investigation Operating System
            </Text>
          </View>

          {syncStatus ? (
            <View
              style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: SYNC_COLORS[syncStatus] ?? '#9CA3AF',
                marginLeft: 2, alignSelf: 'center',
              }}
            />
          ) : null}

          {aiStatus ? (
            <View
              style={{
                borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
                backgroundColor: '#1E3A5F', marginLeft: 2,
              }}
            >
              <Text style={{ ...T.micro, fontWeight: '700', color: '#60A5FA', letterSpacing: 0.3 }}>
                AI
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Right: Bell with optional badge ─────────────────────── */}
        <View style={{ width: H.iconBtnSize, height: H.iconBtnSize }}>
          <HeaderIconBtn
            onPress={onBellPress ?? (() => {})}
            accessibilityLabel={showBadge ? `Notifications, ${badgeLabel} unread` : 'Notifications'}
          >
            <Bell size={H.iconSize} color={colors.foreground} strokeWidth={1.8} />
          </HeaderIconBtn>

          {showBadge && (
            <View
              className="absolute items-center justify-center"
              style={{
                top: 4, right: 4,
                minWidth: 16, height: 16, borderRadius: 8,
                backgroundColor: INDIGO_DOT,
                paddingHorizontal: 3,
                borderWidth: 1.5, borderColor: colors.card,
              }}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 8, fontWeight: '800', color: '#FFFFFF', lineHeight: 10 }}>
                {badgeLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
