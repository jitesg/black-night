/**
 * Home "और काम" (owner): what "मेरा काम" (ProductivityCard) does not show — निरोधात्मक, रिपोर्ट इस हफ़्ते, आज की GD — as one row of
 * 3 gradient tiles. (Was design F "सारांश" with मुकदमा / न्यायालय / प्रार्थना पत्र tiles too; those moved into "मेरा काम" as "कुल लंबित".)
 * Old design F layout, for reference:
 *   ┌──────────────┬──────────┐
 *   │ लंबित मुकदमे  │ न्यायालय  │
 *   │ (big + bar)   ├──────────┤
 *   │               │ प्रा0 पत्र │
 *   ├──────────────┼──────────┤
 *   │ निरोधात्मक    │ रिपोर्ट   │
 *   ├──────────────┴──────────┤
 *   │ आज की GD               n │
 *   └─────────────────────────┘
 * Gradients are drawn with react-native-svg (already in the app — no new native module). Dark mode = deeper shades.
 * Every tile opens its module, like the old tiles. Words from i18n (home.summary.*).
 */
import { memo, useState, type ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { BookOpen, FileCheck, ShieldCheck } from 'lucide-react-native';

type Icon = ComponentType<{ size: number; color: string; strokeWidth?: number }>;

/** [from, to] per module — light / dark (module colours of the app). */
const GRAD = {
  case: { light: ['#7C3AED', '#5B21B6'], dark: ['#6D28D9', '#4C1D95'] },
  court: { light: ['#1D4ED8', '#1E40AF'], dark: ['#1E40AF', '#1E3A8A'] },
  pp: { light: ['#2D52B8', '#1E3A8A'], dark: ['#1E3A8A', '#172554'] },
  nk: { light: ['#DC2626', '#991B1B'], dark: ['#B91C1C', '#7F1D1D'] },
  rep: { light: ['#16A34A', '#15803D'], dark: ['#15803D', '#14532D'] },
  gd: { light: ['#D97706', '#B45309'], dark: ['#B45309', '#78350F'] },
} as const;
type Kind = keyof typeof GRAD;

const Tile = memo(function Tile({ kind, onPress, style, children, horizontal, label }: {
  kind: Kind; onPress: () => void; style?: object; children: React.ReactNode; horizontal?: boolean; label: string;
}) {
  const { colorScheme } = useColorScheme();
  const [from, to] = GRAD[kind][colorScheme === 'dark' ? 'dark' : 'light'];
  const id = `g-${kind}`;
  // Android: a "100%" Svg inside the tile measured to a fixed default box (owner's build 47: the colour covered only the
  // top-left part, white text vanished) → draw it at the tile's real size, and paint the tile's own background meanwhile.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-80"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
      }}
      style={{ borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous', backgroundColor: from, ...style } as object}
    >
      {/* the gradient fills the tile behind its content (real pixel size, see above) */}
      {size ? (
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={size.w} height={size.h}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '1'} y2={horizontal ? '0' : '1'}>
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
      </Svg>
      ) : null}
      {children}
    </Pressable>
  );
});

const W = '#FFFFFF';

export const SummaryBento = memo(function SummaryBento({ nkTotal, reportsWeek, reportsToday, gdToday, go }: {
  nkTotal: number; reportsWeek: number; reportsToday: number; gdToday: number;
  /** open a module route */
  go: (route: string) => void;
}) {
  const { t } = useTranslation();
  const num = { fontSize: 22, fontWeight: '800' as const, color: W, lineHeight: 28 };
  const lbl = { fontSize: 11.5, fontWeight: '600' as const, color: W, opacity: 0.95, lineHeight: 17 };
  const tile = { flex: 1, padding: 11, paddingRight: 26, minHeight: 82, justifyContent: 'flex-end' as const };
  const small = (I: Icon) => (
    <View style={{ position: 'absolute', top: 8, right: 8, opacity: 0.85 }}><I size={16} color={W} strokeWidth={2} /></View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Tile kind="nk" label={t('home.summary.nk')} onPress={() => go('/(app)/nirodhatmak')} style={tile}>
        {small(ShieldCheck)}
        <Text style={num}>{nkTotal}</Text>
        <Text style={lbl} numberOfLines={2}>{t('home.summary.nkShort')}</Text>
      </Tile>
      <Tile kind="rep" label={t('home.summary.reports')} onPress={() => go('/(app)/recent-tasks')} style={tile}>
        {small(FileCheck)}
        <Text style={num}>{reportsWeek}</Text>
        <Text style={lbl} numberOfLines={3}>{`${t('home.summary.reports')} · ${t('home.summary.reportsToday', { n: reportsToday })}`}</Text>
      </Tile>
      <Tile kind="gd" label={t('home.summary.gd')} onPress={() => go('/(app)/gd')} style={tile}>
        {small(BookOpen)}
        <Text style={num}>{gdToday}</Text>
        <Text style={lbl} numberOfLines={2}>{t('home.summary.gd')}</Text>
      </Tile>
    </View>
  );
});
