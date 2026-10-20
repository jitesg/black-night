/**
 * RegulationViewer — reader for one UP Police Regulations paragraph (L35),
 * POCSO section (L36) or women-protection Act section (L37).
 *
 * Sticky header (पैरा N, title, breadcrumb, prev/next) · 4 sticky tabs
 * (मूल पाठ | सरल हिंदी | उदाहरण | संबंधित), swipe or tap · notes · share ·
 * "Copilot से पूछें".
 *
 * Rules of Hooks: every hook is at the top of a component, never after a
 * conditional return; each tab is its own child component. The screen
 * wraps this in RegulationErrorBoundary with the plain viewer as fallback.
 */
import React, { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, FlatList, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import {
  AlertTriangle, Bot, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, Gavel, Lightbulb,
  Minus, Plus, Scale, Share2, Clock3,
} from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AICopilotModal } from '@/components/ai/AICopilotModal';
import { THEME } from '@/lib/theme';
import { logger } from '@/lib/logger';
import { getKnowledgeById, type KnowledgeEntry } from '@/lib/db/knowledgeRepo';
import { getKnowledgeNote, saveKnowledgeNote } from '@/lib/db/knowledgeNotesRepo';
import { getSection, parseSectionRef } from '@/lib/law/lawLibrary';
import { getRegNeighbours, getRegPara } from '@/lib/regulations/regIndex';
import {
  parseExamples, parseRegSections, parseSimpleItems, relatedLabels, sectionsToPlainText,
  ACT_META, CONFIDENTIAL_PREFIX, actOfId, isWomenAct, sectionLabel,
  type RegExample, type RegPara, type RegSection, type RegSections,
} from '@/lib/regulations/regCore';

type Theme = (typeof THEME)['light'];
type TabKey = 'original' | 'simple' | 'examples' | 'related';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'original', label: 'मूल पाठ' },
  { key: 'simple', label: 'सरल हिंदी' },
  { key: 'examples', label: 'उदाहरण' },
  { key: 'related', label: 'संबंधित' },
];

// Remembered for this app session (not persisted).
let lastTab: TabKey = 'simple';
const FONT_KEY = 'reg.originalFontSize';
const AMBER = '#B45309';

// ─── Error boundary ──────────────────────────────────────────────────────────

export class RegulationErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    logger.error('[RegulationViewer] crashed, showing plain viewer:', error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ─── Small pieces ───────────────────────────────────────────────────────────

function ComingSoon({ c }: { c: Theme }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
      <Clock3 size={26} color={c.mutedForeground} />
      <Text style={{ color: c.mutedForeground, fontSize: 15, fontWeight: '700' }}>जल्द उपलब्ध</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 24 }}>
        यह भाग तैयार किया जा रहा है — अगले अपडेट में आएगा।
      </Text>
    </View>
  );
}

function NotesCard({ c, note, status, onChange, onBlur, unit }: {
  c: Theme; unit: string; note: string; status: 'idle' | 'saving' | 'saved'; onChange: (t: string) => void; onBlur: () => void;
}) {
  return (
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14, gap: 8, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: c.foreground, fontWeight: '700', fontSize: 14 }}>📝 मेरा नोट</Text>
        {status === 'saved' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Check size={12} color="#16A34A" />
            <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '600' }}>सहेजा गया</Text>
          </View>
        ) : status === 'saving' ? (
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>सहेज रहे हैं…</Text>
        ) : null}
      </View>
      <TextInput
        value={note}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={`इस ${unit} पर अपना नोट लिखें…`}
        placeholderTextColor={c.mutedForeground}
        multiline
        textAlignVertical="top"
        style={{ minHeight: 90, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, color: c.foreground, fontSize: 14, lineHeight: 20 }}
      />
    </View>
  );
}

// ─── Tab 1: original English ────────────────────────────────────────────────

