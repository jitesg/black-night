/**
 * SopExplainTab — "समझें" tab of an SOP (Task L32): teaches the SOP instead of
 * only showing the booklet text.
 *
 * Order: hero (30 सेकंड में, याद-सूत्र, कब) → क्यों ज़रूरी → roadmap → phase
 * cards (लक्ष्य, कैसे करें, क्यों, गलतियाँ, प्रो-टिप, पुस्तिका के निर्देश with
 * checkboxes) → नया कानून अपडेट → मिसाल → कोर्ट की गलतियाँ → खुद को परखें →
 * footer.
 *
 * Checkbox state is the SAME sop_checklist rows the चेकलिस्ट tab uses, for the
 * case chosen in the parent screen (shared via selectedCaseId/onCaseChange).
 */
import { crimeTypeLabel } from '@/lib/db/checklistRepo';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { View, Text, Pressable, ScrollView, Modal, type LayoutChangeEvent } from 'react-native';
import { useColorScheme } from 'nativewind';
import { CheckSquare, Square, ChevronDown, ChevronUp, ArrowRight, Check } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { type SopExplain, phaseSteps, memParts } from '@/ai/sopExplain';
import { type SopStep } from '@/ai/sopIndex';
import { getChecklist, setStepDone } from '@/lib/db/sopChecklistRepo';
import { getAllFIRs, type FIR } from '@/lib/db/firRepo';
import { getDatabase } from '@/lib/db/database';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

const BLUE = '#2563EB';
const RED = '#DC2626';
const AMBER = '#D97706';
const GREEN = '#059669';

export interface SopExplainTabHandle {
  /** Parent ScrollView offset → highlights the phase being read. */
  onParentScroll: (y: number) => void;
}

interface Props {
  sopId: string;
  title: string;
  sourceLabel?: string;
  explain: SopExplain;
  steps: SopStep[];
  selectedCaseId: string | null;
  onCaseChange: (caseId: string | null) => void;
  onLawPress: (ref: string) => void;
  /** Scroll the parent ScrollView to a content offset. */
  scrollTo: (y: number) => void;
  /** Reports overall checklist progress for the sticky mini-bar. */
  onProgress?: (done: number, total: number) => void;
}

// ── small building blocks ────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 gap-2.5"
      style={[{ borderCurve: 'continuous', elevation: 1 }, style]}
    >
      {children}
    </View>
  );
}

