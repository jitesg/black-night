/**
 * परिपत्र गाइड screen (owner: the 70/2013 sample = the base theme + structure for every DGP परिपत्र).
 * Navy header with an amber line (compact: back · title + ⚖️ line · ☆), section buttons that scroll to each section, then the
 * sections the guide has (circularGuideCore.guideSections): 1 विवरण (+ आज की धाराएँ, tap opens the new section), समस्या (amber box),
 * निर्देश (numbered points, "देखें 73/2013" tags) + related परिपत्र red box (tap opens it), DGP (navy box), वाद (case box + order
 * tabs), चेकलिस्ट (ticks + optional switch + navy status card; saved on this phone). Footer + "मूल पाठ व नोट" → the old view
 * (?view=text). THEME colours for cards / text, fixed navy + amber like the owner's page, deeper shades in dark mode.
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { boldParts, checklistProgress, guideSections, type CircularGuide, type GuideSectionKey } from '@/lib/circularGuideCore';
import { guideLawPairs, loadGuideTicks, saveGuideTicks } from '@/lib/circularGuide';
import { useSavedToggle } from '@/lib/knowledge/knowledgeVisits';

const ACT_COLOR: Record<string, { light: string; dark: string }> = {
  BNS: { light: '#1D4ED8', dark: '#60A5FA' }, BNSS: { light: '#0F766E', dark: '#2DD4BF' }, BSA: { light: '#B45309', dark: '#FBBF24' },
};

function palette(dark: boolean) {
  return {
    navy: dark ? '#0B1220' : '#1E293B', navy2: dark ? '#1E293B' : '#334155', amberLine: '#D97706', amberText: '#FBBF24',
    amber: dark ? '#FBBF24' : '#B45309', amberBg: dark ? '#3A2A10' : '#FFFBEB', amberFg: dark ? '#FDE68A' : '#78350F',
    red: dark ? '#F87171' : '#DC2626', redBg: dark ? '#DC26261F' : '#FEF2F2', soft: dark ? '#262D3A' : '#F5F5F4',
    green: '#10B981',
  };
}

function Rich({ text, style, boldColor }: { text: string; style: object; boldColor?: string }) {
  return (
    <Text style={style}>
      {boldParts(text).map((p, i) => (p.bold ? <Text key={i} style={{ fontWeight: '800', ...(boldColor ? { color: boldColor } : {}) }}>{p.text}</Text> : p.text))}
    </Text>
  );
}

export const CircularGuideView = memo(function CircularGuideView({ entryId, title, guide }: { entryId: string; title: string; guide: CircularGuide }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const P = palette(dark);
  const insets = useSafeAreaInsets();
  const sections = useMemo(() => guideSections(guide), [guide]);
  const laws = useMemo(() => guideLawPairs(guide), [guide]);
  const scrollRef = useRef<ScrollView>(null);
  const ys = useRef<Partial<Record<GuideSectionKey, number>>>({});
  const [active, setActive] = useState<GuideSectionKey>(sections[0]?.key ?? 'details');
  const [orderTab, setOrderTab] = useState(0);
  const visit = useMemo(() => ({ route: `/(app)/knowledge/${entryId}`, label: title, title: '', color: '#B45309' }), [entryId, title]);
  const { saved, toggle } = useSavedToggle(visit);

  // checklist ticks (this phone)
  const [ticks, setTicks] = useState(() => loadGuideTicks(entryId));
  const doneSet = useMemo(() => new Set(ticks.done), [ticks]);
  const items = guide.checklist?.items ?? [];
  const prog = checklistProgress(items, doneSet, ticks.opt);
  const update = useCallback((next: { done: number[]; opt: boolean }) => { setTicks(next); saveGuideTicks(entryId, next); }, [entryId]);

  const go = (k: GuideSectionKey) => {
    setActive(k);
    const y = ys.current[k];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };
  const onScroll = (y: number) => {
    let cur: GuideSectionKey = sections[0]?.key ?? 'details';
    for (const s of sections) { const sy = ys.current[s.key]; if (sy != null && sy - 40 <= y) cur = s.key; }
    if (cur !== active) setActive(cur);
  };
  const no = (k: GuideSectionKey) => sections.find((s) => s.key === k)?.no ?? 0;

  const card = { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12 } as const;
  const h2 = { fontSize: 14.5, fontWeight: '800' as const, color: C.foreground, paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border };
  const body = { fontSize: 13.5, lineHeight: 22, color: C.foreground };
  const muted = { fontSize: 12.5, lineHeight: 20, color: C.mutedForeground };
  const tag = (text: string) => (
    <Text style={{ fontSize: 10.5, fontWeight: '800', color: P.amber, backgroundColor: P.amberBg }}>{` ${text} `}</Text>
  );
  const sectionWrap = (k: GuideSectionKey, children: React.ReactNode) => (
    <View key={k} onLayout={(e) => { ys.current[k] = e.nativeEvent.layout.y; }} style={card}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <StatusBar style="light" />
      {/* compact navy header (owner) */}
      <View style={{ backgroundColor: P.navy, paddingTop: insets.top + 6, paddingHorizontal: 10, paddingBottom: 7, borderBottomWidth: 3, borderBottomColor: P.amberLine }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: sections.length > 1 ? 7 : 0 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="वापस"
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{guide.short}</Text>
            {guide.kicker ? <Text numberOfLines={1} style={{ color: P.amberText, fontSize: 11, fontWeight: '700' }}>{guide.kicker}</Text> : null}
          </View>
          <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ selected: saved }} accessibilityLabel={saved ? 'सहेजा गया — हटाएँ' : 'सहेजें'}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, color: '#FFFFFF' }}>{saved ? '⭐' : '☆'}</Text>
          </Pressable>
        </View>
        {sections.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {sections.map((s) => {
              const on = active === s.key;
              return (
                <Pressable key={s.key} onPress={() => go(s.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ borderRadius: 7, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: on ? P.amberLine : P.navy2 }}>
                  <Text style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: on ? '#FFFFFF' : '#E2E8F0' }}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
        contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 14 }}
      >
        {sections.some((s) => s.key === 'details') ? sectionWrap('details', (
          <>
            <Text style={h2}>{`${no('details')}. परिपत्र का सामान्य विवरण`}</Text>
            {(guide.details ?? []).map((d, i) => (
              <View key={d.k} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.mutedForeground }}>{d.k}</Text>
                <Text style={{ ...body, fontWeight: '600', ...(d.accent ? { color: P.amber } : {}) }}>{d.v}</Text>
              </View>
            ))}
            {laws.length ? (
              <View style={{ paddingTop: 8, borderTopWidth: guide.details?.length ? 1 : 0, borderTopColor: C.border }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.mutedForeground, marginBottom: 6 }}>आज की धाराएँ</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {laws.map((l) => l.news.map((n) => {
                    const col = (ACT_COLOR[n.act] ?? ACT_COLOR.BNS)[dark ? 'dark' : 'light'];
                    return (
                      <Pressable key={`${l.old}-${n.act}${n.n}`} onPress={() => router.push(`/(app)/knowledge/law/${n.act}/${n.n}` as never)}
                        accessibilityRole="button" accessibilityLabel={`${l.old} अब ${n.act} ${n.n}`}
                        style={{ borderRadius: 10, borderWidth: 1, borderColor: `${col}55`, backgroundColor: `${col}14`, paddingHorizontal: 9, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 10.5, color: C.mutedForeground }}>{l.old}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: col }}>{`${n.act} ${n.n} ›`}</Text>
                      </Pressable>
                    );
                  }))}
                </View>
              </View>
            ) : null}
          </>
        )) : null}

        {guide.problem ? sectionWrap('problem', (
          <>
            <Text style={h2}>{`${no('problem')}. ${guide.problemTitle ?? 'मुख्य समस्या'}`}</Text>
            <View style={{ backgroundColor: P.amberBg, borderLeftWidth: 4, borderLeftColor: P.amberLine, borderRadius: 10, padding: 10 }}>
              <Rich text={guide.problem} style={{ ...body, color: P.amberFg }} />
            </View>
          </>
        )) : null}

        {guide.directions ? sectionWrap('directions', (
          <>
            <Text style={h2}>{`${no('directions')}. ${guide.directions.title ?? 'मुख्य निर्देश'}`}</Text>
            {guide.directions.intro ? <Text style={{ ...muted, marginBottom: 8 }}>{guide.directions.intro}</Text> : null}
            <View style={{ gap: 8 }}>
              {guide.directions.points.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 9, backgroundColor: P.soft, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 9 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: P.amberLine, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ ...body, flex: 1 }}>
                    {p.t ? <Text style={{ fontWeight: '800' }}>{`${p.t}: `}</Text> : null}
                    {boldParts(p.b).map((x, j) => (x.bold ? <Text key={j} style={{ fontWeight: '800' }}>{x.text}</Text> : x.text))}
                    {p.see ? <Text>{'  '}{tag(`देखें ${p.see}`)}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
            {(guide.related ?? []).map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/(app)/knowledge/${r.id}` as never)} accessibilityRole="button" accessibilityLabel={r.title}
                style={{ marginTop: 10, backgroundColor: P.redBg, borderLeftWidth: 4, borderLeftColor: '#DC2626', borderRadius: 10, padding: 10 }}>
                <Text style={body}>
                  <Text style={{ fontWeight: '800', color: P.red }}>{`⚠️ ${r.title}: `}</Text>
                  {r.text}{'  '}
                  <Text style={{ fontWeight: '800', color: P.amber, textDecorationLine: 'underline' }}>खोलें ›</Text>
                </Text>
              </Pressable>
            ))}
          </>
        )) : null}

        {guide.dgp ? sectionWrap('dgp', (
          <>
            <Text style={h2}>{`${no('dgp')}. डीजीपी का निर्देश`}</Text>
            <View style={{ backgroundColor: P.navy, borderRadius: 12, padding: 11 }}>
              <Rich text={guide.dgp} style={{ fontSize: 13.5, lineHeight: 22, color: '#E2E8F0' }} boldColor={P.amberText} />
            </View>
          </>
        )) : null}

        {guide.case ? sectionWrap('case', (
          <>
            <Text style={h2}>{`${no('case')}. ${guide.case.title ?? 'संदर्भित वाद'}`}</Text>
            {guide.case.intro ? <Text style={{ ...muted, marginBottom: 8 }}>{guide.case.intro}</Text> : null}
            {guide.case.lines?.length ? (
              <View style={{ backgroundColor: P.soft, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, gap: 6, marginBottom: 10 }}>
                {guide.case.lines.map((l) => (
                  <Text key={l.k} style={{ ...body, fontSize: 13 }}><Text style={{ fontWeight: '800' }}>{`${l.k}: `}</Text>{l.v}</Text>
                ))}
              </View>
            ) : null}
            {guide.case.points?.length ? (
              <View style={{ gap: 8, marginBottom: guide.case.orders?.length ? 10 : 0 }}>
                {guide.case.points.map((pt, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ ...body, color: P.amber, fontWeight: '800' }}>•</Text>
                    <Rich text={pt} style={{ ...body, flex: 1 }} />
                  </View>
                ))}
              </View>
            ) : null}
            {guide.case.orders?.length ? (
              <>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 8 }}>
                  {guide.case.orders.map((o, i) => {
                    const on = orderTab === i;
                    return (
                      <Pressable key={o.tab} onPress={() => setOrderTab(i)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: on ? P.amberLine : 'transparent',
                          backgroundColor: on ? P.amberBg : 'transparent', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '800', color: on ? P.amber : C.mutedForeground }}>{`📅 ${o.tab}`}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ backgroundColor: P.soft, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, gap: 8 }}>
                  {(guide.case.orders[orderTab] ?? guide.case.orders[0]).points.map((pt, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ ...body, color: P.amber, fontWeight: '800' }}>•</Text>
                      <Rich text={pt} style={{ ...body, flex: 1 }} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )) : null}

        {guide.checklist ? sectionWrap('checklist', (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', ...h2 }}>
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: C.foreground }}>{`${no('checklist')}. ${guide.checklist.title ?? 'चेकलिस्ट'}`}</Text>
              <Pressable onPress={() => update({ done: [], opt: ticks.opt })} accessibilityRole="button"
                style={{ borderRadius: 7, borderWidth: 1, borderColor: C.border, backgroundColor: P.soft, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11.5, color: C.foreground }}>रीसेट ↺</Text>
              </Pressable>
            </View>
            {guide.checklist.intro ? <Text style={{ ...muted, marginBottom: 8 }}>{guide.checklist.intro}</Text> : null}
            {items.map((it, i) => {
              const na = !!it.optional && !ticks.opt;
              const on = doneSet.has(i) && !na;
              return (
                <Pressable key={i} disabled={na}
                  onPress={() => update({ done: on ? ticks.done.filter((x) => x !== i) : [...ticks.done, i], opt: ticks.opt })}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: na }}
                  style={{ flexDirection: 'row', gap: 10, padding: 10, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: C.border,
                    backgroundColor: P.soft, opacity: na ? 0.45 : 1 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: P.amberLine, backgroundColor: on ? P.amberLine : 'transparent',
                    alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    {on ? <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...body, fontWeight: '700' }}>{`${i + 1}. ${it.t}`}</Text>
                    <Text style={muted}>{na ? 'लागू नहीं — आपके आदेश में यह शर्त नहीं' : (it.s ?? '')}</Text>
                  </View>
                </Pressable>
              );
            })}
            {items.some((x) => x.optional) ? (
              <Pressable onPress={() => update({ done: ticks.done, opt: !ticks.opt })} accessibilityRole="switch" accessibilityState={{ checked: ticks.opt }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: P.amberLine }}>
                <View style={{ width: 36, height: 21, borderRadius: 11, backgroundColor: ticks.opt ? P.green : '#94A3B8', padding: 2, alignItems: ticks.opt ? 'flex-end' : 'flex-start' }}>
                  <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: '#FFFFFF' }} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...body, fontWeight: '700' }}>{guide.checklist.optionalLabel ?? 'मेरे मामले में यह शर्त है'}</Text>
                  {guide.checklist.optionalHint ? <Text style={muted}>{guide.checklist.optionalHint}</Text> : null}
                </View>
              </Pressable>
            ) : null}
            <View style={{ backgroundColor: P.navy, borderRadius: 14, padding: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>स्थिति</Text>
              <Text>
                <Text style={{ fontSize: 30, fontWeight: '800', color: P.amberText }}>{prog.done}</Text>
                <Text style={{ fontSize: 14, color: '#94A3B8' }}>{` / ${prog.total} शर्तें पूर्ण`}</Text>
              </Text>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: '#334155', overflow: 'hidden', marginTop: 6 }}>
                <View style={{ width: `${prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%`, height: '100%', backgroundColor: prog.complete ? P.green : '#F59E0B' }} />
              </View>
              <View style={{ marginTop: 10, borderRadius: 10, padding: 10, borderWidth: 1,
                backgroundColor: prog.complete ? '#022C22' : '#450A0A', borderColor: prog.complete ? '#059669' : '#B91C1C' }}>
                <Text style={{ fontSize: 12.5, lineHeight: 20, color: prog.complete ? '#A7F3D0' : '#FECACA' }}>
                  {prog.complete
                    ? `✅ ${guide.checklist.doneText ?? 'सब शर्तें पूरी।'}`
                    : `⚠️ ${(guide.checklist.pendingText ?? '{n} शर्तें बाकी।').replace('{n}', String(prog.total - prog.done))}`}
                </Text>
              </View>
              {guide.checklist.footer ? (
                <Text style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155', fontSize: 11.5, lineHeight: 18, color: '#94A3B8' }}>
                  {guide.checklist.footer}
                </Text>
              ) : null}
            </View>
          </>
        )) : null}

        <View style={{ backgroundColor: P.navy, borderRadius: 12, padding: 11, gap: 10 }}>
          {guide.foot ? <Text style={{ fontSize: 11.5, lineHeight: 18, color: '#94A3B8' }}>{guide.foot}</Text> : null}
          <Pressable onPress={() => router.push(`/(app)/knowledge/${entryId}?view=text` as never)} accessibilityRole="button"
            style={{ alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, borderColor: '#475569', paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#E2E8F0' }}>📄 मूल पाठ, मेरा नोट व संलग्न फ़ाइलें ›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
});