const OriginalTab = memo(function OriginalTab({ c, section, fontSize, onFont }: {
  c: Theme; section: RegSection; fontSize: number; onFont: (delta: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(section.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  if (section.pending) return <ComingSoon c={c} />;
  const btn = { minWidth: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: c.secondary, paddingHorizontal: 10, flexDirection: 'row' as const, gap: 6 };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Pressable onPress={() => onFont(-1)} style={btn} accessibilityLabel="छोटा अक्षर">
          <Minus size={14} color={c.foreground} /><Text style={{ color: c.foreground, fontWeight: '700' }}>A</Text>
        </Pressable>
        <Pressable onPress={() => onFont(1)} style={btn} accessibilityLabel="बड़ा अक्षर">
          <Plus size={14} color={c.foreground} /><Text style={{ color: c.foreground, fontWeight: '700', fontSize: 17 }}>A</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={copy} style={btn} accessibilityLabel="कॉपी करें">
          {copied ? <Check size={16} color="#16A34A" /> : <Copy size={16} color={c.foreground} />}
          <Text style={{ color: copied ? '#16A34A' : c.foreground, fontWeight: '600' }}>{copied ? 'कॉपी हुआ' : 'कॉपी'}</Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16 }}>
        <Text
          selectable
          style={{ color: c.foreground, fontSize, lineHeight: Math.round(fontSize * 1.6), fontFamily: 'serif' }}
        >
          {section.body}
        </Text>
      </View>
    </View>
  );
});

// ─── Tab 2: simple Hindi ────────────────────────────────────────────────────

