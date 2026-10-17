import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  FileText,
  Search,
  Scale,
  AlertOctagon,
  ShieldAlert,
  HelpCircle,
  BookOpen,
  Sparkles,
} from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { THEME } from '@/lib/theme';
import { type DetailedExplainEntry } from '@/lib/law/detailedAnalysis';

interface DetailedAnalysisCardProps {
  entry: DetailedExplainEntry;
  isHi?: boolean;
}

export function DetailedAnalysisCard({ entry, isHi = true }: DetailedAnalysisCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const C = THEME[isDark ? 'dark' : 'light'];

  // Overall card collapse state (open by default)
  const [isCardExpanded, setIsCardExpanded] = useState(true);

  // Sub-accordions state (first two open by default: 'sar_bindu' and 'tatva')
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(
    () => new Set(['sar_bindu', 'tatva'])
  );

  // Checklist session-only state
  const [checkedElements, setCheckedElements] = useState<Set<number>>(new Set());

  // Examples filter state: 'all' | 'o' | 'h'
  const [exampleFilter, setExampleFilter] = useState<'all' | 'o' | 'h'>('all');

  const toggleAccordion = useCallback((key: string) => {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleElement = useCallback((index: number) => {
    setCheckedElements((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const hasSarBindu = Boolean(entry.s) || (Array.isArray(entry.k) && entry.k.length > 0);
  const hasElements = Array.isArray(entry.el) && entry.el.length > 0;
  const hasFIR = Array.isArray(entry.fir) && entry.fir.length > 0;
  const hasEvidence = Array.isArray(entry.ev) && entry.ev.length > 0;
  const hasDifferences = Array.isArray(entry.df) && entry.df.length > 0;
  const hasMistakes = Array.isArray(entry.mist) && entry.mist.length > 0;
  const hasPoliceNote = Boolean(entry.p);
  const hasQuestions = Array.isArray(entry.q) && entry.q.length > 0;
  const hasExamples = Array.isArray(entry.ex) && entry.ex.length > 0;

  const filteredExamples = (entry.ex || []).filter((item) => {
    if (exampleFilter === 'all') return true;
    return item.t === exampleFilter;
  });

  const oCount = (entry.ex || []).filter((e) => e.t === 'o').length;
  const hCount = (entry.ex || []).filter((e) => e.t === 'h').length;

  return (
    <View
      className="p-5 bg-card border border-border rounded-2xl shadow-sm shadow-black/5 gap-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      {/* ── Card Header: Title + Badge + Collapse Chevron ── */}
      <Pressable
        onPress={() => setIsCardExpanded((prev) => !prev)}
        className="flex-row items-center justify-between active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="विस्तृत विश्लेषण कार्ड"
      >
        <View className="flex-row items-center gap-2 flex-1 min-w-0 pr-2">
          <Sparkles size={18} color={C.primary} />
          <Text className="text-[15px] font-bold text-foreground tracking-tight leading-5">
            {isHi ? 'विस्तृत विश्लेषण' : 'Detailed Analysis'}
          </Text>
          <View
            className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-[10px] font-bold text-primary">
              {isHi ? 'सहायक व्याख्या — आधिकारिक नहीं' : 'Advisory Guide — Non-official'}
            </Text>
          </View>
        </View>
        {isCardExpanded ? (
          <ChevronUp size={20} color={C.mutedForeground} />
        ) : (
          <ChevronDown size={20} color={C.mutedForeground} />
        )}
      </Pressable>

      {isCardExpanded && (
        <View className="gap-3 pt-1">
          {/* ── 1. सार (s) + मुख्य बिंदु (k) ── */}
          {hasSarBindu && (
            <AccordionSection
              title={isHi ? 'सार व मुख्य बिंदु' : 'Summary & Key Points'}
              icon={<BookOpen size={16} color={C.primary} />}
              isOpen={openAccordions.has('sar_bindu')}
              onToggle={() => toggleAccordion('sar_bindu')}
              C={C}
            >
              <View className="gap-2.5 pt-1">
                {Boolean(entry.s) && (
                  <Text className="text-sm font-bold text-foreground leading-6">
                    {entry.s}
                  </Text>
                )}
                {Array.isArray(entry.k) && entry.k.length > 0 && (
                  <View className="gap-2 pl-0.5 pt-1">
                    {entry.k.map((pt, idx) => (
                      <View key={idx} className="flex-row items-start gap-2">
                        <Text className="text-primary font-bold text-base leading-5">•</Text>
                        <Text className="text-sm text-foreground/90 leading-5 flex-1">
                          {pt}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </AccordionSection>
          )}

          {/* ── 2. आवश्यक तत्व (el) as a Checklist ── */}
          {hasElements && (
            <AccordionSection
              title={
                isHi
                  ? `आवश्यक तत्व (${checkedElements.size}/${entry.el?.length || 0})`
                  : `Essential Elements (${checkedElements.size}/${entry.el?.length || 0})`
              }
              icon={<CheckSquare size={16} color={C.primary} />}
              isOpen={openAccordions.has('tatva')}
              onToggle={() => toggleAccordion('tatva')}
              badge={
                checkedElements.size === (entry.el?.length || 0) && (entry.el?.length || 0) > 0
                  ? (isHi ? 'सभी पूर्ण ✓' : 'All Complete ✓')
                  : undefined
              }
              badgeColor="#059669"
              C={C}
            >
              <View className="gap-2 pt-1">
                <Text className="text-xs text-muted-foreground mb-1">
                  {isHi
                    ? 'अपराध बनने हेतु सभी तत्वों की उपस्थिति जाँचें (सत्र जाँच):'
                    : 'Check presence of all ingredients for this offence:'}
                </Text>
                {entry.el?.map((elem, idx) => {
                  const isChecked = checkedElements.has(idx);
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => toggleElement(idx)}
                      className="flex-row items-start gap-2.5 p-2.5 rounded-xl border border-border bg-background/60 active:opacity-70"
                      style={{ borderCurve: 'continuous', minHeight: 44 }}
                    >
                      <View className="pt-0.5">
                        {isChecked ? (
                          <CheckSquare size={18} color="#059669" />
                        ) : (
                          <Square size={18} color={C.mutedForeground} />
                        )}
                      </View>
                      <Text
                        className={`text-xs leading-5 flex-1 ${
                          isChecked ? 'text-foreground font-semibold line-through opacity-80' : 'text-foreground/90 font-medium'
                        }`}
                      >
                        {elem}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </AccordionSection>
          )}

          {/* ── 3. FIR में क्या लिखें (fir) ── */}
          {hasFIR && (
            <AccordionSection
              title={isHi ? 'FIR में क्या लिखें' : 'What to Write in FIR'}
              icon={<FileText size={16} color={C.primary} />}
              isOpen={openAccordions.has('fir')}
              onToggle={() => toggleAccordion('fir')}
              C={C}
            >
              <View className="gap-2 pt-1">
                {entry.fir?.map((item, idx) => (
                  <View key={idx} className="flex-row items-start gap-2 p-2 rounded-lg bg-background/40">
                    <Text className="text-xs font-bold text-primary w-5">{idx + 1}.</Text>
                    <Text className="text-xs text-foreground/90 leading-5 flex-1">{item}</Text>
                  </View>
                ))}
              </View>
            </AccordionSection>
          )}

          {/* ── 4. साक्ष्य (ev) ── */}
          {hasEvidence && (
            <AccordionSection
              title={isHi ? 'साक्ष्य (जाँच में क्या जुटाएँ)' : 'Evidence to Collect'}
              icon={<Search size={16} color={C.primary} />}
              isOpen={openAccordions.has('sakshya')}
              onToggle={() => toggleAccordion('sakshya')}
              C={C}
            >
              <View className="gap-2 pt-1">
                {entry.ev?.map((item, idx) => (
                  <View key={idx} className="flex-row items-start gap-2">
                    <Text className="text-primary font-bold text-base leading-4">•</Text>
                    <Text className="text-xs text-foreground/90 leading-5 flex-1">{item}</Text>
                  </View>
                ))}
              </View>
            </AccordionSection>
          )}

          {/* ── 5. मिलते-जुलते अपराधों से फ़र्क़ (df) ── */}
          {hasDifferences && (
            <AccordionSection
              title={isHi ? 'मिलते-जुलते अपराधों से फ़र्क़' : 'Differences from Nearby Sections'}
              icon={<Scale size={16} color={C.primary} />}
              isOpen={openAccordions.has('fark')}
              onToggle={() => toggleAccordion('fark')}
              C={C}
            >
              <View className="gap-2 pt-1">
                {entry.df?.map((item, idx) => (
                  <View key={idx} className="p-2.5 rounded-xl border border-border/80 bg-background/50 gap-1" style={{ borderCurve: 'continuous' }}>
                    <Text className="text-xs text-foreground/90 leading-5">{item}</Text>
                  </View>
                ))}
              </View>
            </AccordionSection>
          )}

          {/* ── 6. आम गलतियाँ (mist) ── */}
          {hasMistakes && (
            <AccordionSection
              title={isHi ? 'आम गलतियाँ (बचें)' : 'Common Mistakes'}
              icon={<AlertOctagon size={16} color="#DC2626" />}
              isOpen={openAccordions.has('galtiyan')}
              onToggle={() => toggleAccordion('galtiyan')}
              C={C}
            >
              <View className="gap-2 pt-1">
                {entry.mist?.map((item, idx) => (
                  <View key={idx} className="flex-row items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <Text className="text-destructive font-bold text-xs">⚠️</Text>
                    <Text className="text-xs text-foreground/90 leading-5 flex-1">{item}</Text>
                  </View>
                ))}
              </View>
            </AccordionSection>
          )}

          {/* ── 7. पुलिस नोट (p, highlighted) ── */}
          {hasPoliceNote && (
            <AccordionSection
              title={isHi ? 'पुलिस नोट (व्यावहारिक निर्देश)' : 'Police Practical Note'}
              icon={<ShieldAlert size={16} color="#D97706" />}
              isOpen={openAccordions.has('police_note')}
              onToggle={() => toggleAccordion('police_note')}
              badge={isHi ? 'विशेष' : 'Important'}
              badgeColor="#D97706"
              C={C}
            >
              <View
                className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 gap-1.5"
                style={{ borderCurve: 'continuous' }}
              >
                <Text className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  {isHi ? 'जाँच अधिकारी ध्यान दें' : 'Investigating Officer Note'}
                </Text>
                <Text className="text-xs font-medium text-foreground leading-5">
                  {entry.p}
                </Text>
              </View>
            </AccordionSection>
          )}

          {/* ── 8. सवाल जो पूछें (q: [{ q, y, n }]) ── */}
          {hasQuestions && (
            <AccordionSection
              title={isHi ? 'सवाल जो पूछें (पूछताछ)' : 'Questions to Ask'}
              icon={<HelpCircle size={16} color={C.primary} />}
              isOpen={openAccordions.has('sawal')}
              onToggle={() => toggleAccordion('sawal')}
              C={C}
            >
              <View className="gap-3 pt-1">
                {entry.q?.map((item, idx) => (
                  <View
                    key={idx}
                    className="p-3 rounded-xl border border-border bg-background/60 gap-2"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-xs font-bold text-foreground leading-5">
                      {idx + 1}. {item.q}
                    </Text>
                    <View className="gap-1.5 pl-2 border-l-2 border-border/70">
                      <View className="flex-row items-start gap-1.5">
                        <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          हाँ →
                        </Text>
                        <Text className="text-[11px] text-foreground/80 leading-4 flex-1">
                          {item.y}
                        </Text>
                      </View>
                      <View className="flex-row items-start gap-1.5">
                        <Text className="text-[11px] font-bold text-destructive">
                          नहीं →
                        </Text>
                        <Text className="text-[11px] text-foreground/80 leading-4 flex-1">
                          {item.n}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </AccordionSection>
          )}

          {/* ── 9. उदाहरण (ex: [{ t, q, a }]) with Filter Chips ── */}
          {hasExamples && (
            <AccordionSection
              title={isHi ? `उदाहरण (${entry.ex?.length || 0})` : `Examples (${entry.ex?.length || 0})`}
              icon={<BookOpen size={16} color={C.primary} />}
              isOpen={openAccordions.has('udaharan')}
              onToggle={() => toggleAccordion('udaharan')}
              C={C}
            >
              <View className="gap-3 pt-1">
                {/* Filter Chips: सभी / आधिकारिक दृष्टांत / सहायक उदाहरण */}
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Pressable
                    onPress={() => setExampleFilter('all')}
                    className={`px-2.5 py-1 rounded-full border active:opacity-70 ${
                      exampleFilter === 'all'
                        ? 'bg-primary border-primary'
                        : 'bg-background border-border'
                    }`}
                    style={{ borderCurve: 'continuous', minHeight: 32 }}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        exampleFilter === 'all' ? 'text-primary-foreground font-bold' : 'text-foreground'
                      }`}
                    >
                      {isHi ? `सभी (${entry.ex?.length || 0})` : `All (${entry.ex?.length || 0})`}
                    </Text>
                  </Pressable>

                  {oCount > 0 && (
                    <Pressable
                      onPress={() => setExampleFilter('o')}
                      className={`px-2.5 py-1 rounded-full border active:opacity-70 ${
                        exampleFilter === 'o'
                          ? 'bg-primary border-primary'
                          : 'bg-background border-border'
                      }`}
                      style={{ borderCurve: 'continuous', minHeight: 32 }}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          exampleFilter === 'o' ? 'text-primary-foreground font-bold' : 'text-foreground'
                        }`}
                      >
                        {isHi ? `आधिकारिक दृष्टांत (${oCount})` : `Official Illustration (${oCount})`}
                      </Text>
                    </Pressable>
                  )}

                  {hCount > 0 && (
                    <Pressable
                      onPress={() => setExampleFilter('h')}
                      className={`px-2.5 py-1 rounded-full border active:opacity-70 ${
                        exampleFilter === 'h'
                          ? 'bg-primary border-primary'
                          : 'bg-background border-border'
                      }`}
                      style={{ borderCurve: 'continuous', minHeight: 32 }}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          exampleFilter === 'h' ? 'text-primary-foreground font-bold' : 'text-foreground'
                        }`}
                      >
                        {isHi ? `सहायक उदाहरण (${hCount})` : `Helper Scenario (${hCount})`}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Filtered Examples Cards */}
                {filteredExamples.map((item, idx) => {
                  const isOfficial = item.t === 'o';
                  return (
                    <View
                      key={idx}
                      className="p-3 rounded-xl border border-border bg-background/60 gap-2"
                      style={{ borderCurve: 'continuous' }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[11px] font-bold text-muted-foreground">
                          {isHi ? `उदाहरण #${idx + 1}` : `Example #${idx + 1}`}
                        </Text>
                        <View
                          className="px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: isOfficial ? `${C.primary}15` : `${C.muted}80`,
                            borderColor: isOfficial ? `${C.primary}30` : `${C.border}`,
                            borderCurve: 'continuous',
                          }}
                        >
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: isOfficial ? C.primary : C.mutedForeground }}
                          >
                            {isOfficial
                              ? (isHi ? 'आधिकारिक दृष्टांत' : 'Official Illustration')
                              : (isHi ? 'सहायक उदाहरण' : 'Helper Scenario')}
                          </Text>
                        </View>
                      </View>

                      {/* Situation / Facts */}
                      <Text className="text-xs text-foreground/90 font-medium leading-5">
                        <Text className="font-bold text-foreground">{isHi ? 'स्थिति: ' : 'Facts: '}</Text>
                        {item.q}
                      </Text>

                      {/* Legal Analysis */}
                      <View className="p-2 rounded-lg bg-muted/40 border border-border/40">
                        <Text className="text-xs text-muted-foreground leading-5">
                          <Text className="font-bold text-foreground/80">{isHi ? 'विश्लेषण: ' : 'Analysis: '}</Text>
                          {item.a}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </AccordionSection>
          )}

          {/* Bottom Card Disclaimer */}
          <View className="pt-2 border-t border-border/40">
            <Text className="text-[11px] text-muted-foreground leading-4">
              {isHi
                ? 'यह विस्तृत विश्लेषण कानूनी अनुसंधान एवं विवेचना मार्गदर्शन हेतु है। न्यायालय में आधिकारिक राजपत्र पाठ का ही संदर्भ लें।'
                : 'This detailed analysis is for investigative guidance and research. Always rely on the official gazette text in court.'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Reusable Accordion Sub-section Component ──
interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  C: {
    primary: string;
    mutedForeground: string;
    border: string;
  };
}

function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  badge,
  badgeColor,
  children,
  C,
}: AccordionSectionProps) {
  return (
    <View className="border border-border/70 rounded-xl overflow-hidden bg-card/50" style={{ borderCurve: 'continuous' }}>
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between p-3 bg-muted/20 active:opacity-70"
        accessibilityRole="button"
        style={{ minHeight: 44 }}
      >
        <View className="flex-row items-center gap-2 flex-1 pr-2">
          {icon}
          <Text className="text-xs font-bold text-foreground leading-4">
            {title}
          </Text>
          {badge && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${badgeColor || C.primary}15`,
                borderCurve: 'continuous',
              }}
            >
              <Text className="text-[10px] font-bold" style={{ color: badgeColor || C.primary }}>
                {badge}
              </Text>
            </View>
          )}
        </View>
        {isOpen ? (
          <ChevronUp size={16} color={C.mutedForeground} />
        ) : (
          <ChevronDown size={16} color={C.mutedForeground} />
        )}
      </Pressable>
      {isOpen && <View className="p-3 border-t border-border/50">{children}</View>}
    </View>
  );
}
