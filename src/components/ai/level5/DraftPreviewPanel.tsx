/**
 * DraftPreviewPanel.tsx
 * Preview generated draft documents. Officer reviews, edits title/notes,
 * then explicitly approves before saving via existing workflow.
 *
 * SAFETY INVARIANT: Never auto-saves. isApproved stays false until
 * the officer explicitly taps "Approve & Use".
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
} from 'react-native';
import {
  FileText, AlertCircle, CheckCircle, RefreshCw, Edit3,
} from 'lucide-react-native';
import type { GeneratedDraft, L5DraftType } from '../../../ai/level5/L5Types';

// ── Draft type labels ─────────────────────────────────────────────────────────

const TYPE_LABELS: Record<L5DraftType, string> = {
  'case-diary':          'Case Diary',
  'notice':              'Notice',
  'arrest-memo':         'Arrest Memo',
  'seizure-memo':        'Seizure Memo',
  'search-memo':         'Search Memo',
  'charge-sheet-summary': 'Charge Sheet Summary',
  'court-reply':         'Court Compliance Reply',
  'prarthna-patra-reply': 'Prarthna Patra Reply',
  'investigation-notes': 'Investigation Notes',
};

// ── Available draft types (for selector) ─────────────────────────────────────

const DRAFT_TYPES: L5DraftType[] = [
  'case-diary', 'notice', 'arrest-memo', 'seizure-memo',
  'search-memo', 'charge-sheet-summary', 'court-reply',
  'prarthna-patra-reply', 'investigation-notes',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onGenerate: (type: L5DraftType) => void;
  onApprove: (draft: GeneratedDraft) => void;
  draft: GeneratedDraft | null;
  isLoading: boolean;
  errorMessage?: string;
}

export function DraftPreviewPanel({
  visible, onClose, onGenerate, onApprove,
  draft, isLoading, errorMessage,
}: Props) {
  const [showSelector, setShowSelector] = useState(!draft);

  // Switch to type selector whenever panel opens with no draft
  React.useEffect(() => {
    if (visible && !draft && !isLoading) setShowSelector(true);
  }, [visible, draft, isLoading]);

  function handleApprove() {
    if (draft) onApprove(draft);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">
              {draft ? draft.title : 'Generate Draft'}
            </Text>
            {draft && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                Confidence {draft.confidencePct}% · {draft.missingDataFields.length} placeholder(s)
              </Text>
            )}
          </View>
          <View className="flex-row gap-2">
            {draft && (
              <Pressable
                onPress={() => setShowSelector(true)}
                className="w-8 h-8 items-center justify-center active:opacity-60"
              >
                <Edit3 size={16} className="text-muted-foreground" />
              </Pressable>
            )}
            <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center active:opacity-60">
              <Text className="text-sm font-medium text-primary">Close</Text>
            </Pressable>
          </View>
        </View>

        {/* Draft type selector */}
        {(showSelector || (!draft && !isLoading)) && (
          <View className="flex-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 pt-4 mb-3">
              Select Document Type
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
              {DRAFT_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => { setShowSelector(false); onGenerate(type); }}
                  className="flex-row items-center gap-3 py-4 border-b border-border active:opacity-70"
                >
                  <FileText size={16} className="text-muted-foreground" />
                  <Text className="text-sm text-foreground flex-1">{TYPE_LABELS[type]}</Text>
                  <Text className="text-xs text-muted-foreground">→</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Loading */}
        {isLoading && (
          <View className="flex-1 items-center justify-center gap-3">
            <RefreshCw size={20} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Generating draft…</Text>
          </View>
        )}

        {/* Error */}
        {!isLoading && errorMessage && !draft && (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <AlertCircle size={32} className="text-red-500" />
            <Text className="text-base font-medium text-foreground text-center">Generation Failed</Text>
            <Text className="text-sm text-muted-foreground text-center">{errorMessage}</Text>
            <Pressable
              onPress={() => setShowSelector(true)}
              className="mt-4 px-6 py-2.5 bg-primary rounded-xl active:opacity-70"
            >
              <Text className="text-sm font-medium text-primary-foreground">Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Draft preview */}
        {!isLoading && !showSelector && draft && (
          <>
            {/* Missing fields warning */}
            {draft.missingDataFields.length > 0 && (
              <View className="mx-5 mt-3 flex-row gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-amber-600 mt-0.5" />
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-amber-700">Placeholders Require Your Input</Text>
                  <Text className="text-xs text-amber-600 mt-0.5">
                    {draft.missingDataFields.join(', ')}
                  </Text>
                </View>
              </View>
            )}

            {/* Sections */}
            <ScrollView
              className="flex-1 px-5 pt-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
            >
              {draft.sections.map((s) => (
                <View key={s.id} className="mb-5">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {s.title}
                  </Text>
                  <View className={`rounded-xl border p-4 ${s.isPlaceholder ? 'border-amber-200 bg-amber-50' : 'border-border bg-card'}`}>
                    <Text className="text-sm text-foreground leading-relaxed">{s.content}</Text>
                    {s.legalReference && (
                      <Text className="text-xs text-muted-foreground mt-2">📌 {s.legalReference}</Text>
                    )}
                    {s.isPlaceholder && (
                      <Text className="text-xs text-amber-600 mt-1">✏️ Please fill in before saving</Text>
                    )}
                  </View>
                </View>
              ))}

              {/* Legal references */}
              {draft.legalReferences.length > 0 && (
                <View className="mt-2">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Legal References</Text>
                  {draft.legalReferences.map((r, i) => (
                    <Text key={i} className="text-xs text-muted-foreground">• {r}</Text>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Approve footer */}
            <View className="px-5 py-4 border-t border-border gap-3">
              {/* Advisory */}
              <View className="flex-row items-start gap-2 bg-muted/60 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="text-muted-foreground mt-0.5" />
                <Text className="text-xs text-muted-foreground flex-1 leading-relaxed">
                  {draft.advisory}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowSelector(true)}
                  className="flex-1 py-3 rounded-xl border border-border items-center active:opacity-70"
                >
                  <Text className="text-sm font-medium text-foreground">Change Type</Text>
                </Pressable>
                <Pressable
                  onPress={handleApprove}
                  className="flex-1 py-3 rounded-xl bg-primary items-center active:opacity-70 flex-row justify-center gap-2"
                >
                  <CheckCircle size={14} className="text-primary-foreground" />
                  <Text className="text-sm font-medium text-primary-foreground">Approve & Use</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