const SimpleTab = memo(function SimpleTab({ c, isDark, section, updatesFirst }: {
  c: Theme; isDark: boolean; section: RegSection; updatesFirst: boolean;
}) {
  // POCSO: the 2019 amendment callouts must be the first thing seen.
  const items = useMemo(() => {
    const all = parseSimpleItems(section.body);
    return updatesFirst
      ? [...all.filter((x) => x.kind === 'update'), ...all.filter((x) => x.kind !== 'update')]
      : all;
  }, [section.body, updatesFirst]);
  // Bullet numbers count bullets only (callouts are not numbered).
  const bulletNo = useMemo(() => {
    const m = new Map<number, number>();
    let n = 0;
    items.forEach((it, i) => { if (it.kind === 'bullet') m.set(i, ++n); });
    return m;
  }, [items]);
  if (section.pending) return <ComingSoon c={c} />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((it, i) => {
        if (it.kind === 'update') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: isDark ? '#78350F55' : '#FEF3C7', borderWidth: 1, borderColor: isDark ? '#F59E0B66' : '#FCD34D' }}>
              <AlertTriangle size={18} color={isDark ? '#FCD34D' : AMBER} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontWeight: '800', fontSize: 13, marginBottom: 2 }}>{it.label ?? 'अद्यतन'}</Text>
                <Text textBreakStrategy="simple" style={{ color: isDark ? '#FDE68A' : '#78350F', fontSize: 14.5, lineHeight: 22 }}>{it.text}</Text>
              </View>
            </View>
          );
        }
        if (it.kind === 'tip') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: isDark ? '#14532D66' : '#DCFCE7', borderWidth: 1, borderColor: isDark ? '#22C55E55' : '#86EFAC' }}>
              <Lightbulb size={18} color={isDark ? '#86EFAC' : '#15803D'} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: isDark ? '#86EFAC' : '#166534', fontWeight: '800', fontSize: 13, marginBottom: 2 }}>टिप</Text>
                <Text textBreakStrategy="simple" style={{ color: isDark ? '#BBF7D0' : '#14532D', fontSize: 14.5, lineHeight: 22 }}>{it.text}</Text>
              </View>
            </View>
          );
        }
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
            {it.kind === 'bullet' ? (
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${c.primary}1F`, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800' }}>{bulletNo.get(i)}</Text>
              </View>
            ) : null}
            <Text textBreakStrategy="simple" style={{ flex: 1, color: c.foreground, fontSize: 15, lineHeight: 23 }}>{it.text}</Text>
          </View>
        );
      })}
    </View>
  );
});

// ─── Tab 3: examples ────────────────────────────────────────────────────────

type ExFilter = 'all' | 'real' | 'scenario';
const EX_FILTERS: { key: ExFilter; label: string }[] = [
  { key: 'all', label: 'सभी' },
  { key: 'real', label: 'वास्तविक मामले' },
  { key: 'scenario', label: 'परिदृश्य' },
];
const REAL_BLUE = '#2563EB';

const ExampleCard = memo(function ExampleCard({ c, isDark, ex, index, badges }: {
  c: Theme; isDark: boolean; ex: RegExample; index: number; badges: boolean;
}) {
  return (
    <View style={{ borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: ex.real && badges ? `${REAL_BLUE}55` : c.border, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: ex.real && badges ? `${REAL_BLUE}${isDark ? '26' : '12'}` : `${c.primary}14`, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {badges && ex.num !== undefined ? (
            <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: ex.real ? REAL_BLUE : c.secondary }}>
              <Text style={{ color: ex.real ? '#fff' : c.secondaryForeground, fontSize: 12, fontWeight: '800' }}>{ex.num}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 16 }}>📖</Text>
          )}
          <Text textBreakStrategy="simple" style={{ flex: 1, color: c.foreground, fontWeight: '800', fontSize: 14.5 }}>
            {ex.label || `उदाहरण ${index + 1}`}
          </Text>
        </View>
        {badges ? (
          <View style={{ flexDirection: 'row' }}>
            {ex.real ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: REAL_BLUE }}>
                <Gavel size={11} color="#fff" />
                <Text textBreakStrategy="simple" style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>वास्तविक निर्णय</Text>
              </View>
            ) : (
              <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center', backgroundColor: c.secondary }}>
                <Text textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 11.5, fontWeight: '700' }}>काल्पनिक उदाहरण</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
      <Text textBreakStrategy="simple" style={{ color: c.foreground, fontSize: 14.5, lineHeight: 23, padding: 14, paddingBottom: ex.real && badges ? 8 : 14 }}>{ex.scenario}</Text>
      {ex.real && badges ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 14, marginBottom: 12 }}>
          <AlertTriangle size={11} color={isDark ? '#FCD34D' : AMBER} />
          <Text textBreakStrategy="simple" style={{ flex: 1, color: isDark ? '#FDE68A' : '#92400E', fontSize: 11.5 }}>
            न्यायालय में उपयोग से पहले मूल निर्णय से मिलान करें
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const EX_FIRST_BATCH = 6;

const ExamplesTab = memo(function ExamplesTab({ c, isDark, section, overview }: {
  c: Theme; isDark: boolean; section: RegSection; overview: boolean;
}) {
  const examples = useMemo(() => parseExamples(section.body), [section.body]);
  // Numbered L37 lists get badges + the filter; older UPPR/POCSO cards stay as they were.
  const badges = useMemo(() => examples.some((e) => e.num !== undefined), [examples]);
  const [filter, setFilter] = useState<ExFilter>('all');
  // Lazy render: first cards at once, the rest right after the first frame.
  const [shown, setShown] = useState(EX_FIRST_BATCH);
  useEffect(() => {
    if (examples.length <= EX_FIRST_BATCH) return;
    const id = setTimeout(() => setShown(examples.length), 60);
    return () => clearTimeout(id);
  }, [examples.length]);
  const visible = useMemo(
    () => examples
      .map((ex, i) => ({ ex, i }))
      .filter(({ ex }) => filter === 'all' || (filter === 'real' ? ex.real : !ex.real)),
    [examples, filter],
  );
  if (section.pending) return <ComingSoon c={c} />;
  if (examples.length === 0) {
    return <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{section.body || 'इस पैरा के लिए उदाहरण नहीं दिए गए हैं।'}</Text>;
  }
  // "इस धारा में उदाहरण की आवश्यकता नहीं …" — a plain note, no card.
  if (badges === false && examples.length === 1 && !examples[0].label) {
    return <Text textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 14, lineHeight: 21 }}>{examples[0].scenario}</Text>;
  }
  const realCount = examples.filter((e) => e.real).length;
  return (
    <View style={{ gap: 12 }}>
      {overview ? (
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: '#9333EA14', borderWidth: 1, borderColor: '#9333EA40' }}>
          <Text style={{ color: '#9333EA', fontWeight: '800', fontSize: 15 }}>एक नज़र में</Text>
          <Text textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 12.5, marginTop: 2 }}>
            पूरे अधिनियम को समझाने वाले {examples.length} उदाहरण · {realCount} वास्तविक निर्णय
          </Text>
        </View>
      ) : null}
      {badges && realCount > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: c.secondary }}>
          {EX_FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{ flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.card : 'transparent' }}
              >
                <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: active ? c.foreground : c.mutedForeground, fontWeight: active ? '800' : '600', fontSize: 13 }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {visible.slice(0, shown).map(({ ex, i }) => (
        <ExampleCard key={i} c={c} isDark={isDark} ex={ex} index={i} badges={badges} />
      ))}
      {visible.length === 0 ? (
        <Text style={{ color: c.mutedForeground, fontSize: 13, textAlign: 'center', marginTop: 8 }}>इस फ़िल्टर में कोई उदाहरण नहीं</Text>
      ) : null}
    </View>
  );
});

// ─── Tab 4: related ─────────────────────────────────────────────────────────

interface LinkTarget { id: string; title: string | null }

const RelatedTab = memo(function RelatedTab({ c, isDark, section, para, targets, onLaw, onOpen }: {
  c: Theme; isDark: boolean; section: RegSection; para: RegPara | null;
  targets: Record<string, LinkTarget>;
  onLaw: (text: string) => void; onOpen: (id: string) => void;
}) {
  // No sidecar entry → plain text (or "coming soon").
  if (!para) {
    return section.pending ? <ComingSoon c={c} /> : (
      <Text selectable style={{ color: c.foreground, fontSize: 14.5, lineHeight: 22 }}>{section.body}</Text>
    );
  }
  const laws = para.law ?? [];
  const sops = para.sop ?? [];
  const circs = para.circ ?? [];
  const cases = para.cases ?? [];
  if (!laws.length && !sops.length && !circs.length && !cases.length) {
    return section.pending ? <ComingSoon c={c} /> : (
      <Text selectable style={{ color: c.foreground, fontSize: 14.5, lineHeight: 22 }}>{section.body}</Text>
    );
  }
  const heading = (t: string) => <Text style={{ color: c.mutedForeground, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 8 }}>{t}</Text>;
  const circLabels = relatedLabels(section.body, /परिपत्र|circular/i);
  const sopLabels = relatedLabels(section.body, /^SOP|एसओपी/i);
  const linkChip = (id: string, color: string, Icon: typeof FileText, fallbackLabel?: string) => {
    const tg = targets[id];
    const disabled = !tg || !tg.title;
    return (
      <Pressable
        key={id}
        disabled={disabled}
        onPress={() => onOpen(id)}
        style={({ pressed }) => ({
          minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
          borderRadius: 14, borderWidth: 1, borderColor: `${color}55`, backgroundColor: `${color}${isDark ? '26' : '12'}`,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1, marginBottom: 8,
        })}
      >
        <Icon size={15} color={color} />
        <Text textBreakStrategy="simple" numberOfLines={2} style={{ flex: 1, color: isDark ? '#E2E8F0' : '#0F172A', fontSize: 13.5, fontWeight: '600' }}>
          {tg?.title ?? fallbackLabel ?? id}
        </Text>
        {!disabled ? <ExternalLink size={13} color={color} /> : <Text style={{ color: c.mutedForeground, fontSize: 11 }}>उपलब्ध नहीं</Text>}
      </Pressable>
    );
  };

  return (
    <View>
      {laws.length ? heading('कानून (पुरानी → नई)') : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {laws.map((lw, i) => {
          const label = `${lw.old} → ${lw.new.join(', ')}`;
          return (
            <Pressable
              key={i}
              onPress={() => onLaw(lw.new[0] || lw.old)}
              onLongPress={lw.u ? () => Alert.alert('सत्यापित करें', 'यह संदर्भ मूल स्रोत से मिलाकर ही प्रयोग करें।') : undefined}
              style={({ pressed }) => ({
                minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
                borderRadius: 22, backgroundColor: `${c.primary}1A`, borderWidth: 1, borderColor: `${c.primary}40`, opacity: pressed ? 0.7 : 1,
              })}
              accessibilityLabel={label}
            >
              <View style={{ flexShrink: 0 }}><Scale size={13} color={c.primary} /></View>
              {/* Long labels (e.g. "Legal Services Authorities Act …") wrap instead of running off screen */}
              <Text textBreakStrategy="simple" numberOfLines={3} style={{ flexShrink: 1, color: c.primary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
              {lw.u ? (
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>?</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {laws.some((l) => l.n) ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          {laws.filter((l) => l.n).map((l, i) => (
            <Text key={i} textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 12.5, lineHeight: 18 }}>
              • {l.old} → {l.new.join(', ')}: {l.n}
            </Text>
          ))}
        </View>
      ) : null}
      {laws.some((l) => l.u) ? (
        <Text style={{ color: AMBER, fontSize: 11.5, marginTop: 6 }}>? = सत्यापित करें (देर तक दबाएँ)</Text>
      ) : null}

      {sops.length ? heading('SOP') : null}
      {sops.map((id, i) => linkChip(id, '#0F766E', FileText, sopLabels[i]))}

      {circs.length ? heading('परिपत्र') : null}
      {circs.map((id, i) => linkChip(id, '#2563EB', FileText, circLabels[i]))}

      {cases.length ? heading('न्यायिक निर्णय') : null}
      {cases.map((cs, i) => (
        <View key={i} style={{ padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginBottom: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Gavel size={16} color={c.foreground} />
            <Text selectable textBreakStrategy="simple" style={{ flex: 1, color: c.foreground, fontWeight: '800', fontSize: 14 }}>
              {cs.n}{cs.c ? ` · ${cs.c}` : ''}
            </Text>
          </View>
          {cs.p ? <Text textBreakStrategy="simple" style={{ color: c.foreground, fontSize: 13.5, lineHeight: 20 }}>{cs.p}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: isDark ? '#78350F66' : '#FEF3C7' }}>
              <AlertTriangle size={11} color={isDark ? '#FCD34D' : AMBER} />
              <Text textBreakStrategy="simple" style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 11.5, fontWeight: '600' }}>
                न्यायालय में उपयोग से पहले मूल निर्णय से मिलान करें
              </Text>
            </View>
            {cs.u ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: `${AMBER}22` }}>
                <Text style={{ color: AMBER, fontSize: 11.5, fontWeight: '700' }}>सत्यापित करें</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
});

// ─── Viewer ─────────────────────────────────────────────────────────────────

export function RegulationViewer({ entry }: { entry: KnowledgeEntry }) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const { width } = useWindowDimensions();
  const pagerRef = useRef<FlatList<TabKey>>(null);

  const para = useMemo(() => getRegPara(entry.id), [entry.id]);
  const sections = useMemo<RegSections>(() => parseRegSections(entry.description), [entry.description]);
  const nav = useMemo(() => getRegNeighbours(entry.id), [entry.id]);

  const [tab, setTab] = useState<TabKey>(lastTab);
  const [fontSize, setFontSize] = useState(16);
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [targets, setTargets] = useState<Record<string, LinkTarget>>({});
  const [copilotOpen, setCopilotOpen] = useState(false);

  const act = actOfId(entry.id);
  const meta = ACT_META[act];
  const isPocso = act === 'pocso';
  const women = isWomenAct(act);
  const paraNo = para?.no ?? sections.title.match(/(?:पैरा|धारा)\s*([\w-]+)/)?.[1] ?? '';
  const title = para?.t ?? sections.title.replace(/^(?:POCSO\s*)?(?:पैरा|धारा)\s*[\w-]+\s*[—-]\s*/, '');
  const isOverview = women && paraNo === '0';
  const unitLabel = act === 'uppr'
    ? `${meta.unit} ${paraNo}`
    : isOverview ? `${meta.prefix} — एक नज़र में` : `${meta.prefix} ${sectionLabel(act, paraNo)}`;

  // Font size (persisted)
  useEffect(() => {
    AsyncStorage.getItem(FONT_KEY).then((v) => {
      const n = Number(v);
      if (n >= 12 && n <= 26) setFontSize(n);
    }).catch(() => {});
  }, []);
  const changeFont = useCallback((delta: number) => {
    setFontSize((f) => {
      const n = Math.max(12, Math.min(26, f + delta * 2));
      AsyncStorage.setItem(FONT_KEY, String(n)).catch(() => {});
      return n;
    });
  }, []);

  // Notes (auto-save, same store as other knowledge rows)
  useEffect(() => {
    let alive = true;
    getKnowledgeNote(entry.id).then((n) => { if (alive) setNote(n ?? ''); }).catch(() => {});
    return () => { alive = false; };
  }, [entry.id]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  const onNote = useCallback((text: string) => {
    setNote(text);
    setNoteStatus('saving');
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      await saveKnowledgeNote(entry.id, text);
      setNoteStatus('saved');
    }, 800);
  }, [entry.id]);
  const onNoteBlur = useCallback(async () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    await saveKnowledgeNote(entry.id, note);
    setNoteStatus('saved');
  }, [entry.id, note]);

  // Which SOP / circular ids exist in the app (missing → disabled chip)
  useEffect(() => {
    let alive = true;
    const ids = [...(para?.sop ?? []), ...(para?.circ ?? [])];
    if (ids.length === 0) return;
    (async () => {
      const out: Record<string, LinkTarget> = {};
      for (const id of ids) {
        let titleFound: string | null = null;
        try {
          const row = await getKnowledgeById(id);
          if (row) titleFound = row.title;
          else {
            const { getByKid, getById } = await import('@/ai/sopStruct');
            const st = getByKid(id) || getById(id);
            if (st) titleFound = st.title;
          }
        } catch {}
        out[id] = { id, title: titleFound };
      }
      if (alive) setTargets(out);
    })();
    return () => { alive = false; };
  }, [para]);

  // Jump the pager to the remembered tab once laid out
  useEffect(() => {
    const i = TABS.findIndex((t) => t.key === tab);
    const id = setTimeout(() => pagerRef.current?.scrollToIndex({ index: Math.max(0, i), animated: false }), 0);
    return () => clearTimeout(id);
    // only on mount / width change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const selectTab = useCallback((k: TabKey) => {
    lastTab = k;
    setTab(k);
    const i = TABS.findIndex((t) => t.key === k);
    pagerRef.current?.scrollToIndex({ index: i, animated: true });
  }, []);

  const onPageEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    const k = TABS[Math.max(0, Math.min(TABS.length - 1, i))].key;
    lastTab = k;
    setTab(k);
  }, [width]);

  const onLaw = useCallback(async (text: string) => {
    const ref = parseSectionRef(text);
    if (ref && getSection(ref.act, ref.n)) {
      router.push(`/(app)/knowledge/law/${ref.act}/${ref.n}` as never);
      return;
    }
    await Clipboard.setStringAsync(text);
    Alert.alert('कॉपी हुआ', `"${text}" कॉपी कर लिया गया।`);
  }, [router]);

  const onOpen = useCallback((id: string) => {
    router.push(`/(app)/knowledge/${id}` as never);
  }, [router]);

  const goPara = useCallback((id: string | null) => {
    if (id) router.replace(`/(app)/knowledge/${id}` as never);
  }, [router]);

  const onShare = useCallback(async () => {
    try {
      // POCSO / women Acts (abuse, harassment, trafficking): mark shared text confidential.
      const body = sectionsToPlainText(entry.title, sections);
      const message = meta.sensitive ? `${CONFIDENTIAL_PREFIX}\n\n${body}` : body;
      await Share.share({ title: entry.title, message: `${message}\n\n— via InvestSuite` });
    } catch (e) {
      logger.error('[RegulationViewer] share failed:', e);
    }
  }, [entry.title, sections, meta.sensitive]);

  const copilotQuery = isPocso
    ? `POCSO धारा ${paraNo} क्या कहती है? (${title})`
    : isOverview ? `${meta.prefix} (${meta.hindi}) एक नज़र में समझाइए`
    : women ? `${meta.prefix} धारा ${paraNo} क्या कहती है? (${title})`
    : `UPPR पैरा ${paraNo} क्या कहता है? (${title})`;

  const renderPage = useCallback(({ item }: { item: TabKey }) => (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      {item === 'original' ? <OriginalTab c={c} section={sections.original} fontSize={fontSize} onFont={changeFont} /> : null}
      {item === 'simple' ? <SimpleTab c={c} isDark={isDark} section={sections.simple} updatesFirst={act !== 'uppr'} /> : null}
      {item === 'examples' ? <ExamplesTab c={c} isDark={isDark} section={sections.examples} overview={isOverview} /> : null}
      {item === 'related' ? (
        <RelatedTab c={c} isDark={isDark} section={sections.related} para={para} targets={targets} onLaw={onLaw} onOpen={onOpen} />
      ) : null}
      <NotesCard c={c} unit={meta.unit} note={note} status={noteStatus} onChange={onNote} onBlur={onNoteBlur} />
    </ScrollView>
  ), [width, c, isDark, act, isOverview, meta.unit, sections, fontSize, changeFont, para, targets, onLaw, onOpen, note, noteStatus, onNote, onNoteBlur]);

  const navBtn = (id: string | null, dir: 'prev' | 'next') => (
    <Pressable
      disabled={!id}
      onPress={() => goPara(id)}
      accessibilityLabel={dir === 'prev' ? `पिछला ${meta.unit}` : `अगला ${meta.unit}`}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: c.secondary, opacity: !id ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      {dir === 'prev' ? <ChevronLeft size={20} color={c.foreground} /> : <ChevronRight size={20} color={c.foreground} />}
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={unitLabel}
        subtitle={women ? meta.hindi : meta.name}
        showBack
        actions={<HeaderIconBtn icon={Share2} label="शेयर" onPress={onShare} />}
      />

      {/* Sticky: title, breadcrumb, prev/next */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
        {navBtn(nav.prev, 'prev')}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} textBreakStrategy="simple" style={{ color: c.foreground, fontWeight: '800', fontSize: 15, lineHeight: 21 }}>{title}</Text>
          <Text numberOfLines={1} textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 11.5, marginTop: 2 }}>
            {para
              ? women ? para.chT
              : `${isPocso ? '' : `भाग ${para.part} · `}अध्याय ${para.ch} — ${para.chT}`
              : sections.breadcrumb}
            {para && !para.done ? '  ·  केवल मूल पाठ' : ''}
          </Text>
        </View>
        {navBtn(nav.next, 'next')}
      </View>

      {/* Sticky tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => selectTab(t.key)}
              style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: active ? c.primary : 'transparent' }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: active ? c.primary : c.mutedForeground, fontWeight: active ? '800' : '600', fontSize: 13.5 }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        ref={pagerRef}
        data={TABS.map((t) => t.key)}
        keyExtractor={(k) => k}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPageEnd}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialScrollIndex={Math.max(0, TABS.findIndex((t) => t.key === tab))}
        extraData={renderPage}
        windowSize={3}
        style={{ flex: 1 }}
      />

      {/* Bottom bar */}
      {/* Starts right of the app-wide AI button (bottom-left). */}
      <View style={{ position: 'absolute', left: 92, right: 16, bottom: 22 }}>
        <Pressable
          onPress={() => setCopilotOpen(true)}
          style={({ pressed }) => ({
            height: 50, borderRadius: 25, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: pressed ? 0.85 : 1, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          })}
          accessibilityRole="button"
        >
          <Bot size={18} color={c.primaryForeground} />
          <Text style={{ color: c.primaryForeground, fontWeight: '700', fontSize: 15 }}>Copilot से पूछें</Text>
        </Pressable>
      </View>

      <AICopilotModal visible={copilotOpen} onClose={() => setCopilotOpen(false)} initialQuery={copilotOpen ? copilotQuery : undefined} />
    </View>
  );
}
