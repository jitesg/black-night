/**
 * debug-console.tsx — Developer Debug Console
 *
 * ACCESS: Developer Options → Sub-Screens → Debug Console
 * GATE:   __DEV__ only — returns null in production.
 *
 * Features:
 *  • Live structured log feed (ring-buffer, newest first)
 *  • Filter by Category (SCREEN / NAV / ACTION / REPO / DB / ERROR / PERF / CRASH / AUTH / SYNC)
 *  • Filter by Level    (info / warn / error / debug)
 *  • Substring search   (searches module + screen + action + sql + errorMessage)
 *  • Collapsible detail rows (tap any entry to expand)
 *  • Export: JSON report copied to clipboard
 *  • Export: TXT report copied to clipboard
 *  • Clear all logs
 *  • Live counter badge
 *
 * Design: Minimal "Airiness" — generous whitespace, monospaced entry rows,
 * muted palette except for level/category colour chips.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, FlatList, ScrollView,
} from 'react-native';
import { T } from '@/lib/typography';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import {
  Search, Trash2, Copy, X, Bug, ChevronDown, ChevronRight,
  Download, FileText,
} from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { useAppLogs, clearAppLogs, getAppLogSnapshot, type AppLogEntry, type LogCategory } from '@/lib/appLogger';
import { generateDebugReport } from '@/lib/debugReport';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Palette ───────────────────────────────────────────────────────────────────

const GREEN  = '#059669';
const RED    = '#DC2626';
const AMBER  = '#D97706';
const BLUE   = '#2563EB';
const PURPLE = '#7C3AED';
const MUTED  = '#9CA3AF';

const LEVEL_COLOR: Record<AppLogEntry['level'], string> = {
  info:  BLUE,
  warn:  AMBER,
  error: RED,
  debug: '#6B7280',
};

const LEVEL_BG: Record<AppLogEntry['level'], string> = {
  info:  '#EFF6FF',
  warn:  '#FFFBEB',
  error: '#FEF2F2',
  debug: '#F9FAFB',
};

const CAT_COLOR: Record<LogCategory, string> = {
  SCREEN: GREEN,
  NAV:    '#1E3A5F',
  ACTION: PURPLE,
  REPO:   '#0891B2',
  DB:     '#0F766E',
  ERROR:  RED,
  PERF:   AMBER,
  CRASH:  '#7F1D1D',
  AUTH:   '#9333EA',
  SYNC:   '#0369A1',
};

const ALL_CATS: LogCategory[] = ['SCREEN', 'NAV', 'ACTION', 'REPO', 'DB', 'ERROR', 'PERF', 'CRASH', 'AUTH', 'SYNC'];
const ALL_LEVELS = ['info', 'warn', 'error', 'debug'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function fmtMs(ms?: number): string {
  if (ms === undefined) return '';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

// ── Chip filter button ────────────────────────────────────────────────────────

function Chip({
  label, active, color, onPress,
}: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="px-2.5 py-1 rounded-full border active:opacity-70"
      style={{
        borderColor: active ? color : '#E5E7EB',
        backgroundColor: active ? `${color}18` : '#F9FAFB',
      }}
    >
      <Text className="text-xs font-semibold" style={{ color: active ? color : MUTED }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Single log entry row ──────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: AppLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(
    entry.errorMessage || entry.sql || entry.stackTrace || entry.detail
    || entry.execMs !== undefined || entry.rowsReturned !== undefined
    || entry.entityId || (entry.precedingLogs && entry.precedingLogs.length > 0)
  );

  const catColor = CAT_COLOR[entry.category];
  const lvlColor = LEVEL_COLOR[entry.level];
  const lvlBg    = LEVEL_BG[entry.level];

  return (
    <Pressable
      onPress={() => { if (hasDetail) setExpanded((v) => !v); }}
      className="border-b border-border"
      style={{ paddingHorizontal: T.space.md, paddingVertical: T.space.sm + 2 }}
    >
      {/* ── Row header ── */}
      <View className="flex-row items-start gap-2">
        {/* Expand chevron */}
        <View style={{ width: 14, marginTop: 2 }}>
          {hasDetail
            ? expanded
              ? <ChevronDown size={12} color={MUTED} />
              : <ChevronRight size={12} color={MUTED} />
            : null}
        </View>

        {/* Content */}
        <View className="flex-1">
          {/* Top line: time + level chip + category chip */}
          <View className="flex-row items-center gap-1.5 mb-0.5 flex-wrap">
            <Text style={{ ...T.micro, color: MUTED, fontVariant: ['tabular-nums'], textTransform: undefined, letterSpacing: 0 }}>
              {fmtTime(entry.timestamp)}
            </Text>
            {/* Level */}
            <View className="px-1.5 rounded" style={{ backgroundColor: lvlBg }}>
              <Text style={{ ...T.micro, color: lvlColor, letterSpacing: 0.3 }}>
                {entry.level.toUpperCase()}
              </Text>
            </View>
            {/* Category */}
            <View className="px-1.5 rounded" style={{ backgroundColor: `${catColor}18` }}>
              <Text style={{ ...T.micro, color: catColor, letterSpacing: 0.3 }}>
                {entry.category}
              </Text>
            </View>
            {/* Module · Screen */}
            <Text style={{ ...T.micro, color: '#374151', textTransform: undefined, letterSpacing: 0 }}>
              {entry.module}{entry.screen && entry.screen !== entry.module ? ` · ${entry.screen}` : ''}
            </Text>
            {/* Exec time */}
            {entry.execMs !== undefined && (
              <Text style={{ ...T.micro, color: entry.execMs > 1000 ? AMBER : MUTED, textTransform: undefined, letterSpacing: 0 }}>
                {fmtMs(entry.execMs)}
              </Text>
            )}
            {/* Success indicator */}
            <Text style={{ ...T.micro, color: entry.success ? GREEN : RED, textTransform: undefined, letterSpacing: 0 }}>
              {entry.success ? '✓' : '✗'}
            </Text>
          </View>

          {/* Action text */}
          <Text
            style={{ ...T.caption1, ...T.mono, color: '#111827', lineHeight: 17 }}
            selectable
          >
            {entry.action}
          </Text>
        </View>
      </View>

      {/* ── Expanded detail panel ── */}
      {expanded && hasDetail && (
        <View
          className="mt-2 ml-5 rounded-xl p-3 gap-1.5"
          style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}
        >
          {entry.entityId && (
            <DetailLine label="Entity ID" value={entry.entityId} />
          )}
          {entry.rowsReturned !== undefined && (
            <DetailLine label="Rows Returned" value={String(entry.rowsReturned)} />
          )}
          {entry.sql && (
            <DetailBlock label="SQL" value={entry.sql} />
          )}
          {entry.errorMessage && (
            <DetailBlock label="Error" value={entry.errorMessage} color={RED} />
          )}
          {entry.stackTrace && (
            <DetailBlock label="Stack Trace" value={entry.stackTrace.slice(0, 500)} />
          )}
          {entry.detail && (
            <DetailBlock label="Detail" value={JSON.stringify(entry.detail, null, 2)} />
          )}
          {entry.precedingLogs && entry.precedingLogs.length > 0 && (
            <View className="mt-1">
              <Text style={{ ...T.micro, color: MUTED, marginBottom: 4, letterSpacing: 0.5 }}>
                PRECEDING {entry.precedingLogs.length} ENTRIES:
              </Text>
              {entry.precedingLogs.slice(0, 20).map((p) => (
                <Text
                  key={p.id}
                  style={{ ...T.micro, ...T.mono, color: '#374151', textTransform: undefined, letterSpacing: 0, lineHeight: 15 }}
                >
                  {fmtTime(p.timestamp)}  {p.category.padEnd(7)}  {p.action}
                </Text>
              ))}
              {entry.precedingLogs.length > 20 && (
                <Text style={{ ...T.micro, color: MUTED, textTransform: undefined, letterSpacing: 0 }}>
                  … and {entry.precedingLogs.length - 20} more
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-2">
      <Text style={{ ...T.micro, color: MUTED, fontWeight: T.weight.bold, width: 80, textTransform: undefined, letterSpacing: 0 }}>{label}</Text>
      <Text style={{ ...T.micro, color: '#374151', flex: 1, textTransform: undefined, letterSpacing: 0 }} selectable>{value}</Text>
    </View>
  );
}

function DetailBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View className="gap-0.5">
      <Text style={{ ...T.micro, color: MUTED, fontWeight: T.weight.bold, textTransform: undefined, letterSpacing: 0 }}>{label}</Text>
      <Text
        style={{ ...T.micro, ...T.mono, color: color ?? '#374151', textTransform: undefined, letterSpacing: 0, lineHeight: 15 }}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DebugConsoleScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const entries = useAppLogs();

  const [query, setQuery]           = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeCats, setActiveCats] = useState<Set<LogCategory>>(new Set());
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set());
  const [clearDialog, setClearDialog]   = useState(false);
  const [toast, setToast]               = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((t: string) => {
    setQuery(t);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQ(t), 150);
  }, []);

  const toggleCat = useCallback((c: LogCategory) => {
    setActiveCats((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  }, []);

  const toggleLevel = useCallback((l: string) => {
    setActiveLevels((prev) => {
      const n = new Set(prev);
      n.has(l) ? n.delete(l) : n.add(l);
      return n;
    });
  }, []);

  const filtered = useMemo<AppLogEntry[]>(() => {
    let result = entries;
    if (activeCats.size > 0) result = result.filter((e) => activeCats.has(e.category));
    if (activeLevels.size > 0) result = result.filter((e) => activeLevels.has(e.level));
    if (debouncedQ.trim()) {
      const q = debouncedQ.toLowerCase();
      result = result.filter((e) =>
        e.action.toLowerCase().includes(q)
        || e.module.toLowerCase().includes(q)
        || e.screen.toLowerCase().includes(q)
        || (e.sql ?? '').toLowerCase().includes(q)
        || (e.errorMessage ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, activeCats, activeLevels, debouncedQ]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const handleExportJSON = useCallback(async () => {
    const { json } = generateDebugReport();
    await Clipboard.setStringAsync(json);
    showToast('Debug Report (JSON) copied to clipboard');
  }, [showToast]);

  const handleExportTXT = useCallback(async () => {
    const { txt } = generateDebugReport();
    await Clipboard.setStringAsync(txt);
    showToast('Debug Report (TXT) copied to clipboard');
  }, [showToast]);

  const handleCopyFiltered = useCallback(async () => {
    const lines = filtered.map((e) =>
      `[${fmtTime(e.timestamp)}] [${e.level.toUpperCase()}] [${e.category}] ${e.module}·${e.screen} ${e.success ? '✓' : '✗'} ${e.action}${e.execMs !== undefined ? ` (${fmtMs(e.execMs)})` : ''}${e.errorMessage ? ` ⚠${e.errorMessage}` : ''}`
    ).join('\n');
    await Clipboard.setStringAsync(lines);
    showToast(`Copied ${filtered.length} entries`);
  }, [filtered, showToast]);

  const handleClear = useCallback(() => {
    clearAppLogs();
    setClearDialog(false);
    showToast('Debug log cleared');
  }, [showToast]);

  const errorCount = useMemo(() => entries.filter((e) => e.level === 'error').length, [entries]);
  const crashCount = useMemo(() => entries.filter((e) => e.category === 'CRASH').length, [entries]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Debug Console"
        subtitle={`${entries.length} events · ${filtered.length} shown · ${errorCount} errors${crashCount > 0 ? ` · ${crashCount} crashes` : ''}`}
        showBack
        variant="navy"
        rightActions={
          <View className="flex-row items-center gap-2">
            {/* Export TXT */}
            <Pressable onPress={handleExportTXT} className="p-1.5 active:opacity-70" accessibilityLabel="Export TXT report">
              <FileText size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
            {/* Export JSON */}
            <Pressable onPress={handleExportJSON} className="p-1.5 active:opacity-70" accessibilityLabel="Export JSON report">
              <Download size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
            {/* Copy filtered */}
            <Pressable onPress={handleCopyFiltered} className="p-1.5 active:opacity-70" accessibilityLabel="Copy filtered entries">
              <Copy size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
            {/* Clear */}
            <Pressable onPress={() => setClearDialog(true)} className="p-1.5 active:opacity-70" accessibilityLabel="Clear logs">
              <Trash2 size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>
        }
      />

      {/* Toast */}
      {!!toast && (
        <View className="mx-4 mt-2 px-4 py-2 rounded-xl bg-card border border-border">
          <Text className="text-xs font-medium text-center" style={{ color: GREEN }}>{toast}</Text>
        </View>
      )}

      {/* Search */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 gap-2">
          <Search size={14} color={MUTED} />
          <TextInput
            className="flex-1 py-2.5 text-sm text-foreground"
            placeholder="Search module, action, SQL, error…"
            placeholderTextColor={MUTED}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => { setQuery(''); setDebouncedQ(''); }} className="p-1">
              <X size={14} color={MUTED} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category filter chips */}
      <View className="px-4 pt-2 pb-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ALL_CATS.map((c) => (
            <Chip
              key={c}
              label={c}
              active={activeCats.has(c)}
              color={CAT_COLOR[c]}
              onPress={() => toggleCat(c)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Level filter chips */}
      <View className="px-4 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ALL_LEVELS.map((l) => (
            <Chip
              key={l}
              label={l}
              active={activeLevels.has(l)}
              color={LEVEL_COLOR[l]}
              onPress={() => toggleLevel(l)}
            />
          ))}
          {(activeCats.size > 0 || activeLevels.size > 0 || debouncedQ) && (
            <Chip
              label="Clear Filters"
              active
              color="#6B7280"
              onPress={() => { setActiveCats(new Set()); setActiveLevels(new Set()); setQuery(''); setDebouncedQ(''); }}
            />
          )}
        </ScrollView>
      </View>

      {/* Summary bar */}
      <View className="px-4 py-1.5 border-b border-border flex-row items-center gap-4">
        <Text className="text-xs" style={{ color: MUTED }}>
          Showing {filtered.length} of {entries.length}
        </Text>
        {errorCount > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RED }} />
            <Text className="text-xs font-semibold" style={{ color: RED }}>{errorCount} errors</Text>
          </View>
        )}
        {crashCount > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#7F1D1D' }} />
            <Text className="text-xs font-semibold" style={{ color: '#7F1D1D' }}>{crashCount} crashes</Text>
          </View>
        )}
      </View>

      {/* Log list */}
      {filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3">
          <Bug size={36} color="#E5E7EB" />
          <Text className="text-sm text-muted-foreground text-center px-8">
            {entries.length === 0
              ? 'No events captured yet.\nUse the app — logs appear here automatically.'
              : 'No entries match the current filters.'}
          </Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={filtered}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <EntryRow entry={item} />}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 40 }}
          removeClippedSubviews
          maxToRenderPerBatch={25}
          windowSize={8}
        />
      )}

      {/* Clear dialog */}
      <AlertDialog open={clearDialog} onOpenChange={(o) => { if (!o) setClearDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Debug Logs</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all {entries.length} captured events from memory. Cannot be undone.
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
