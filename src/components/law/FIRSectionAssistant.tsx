/**
 * FIRSectionAssistant.tsx
 * TASK L8: FIR screen section suggester and element checklist.
 * 
 * Provides:
 * 1) "धारा सुझाव" button and bottom sheet modal that pre-fills with incident facts,
 *    runs offline scoring suggester, and lets user tap "जोड़ें" to add to FIR sections.
 * 2) "तत्व जाँचें" link for each added section, opening interactive elements checklist (el)
 *    and FIR drafting guidance (fir).
 * 
 * SAFETY: Zero hallucination, strictly offline, no auto-filling.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Sparkles, CheckSquare, X, Plus, Search, Check, AlertCircle, ChevronDown, BookOpen } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import {
  suggestSections,
  rankSectionSuggestions,
  getDetailedExplain,
  type SectionSuggestion,
  type DetailedExplainEntry,
  type RankedSuggestionsResult,
} from '@/lib/law/detailedAnalysis';
import { extractRefs, getSection, parseSectionRef, type ActId } from '@/lib/law/lawLibrary';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

interface FIRSectionAssistantProps {
  section: string;
  onAddSection: (newSection: string) => void;
  incidentFacts?: string;
  isSuggesterOpen?: boolean;
  onCloseSuggester?: () => void;
}

export function FIRSectionAssistant({
  section,
  onAddSection,
  incidentFacts = '',
  isSuggesterOpen: externalIsOpen,
  onCloseSuggester: externalOnClose,
}: FIRSectionAssistantProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const C = THEME[isDark ? 'dark' : 'light'];

  // ── Suggster Modal State ─────────────────────────────────────────────────
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isSuggesterOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const handleCloseSuggester = externalOnClose || (() => setInternalIsOpen(false));

  const [queryText, setQueryText] = useState(incidentFacts.trim());

  React.useEffect(() => {
    if (isSuggesterOpen && (!queryText || queryText.trim() === '')) {
      setQueryText(incidentFacts.trim());
    }
  }, [isSuggesterOpen, incidentFacts]);

  // ── Elements Checklist Modal State ────────────────────────────────────────
  const [inspectSection, setInspectSection] = useState<{ act: ActId; n: number } | null>(null);
  const [checkedElements, setCheckedElements] = useState<Record<number, boolean>>({});

  // Parse sections currently entered in the FIR
  const parsedSections = useMemo(() => {
    if (!section || !section.trim()) return [];
    const directExtracted = extractRefs(section);
    if (directExtracted.length > 0) return directExtracted;

    // Fallback: split by comma or slash
    const tokens = section.split(/[,/;\n]+/);
    const results: Array<{ act: ActId; n: number; sub?: string }> = [];
    for (const token of tokens) {
      const ref = parseSectionRef(token.trim());
      if (ref) results.push(ref);
    }
    return results;
  }, [section]);

  // Filter parsed sections to those that have detailed explanation data
  const sectionsWithDetails = useMemo(() => {
    const list: Array<{ act: ActId; n: number; entry: DetailedExplainEntry }> = [];
    const seen = new Set<string>();
    for (const s of parsedSections) {
      const key = `${s.act}:${s.n}`;
      if (!seen.has(key)) {
        seen.add(key);
        const entry = getDetailedExplain(s.act, s.n);
        if (entry) {
          list.push({ act: s.act, n: s.n, entry });
        }
      }
    }
    return list;
  }, [parsedSections]);

  const [showMore, setShowMore] = useState(false);

  const handleOpenSuggester = () => {
    setQueryText(incidentFacts.trim());
    setShowMore(false);
    setInternalIsOpen(true);
  };

  // Run shared ranking suggester on queryText
  const suggesterResult: RankedSuggestionsResult = useMemo(() => {
    if (!queryText.trim()) {
      return {
        primary: [],
        secondary: [],
        all: [],
        isWeakQuery: false,
        weakDetailChips: [],
      };
    }
    return rankSectionSuggestions(queryText, (act, n) => getSection(act, n));
  }, [queryText]);

  const displayedSuggestions = showMore ? suggesterResult.all : suggesterResult.primary;

  const handleAdd = (item: SectionSuggestion) => {
    const label = `${item.act} ${item.n}`;
    onAddSection(label);
  };

  const toggleElementCheck = (index: number) => {
    setCheckedElements((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const inspectEntry = inspectSection
    ? getDetailedExplain(inspectSection.act, inspectSection.n)
    : null;

  return (
    <View style={{ marginTop: 4 }}>
      {/* ── Added sections interactive element chips ─────────────────────── */}
      {sectionsWithDetails.length > 0 && (
        <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {sectionsWithDetails.map((item) => (
            <Pressable
              key={`${item.act}-${item.n}`}
              onPress={() => {
                setCheckedElements({});
                setInspectSection({ act: item.act, n: item.n });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#BFDBFE',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.act} ${item.n} तत्व जाँचें`}
            >
              <CheckSquare size={13} color="#2563EB" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#93C5FD' : '#1D4ED8' }}>
                {item.act} {item.n}: तत्व जाँचें
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Suggester Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={isSuggesterOpen}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSuggester}
      >
        <View
          style={{
            paddingBottom: NAV_BAR_INSET,
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85%',
              paddingBottom: 24,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(37,99,235,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={16} color="#2563EB" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.foreground }}>
                    धारा सुझाव (Section Suggester)
                  </Text>
                  <Text style={{ fontSize: 11, color: C.mutedForeground }}>
                    सहायक सुझाव — अंतिम निर्णय जाँच अधिकारी का
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleCloseSuggester}
                style={{ padding: 6 }}
                accessibilityRole="button"
                accessibilityLabel="बंद करें"
              >
                <X size={20} color={C.mutedForeground} />
              </Pressable>
            </View>

            {/* Modal Body */}
            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground, marginBottom: 6 }}>
                घटना / संक्षिप्त तथ्य (Incident / Brief Facts):
              </Text>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 10,
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  padding: 10,
                  marginBottom: 14,
                }}
              >
                <TextInput
                  value={queryText}
                  onChangeText={setQueryText}
                  placeholder="घटना का विवरण लिखें (उदा. एक आदमी ने चाकू से हमला कर मोबाइल छीन लिया)..."
                  placeholderTextColor={C.mutedForeground}
                  multiline
                  numberOfLines={3}
                  style={{
                    fontSize: 14,
                    color: C.foreground,
                    minHeight: 64,
                    textAlignVertical: 'top',
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.foreground }}>
                  संभावित धाराएँ ({displayedSuggestions.length})
                </Text>
                <Text style={{ fontSize: 11, color: C.mutedForeground }}>
                  ऑफ़लाइन विश्लेषण
                </Text>
              </View>

              {suggesterResult.isWeakQuery || (!queryText.trim() && displayedSuggestions.length === 0) ? (
                <View
                  style={{
                    padding: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    gap: 10,
                  }}
                >
                  <Search size={22} color={C.mutedForeground} />
                  <Text style={{ fontSize: 13, color: C.mutedForeground, textAlign: 'center' }}>
                    {queryText.trim()
                      ? 'कोई स्पष्ट धारा मेल नहीं खा सकी। कृपया घटना का और विवरण लिखें।'
                      : 'घटना का विवरण दर्ज करें ताकि संबंधित धाराएँ सुझाई जा सकें।'}
                  </Text>
                  {suggesterResult.weakDetailChips.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
                      {suggesterResult.weakDetailChips.map((chip, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() => {
                            setShowMore(false);
                            setQueryText((prev) => (prev.trim() ? `${prev.trim()} ${chip}` : chip));
                          }}
                          style={{
                            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                            borderRadius: 16,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: isDark ? '#334155' : '#CBD5E1',
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={chip}
                        >
                          <Text style={{ fontSize: 12, color: C.foreground, fontWeight: '500' }}>
                            {chip}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {displayedSuggestions.map((item) => {
                    const entry = getDetailedExplain(item.act, item.n);
                    const isAlreadyAdded = parsedSections.some(
                      (p) => p.act === item.act && p.n === item.n
                    );

                    return (
                      <View
                        key={`${item.act}-${item.n}`}
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                          borderWidth: 1,
                          borderColor: isDark ? '#334155' : '#E2E8F0',
                          borderRadius: 12,
                          padding: 12,
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: C.foreground }}>
                              {item.act} {item.n} — {item.title}
                            </Text>
                            {item.relatedSection && (
                              <Text style={{ fontSize: 11, color: C.mutedForeground, fontStyle: 'italic', marginTop: 1 }}>
                                संबंधित: {item.relatedSection}
                              </Text>
                            )}
                            {(item.summary || entry?.s) && (
                              <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                                {item.summary || entry?.s}
                              </Text>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Pressable
                              onPress={() => {
                                setCheckedElements({});
                                setInspectSection({ act: item.act, n: item.n });
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: isDark ? '#334155' : '#CBD5E1',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`धारा ${item.act} ${item.n} खोलें`}
                            >
                              <BookOpen size={13} color={isDark ? '#93C5FD' : '#2563EB'} />
                              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#93C5FD' : '#2563EB' }}>
                                धारा खोलें
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => handleAdd(item)}
                              disabled={isAlreadyAdded}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: isAlreadyAdded ? (isDark ? '#334155' : '#E2E8F0') : '#2563EB',
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`धारा ${item.act} ${item.n} जोड़ें`}
                            >
                              {isAlreadyAdded ? (
                                <>
                                  <Check size={13} color={C.mutedForeground} />
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: C.mutedForeground }}>
                                    जुड़ा हुआ
                                  </Text>
                                </>
                              ) : (
                                <>
                                  <Plus size={13} color="#FFFFFF" />
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                                    जोड़ें
                                  </Text>
                                </>
                              )}
                            </Pressable>
                          </View>
                        </View>

                        {item.matchedKeywords.length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            <Text style={{ fontSize: 11, color: C.mutedForeground }}>
                              मिलान:
                            </Text>
                            {item.matchedKeywords.slice(0, 3).map((kw, kwIdx) => (
                              <View
                                key={kwIdx}
                                style={{
                                  backgroundColor: isDark ? '#1E3A8A33' : '#DBEAFE',
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '500' }}>
                                  {kw}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {!showMore && suggesterResult.secondary.length > 0 && (
                    <Pressable
                      onPress={() => setShowMore(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                        marginTop: 4,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="और सुझाव देखें"
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>
                        और सुझाव देखें ({suggesterResult.secondary.length})
                      </Text>
                      <ChevronDown size={14} color="#2563EB" />
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Elements & FIR Checklist Modal ───────────────────────────────── */}
      <Modal
        visible={inspectSection !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setInspectSection(null)}
      >
        <View
          style={{
            paddingBottom: NAV_BAR_INSET,
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85%',
              paddingBottom: 24,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.foreground }}>
                  {inspectSection ? `${inspectSection.act} ${inspectSection.n}` : ''}: आवश्यक तत्व एवं प्रारूपण
                </Text>
                <Text style={{ fontSize: 11, color: C.mutedForeground }}>
                  सहायक सामग्री — आधिकारिक नहीं (जाँच अधिकारी का विवेक आवश्यक)
                </Text>
              </View>

              <Pressable
                onPress={() => setInspectSection(null)}
                style={{ padding: 6 }}
                accessibilityRole="button"
                accessibilityLabel="बंद करें"
              >
                <X size={20} color={C.mutedForeground} />
              </Pressable>
            </View>

            {/* Checklist Body */}
            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
              {/* Ingredients (el) */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CheckSquare size={16} color="#2563EB" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>
                    आवश्यक तत्व (Ingredients Checklist)
                  </Text>
                </View>

                {inspectEntry?.el && inspectEntry.el.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    {inspectEntry.el.map((item, idx) => {
                      const isChecked = !!checkedElements[idx];
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => toggleElementCheck(idx)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: isChecked
                              ? isDark
                                ? '#064E3B'
                                : '#ECFDF5'
                              : isDark
                              ? '#1E293B'
                              : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: isChecked
                              ? isDark
                                ? '#059669'
                                : '#A7F3D0'
                              : C.border,
                          }}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              borderWidth: 1.5,
                              borderColor: isChecked ? '#10B981' : C.mutedForeground,
                              backgroundColor: isChecked ? '#10B981' : 'transparent',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 1,
                            }}
                          >
                            {isChecked && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: isChecked ? (isDark ? '#D1FAE5' : '#065F46') : C.foreground,
                              lineHeight: 18,
                            }}
                          >
                            {item}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: C.mutedForeground }}>
                    कोई आवश्यक तत्व उपलब्ध नहीं हैं।
                  </Text>
                )}
              </View>

              {/* What to write in FIR (fir) */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertCircle size={16} color="#D97706" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>
                    FIR में क्या लिखें (Drafting Guidance)
                  </Text>
                </View>

                {inspectEntry?.fir && inspectEntry.fir.length > 0 ? (
                  <View
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#FEF3C7',
                      borderWidth: 1,
                      borderColor: isDark ? '#334155' : '#FDE68A',
                      borderRadius: 10,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    {inspectEntry.fir.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <Text style={{ fontSize: 13, color: '#D97706', fontWeight: '700' }}>•</Text>
                        <Text style={{ flex: 1, fontSize: 13, color: isDark ? '#FDE68A' : '#92400E', lineHeight: 18 }}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: C.mutedForeground }}>
                    कोई प्रारूपण मार्गदर्शन उपलब्ध नहीं है।
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function FIRSuggesterButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 14,
        backgroundColor: 'rgba(37,99,235,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(37,99,235,0.2)',
      }}
      accessibilityRole="button"
      accessibilityLabel="धारा सुझाव"
    >
      <Sparkles size={12} color="#2563EB" />
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>
        धारा सुझाव
      </Text>
    </Pressable>
  );
}
