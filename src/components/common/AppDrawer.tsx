/**
 * AppDrawer — Modern enterprise navigation drawer for InvestSuite
 *
 * Design system: Minimal template — white background, #111827 text,
 * 1px borders, near-zero shadow, semantic colour tokens.
 *
 * Sub-components (all co-located for single-source coherence):
 *   DrawerHeader       — compact 80dp top bar: logo + wordmark + close
 *   DrawerProfileCard  — officer avatar, name, station, status dot (future-ready)
 *   DrawerSection      — labelled section wrapper with optional divider
 *   DrawerNavItem      — 48dp touch target: icon tray, label, badge, active indicator
 *   DrawerPinnedChip   — horizontal quick-access chip (long-press to unpin)
 *   DrawerFooter       — version, build, sync status
 *
 * Animation: spring slide-in (natural deceleration), timing backdrop fade.
 * Width:     phone 82% capped at 360dp · tablet 480dp max.
 * Safe area: handled inside the drawer via useSafeAreaInsets.
 * Dev gate:  Developer Options item only visible when __DEV__ === true.
 */
import { useCallback, useEffect, useRef } from 'react';
import { T } from '@/lib/typography';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  FileText,
  BookMarked,
  Scale,
  Scroll,
  ShieldAlert,
  BookOpen,
  Library,
  LayoutTemplate,
  Settings,
  Bell,
  FolderOpen,
  HelpCircle,
  Info,
  Database,
  X,
  Star,
  Terminal,
  ChevronRight,
  Wifi,
} from 'lucide-react-native';
import { useWorkspace } from '@/context/WorkspaceContext';
import { usePinnedItems } from '@/hooks/usePinnedItems';

// ── Design tokens ─────────────────────────────────────────────────────────────
// INDIGO: fixed brand accent (IS badge, active nav indicator, pinned chips)
// All surface/text/border tokens are resolved at render time from THEME.
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

const INDIGO = '#6366F1';

// ── Nav item model ────────────────────────────────────────────────────────────
interface NavItem {
  id: string;
  labelKey: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  route: string;
  /** accent colour — used for icon tray + active tint */
  color: string;
  /** optional numeric badge (e.g. pending count) */
  badge?: number;
}

// ── Navigation data ───────────────────────────────────────────────────────────
const MAIN_NAV: NavItem[] = [
  { id: 'home',        labelKey: 'drawer.navDashboard',   label: 'Dashboard',            icon: LayoutDashboard, route: '/(app)/home',           color: INDIGO },
  { id: 'mukadma',     labelKey: 'drawer.navMukadma',     label: 'Mukadma',              icon: FileText,        route: '/(app)/mukadma',        color: '#7C3AED' },
  { id: 'gd',          labelKey: 'drawer.navGd',          label: 'General Diary',        icon: BookMarked,      route: '/(app)/gd',             color: '#D97706' },
  { id: 'nyayalay',    labelKey: 'drawer.navNyayalay',    label: 'Nyayalay',             icon: Scale,           route: '/(app)/nyayalay',       color: '#1D4ED8' },
  { id: 'prarthna',    labelKey: 'drawer.navPrarthna',    label: 'Prarthna Patra',       icon: Scroll,          route: '/(app)/prarthna-patra', color: '#7C3AED' },
  { id: 'nirodhatmak', labelKey: 'drawer.navNirodhatmak', label: 'Nirodhatmak Karyvahi', icon: ShieldAlert,     route: '/(app)/nirodhatmak',    color: '#DC2626' },
  { id: 'halka',       labelKey: 'drawer.navHalka',       label: 'My Halka',             icon: BookOpen,        route: '/(app)/halka',          color: '#0891B2' },
  { id: 'knowledge',   labelKey: 'drawer.navKnowledge',   label: 'Knowledge',            icon: Library,         route: '/(app)/knowledge',      color: '#16A34A' },
  { id: 'formats',     labelKey: 'drawer.navFormats',     label: 'Predefine Formats',    icon: LayoutTemplate,  route: '/(app)/formats',        color: '#0891B2' },
];

