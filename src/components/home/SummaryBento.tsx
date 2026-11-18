/**
 * Home "सारांश" — design F (owner, sample approved): bento tiles in each module's colour.
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
import { memo, type ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { BookOpen, FileCheck, Landmark, Mail, Scale, ShieldCheck } from 'lucide-react-native';

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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-80"
      style={{ borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous', ...style } as object}
    >
      {/* the gradient fills the tile behind its content */}
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '1'} y2={horizontal ? '0' : '1'}>
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </Pressable>
  );
});

const W = '#FFFFFF';
const corner = (I: Icon) => (
  <View style={{ position: 'absolute', top: 10, right: 10, opacity: 0.85 }}>
    <I size={20} color={W} strokeWidth={2} />
  </View>
);

export const SummaryBento = memo(function SummaryBento({
  casesPending, casesTotal, courtActive, ppPending, nkTotal, reportsWeek, reportsToday, gdToday, go,
}: {
  casesPending: number; casesTotal: number; courtActive: number; ppPending: number; nkTotal: number;
  reportsWeek: number; reportsToday: number; gdToday: number;
  /** open a module route */
  go: (route: string) => void;
}) {
  const { t } = useTranslation();
  const pct = casesTotal > 0 ? Math.min(1, casesPending / casesTotal) : 0;
  const num = (size: number) => ({ fontSize: size, fontWeight: '800' as const, color: W, lineHeight: Math.round(size * 1.2) });
  const lbl = { fontSize: 12, fontWeight: '600' as const, color: W, opacity: 0.95, lineHeight: 18 };
  const small = { padding: 12, paddingRight: 34, minHeight: 84, justifyContent: 'flex-end' as const };

  return (
    <View style={{ gap: 10 }}>
      {/* rows 1–2: big मुकदमे tile | न्यायालय over प्रार्थना पत्र */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile kind="case" label={t('home.summary.cases')} onPress={() => go('/(app)/mukadma')}
          style={{ flex: 1.25, padding: 14, justifyContent: 'flex-end', minHeight: 178 }}>
          {corner(Scale)}
          <Text style={num(44)}>{casesPending}</Text>
          <Text style={lbl}>{t('home.summary.cases')}</Text>
          {casesTotal > 0 ? (
            <>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: '#FFFFFF40', marginTop: 8, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: W }} />
              </View>
              <Text style={{ ...lbl, fontSize: 11, opacity: 0.85, marginTop: 4 }}>{t('home.summary.casesOf', { total: casesTotal })}</Text>
            </>
          ) : null}
        </Tile>
        <View style={{ flex: 1, gap: 10 }}>
          <Tile kind="court" label={t('home.summary.court')} onPress={() => go('/(app)/nyayalay')} style={{ flex: 1, ...small }}>
            {corner(Landmark)}
            <Text style={num(26)}>{courtActive}</Text>
            <Text style={lbl} numberOfLines={2}>{t('home.summary.court')}</Text>
          </Tile>
          <Tile kind="pp" label={t('home.summary.pp')} onPress={() => go('/(app)/prarthna-patra')} style={{ flex: 1, ...small }}>
            {corner(Mail)}
            <Text style={num(26)}>{ppPending}</Text>
            <Text style={lbl} numberOfLines={2}>{t('home.summary.pp')}</Text>
          </Tile>
        </View>
      </View>

      {/* row 3: निरोधात्मक | रिपोर्ट */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile kind="nk" label={t('home.summary.nk')} onPress={() => go('/(app)/nirodhatmak')} style={{ flex: 1, ...small }}>
          {corner(ShieldCheck)}
          <Text style={num(26)}>{nkTotal}</Text>
          <Text style={lbl} numberOfLines={2}>{t('home.summary.nk')}</Text>
        </Tile>
        <Tile kind="rep" label={t('home.summary.reports')} onPress={() => go('/(app)/recent-tasks')} style={{ flex: 1, ...small }}>
          {corner(FileCheck)}
          <Text style={num(26)}>{reportsWeek}</Text>
          <Text style={lbl} numberOfLines={2}>{`${t('home.summary.reports')} · ${t('home.summary.reportsToday', { n: reportsToday })}`}</Text>
        </Tile>
      </View>

      {/* row 4: आज की GD — full width strip */}
      <Tile kind="gd" horizontal label={t('home.summary.gd')} onPress={() => go('/(app)/gd')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 }}>
        <BookOpen size={20} color={W} strokeWidth={2} />
        <Text style={{ ...lbl, fontSize: 13.5, flex: 1 }}>{t('home.summary.gd')}</Text>
        <Text style={num(22)}>{gdToday}</Text>
      </Tile>
    </View>
  );
});
