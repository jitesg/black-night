/**
 * Home "मेरी उत्पादकता" — design P1 (owner, sample approved): only मुकदमा / न्यायालय / प्रार्थना पत्र.
 * इस हफ़्ते / इस महीने switch → one row per module "मिले n · निस्तारित m · बाकी k" + its ring %, and a green strip
 * "कुल उत्पादकता · done / got निपटाए · p%". Rules in src/lib/productivity.ts. THEME colours (light + dark); a row opens its module.
 */
import { memo, useState, type ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Landmark, Mail, Scale } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { rowPct, type ProdRow, type ProdStats } from '@/lib/productivity';

type Icon = ComponentType<{ size: number; color: string; strokeWidth?: number }>;
const GREEN = '#16A34A';

/** module colour per theme (dark = a lighter shade so it reads on the dark card) */
const COLORS = {
  fir: { light: '#7C3AED', dark: '#A78BFA' },
  court: { light: '#1D4ED8', dark: '#60A5FA' },
  pp: { light: '#2D52B8', dark: '#93A8F4' },
} as const;

const Ring = memo(function Ring({ pct, color, text }: { pct: number; color: string; text: string }) {
  const s = 46; const r = s / 2 - 5; const c = 2 * Math.PI * r;
  return (
    <Svg width={s} height={s}>
      <Circle cx={s / 2} cy={s / 2} r={r} stroke={`${color}33`} strokeWidth={6} fill="none" />
      {pct > 0 ? (
        <Circle cx={s / 2} cy={s / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${s / 2} ${s / 2})`} />
      ) : null}
      <SvgText x={s / 2} y={s / 2 + 4} textAnchor="middle" fontSize={11} fontWeight="700" fill={text}>{`${pct}%`}</SvgText>
    </Svg>
  );
});

export const ProductivityCard = memo(function ProductivityCard({ stats, go }: { stats: ProdStats; go: (route: string) => void }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const [when, setWhen] = useState<'week' | 'month'>('month');
  const p = stats[when];

  const rows: { key: 'fir' | 'court' | 'pp'; icon: Icon; title: string; got: string; done: string; route: string; row: ProdRow }[] = [
    { key: 'fir', icon: Scale, title: t('home.prod.fir'), got: t('home.prod.firGot'), done: t('home.prod.firDone'), route: '/(app)/mukadma', row: p.fir },
    { key: 'court', icon: Landmark, title: t('home.prod.court'), got: t('home.prod.got'), done: t('home.prod.done'), route: '/(app)/nyayalay', row: p.court },
    { key: 'pp', icon: Mail, title: t('home.prod.pp'), got: t('home.prod.got'), done: t('home.prod.done'), route: '/(app)/prarthna-patra', row: p.pp },
  ];
  const seg = (k: 'week' | 'month', label: string) => (
    <Pressable onPress={() => setWhen(k)} accessibilityRole="button" accessibilityState={{ selected: when === k }}
      style={{ paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, ...(when === k ? { backgroundColor: C.card } : {}) }}>
      <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: when === k ? '700' : '500', color: when === k ? C.foreground : C.mutedForeground }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      {/* heading + इस हफ़्ते / इस महीने */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 13, color: C.mutedForeground }}>{`📈 ${t('home.prod.title')}`}</Text>
        <View style={{ flexDirection: 'row', backgroundColor: C.muted, borderRadius: 999, padding: 3 }}>
          {seg('week', t('home.prod.week'))}
          {seg('month', t('home.prod.month'))}
        </View>
      </View>

      <View className="shadow-sm shadow-black/5" style={{ backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderCurve: 'continuous' } as object}>
        {rows.map((r, i) => {
          const color = COLORS[r.key][dark ? 'dark' : 'light'];
          const pending = Math.max(0, r.row.got - r.row.done);
          const I = r.icon;
          return (
            <Pressable key={r.key} onPress={() => go(r.route)} accessibilityRole="button" accessibilityLabel={r.title}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: C.muted }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}1F` }}>
                <I size={19} color={color} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>{r.title}</Text>
                <Text numberOfLines={2} style={{ fontSize: 12, color: C.mutedForeground, lineHeight: 18 }}>
                  {`${r.got} `}<Text style={{ fontWeight: '700', color: C.foreground }}>{r.row.got}</Text>
                  {` · ${r.done} `}<Text style={{ fontWeight: '700', color: GREEN }}>{r.row.done}</Text>
                  {` · ${t('home.prod.left')} ${pending}`}
                </Text>
              </View>
              <Ring pct={rowPct(r.row)} color={color} text={C.foreground} />
            </Pressable>
          );
        })}

        {/* कुल उत्पादकता */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10,
          paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: `${GREEN}1A` }}>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 12.5, color: C.foreground }}>
            {t('home.prod.total', { done: p.done, got: p.got })}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: dark ? '#4ADE80' : GREEN }}>{`${p.pct}%`}</Text>
        </View>
      </View>
    </View>
  );
});