function Tint({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View className="rounded-xl p-3 gap-1.5" style={{ backgroundColor: `${color}14`, borderLeftWidth: 3, borderLeftColor: color }}>
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-base font-bold text-foreground" style={{ lineHeight: 24 }}>{children}</Text>;
}

function Body({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-[16px] text-foreground ${className}`} style={{ lineHeight: 26 }}>{children}</Text>;
}

function ProgressRing({ done, total, color }: { done: number; total: number; color: string }) {
  const full = total > 0 && done >= total;
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: 22, height: 22, borderWidth: 2.5,
        borderColor: full ? GREEN : done > 0 ? color : `${color}40`,
        backgroundColor: full ? `${GREEN}22` : 'transparent',
      }}
    >
      <Text style={{ fontSize: 8, fontWeight: '700', color: full ? GREEN : color }}>
        {full ? '✓' : `${done}`}
      </Text>
    </View>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export const SopExplainTab = forwardRef<SopExplainTabHandle, Props>(function SopExplainTab(
  { sopId, title, sourceLabel, explain, steps, selectedCaseId, onCaseChange, onLawPress, scrollTo, onProgress },
  ref,
) {
  const { colorScheme } = useColorScheme();
  const C = THEME[colorScheme ?? 'light'];

  // ── checklist state (shared table with the चेकलिस्ट tab) ──
  const [checked, setChecked] = useState<Record<string, { done: boolean; note: string | null }>>({});
  useEffect(() => {
    let alive = true;
    getChecklist(sopId, selectedCaseId)
      .then((m) => { if (alive) setChecked(m); })
      .catch(() => { if (alive) setChecked({}); });
    return () => { alive = false; };
  }, [sopId, selectedCaseId]);

  const toggleStep = useCallback(async (step: SopStep) => {
    const next = !checked[step.id]?.done;
    setChecked((p) => ({ ...p, [step.id]: { done: next, note: p[step.id]?.note ?? null } }));
    try {
      await setStepDone(sopId, selectedCaseId, step.id, next);
    } catch {
      setChecked((p) => ({ ...p, [step.id]: { done: !next, note: p[step.id]?.note ?? null } }));
    }
  }, [checked, sopId, selectedCaseId]);

  const doneTotal = useMemo(() => steps.filter((s) => checked[s.id]?.done).length, [steps, checked]);
  useEffect(() => { onProgress?.(doneTotal, steps.length); }, [doneTotal, steps.length, onProgress]);

  const phaseProgress = useMemo(
    () => explain.phases.map((p) => {
      const ps = phaseSteps(p, steps);
      return { done: ps.filter(({ step }) => checked[step.id]?.done).length, total: ps.length };
    }),
    [explain.phases, steps, checked],
  );

  // ── cases (for the shared case chip) ──
  const [cases, setCases] = useState<FIR[]>([]);
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  useEffect(() => { getAllFIRs().then(setCases).catch(() => setCases([])); }, []);
  const caseObj = cases.find((c) => c.id === selectedCaseId);
  const caseLabel = caseObj ? `FIR ${caseObj.fir_number}` : 'बिना केस';

  // ── phases: accordion (first open), content mounted on first open ──
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([0]));
  const [bookletOpen, setBookletOpen] = useState<Set<number>>(() => new Set());
  const togglePhase = (i: number) =>
    setOpenSet((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const toggleBooklet = (i: number) =>
    setBookletOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  // ── positions for roadmap → scroll, and scroll → active phase ──
  const rootY = useRef(0);
  const phasesY = useRef(0);
  const cardY = useRef<number[]>([]);
  const [activePhase, setActivePhase] = useState(0);
  const activeRef = useRef(0);
  const roadmapRef = useRef<ScrollView>(null);
  const nodeX = useRef<number[]>([]);

  useImperativeHandle(ref, () => ({
    onParentScroll: (y: number) => {
      const base = rootY.current + phasesY.current;
      let idx = 0;
      for (let i = 0; i < cardY.current.length; i++) {
        if (y + 160 >= base + (cardY.current[i] ?? 0)) idx = i;
      }
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActivePhase(idx);
        roadmapRef.current?.scrollTo({ x: Math.max(0, (nodeX.current[idx] ?? 0) - 24), animated: true });
      }
    },
  }), []);

  const jumpToPhase = (i: number) => {
    setOpenSet((s) => new Set(s).add(i));
    const y = rootY.current + phasesY.current + (cardY.current[i] ?? 0);
    scrollTo(Math.max(0, y - 8));
  };

  // ── QA flip cards + local "याद" counter in app_settings ──
  const qaKey = `sop_qa_known:${sopId}`;
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set());
  const [known, setKnown] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    (async () => {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [qaKey]);
        if (row?.value) setKnown(new Set(JSON.parse(row.value) as number[]));
      } catch { /* counter is optional */ }
    })();
  }, [qaKey]);
  const markQA = async (i: number, remembered: boolean) => {
    const next = new Set(known);
    if (remembered) next.add(i); else next.delete(i);
    setKnown(next);
    setFlipped((s) => { const n = new Set(s); n.delete(i); return n; });
    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [qaKey, JSON.stringify([...next]), Math.floor(Date.now() / 1000)],
      );
    } catch { /* ignore */ }
  };

  const mem = memParts(explain.mem);

  return (
    <View className="gap-4" onLayout={(e: LayoutChangeEvent) => { rootY.current = e.nativeEvent.layout.y; }}>
      {/* a) HERO */}
      <Card>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-lg font-bold text-foreground" style={{ lineHeight: 28 }}>{title}</Text>
          {sourceLabel ? (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${C.primary}1A` }}>
              <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: C.primary }}>{sourceLabel}</Text>
            </View>
          ) : null}
        </View>
        <View className="rounded-xl p-3 gap-1" style={{ backgroundColor: `${AMBER}1A`, borderWidth: 1, borderColor: `${AMBER}55` }}>
          <Text className="text-xs font-bold" style={{ color: AMBER }}>⏱ 30 सेकंड में</Text>
          <Body>{explain.tl}</Body>
        </View>
        {mem.length > 0 && (
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground">याद-सूत्र</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {mem.map((m, i) => (
                <React.Fragment key={`${i}-${m}`}>
                  {i > 0 && <ArrowRight size={14} color={C.mutedForeground} />}
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${C.primary}1F` }}>
                    <Text textBreakStrategy="simple" className="text-sm font-bold" style={{ color: C.primary }}>{m}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
        {explain.when ? (
          <Text className="text-sm text-muted-foreground" style={{ lineHeight: 22 }}>
            <Text className="font-semibold text-foreground">कब लगता है: </Text>{explain.when}
          </Text>
        ) : null}
      </Card>

      {/* b) WHY */}
      {explain.why ? (
        <Tint color={BLUE}>
          <Text className="text-sm font-bold" style={{ color: BLUE }}>🎯 यह क्यों ज़रूरी</Text>
          <Body>{explain.why}</Body>
        </Tint>
      ) : null}

      {/* case chip (shared with चेकलिस्ट tab) */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {doneTotal}/{steps.length} पूरे
        </Text>
        <Pressable
          onPress={() => setCasePickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`केस चुनें: ${caseLabel}`}
          className="flex-row items-center gap-1 rounded-full border border-border px-3 active:opacity-70"
          style={{ minHeight: 36 }}
        >
          <Text className="text-xs font-semibold text-foreground">केस: {caseLabel}</Text>
          <ChevronDown size={14} color={C.mutedForeground} />
        </Pressable>
      </View>

      {/* c) ROADMAP */}
      <View className="gap-2">
        <SectionTitle>🗺 रास्ता</SectionTitle>
        <ScrollView ref={roadmapRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {explain.phases.map((p, i) => {
            const active = i === activePhase;
            return (
              <Pressable
                key={`node-${i}`}
                onLayout={(e) => { nodeX.current[i] = e.nativeEvent.layout.x; }}
                onPress={() => jumpToPhase(i)}
                accessibilityRole="button"
                accessibilityLabel={`चरण ${i + 1}: ${p.t}`}
                className="rounded-2xl border px-3 py-2 gap-1"
                style={{
                  width: 150, minHeight: 44,
                  borderColor: active ? C.primary : C.border,
                  backgroundColor: active ? `${C.primary}14` : C.card,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text style={{ fontSize: 20 }}>{p.ic}</Text>
                  <ProgressRing done={phaseProgress[i]?.done ?? 0} total={phaseProgress[i]?.total ?? 0} color={C.primary} />
                </View>
                <Text numberOfLines={2} className="text-xs font-bold text-foreground" style={{ lineHeight: 17 }}>{p.t}</Text>
                <Text numberOfLines={1} className="text-[11px] text-muted-foreground">⏲ {p.time}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* d) PHASE CARDS */}
      <View className="gap-3" onLayout={(e) => { phasesY.current = e.nativeEvent.layout.y; }}>
        {explain.phases.map((p, i) => {
          const open = openSet.has(i);
          const prog = phaseProgress[i] ?? { done: 0, total: 0 };
          const booklet = phaseSteps(p, steps);
          return (
            <View
              key={`phase-${i}`}
              onLayout={(e) => { cardY.current[i] = e.nativeEvent.layout.y; }}
              className="bg-card border rounded-2xl overflow-hidden"
              style={{ borderCurve: 'continuous', elevation: 1, borderColor: i === activePhase ? C.primary : C.border }}
            >
              <Pressable
                onPress={() => togglePhase(i)}
                accessibilityRole="button"
                accessibilityLabel={`${p.t}, ${prog.done}/${prog.total} पूरे`}
                className="flex-row items-center gap-3 px-4 active:opacity-80"
                style={{ minHeight: 56, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 22 }}>{p.ic}</Text>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold text-foreground" style={{ lineHeight: 22 }}>{p.t}</Text>
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <View className="rounded-full bg-muted px-2.5 py-1"><Text textBreakStrategy="simple" className="text-[11px] text-muted-foreground">⏲ {p.time}</Text></View>
                    <Text className="text-[11px] font-semibold" style={{ color: prog.done === prog.total && prog.total > 0 ? GREEN : C.mutedForeground }}>
                      {prog.done}/{prog.total} पूरे
                    </Text>
                  </View>
                </View>
                {open ? <ChevronUp size={18} color={C.mutedForeground} /> : <ChevronDown size={18} color={C.mutedForeground} />}
              </Pressable>

              {open && (
                <View className="px-4 pb-4 gap-3">
                  {p.goal ? (
                    <View className="gap-0.5">
                      <Text className="text-xs font-semibold text-muted-foreground">लक्ष्य</Text>
                      <Text className="text-[16px] font-bold text-foreground" style={{ lineHeight: 25 }}>{p.goal}</Text>
                    </View>
                  ) : null}

                  {p.how.length > 0 && (
                    <View className="gap-1.5">
                      <Text className="text-xs font-semibold text-muted-foreground">कैसे करें</Text>
                      {p.how.map((h, k) => (
                        <View key={k} className="flex-row gap-2">
                          <View className="mt-1.5"><Check size={14} color={GREEN} /></View>
                          <Body className="flex-1">{h}</Body>
                        </View>
                      ))}
                    </View>
                  )}

                  {p.why ? (
                    <Tint color={BLUE}>
                      <Text className="text-xs font-bold" style={{ color: BLUE }}>क्यों</Text>
                      <Body>{p.why}</Body>
                    </Tint>
                  ) : null}

                  {p.err.length > 0 && (
                    <Tint color={RED}>
                      <Text className="text-xs font-bold" style={{ color: RED }}>⚠ इन गलतियों से बचें</Text>
                      {p.err.map((e, k) => <Body key={k}>• {e}</Body>)}
                    </Tint>
                  )}

                  {p.tip ? (
                    <View className="rounded-xl p-3 gap-1" style={{ backgroundColor: `${AMBER}1A` }}>
                      <Text className="text-xs font-bold" style={{ color: AMBER }}>💡 प्रो-टिप</Text>
                      <Body>{p.tip}</Body>
                    </View>
                  ) : null}

                  {booklet.length > 0 && (
                    <View className="border-t border-border pt-2">
                      <Pressable
                        onPress={() => toggleBooklet(i)}
                        accessibilityRole="button"
                        className="flex-row items-center justify-between active:opacity-70"
                        style={{ minHeight: 44 }}
                      >
                        <Text className="text-sm font-semibold text-foreground">📖 पुस्तिका के निर्देश ({booklet.length})</Text>
                        {bookletOpen.has(i) ? <ChevronUp size={16} color={C.mutedForeground} /> : <ChevronDown size={16} color={C.mutedForeground} />}
                      </Pressable>
                      {bookletOpen.has(i) && (
                        <View className="gap-2 pt-1">
                          {booklet.map(({ n, step }) => {
                            const done = !!checked[step.id]?.done;
                            const note = explain.anno[String(n)];
                            return (
                              <Pressable
                                key={step.id}
                                onPress={() => toggleStep(step)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: done }}
                                accessibilityLabel={step.t}
                                className="flex-row gap-2.5 active:opacity-80"
                              >
                                <View className="pt-1">
                                  {done ? <CheckSquare size={20} color={GREEN} /> : <Square size={20} color={C.mutedForeground} />}
                                </View>
                                <View
                                  className="flex-1 gap-1 pl-2.5 py-1"
                                  style={{ borderLeftWidth: 3, borderLeftColor: step.dont === 1 ? RED : C.border }}
                                >
                                  <View className="flex-row items-center gap-1.5 flex-wrap">
                                    <Text className="text-[10px] font-semibold text-muted-foreground">पुस्तिका · {n}</Text>
                                    {step.must === 1 && (
                                      <View className="rounded px-1.5" style={{ backgroundColor: `${GREEN}22` }}>
                                        <Text className="text-[10px] font-bold" style={{ color: GREEN }}>✱ ज़रूरी</Text>
                                      </View>
                                    )}
                                    {step.dont === 1 && <Text className="text-[11px] font-bold" style={{ color: RED }}>✗</Text>}
                                  </View>
                                  <Text
                                    className="text-[15px] text-muted-foreground italic"
                                    style={{ lineHeight: 23, textDecorationLine: done ? 'line-through' : 'none', color: step.dont === 1 ? RED : undefined }}
                                  >
                                    {step.t}
                                  </Text>
                                  {note ? (
                                    <Text className="text-[13px] text-foreground" style={{ lineHeight: 20 }}>
                                      {note.startsWith('⚠') ? note : `ℹ ${note}`}
                                    </Text>
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* e) LAW UPDATES */}
      {explain.upd.length > 0 && (
        <Card>
          <SectionTitle>🆕 नया कानून अपडेट</SectionTitle>
          <Text className="text-xs text-muted-foreground" style={{ lineHeight: 18 }}>
            पुस्तिका पुराने कानून (IPC/CrPC/IEA) पर आधारित है; नीचे नई संहिता के अनुसार
          </Text>
          {explain.upd.map((u, k) => (
            <View key={k} className="flex-row items-start gap-2 py-2 border-t border-border/60">
              <View style={{ width: 92 }}>
                {u.old === 'नया' ? (
                  <View className="self-start rounded px-1.5 py-0.5" style={{ backgroundColor: `${GREEN}22` }}>
                    <Text className="text-[11px] font-bold" style={{ color: GREEN }}>NEW</Text>
                  </View>
                ) : (
                  <Text className="text-xs text-muted-foreground line-through">{u.old}</Text>
                )}
              </View>
              <Pressable
                onPress={() => onLawPress(u.new)}
                accessibilityRole="link"
                accessibilityLabel={`${u.new} खोलें`}
                className="rounded-full px-2.5 active:opacity-70 justify-center"
                style={{ backgroundColor: `${C.primary}1A`, minHeight: 32 }}
              >
                <Text className="text-xs font-bold" style={{ color: C.primary }}>→ {u.new}</Text>
              </Pressable>
              <Text className="flex-1 text-[13px] text-foreground" style={{ lineHeight: 20 }}>{u.note}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* f) STORY */}
      {explain.story?.b ? (
        <Card>
          <View className="flex-row items-center gap-2">
            <Text style={{ fontSize: 24 }}>📖</Text>
            <Text className="text-base font-bold text-foreground italic">{explain.story.t || 'एक छोटी मिसाल'}</Text>
          </View>
          <Body>{explain.story.b}</Body>
        </Card>
      ) : null}

      {/* g) MISTAKES */}
      {explain.mist.length > 0 && (
        <View className="gap-2">
          <SectionTitle>⚖ कोर्ट में ये गलतियाँ भारी पड़ती हैं</SectionTitle>
          {explain.mist.map((m, k) => (
            <View key={k} className="bg-card border border-border rounded-2xl p-3 gap-1.5" style={{ borderCurve: 'continuous' }}>
              <Text className="text-[15px] font-semibold" style={{ color: RED, lineHeight: 22 }}>✗ {m.m}</Text>
              <View className="flex-row items-start gap-1.5">
                <View className="mt-1"><ArrowRight size={14} color={C.mutedForeground} /></View>
                <Text className="flex-1 text-[14px] text-muted-foreground" style={{ lineHeight: 21 }}>{m.r}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* h) SELF-TEST */}
      {explain.qa.length > 0 && (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <SectionTitle>🧠 खुद को परखें</SectionTitle>
            <Text className="text-xs font-semibold" style={{ color: GREEN }}>{known.size}/{explain.qa.length} याद</Text>
          </View>
          {explain.qa.map((qa, k) => {
            const isFlipped = flipped.has(k);
            return (
              <View key={k} className="bg-card border rounded-2xl p-4 gap-2" style={{ borderCurve: 'continuous', borderColor: known.has(k) ? `${GREEN}88` : C.border }}>
                <Pressable
                  onPress={() => setFlipped((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                  accessibilityRole="button"
                  accessibilityLabel={isFlipped ? 'उत्तर छिपाएँ' : 'उत्तर देखें'}
                  className="gap-2 active:opacity-80"
                >
                  <Text className="text-[15px] font-semibold text-foreground" style={{ lineHeight: 23 }}>❓ {qa.q}</Text>
                  {isFlipped ? (
                    <Body>{qa.a}</Body>
                  ) : (
                    <Text className="text-xs text-muted-foreground">उत्तर देखने के लिए टैप करें</Text>
                  )}
                </Pressable>
                {isFlipped && (
                  <View className="flex-row gap-2 pt-1">
                    <Pressable onPress={() => markQA(k, true)} className="flex-1 rounded-xl items-center justify-center active:opacity-80" style={{ minHeight: 40, backgroundColor: `${GREEN}1F` }}>
                      <Text className="text-sm font-semibold" style={{ color: GREEN }}>याद था</Text>
                    </Pressable>
                    <Pressable onPress={() => markQA(k, false)} className="flex-1 rounded-xl items-center justify-center border border-border active:opacity-80" style={{ minHeight: 40 }}>
                      <Text className="text-sm font-semibold text-foreground">दोबारा देखूँगा</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* i) FOOTER */}
      <Text className="text-xs text-muted-foreground text-center px-2" style={{ lineHeight: 18 }}>
        समझाने वाला हिस्सा सहायक व्याख्या है, आदेश नहीं; अंतिम निर्णय हेतु मूल आदेश/कानून देखें
      </Text>

      {/* case picker */}
      <Modal visible={casePickerOpen} transparent animationType="fade" onRequestClose={() => setCasePickerOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ paddingBottom: NAV_BAR_INSET, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setCasePickerOpen(false)}>
          <View className="bg-card rounded-t-3xl px-4 pt-4 pb-8" style={{ maxHeight: '70%' }}>
            <Text className="text-base font-bold text-foreground text-center mb-3">केस चुनें</Text>
            <ScrollView>
              {[{ id: null as string | null, label: 'बिना केस (सामान्य)' }, ...cases.map((c) => ({ id: c.id as string | null, label: `FIR ${c.fir_number} (${crimeTypeLabel(c.crime_type)})` }))].map((o) => (
                <Pressable
                  key={o.id ?? 'none'}
                  onPress={() => { onCaseChange(o.id); setCasePickerOpen(false); }}
                  className="flex-row items-center justify-between py-3.5 border-b border-border active:opacity-70"
                >
                  <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>{o.label}</Text>
                  {o.id === selectedCaseId && <Check size={16} color={C.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
});
