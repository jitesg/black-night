/**
 * NLSearchPanel.tsx
 * Natural Language Query interface. Officer types a query in plain English
 * and results are displayed with FIR-level relevance notes.
 *
 * Minimal design: whitespace-led, no decorative elements.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
} from 'react-native';
import { Search, RefreshCw, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { NLQResult } from '../../../ai/level5/L5Types';

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Show FIRs with pending medical reports',
  'Cases nearing charge sheet deadline',
  'FIRs without recent case diary updates',
  'All NDPS investigations',
  'FIRs with default bail risk',
  'Cases with pending FSL reports',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onQuery: (query: string) => void;
  result: NLQResult | null;
  isLoading: boolean;
}

export function NLSearchPanel({ visible, onClose, onQuery, result, isLoading }: Props) {
  const [query, setQuery] = useState('');
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';

  function handleSubmit() {
    const q = query.trim();
    if (q.length > 0) onQuery(q);
  }

  function handleSuggestion(s: string) {
    setQuery(s);
    onQuery(s);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">Natural Language Search</Text>
          <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center active:opacity-60">
            <Text className="text-sm font-medium text-primary">Done</Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <View className="px-5 py-4 border-b border-border">
          <View className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
            <Search size={16} className="text-muted-foreground" />
            <TextInput
              className="flex-1 text-sm text-foreground"
              placeholder="Ask about FIRs in plain language…"
              placeholderTextColor={C.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSubmit}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} className="active:opacity-60">
                <X size={14} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={query.trim().length === 0 || isLoading}
            className="mt-3 bg-primary rounded-xl py-2.5 items-center active:opacity-70"
          >
            {isLoading
              ? <Text className="text-sm font-medium text-primary-foreground">Searching…</Text>
              : <Text className="text-sm font-medium text-primary-foreground">Search</Text>}
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Suggestions (shown when no result) */}
          {!result && (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Try asking…
              </Text>
              <View className="gap-2">
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => handleSuggestion(s)}
                    className="flex-row items-center gap-2 py-3 border-b border-border active:opacity-70"
                  >
                    <Search size={13} className="text-muted-foreground" />
                    <Text className="text-sm text-foreground">{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Results */}
          {result && (
            <View>
              {/* Query meta */}
              <View className="mb-4">
                {result.correctedQuery && (
                  <View
                    className="flex-row items-center gap-2 mb-2 rounded-lg px-3 py-2 border"
                    style={{
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
                      borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                    }}
                  >
                    <Text
                      className="text-xs flex-1"
                      style={{ color: isDark ? '#FDE68A' : '#B45309' }}
                    >
                      Auto-corrected: "{result.correctedQuery}"
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xs text-muted-foreground">Intent:</Text>
                  <Text className="text-xs font-medium text-foreground">{result.intent.replace(/-/g, ' ')}</Text>
                  <Text className="text-xs text-muted-foreground">· Confidence {result.confidence}%</Text>
                </View>
                <Text className="text-xs text-muted-foreground">{result.executionNote}</Text>
              </View>

              {/* Match count */}
              <Text className="text-sm font-semibold text-foreground mb-3">
                {result.totalMatches} Result{result.totalMatches !== 1 ? 's' : ''} Found
              </Text>

              {result.matchingFIRs.length === 0 ? (
                <View className="items-center py-8 gap-2">
                  <Search size={28} className="text-muted-foreground" />
                  <Text className="text-sm text-muted-foreground text-center">
                    No FIRs matched your query. Try different keywords.
                  </Text>
                </View>
              ) : (
                result.matchingFIRs.map((f: { firId: string; firNumber: string; crimeType: string; relevanceNote: string }) => (
                  <View key={f.firId} className="py-3 border-b border-border">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-medium text-foreground">FIR {f.firNumber}</Text>
                      <View className="flex-1" />
                      <Text className="text-xs text-muted-foreground">{f.crimeType}</Text>
                    </View>
                    <Text className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.relevanceNote}</Text>
                  </View>
                ))
              )}

              {/* New search button */}
              <Pressable
                onPress={() => { setQuery(''); }}
                className="mt-6 items-center active:opacity-70"
              >
                <Text className="text-sm text-primary font-medium">New Search</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Advisory */}
        <View className="px-5 py-3 border-t border-border">
          <Text className="text-xs text-muted-foreground text-center">
            ⚖️ Search results are advisory only. All decisions remain with the Investigating Officer.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
