import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator } from 'react-native';
import { CheckSquare, Square, AlertCircle, RotateCcw, FileText, ChevronDown, Check } from 'lucide-react-native';
import { getById as getIndexById, type SopStep } from '../../ai/sopIndex';
import { getExplain, phaseSteps } from '../../ai/sopExplain';
import { getAllFIRs, type FIR } from '../../lib/db/firRepo';
import {
  getChecklist,
  setStepDone,
  setStepNote,
  resetChecklist,
} from '../../lib/db/sopChecklistRepo';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../ui/alert-dialog';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

interface SopChecklistTabProps {
  sopId: string;
  sopKid?: string;
  initialCaseId?: string | null;
  onCaseChange?: (caseId: string | null) => void;
}

export function SopChecklistTab({
  sopId,
  sopKid,
  initialCaseId,
  onCaseChange,
}: SopChecklistTabProps) {
  // Find SOP steps from sopIndex (by id or kid)
  const indexEntry = useMemo(() => {
    return getIndexById(sopKid || sopId);
  }, [sopId, sopKid]);

  const rawSteps = useMemo(() => indexEntry?.steps || [], [indexEntry]);

  // Cases state
  const [cases, setCases] = useState<FIR[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId ?? null);
  const [casePickerOpen, setCasePickerOpen] = useState(false);

  // Filter: only must steps
  const [onlyMust, setOnlyMust] = useState(false);

  // Checklist completion state & notes
  const [checkedMap, setCheckedMap] = useState<Record<string, { done: boolean; note: string | null }>>({});
  const [loading, setLoading] = useState(true);

  // Note dialog state
  const [activeStepForNote, setActiveStepForNote] = useState<SopStep | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load cases list
  useEffect(() => {
    (async () => {
      try {
        const firs = await getAllFIRs();
        setCases(firs);
      } catch {
        setCases([]);
      }
    })();
  }, []);

  // Sync initialCaseId when it changes from props
  useEffect(() => {
    if (initialCaseId !== undefined) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  // Load checklist items for selected case
  const loadChecklistState = useCallback(async () => {
    setLoading(true);
    try {
      const state = await getChecklist(sopId, selectedCaseId);
      setCheckedMap(state);
    } catch {
      setCheckedMap({});
    } finally {
      setLoading(false);
    }
  }, [sopId, selectedCaseId]);

  useEffect(() => {
    loadChecklistState();
  }, [loadChecklistState]);

  // Toggle step
  const handleToggleStep = async (step: SopStep) => {
    const current = checkedMap[step.id]?.done || false;
    const nextDone = !current;

    // Optimistic UI update
    setCheckedMap((prev) => ({
      ...prev,
      [step.id]: {
        done: nextDone,
        note: prev[step.id]?.note || null,
      },
    }));

    try {
      await setStepDone(sopId, selectedCaseId, step.id, nextDone);
    } catch {
      // Revert on error
      setCheckedMap((prev) => ({
        ...prev,
        [step.id]: {
          done: current,
          note: prev[step.id]?.note || null,
        },
      }));
    }
  };

  // Open note modal
  const handleOpenNoteModal = (step: SopStep) => {
    setActiveStepForNote(step);
    setEditingNoteText(checkedMap[step.id]?.note || '');
  };

  // Save note
  const handleSaveNote = async () => {
    if (!activeStepForNote) return;
    const stepId = activeStepForNote.id;
    const note = editingNoteText.trim() || null;

    setCheckedMap((prev) => ({
      ...prev,
      [stepId]: {
        done: prev[stepId]?.done || false,
        note,
      },
    }));

    try {
      await setStepNote(sopId, selectedCaseId, stepId, note);
    } catch {
      // Revert
      await loadChecklistState();
    } finally {
      setActiveStepForNote(null);
    }
  };

  // Reset checklist
  const handleConfirmReset = async () => {
    setShowResetConfirm(false);
    setCheckedMap({});
    try {
      await resetChecklist(sopId, selectedCaseId);
    } catch {
      await loadChecklistState();
    }
  };

  // Selected case display name
  const selectedCaseObj = cases.find((c) => c.id === selectedCaseId);
  const selectedCaseLabel = selectedCaseObj
    ? `FIR ${selectedCaseObj.fir_number} (${selectedCaseObj.crime_type})`
    : 'बिना केस (सामान्य)';

  // Visible steps after toggle
  const visibleSteps = useMemo(() => {
    if (!onlyMust) return rawSteps;
    return rawSteps.filter((s: SopStep) => s.must === 1);
  }, [rawSteps, onlyMust]);

  // Progress metrics
  const totalCount = rawSteps.length;
  const doneCount = rawSteps.filter((s: SopStep) => checkedMap[s.id]?.done).length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Explainer (L32): when present, group by its phases (in order) and show
  // the teacher's note (anno) under the matching booklet step.
  const explain = useMemo(() => getExplain(sopKid || sopId), [sopId, sopKid]);
  const stepNumber = useMemo(() => {
    const m = new Map<string, number>();
    rawSteps.forEach((st: SopStep, i: number) => m.set(st.id, i + 1));
    return m;
  }, [rawSteps]);

  // Group steps by explainer phase, else by group heading (step.g)
  const groupedSteps = useMemo(() => {
    if (explain && explain.phases.length > 0) {
      const visible = new Set(visibleSteps.map((st: SopStep) => st.id));
      return explain.phases
        .map((ph) => [
          `${ph.ic} ${ph.t}`,
          phaseSteps(ph, rawSteps).map(({ step }) => step).filter((st) => visible.has(st.id)),
        ] as [string, SopStep[]])
        .filter(([, list]) => list.length > 0);
    }
    const map = new Map<string, SopStep[]>();
    for (const st of visibleSteps) {
      const g = st.g || 'जाँच चरण';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(st);
    }
    return Array.from(map.entries());
  }, [visibleSteps, explain, rawSteps]);

  return (
    <View className="gap-4 pb-8">
      {/* ── Case Selector & Reset Button ── */}
      <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            केस चुनें
          </Text>
          <Pressable
            onPress={() => setShowResetConfirm(true)}
            className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 active:opacity-70"
          >
            <RotateCcw size={12} className="text-destructive" />
            <Text className="text-xs font-semibold text-destructive">रीसेट</Text>
          </Pressable>
        </View>

        {/* Dropdown button */}
        <Pressable
          onPress={() => setCasePickerOpen(true)}
          className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-muted/20 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-foreground flex-1 pr-2" numberOfLines={1}>
            📂 {selectedCaseLabel}
          </Text>
          <ChevronDown size={16} className="text-muted-foreground" />
        </Pressable>

        {/* ── Progress Bar ── */}
        <View className="gap-1.5 pt-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-muted-foreground">प्रगति</Text>
            <Text className="text-xs font-bold text-primary">
              {doneCount} / {totalCount} पूरे ({progressPercent}%)
            </Text>
          </View>
          <View className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>

        {/* ── Toggle: सिर्फ ✱ ज़रूरी ── */}
        <View className="pt-2 border-t border-border/60 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-foreground">
            सिर्फ ✱ ज़रूरी चरण दिखाएँ
          </Text>
          <Pressable
            onPress={() => setOnlyMust(!onlyMust)}
            className={`px-3 py-1 rounded-full border ${
              onlyMust
                ? 'bg-primary border-primary'
                : 'bg-muted/40 border-border'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                onlyMust ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {onlyMust ? '✓ सक्रिय' : 'सभी'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Steps List Grouped by step.g ── */}
      {loading ? (
        <View className="p-8 items-center justify-center">
          <ActivityIndicator size="small" color="#0F766E" />
          <Text className="text-xs text-muted-foreground mt-2">चेकलिस्ट लोड हो रही है…</Text>
        </View>
      ) : (
        <View className="gap-4">
          {groupedSteps.map(([groupName, stepsInGroup]) => (
            <View
              key={`grp-${groupName}`}
              className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
            >
              <Text className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-2">
                📋 {groupName}
              </Text>

              <View className="gap-2.5">
                {stepsInGroup.map((step) => {
                  const state = checkedMap[step.id] || { done: false, note: null };
                  const isDone = state.done;
                  const isMust = step.must === 1;
                  const isDont = step.dont === 1;

                  return (
                    <Pressable
                      key={step.id}
                      onPress={() => handleToggleStep(step)}
                      onLongPress={() => handleOpenNoteModal(step)}
                      className={`p-3 rounded-xl border ${
                        isDone
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : isDont
                          ? 'bg-destructive/10 border-destructive/30'
                          : 'bg-muted/15 border-border/60'
                      } active:opacity-75`}
                    >
                      <View className="flex-row items-start gap-2.5">
                        {/* Checkbox Icon */}
                        <View className="mt-0.5">
                          {isDone ? (
                            <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square size={18} className="text-muted-foreground opacity-60" />
                          )}
                        </View>

                        {/* Step Text & Badges */}
                        <View className="flex-1 gap-1">
                          <View className="flex-row flex-wrap items-center gap-1.5">
                            {isMust ? (
                              <View className="bg-emerald-600/15 border border-emerald-600/30 px-1.5 py-0.5 rounded">
                                <Text className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  ✱ ज़रूरी
                                </Text>
                              </View>
                            ) : null}
                            {isDont ? (
                              <View className="bg-destructive/20 border border-destructive/30 px-1.5 py-0.5 rounded">
                                <Text className="text-[10px] font-bold text-destructive">
                                  ✗ ध्यान
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Text
                            className={`text-sm leading-5 ${
                              isDone
                                ? 'text-emerald-950 dark:text-emerald-100 line-through opacity-85'
                                : isDont
                                ? 'text-destructive font-medium'
                                : 'text-foreground'
                            }`}
                          >
                            {isDont ? `ध्यान: ${step.t}` : step.t}
                          </Text>

                          {/* Teacher note from the explainer (L32) */}
                          {(() => {
                            const n = stepNumber.get(step.id);
                            const anno = n && explain ? explain.anno[String(n)] : undefined;
                            return anno ? (
                              <Text className="text-xs text-foreground/80 leading-4">
                                {anno.startsWith('⚠') ? anno : `ℹ ${anno}`}
                              </Text>
                            ) : null;
                          })()}

                          {/* Existing Note */}
                          {state.note ? (
                            <View className="mt-1.5 p-2 rounded-lg bg-background/80 border border-border/80 flex-row items-start gap-1.5">
                              <Text className="text-xs">📝</Text>
                              <Text className="text-xs text-foreground/80 flex-1 leading-4">
                                {state.note}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Add / Edit Note Icon Button */}
                        <Pressable
                          onPress={() => handleOpenNoteModal(step)}
                          hitSlop={8}
                          className="p-1 rounded active:opacity-60"
                        >
                          <FileText
                            size={15}
                            className={state.note ? 'text-primary' : 'text-muted-foreground opacity-40'}
                          />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Case Picker Modal ── */}
      <Modal
        visible={casePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCasePickerOpen(false)}
      >
        <Pressable style={{ paddingBottom: NAV_BAR_INSET }}
          onPress={() => setCasePickerOpen(false)}
          className="flex-1 bg-black/50 justify-center px-4"
        >
          <View className="bg-card border border-border rounded-2xl p-4 max-h-[80%] gap-3 shadow-xl">
            <Text className="text-base font-bold text-foreground">
              केस का चयन करें
            </Text>
            <Text className="text-xs text-muted-foreground -mt-1">
              चेकलिस्ट की स्थिति चुने गए केस के अनुसार सुरक्षित रहेगी
            </Text>

            <ScrollView className="max-h-80 gap-1.5">
              {/* Option: बिना केस (सामान्य) */}
              <Pressable
                onPress={() => {
                  setSelectedCaseId(null);
                  onCaseChange?.(null);
                  setCasePickerOpen(false);
                }}
                className={`p-3 rounded-xl border flex-row items-center justify-between ${
                  selectedCaseId === null
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/15 border-border'
                }`}
              >
                <Text className="text-sm font-semibold text-foreground">
                  बिना केस (सामान्य)
                </Text>
                {selectedCaseId === null && <Check size={16} className="text-primary" />}
              </Pressable>

              {/* FIR Cases */}
              {cases.map((c) => {
                const isSel = selectedCaseId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setSelectedCaseId(c.id);
                      onCaseChange?.(c.id);
                      setCasePickerOpen(false);
                    }}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${
                      isSel
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted/15 border-border'
                    }`}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-sm font-semibold text-foreground">
                        FIR {c.fir_number}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {c.crime_type} • {c.complainant_name || 'अज्ञात वादी'}
                      </Text>
                    </View>
                    {isSel && <Check size={16} className="text-primary" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── Edit Note Modal ── */}
      <Modal
        visible={activeStepForNote !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveStepForNote(null)}
      >
        <Pressable style={{ paddingBottom: NAV_BAR_INSET }}
          onPress={() => setActiveStepForNote(null)}
          className="flex-1 bg-black/50 justify-center px-4"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-xl"
          >
            <Text className="text-base font-bold text-foreground">
              चरण नोट जोड़ें / संपादित करें
            </Text>
            {activeStepForNote ? (
              <Text className="text-xs text-muted-foreground leading-4" numberOfLines={2}>
                {activeStepForNote.t}
              </Text>
            ) : null}

            <TextInput
              value={editingNoteText}
              onChangeText={setEditingNoteText}
              placeholder="इस चरण के संबंध में कोई विशेष टिप्पणी या जाँच स्थिति…"
              placeholderTextColor="#9CA3AF"
              multiline textAlignVertical="top"
              numberOfLines={3}
              className="p-3 rounded-xl border border-border bg-background text-sm text-foreground min-h-[80px]"
            />

            <View className="flex-row gap-2 justify-end pt-2">
              <Pressable
                onPress={() => setActiveStepForNote(null)}
                className="px-4 py-2 rounded-xl bg-muted active:opacity-70"
              >
                <Text className="text-sm font-semibold text-muted-foreground">रद्द करें</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveNote}
                className="px-4 py-2 rounded-xl bg-primary active:opacity-70"
              >
                <Text className="text-sm font-semibold text-primary-foreground">सहेजें</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Reset Confirmation Dialog ── */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>चेकलिस्ट रीसेट करें?</AlertDialogTitle>
            <AlertDialogDescription>
              चुने गए केस ({selectedCaseLabel}) के लिए सभी टिक और नोट साफ़ हो जाएंगे। क्या आप आगे बढ़ना चाहते हैं?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowResetConfirm(false)}>
              रद्द करें
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleConfirmReset}>
              हाँ, रीसेट करें
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