const SECONDARY_NAV: NavItem[] = [
  { id: 'master-data', labelKey: 'drawer.navMasterData',  label: 'Master Data Hub',    icon: Database,    route: '/(app)/workspace-setup',     color: '#6B7280' },
  { id: 'reminders',   labelKey: 'drawer.navReminders',   label: 'Reminders',          icon: Bell,        route: '/(app)/settings/reminders',  color: '#D97706' },
  { id: 'attachments', labelKey: 'drawer.navAttachments', label: 'Attachment Library', icon: FolderOpen,  route: '/(app)/knowledge',            color: '#6B7280' },
  { id: 'settings',    labelKey: 'drawer.navSettings',    label: 'Settings',           icon: Settings,    route: '/(app)/settings',             color: '#6B7280' },
  { id: 'help',        labelKey: 'drawer.navHelp',        label: 'Help',               icon: HelpCircle,  route: '/(app)/settings/help',        color: '#6B7280' },
  { id: 'about',       labelKey: 'drawer.navAbout',       label: 'About InvestSuite',  icon: Info,        route: '/(app)/settings/about',       color: '#6B7280' },
];

// ── Sub-component: DrawerHeader ───────────────────────────────────────────────
function DrawerHeader({
  onClose,
  safeTop,
  colors,
}: {
  onClose: () => void;
  safeTop: number;
  colors: typeof THEME.light;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        paddingTop: Math.max(safeTop, 12) + 4,
        paddingBottom: T.space.md - 2,
        paddingHorizontal: T.space.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.space.sm + 2 }}>
        {/* IS badge — fixed indigo brand accent */}
        <View
          style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: INDIGO,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ ...T.caption1, fontWeight: T.weight.black, color: '#FFFFFF', letterSpacing: 0.3 }}>
            IS
          </Text>
        </View>

        {/* Wordmark */}
        <View style={{ flex: 1 }}>
          <Text style={{ ...T.callout, fontWeight: T.weight.bold, color: colors.foreground, letterSpacing: -0.3, lineHeight: 19 }}>
            InvestSuite
          </Text>
          <Text style={{ ...T.micro, fontWeight: T.weight.regular, color: colors.mutedForeground, letterSpacing: 0.1, lineHeight: 14, textTransform: undefined }}>
            {t('drawer.subtitle')}
          </Text>
        </View>

        {/* Close button */}
        <Pressable
          onPress={onClose}
          accessibilityLabel={t('drawer.closeAria')}
          accessibilityRole="button"
          style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: colors.muted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} color={colors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Sub-component: DrawerProfileCard ─────────────────────────────────────────
function DrawerProfileCard({
  officerName,
  policeStation,
  district,
  onPress,
  colors,
}: {
  officerName: string;
  policeStation: string;
  district: string;
  onPress: () => void;
  colors: typeof THEME.light;
}) {
  const { t } = useTranslation();
  const initial = (officerName || 'O')[0].toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t('drawer.officerProfileAria')}
      style={{
        marginHorizontal: T.space.md - 4,
        marginTop: T.space.md - 4,
        marginBottom: T.space.xs,
        padding: T.space.md - 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.muted,
        flexDirection: 'row',
        alignItems: 'center',
        gap: T.space.md - 4,
      }}
    >
      {/* Avatar circle */}
      <View style={{ position: 'relative' }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: `${INDIGO}18`,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ ...T.headline, color: INDIGO }}>{initial}</Text>
        </View>
        {/* Online status dot */}
        <View
          style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: '#16A34A',
            borderWidth: 1.5, borderColor: colors.card,
          }}
        />
      </View>

      {/* Text block */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ ...T.subhead, fontWeight: T.weight.semibold, color: colors.foreground, letterSpacing: -0.1 }}
        >
          {officerName || t('drawer.officerDefault')}
        </Text>
        {policeStation ? (
          <Text
            numberOfLines={1}
            style={{ ...T.caption2, color: colors.mutedForeground, marginTop: 1 }}
          >
            {policeStation}{district ? ` · ${district}` : ''}
          </Text>
        ) : null}
      </View>

      <ChevronRight size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

