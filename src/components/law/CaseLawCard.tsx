import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import {
  Scale,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Quote,
  ShieldCheck,
  AlertTriangle,
  Building,
  Calendar,
  FileCheck,
} from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { THEME } from '@/lib/theme';
import { type CaseLawItem } from '@/lib/law/casesData';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface CaseLawCardProps {
  cases: CaseLawItem[];
  isHi?: boolean;
}

export function CaseLawCard({ cases, isHi = true }: CaseLawCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const C = THEME[isDark ? 'dark' : 'light'];

  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [selectedCaseForUrl, setSelectedCaseForUrl] = useState<CaseLawItem | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Sort unverified cases after verified ones
  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const aUnv = a.status === 'unverified' ? 1 : 0;
      const bUnv = b.status === 'unverified' ? 1 : 0;
      return aUnv - bUnv;
    });
  }, [cases]);

  // Check if every case in this card is verified (missing status treated as verified)
  const allVerified = sortedCases.every((c) => c.status !== 'unverified');

  const handleOpenSourcePrompt = useCallback((caseItem: CaseLawItem) => {
    if (!caseItem.url) return;
    setSelectedCaseForUrl(caseItem);
    setIsConfirmOpen(true);
  }, []);

  const handleConfirmOpen = useCallback(async () => {
    if (selectedCaseForUrl?.url) {
      try {
        const can = await Linking.canOpenURL(selectedCaseForUrl.url);
        if (can) {
          await Linking.openURL(selectedCaseForUrl.url);
        }
      } catch {
        // Safe fallback - no crash
      }
    }
    setIsConfirmOpen(false);
    setSelectedCaseForUrl(null);
  }, [selectedCaseForUrl]);

  if (!cases || cases.length === 0) return null;

  return (
    <View
      className="p-5 bg-card border border-border rounded-2xl shadow-sm shadow-black/5 gap-3.5"
      style={{ borderCurve: 'continuous' }}
    >
      {/* ── Header: Title + Verified Badge (if all verified) + Collapse Chevron ── */}
      <Pressable
        onPress={() => setIsCardExpanded((prev) => !prev)}
        className="flex-row items-center justify-between active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="महत्वपूर्ण निर्णय कार्ड"
      >
        <View className="flex-row items-center gap-2 flex-1 min-w-0 pr-2">
          <Scale size={18} color="#2563EB" />
          <Text className="text-[15px] font-bold text-foreground tracking-tight leading-5">
            {isHi ? `महत्वपूर्ण निर्णय (${sortedCases.length})` : `Case Law (${sortedCases.length})`}
          </Text>
          {allVerified && (
            <View
              className="flex-row items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1"
              style={{ borderCurve: 'continuous' }}
            >
              <ShieldCheck size={11} color="#059669" />
              <Text textBreakStrategy="simple" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {isHi ? 'सत्यापित स्रोत' : 'Verified Source'}
              </Text>
            </View>
          )}
        </View>
        {isCardExpanded ? (
          <ChevronUp size={20} color={C.mutedForeground} />
        ) : (
          <ChevronDown size={20} color={C.mutedForeground} />
        )}
      </Pressable>

      {isCardExpanded && (
        <View className="gap-3.5 pt-1">
          {sortedCases.map((c) => {
            const isUnverified = c.status === 'unverified';
            const hasOldNewMapping = (c.old && c.old.length > 0) || (c.new && c.new.length > 0);
            return (
              <View
                key={c.id}
                className="p-3.5 rounded-xl border border-border/80 bg-background/50 gap-2.5"
                style={{ borderCurve: 'continuous' }}
              >
                {/* Case Title + Badge */}
                <View className="gap-1.5">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="text-sm font-bold text-foreground leading-5 flex-1">
                      {c.name}
                    </Text>
                    {isUnverified ? (
                      <View
                        className="flex-row items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 shrink-0 mt-0.5 px-2.5 py-1"
                        style={{ borderCurve: 'continuous' }}
                      >
                        <AlertTriangle size={10} color="#D97706" />
                        <Text textBreakStrategy="simple" className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          {isHi ? 'पूर्ण सत्यापित नहीं' : 'Unverified'}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className="flex-row items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0 mt-0.5 px-2.5 py-1"
                        style={{ borderCurve: 'continuous' }}
                      >
                        <ShieldCheck size={10} color="#059669" />
                        <Text textBreakStrategy="simple" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {isHi ? 'सत्यापित स्रोत' : 'Verified Source'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <View className="flex-row items-center gap-1">
                      <Building size={12} color={C.mutedForeground} />
                      <Text className="text-[11px] text-muted-foreground font-medium">{c.court}</Text>
                    </View>
                    <Text className="text-[11px] text-muted-foreground">•</Text>
                    <View className="flex-row items-center gap-1">
                      <Calendar size={12} color={C.mutedForeground} />
                      <Text className="text-[11px] text-muted-foreground font-medium">{c.year}</Text>
                    </View>
                    {Boolean(c.cite) && (
                      <>
                        <Text className="text-[11px] text-muted-foreground">•</Text>
                        <Text className="text-[11px] text-muted-foreground font-medium">{c.cite}</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Unverified Warning Box (above held summary) */}
                {isUnverified && Boolean(c.warn_hi) && (
                  <View
                    className="flex-row items-start gap-2 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/35"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <AlertTriangle size={14} color="#D97706" className="mt-0.5 shrink-0" />
                    <Text className="text-xs text-amber-800 dark:text-amber-300 leading-5 flex-1 font-medium">
                      {c.warn_hi}
                    </Text>
                  </View>
                )}

                {/* Old -> New Mapping Line */}
                {hasOldNewMapping && (
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/50">
                    <FileCheck size={12} color={C.primary} />
                    <Text className="text-[11px] text-muted-foreground flex-1" numberOfLines={2}>
                      <Text className="font-semibold text-foreground/80">{c.old?.join(', ') || '—'}</Text>
                      {' ➔ '}
                      <Text className="font-semibold text-primary">{c.new?.join(', ') || '—'}</Text>
                    </Text>
                  </View>
                )}

                {/* Held (निर्णय सार) */}
                {Boolean(c.held_hi) && (
                  <View className="gap-0.5">
                    <Text className="text-[11px] font-bold text-muted-foreground">
                      {isHi ? 'निर्णय / मार्गदर्शक सिद्धांत:' : 'Held / Ratio:'}
                    </Text>
                    <Text className="text-xs text-foreground/90 leading-5">
                      {c.held_hi}
                    </Text>
                  </View>
                )}

                {/* Use in investigation (जाँच में उपयोग) */}
                {Boolean(c.use_hi) && (
                  <View className="p-2.5 rounded-lg bg-primary/5 border border-primary/15 gap-1">
                    <Text className="text-[11px] font-bold text-primary">
                      {isHi ? 'जाँच में उपयोग:' : 'Use in Investigation:'}
                    </Text>
                    <Text className="text-xs text-foreground/90 leading-5 font-medium">
                      {c.use_hi}
                    </Text>
                  </View>
                )}

                {/* Quote (Italics) */}
                {Boolean(c.quote) && (
                  <View className="flex-row items-start gap-2 p-2.5 rounded-lg bg-muted/20 border-l-2 border-primary/60">
                    <Quote size={13} color={C.primary} className="mt-0.5" />
                    <Text className="text-xs italic text-foreground/80 leading-5 flex-1">
                      "{c.quote}"
                    </Text>
                  </View>
                )}

                {/* Source External Link Button */}
                {Boolean(c.url) && (
                  <View className="flex-row justify-end pt-1">
                    <Pressable
                      onPress={() => handleOpenSourcePrompt(c)}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 active:opacity-70"
                      accessibilityRole="button"
                      accessibilityLabel="स्रोत खोलें"
                      style={{ borderCurve: 'continuous', minHeight: 36 }}
                    >
                      <ExternalLink size={13} color={C.primary} />
                      <Text className="text-xs font-semibold text-primary">
                        {isHi ? 'स्रोत खोलें' : 'Open Source'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          {/* Footer Line */}
          <View className="pt-2 border-t border-border/40">
            <Text className="text-[11px] text-muted-foreground leading-4 italic">
              {isHi
                ? 'निर्णय का पूरा पाठ स्रोत पर देखें; यहाँ सार सहायक है।'
                : 'View the full judgment at the official source; this summary is for investigative assistance.'}
            </Text>
          </View>
        </View>
      )}

      {/* External Link Confirmation Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="w-[90%] max-w-md p-6 rounded-2xl bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              {isHi ? 'बाहरी स्रोत खोलें?' : 'Open External Source?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-5 mt-2">
              {isHi
                ? `क्या आप निर्णय "${selectedCaseForUrl?.name}" का आधिकारिक स्रोत वेबपेज अपने ब्राउज़र में खोलना चाहते हैं?`
                : `Would you like to open the official source webpage for "${selectedCaseForUrl?.name}" in your external browser?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 mt-4">
            <AlertDialogCancel
              onPress={() => {
                setIsConfirmOpen(false);
                setSelectedCaseForUrl(null);
              }}
              className="px-4 py-2 rounded-xl bg-muted border border-border"
            >
              <Text className="text-xs font-semibold text-foreground">
                {isHi ? 'रद्द करें' : 'Cancel'}
              </Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={handleConfirmOpen}
              className="px-4 py-2 rounded-xl bg-primary"
            >
              <Text className="text-xs font-semibold text-primary-foreground">
                {isHi ? 'खोलें' : 'Open'}
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
