/**
 * Developer Seed Manager — Import Seed JSON
 *
 * Paste a formats_seed.json or knowledge_seed.json payload, validate it,
 * review the diff summary, then confirm to merge into the working copy.
 *
 * Rules:
 *   - New UUID   → Insert (Added)
 *   - Same UUID, higher seed_version → Update (Updated)
 *   - Same UUID, same/lower version  → Skip  (Skipped)
 *   - Missing id / title             → Error
 *   - Never modifies User Content
 *
 * DEV-ONLY. Not accessible in production builds.
 */
import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  Upload, CheckCircle2, AlertCircle,
  SkipForward, Plus, RefreshCw, AlertTriangle, FileJson,
  ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { useDevSeedStore, type ImportResult } from '@/lib/devSeedStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

// ─── Step type ────────────────────────────────────────────────────────────────
type Step = 'paste' | 'preview' | 'done';

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  result, onDone, onImportMore,
}: {
  result: ImportResult;
  onDone: () => void;
  onImportMore: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const success = result.errors.length === 0;

  return (
    <ScrollView contentContainerClassName="px-5 py-6 gap-5 pb-16" showsVerticalScrollIndicator={false}>
      {/* Status icon */}
      <View className="items-center gap-3 py-4">
        {success
          ? <CheckCircle2 size={52} color="#059669" />
          : <AlertCircle  size={52} color="#D97706" />}
        <Text className="text-xl font-bold text-foreground">
          {success ? 'Import Complete' : 'Import Finished with Errors'}
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          {success
            ? 'Seed data merged into your working copy. Export to apply to the next build.'
            : 'Some records were skipped. Review errors below.'}
        </Text>
      </View>

      {/* Stat row */}
      <View className="flex-row gap-3">
        {[
          { icon: <Plus size={16} color="#059669" />,       label: 'Added',   value: result.added,   bg: '#05966912' },
          { icon: <RefreshCw size={16} color="#2563EB" />,  label: 'Updated', value: result.updated, bg: '#2563EB12' },
          { icon: <SkipForward size={16} color="#9CA3AF" />, label: 'Skipped', value: result.skipped, bg: '#9CA3AF12' },
          { icon: <AlertCircle size={16} color="#DC2626" />, label: 'Errors',  value: result.errors.length, bg: '#DC262612' },
        ].map(({ icon, label, value, bg }) => (
          <View
            key={label}
            className="flex-1 rounded-2xl py-3 items-center gap-1"
            style={{ backgroundColor: bg, borderCurve: 'continuous' }}
          >
            {icon}
            <Text className="text-lg font-bold text-foreground">{value}</Text>
            <Text className="text-xs text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {/* Errors accordion */}
      {result.errors.length > 0 && (
        <View className="border border-destructive/30 rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          <Pressable
            onPress={() => setShowErrors((v) => !v)}
            className="flex-row items-center gap-2 px-4 py-3 active:opacity-70"
            style={{ backgroundColor: '#FEF2F2' }}
          >
            <AlertCircle size={14} color="#DC2626" />
            <Text className="flex-1 text-sm font-semibold text-destructive">
              {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
            </Text>
            {showErrors ? <ChevronUp size={14} color="#DC2626" /> : <ChevronDown size={14} color="#DC2626" />}
          </Pressable>
          {showErrors && (
            <View className="px-4 py-3 gap-2 bg-card">
              {result.errors.map((e, i) => (
                <View key={i} className="flex-row items-start gap-2">
                  <Text className="text-xs text-destructive mt-0.5">•</Text>
                  <Text className="flex-1 text-xs text-destructive leading-5">{e}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View className="gap-3 mt-2">
        <Pressable
          onPress={onImportMore}
          className="py-3 rounded-2xl border border-border items-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-foreground">Import More JSON</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
          className="py-3 rounded-2xl items-center active:opacity-70"
          style={{ backgroundColor: '#1E3A5F' }}
        >
          <Text className="text-sm font-semibold text-white">Done</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Preview / diff card ──────────────────────────────────────────────────────
function DiffPreview({
  rawJson,
  formats,
  knowledge,
  onConfirm,
  onBack,
}: {
  rawJson: string;
  formats:   { id: string; title: string; seed_version: number }[];
  knowledge: { id: string; title: string; seed_version: number }[];
  onConfirm: () => void;
  onBack: () => void;
}) {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(rawJson) as Record<string, unknown>; }
  catch { return null; }

  const incomingFormats:   { id: string; title: string; seed_version: number }[] = Array.isArray(parsed.formats)   ? (parsed.formats   as { id: string; title: string; seed_version: number }[]) : [];
  const incomingKnowledge: { id: string; title: string; seed_version: number }[] = Array.isArray(parsed.knowledge) ? (parsed.knowledge as { id: string; title: string; seed_version: number }[]) : [];

  type DiffEntry = { title: string; action: 'add' | 'update' | 'skip' | 'error'; detail: string };

  const rows: DiffEntry[] = [];
  for (const item of [...incomingFormats, ...incomingKnowledge]) {
    if (!item.id)    { rows.push({ title: item.title ?? '?', action: 'error', detail: 'Missing id' }); continue; }
    if (!item.title) { rows.push({ title: item.id,           action: 'error', detail: 'Missing title' }); continue; }
    const existing = [...formats, ...knowledge].find((e) => e.id === item.id);
    if (!existing) {
      rows.push({ title: item.title, action: 'add', detail: `New — v${item.seed_version ?? 1}` });
    } else if ((item.seed_version ?? 1) > (existing.seed_version ?? 1)) {
      rows.push({ title: item.title, action: 'update', detail: `v${existing.seed_version} → v${item.seed_version}` });
    } else {
      rows.push({ title: item.title, action: 'skip', detail: `Same version (v${existing.seed_version})` });
    }
  }

  const ACTION_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    add:    { color: '#059669', bg: '#05966912', label: 'ADD'    },
    update: { color: '#2563EB', bg: '#2563EB12', label: 'UPDATE' },
    skip:   { color: '#9CA3AF', bg: '#9CA3AF12', label: 'SKIP'   },
    error:  { color: '#DC2626', bg: '#DC262612', label: 'ERROR'  },
  };

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="px-5 py-4 gap-3 pb-20" showsVerticalScrollIndicator={false}>
        {/* Counts */}
        <View className="flex-row gap-2 pb-1">
          {(['add','update','skip','error'] as const).map((a) => {
            const count = rows.filter((r) => r.action === a).length;
            const s = ACTION_STYLE[a];
            return (
              <View key={a} className="flex-1 rounded-xl py-2 items-center" style={{ backgroundColor: s.bg }}>
                <Text className="text-base font-bold" style={{ color: s.color }}>{count}</Text>
                <Text className="text-xs font-medium" style={{ color: s.color }}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Item diff list */}
        {rows.map((row, idx) => {
          const s = ACTION_STYLE[row.action];
          return (
            <View
              key={idx}
              className="flex-row items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: s.bg }}>
                <Text textBreakStrategy="simple" className="text-xs font-bold" style={{ color: s.color }}>{s.label}</Text>
              </View>
              <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{row.title}</Text>
                <Text className="text-xs text-muted-foreground">{row.detail}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Sticky footer */}
      <View className="px-5 pb-8 pt-3 border-t border-border flex-row gap-3 bg-background">
        <Pressable
          onPress={onBack}
          className="flex-1 py-3 rounded-2xl border border-border items-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-foreground">Back</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={rows.filter((r) => r.action !== 'error').length === 0}
          className="flex-1 py-3 rounded-2xl items-center active:opacity-70"
          style={{
            backgroundColor: rows.filter((r) => r.action !== 'error').length > 0 ? '#1E3A5F' : '#9CA3AF',
          }}
        >
          <Text className="text-sm font-semibold text-white">
            Confirm Import ({rows.filter((r) => r.action !== 'skip' && r.action !== 'error').length} changes)
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ImportSeedScreen() {
  const store = useDevSeedStore();

  const [step,       setStep      ] = useState<Step>('paste');
  const [rawJson,    setRawJson   ] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing,  setImporting ] = useState(false);
  const [result,     setResult    ] = useState<ImportResult | null>(null);

  // ── Validate JSON and move to preview ──────────────────────────────────────
  const handleValidate = () => {
    setParseError('');
    if (!rawJson.trim()) {
      setParseError('Please paste a seed JSON payload first.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      setParseError('Invalid JSON — check the syntax and try again.');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      setParseError('Root must be a JSON object (e.g. { "formats": [...] }).');
      return;
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.formats) && !Array.isArray(obj.knowledge)) {
      setParseError('JSON must contain a "formats" or "knowledge" array.');
      return;
    }
    setStep('preview');
  };

  // ── Confirm import ─────────────────────────────────────────────────────────
  const handleConfirm = () => {
    setImporting(true);
    const r = store.importSeedJson(rawJson);
    setResult(r);
    setStep('done');
    setImporting(false);
  };

  // ── Reset for another import ───────────────────────────────────────────────
  const handleImportMore = () => {
    setRawJson('');
    setParseError('');
    setResult(null);
    setStep('paste');
  };

  // ── Header title per step ─────────────────────────────────────────────────
  const headerTitle: Record<Step, string> = {
    paste:   'Import Seed JSON',
    preview: 'Review Changes',
    done:    'Import Result',
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={headerTitle[step]}
        subtitle={
          step === 'paste'   ? 'Paste formats_seed.json or knowledge_seed.json' :
          step === 'preview' ? 'Review before committing changes' :
                               'Changes applied to working copy'
        }
        onBack={() => (step === 'paste' ? router.back() : setStep('paste'))}
      />

      {/* ── Step: Paste ──────────────────────────────────────────────────── */}
      {step === 'paste' && (
        <ScrollView
          contentContainerClassName="px-5 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Instruction card */}
          <View
            className="flex-row items-start gap-3 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: '#F0F9FF', borderCurve: 'continuous' }}
          >
            <FileJson size={16} color="#0891B2" style={{ marginTop: 1 }} />
            <View className="flex-1 gap-1">
              <Text className="text-sm font-semibold" style={{ color: '#0891B2' }}>How to import</Text>
              <Text className="text-xs leading-5" style={{ color: '#0369A1' }}>
                1. Export seed JSON from another build or the Seed Manager.{'\n'}
                2. Copy the full JSON text.{'\n'}
                3. Paste it in the field below.{'\n'}
                4. Review the diff before confirming.
              </Text>
            </View>
          </View>

          {/* Warning */}
          <View className="flex-row items-start gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
            <AlertTriangle size={12} color="#92400E" style={{ marginTop: 1 }} />
            <Text className="flex-1 text-xs leading-5" style={{ color: '#92400E' }}>
              Only System Content is affected. User records are never modified. Newer versions overwrite older ones.
            </Text>
          </View>

          {/* JSON text area */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Paste JSON here
            </Text>
            <TextInput
              value={rawJson}
              onChangeText={(v) => { setRawJson(v); setParseError(''); }}
              placeholder={'{\n  "formats": [...]\n}\nor\n{\n  "knowledge": [...]\n}'}
              placeholderTextColor="#9CA3AF"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
              className="border border-border rounded-xl px-4 py-3 text-xs text-foreground bg-card font-mono"
              style={{ borderCurve: 'continuous', minHeight: 220 }}
            />
          </View>

          {/* Parse error */}
          {parseError ? (
            <View className="flex-row items-start gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#FEF2F2' }}>
              <AlertCircle size={13} color="#DC2626" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-sm text-destructive">{parseError}</Text>
            </View>
          ) : null}

          {/* Validate button */}
          <Pressable
            onPress={handleValidate}
            disabled={!rawJson.trim()}
            className="py-3.5 rounded-2xl items-center flex-row justify-center gap-2 active:opacity-70"
            style={{ backgroundColor: rawJson.trim() ? '#1E3A5F' : '#9CA3AF' }}
          >
            <Upload size={16} color="#fff" />
            <Text className="text-sm font-semibold text-white">Validate &amp; Preview</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Step: Preview diff ────────────────────────────────────────────── */}
      {step === 'preview' && !importing && (
        <DiffPreview
          rawJson={rawJson}
          formats={store.formats}
          knowledge={store.knowledge}
          onConfirm={handleConfirm}
          onBack={() => setStep('paste')}
        />
      )}

      {importing && (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator />
          <Text className="text-sm text-muted-foreground">Importing…</Text>
        </View>
      )}

      {/* ── Step: Done ────────────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <SummaryCard
          result={result}
          onDone={() => router.back()}
          onImportMore={handleImportMore}
        />
      )}
    </View>
  );
}
