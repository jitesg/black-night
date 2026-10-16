/**
 * Dev Options — Console Log Viewer
 *
 * Displays every console.log / console.warn / console.error / console.info
 * call captured by debugLogStore since app startup.
 *
 * Features:
 *  - Newest entry first, live-updating FlatList
 *  - Substring search box (type e.g. "[PROBE]" or "[TL-STALE]")
 *  - Copy All  — copies all 500 entries to clipboard
 *  - Copy Filtered — copies only the currently matching entries
 *  - Clear — empties the in-memory ring buffer
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, FlatList,
} from 'react-native';
import { T } from '@/lib/typography';
import { StatusBar } from 'expo-status-bar';
import { Search, Trash2, Copy, X, Terminal } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  useDebugLogs, clearDebugLogs, getDebugLogSnapshot,
  type DebugLogEntry,
} from '@/lib/debugLogStore';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const GREEN = '#059669';
const RED   = '#DC2626';
const AMBER = '#D97706';
const BLUE  = '#2563EB';

const LEVEL_COLORS: Record<DebugLogEntry['level'], string> = {
  log:   '#6B7280',
  info:  BLUE,
  warn:  AMBER,
  error: RED,
};

const LEVEL_BG: Record<DebugLogEntry['level'], string> = {
  log:   '#F3F4F6',
  info:  '#EFF6FF',
  warn:  '#FFFBEB',
  error: '#FEF2F2',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function entryToText(e: DebugLogEntry): string {
  return `[${formatTime(e.timestamp)}] [${e.level.toUpperCase()}] ${e.message}`;
}

function LogRow({ entry }: { entry: DebugLogEntry }) {
  const color = LEVEL_COLORS[entry.level];
  const bg    = LEVEL_BG[entry.level];
  return (
    <View className="px-4 py-2.5 border-b border-border">
      <View className="flex-row items-center gap-2 mb-0.5">
        <Text className="text-xs font-mono" style={{ color: '#9CA3AF' }}>
          {formatTime(entry.timestamp)}
        </Text>
        <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: bg }}>
          <Text className="text-xs font-bold uppercase" style={{ color }}>
            {entry.level}
          </Text>
        </View>
      </View>
      <Text
        className="text-xs font-mono"
        style={{ color: '#111827', lineHeight: 18 }}
        selectable
      >
        {entry.message}
      </Text>
    </View>
  );
}

export default function LogViewerScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const entries = useDebugLogs();

  const [query, setQuery]         = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [clearDialog, setClearDialog] = useState(false);
  const [copyToast, setCopyToast]   = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((t: string) => {
    setQuery(t);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQ(t), 150);
  }, []);

  const filtered = useMemo<DebugLogEntry[]>(() => {
    if (!debouncedQ.trim()) return entries;
    const q = debouncedQ.toLowerCase();
    return entries.filter((e) => e.message.toLowerCase().includes(q));
  }, [entries, debouncedQ]);

  const showToast = useCallback((msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(''), 2000);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const all = getDebugLogSnapshot();
    const text = all.map(entryToText).join('\n');
    await Clipboard.setStringAsync(text);
    showToast(`Copied ${all.length} entries`);
  }, [showToast]);

  const handleCopyFiltered = useCallback(async () => {
    const text = filtered.map(entryToText).join('\n');
    await Clipboard.setStringAsync(text);
    showToast(`Copied ${filtered.length} entries`);
  }, [filtered, showToast]);

  const handleClear = useCallback(() => {
    clearDebugLogs();
    setClearDialog(false);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Console Log Viewer"
        subtitle={`${entries.length} entries captured · showing ${filtered.length}`}
        showBack
        variant="navy"
        rightActions={
          <View className="flex-row items-center gap-3">
            {/* Copy All */}
            <Pressable
              onPress={handleCopyAll}
              className="p-1.5 active:opacity-70"
              accessibilityLabel="Copy all log entries"
            >
              <Copy size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
            {/* Clear */}
            <Pressable
              onPress={() => setClearDialog(true)}
              className="p-1.5 active:opacity-70"
              accessibilityLabel="Clear log"
            >
              <Trash2 size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>
        }
      />

      {/* Toast */}
      {!!copyToast && (
        <View className="mx-4 mt-2 px-4 py-2 rounded-xl bg-card border border-border">
          <Text className="text-xs font-medium text-center" style={{ color: GREEN }}>{copyToast}</Text>
        </View>
      )}

      {/* Search bar */}
      <View className="px-4 pt-3 pb-2 gap-2">
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 gap-2">
          <Search size={14} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-2.5 text-sm text-foreground"
            placeholder='Filter by substring e.g. "[PROBE]"'
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => { setQuery(''); setDebouncedQ(''); }} className="p-1">
              <X size={14} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Copy Filtered button — only show when a filter is active */}
        {!!debouncedQ && (
          <Pressable
            onPress={handleCopyFiltered}
            className="flex-row items-center justify-center gap-2 py-2 rounded-xl active:opacity-70"
            style={{ backgroundColor: `${'#1E3A5F'}12` }}
          >
            <Copy size={13} color='#1E3A5F' />
            <Text className="text-xs font-semibold" style={{ color: '#1E3A5F' }}>
              Copy {filtered.length} filtered entries
            </Text>
          </Pressable>
        )}
      </View>

      {/* Log list — newest first */}
      {filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3">
          <Terminal size={36} color="#D1D5DB" />
          <Text className="text-sm text-muted-foreground text-center px-8">
            {entries.length === 0
              ? 'No console output captured yet.\nUse the app to generate logs.'
              : 'No entries match the current filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={filtered}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <LogRow entry={item} />}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 40 }}
          removeClippedSubviews
          maxToRenderPerBatch={30}
          windowSize={10}
        />
      )}

      {/* Clear confirmation dialog */}
      <AlertDialog open={clearDialog} onOpenChange={(o) => { if (!o) setClearDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Console Logs</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all {entries.length} captured log entries from memory. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setClearDialog(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleClear}>
              <Text>Clear</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