// ── Sub-component: DrawerSection (label wrapper) ──────────────────────────────
function DrawerSection({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: typeof THEME.light;
}) {
  return (
    <View style={{ marginTop: T.space.sm }}>
      <Text
        style={{
          ...T.micro,
          color: colors.mutedForeground,
          marginHorizontal: T.space.xl - 12,
          marginBottom: T.space.xs,
          marginTop: T.space.sm,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

// ── Sub-component: DrawerNavItem ──────────────────────────────────────────────
function DrawerNavItem({
  item,
  active,
  onPress,
  onLongPress,
  pinned = false,
  colors,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
  /** Long press pins/unpins the item on Home */
  onLongPress?: () => void;
  pinned?: boolean;
  colors: typeof THEME.light;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityHint={onLongPress ? t('drawer.pinHint') : undefined}
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: T.space.md - 4,
        marginHorizontal: T.space.sm,
        marginBottom: 1,
        paddingHorizontal: T.space.sm + 2,
        paddingVertical: T.space.sm + 2,
        borderRadius: 12,
        minHeight: 48,
        backgroundColor: active ? `${INDIGO}10` : 'transparent',
      }}
    >
      {/* Icon tray */}
      <View
        style={{
          width: 34, height: 34, borderRadius: 9,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: active ? `${INDIGO}18` : colors.muted,
        }}
      >
        <Icon
          size={17}
          color={active ? INDIGO : colors.mutedForeground}
          strokeWidth={active ? 2.2 : 1.8}
        />
      </View>

      {/* Label */}
      <Text
        style={{
          flex: 1,
          ...T.subhead,
          fontWeight: active ? T.weight.semibold : T.weight.medium,
          color: active ? INDIGO : colors.foreground,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>

      {/* Pinned to Home */}
      {pinned ? <Star size={13} color={INDIGO} fill={INDIGO} /> : null}

      {/* Optional badge */}
      {item.badge && item.badge > 0 ? (
        <View
          style={{
            minWidth: 20, height: 20, borderRadius: 10,
            backgroundColor: INDIGO,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: T.space.xs + 1,
          }}
        >
          <Text style={{ ...T.micro, color: '#FFFFFF' }}>
            {item.badge > 99 ? '99+' : item.badge}
          </Text>
        </View>
      ) : null}

      {/* Active selection indicator — indigo bar */}
      {active ? (
        <View
          style={{
            width: 4, height: 20, borderRadius: 2,
            backgroundColor: INDIGO,
          }}
        />
      ) : null}
    </Pressable>
  );
}

// ── Sub-component: DrawerPinnedChip ───────────────────────────────────────────
function DrawerPinnedChip({
  label,
  color: _color,
  onPress,
  onLongPress,
  colors,
}: {
  label: string;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
  colors: typeof THEME.light;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={t('home.pinnedHintShort')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: T.space.sm - 2,
        paddingHorizontal: T.space.md - 4,
        paddingVertical: T.space.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${INDIGO}30`,
        marginRight: T.space.sm,
        backgroundColor: `${INDIGO}0C`,
      }}
    >
      <Star size={11} color={INDIGO} fill={INDIGO} />
      <Text
        numberOfLines={1}
        style={{
          ...T.caption1,
          fontWeight: T.weight.semibold,
          color: colors.foreground,
          maxWidth: 90,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Sub-component: DrawerFooter ───────────────────────────────────────────────
function DrawerFooter({ safeBottom, colors }: { safeBottom: number; colors: typeof THEME.light }) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        paddingHorizontal: T.space.xl - 12,
        paddingTop: T.space.md - 4,
        paddingBottom: Math.max(safeBottom, T.space.md),
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View>
        <Text style={{ ...T.caption1, fontWeight: T.weight.semibold, color: colors.foreground }}>InvestSuite</Text>
        <Text style={{ ...T.micro, fontWeight: T.weight.regular, color: colors.mutedForeground, marginTop: 1, textTransform: undefined }}>
          {t('drawer.versionBuild', { version: '1.0.123', build: '1' })}
        </Text>
      </View>

      {/* Sync status — fixed green (semantic status, not a surface color) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.space.xs + 1 }}>
        <Wifi size={12} color='#16A34A' strokeWidth={2} />
        <Text style={{ ...T.micro, color: '#16A34A', textTransform: undefined }}>{t('common.online')}</Text>
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function AppDrawer({ visible, onClose }: AppDrawerProps) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const pathname = usePathname();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  // Phone: 82% capped at 360dp · Tablet: up to 480dp
  const drawerWidth = Math.min(windowWidth * 0.82, windowWidth >= 600 ? 480 : 360);

  const { items: pinnedItems, pinItem, unpinItem, isPinned } = usePinnedItems();

  // Long press a menu item to pin it to Home (or unpin it).
  const togglePin = useCallback((item: NavItem) => {
    const label = t(item.labelKey);
    let message: string;
    if (isPinned(item.id)) {
      unpinItem(item.id);
      message = t('drawer.unpinnedToast', { name: label });
    } else {
      pinItem({
        id: item.id,
        label: item.label,
        labelKey: item.labelKey,
        iconKey: item.id,
        color: item.color,
        route: item.route,
      });
      message = t('drawer.pinnedToast', { name: label });
    }
    if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  }, [t, isPinned, pinItem, unpinItem]);

  // ── Animation refs ──────────────────────────────────────────────────────────
  // Initialise well off-screen
  const slideAnim   = useRef(new Animated.Value(-500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 28,
          stiffness: 260,
          mass: 0.9,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -drawerWidth - 20,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim, drawerWidth]);

  const handleNavigate = useCallback((route: string) => {
    onClose();
    setTimeout(() => router.replace(route as never), 60);
  }, [onClose]);

  const activeRoute = pathname ?? '';
  const isActive = (route: string) =>
    activeRoute.includes(route.replace('/(app)/', '').split('/')[0]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* ── Backdrop ── */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(17,24,39,0.35)',
          opacity: backdropAnim,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel={t('drawer.closeAria')}
        />
      </Animated.View>

      {/* ── Drawer panel ── */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: drawerWidth,
          backgroundColor: colors.card,
          boxShadow: [{ offsetX: 4, offsetY: 0, blurRadius: 32, color: 'rgba(0,0,0,0.12)' }],
          transform: [{ translateX: slideAnim }],
        }}
      >
        {/* ── Header ── */}
        <DrawerHeader onClose={onClose} safeTop={insets.top} colors={colors} />

        {/* ── Profile card ── */}
        <DrawerProfileCard
          officerName={workspace.officer_name}
          policeStation={workspace.police_station}
          district={workspace.district ?? ''}
          onPress={() => handleNavigate('/(app)/settings')}
          colors={colors}
        />

        {/* ── Scrollable nav body ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Quick Access (pinned) ── */}
          {pinnedItems.length > 0 && (
            <DrawerSection label={t('drawer.quickAccess')} colors={colors}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: T.space.md - 4, paddingVertical: T.space.sm - 2 }}
              >
                {pinnedItems.slice(0, 5).map((p) => (
                  <DrawerPinnedChip
                    key={p.id}
                    label={p.labelKey ? t(p.labelKey) : p.label}
                    color={p.color}
                    onPress={() => handleNavigate(p.route)}
                    onLongPress={() => unpinItem(p.id)}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            </DrawerSection>
          )}

          {/* ── Main navigation ── */}
          <DrawerSection label={t('drawer.navigation')} colors={colors}>
            {MAIN_NAV.map((item) => (
              <DrawerNavItem
                key={item.id}
                item={item}
                active={isActive(item.route)}
                onPress={() => handleNavigate(item.route)}
                onLongPress={item.id === 'home' ? undefined : () => togglePin(item)}
                pinned={isPinned(item.id)}
                colors={colors}
              />
            ))}
          </DrawerSection>

          {/* ── Secondary ── */}
          <DrawerSection label={t('drawer.more')} colors={colors}>
            {SECONDARY_NAV.map((item) => (
              <DrawerNavItem
                key={item.id}
                item={item}
                active={isActive(item.route)}
                onPress={() => handleNavigate(item.route)}
                onLongPress={() => togglePin(item)}
                pinned={isPinned(item.id)}
                colors={colors}
              />
            ))}
            {/* Developer Options — hidden in production */}
            {__DEV__ && (
              <DrawerNavItem
                item={{
                  id: 'dev-options',
                  labelKey: 'drawer.developerOptions',
                  label: 'Developer Options',
                  icon: Terminal,
                  route: '/(app)/dev-options',
                  color: '#0F766E',
                }}
                active={isActive('/(app)/dev-options')}
                onPress={() => handleNavigate('/(app)/dev-options')}
                colors={colors}
              />
            )}
          </DrawerSection>

        </ScrollView>

        {/* ── Footer ── */}
        <DrawerFooter safeBottom={insets.bottom} colors={colors} />
      </Animated.View>
    </Modal>
  );
}

export default AppDrawer;
