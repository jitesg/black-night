/**
 * Press-and-hold selection on a module list (owner, sample approved — प्रार्थना पत्र + न्यायालय; same idea as निरोधात्मक):
 *  • `useCardSelection(shownIds)` — the chosen ids; press-and-hold a card = choose it, then a tap = choose / un-choose;
 *    the phone's back button ends the choosing (call `handleBack()` first in the screen's BackHandler);
 *  • `SelectTick` — the round tick that takes the ⋮ button's place while choosing;
 *  • `SelectionHeader` — "n चुने गए" header: ☑ सभी चुनें (again = सब हटाएँ) · ⬇ Word · 🗑 हटाएँ.
 * THEME colours; `accent` = the module colour.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, ToastAndroid, View } from 'react-native';
import { Check, CheckCheck, FileDown, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { BatchResult } from '@/lib/batchReportExport';

export function useCardSelection(shownIds: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selecting = selectedIds.size > 0;
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const allChosen = shownIds.length > 0 && shownIds.every((id) => selectedIds.has(id));
  const toggleAll = useCallback(() => {
    setSelectedIds(allChosen ? new Set() : new Set(shownIds));
  }, [allChosen, shownIds]);
  // A card that left the list (deleted / filtered out) is no longer chosen.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const shown = new Set(shownIds);
      const next = new Set([...prev].filter((id) => shown.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [shownIds]);
  const ref = useRef(selectedIds);
  ref.current = selectedIds;
  /** Back button: true = it only ended the choosing. */
  const handleBack = useCallback(() => {
    if (ref.current.size === 0) return false;
    setSelectedIds(new Set());
    return true;
  }, []);
  return useMemo(
    () => ({ selectedIds, selecting, toggle, clear, toggleAll, allChosen, handleBack }),
    [selectedIds, selecting, toggle, clear, toggleAll, allChosen, handleBack],
  );
}

/** Round tick in the ⋮ place (32 × 32 like CardMenuButton, so the card does not shift). */
export const SelectTick = memo(function SelectTick({ selected, accent }: { selected: boolean; accent: string }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <View style={{ width: 32, height: 32, marginRight: -8, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 24, height: 24, borderRadius: 12, borderWidth: 2,
        borderColor: selected ? accent : C.mutedForeground, backgroundColor: selected ? accent : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {selected ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
    </View>
  );
});

export const SelectionHeader = memo(function SelectionHeader({
  count, allChosen, onBack, onToggleAll, onExport, onDelete, exporting,
}: {
  count: number;
  allChosen: boolean;
  onBack: () => void;
  onToggleAll: () => void;
  onExport: () => void;
  onDelete: () => void;
  exporting?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <AppHeader
      title={`${count} चुने गए`}
      subtitle="tap करें: चुनें / हटाएँ"
      onBack={onBack}
      actions={
        <>
          <HeaderIconBtn icon={CheckCheck} onPress={onToggleAll} label={allChosen ? 'सबका चुनाव हटाएँ' : 'सभी चुनें'} />
          {exporting ? (
            <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          ) : (
            <HeaderIconBtn icon={FileDown} onPress={onExport} label="चुने गए की Word फ़ाइल" />
          )}
          <HeaderIconBtn icon={Trash2} onPress={onDelete} label="चुने गए हटाएँ" color={colorScheme === 'dark' ? '#F87171' : '#DC2626'} />
        </>
      }
    />
  );
});

/**
 * ⬇ Word for the chosen cards: runs the module's batch export, then says what was left out
 * ("n पत्र में आख्या नहीं — छोड़ा गया"); nothing to export → an alert instead of an empty file.
 */
export async function runBatchExport(run: () => Promise<BatchResult>, what: { noun: string; report: string }): Promise<void> {
  try {
    const { exported, skipped } = await run();
    if (!exported) {
      Alert.alert('Word फ़ाइल नहीं बनी', `चुने गए किसी भी ${what.noun} में ${what.report} नहीं लगी है।`);
      return;
    }
    if (skipped) {
      const msg = `${skipped} ${what.noun} में ${what.report} नहीं — छोड़ा गया`;
      if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
      else Alert.alert('', msg);
    }
  } catch (e) {
    Alert.alert('Word फ़ाइल नहीं बनी', e instanceof Error ? e.message : String(e));
  }
}

/** "n … हटाएँ?" for the chosen cards (buttons written in reverse — the footer is flex-col-reverse). */
export function BatchDeleteDialog({ open, title, description, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={onCancel}>
            <Text>रद्द करें</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={onConfirm} className="bg-destructive">
            <Text className="text-destructive-foreground font-semibold">हाँ, हटाएँ</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
