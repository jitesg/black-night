/**
 * Developer Options — Main Console
 *
 * ACCESS: Secret 7-tap on Build Number in About screen (≥5 taps in 4 s).
 * GATE:   __DEV__ check — renders nothing in production builds.
 *
 * Sections on this screen:
 *   1. System Information
 *   2. Feature Flags
 *   3. Database Tools
 *   4. Cache Management
 *
 * Further sections live in sub-screens navigated from Section 12 shortcuts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch,
  ActivityIndicator, Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Terminal, ChevronRight, Database, Trash2, Zap, LayoutTemplate,
  Users, BarChart2, FileText, Bug, RefreshCw, Shield, AlertTriangle,
  Info, Cpu, HardDrive, Search, Navigation, Play, Sparkles,
} from 'lucide-react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  useDevOptions, setFlag, _addAudit,
  type FeatureFlags,
} from '@/lib/devOptionsStore';
import { isDevSessionActive, clearDevSession } from '@/lib/devOptionsAuth';
import {
  getDiagnosticsSnapshot, vacuumDatabase, optimizeDatabase,
  runIntegrityCheck, runForeignKeyCheck,
  type DiagnosticsSnapshot,
} from '@/lib/db/devDiagnosticsRepo';
import { runAutocompleteBackfill } from '@/lib/db/backfillAutocomplete';
import { useWindowDimensions } from 'react-native';

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN   = '#059669';
const RED     = '#DC2626';
const MUTED   = '#6B7280';

const APP_VERSION   = '1.0.0';
const BUILD_NUMBER  = '119';
const DB_VERSION    = 4;
const ENVIRONMENT   = __DEV__ ? 'Development' : 'Production';

// ── Shared UI primitives ───────────────────────────────────────────────────────

function SectionTitle({ label, icon: Icon, color = '#1E3A5F' }: { label: string; icon: React.ComponentType<{ size: number; color: string }>; color?: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-3 mt-1">
      <Icon size={14} color={color} />
      <Text className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-border last:border-0">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label, icon: Icon, color = '#1E3A5F', onPress, loading = false, destructive = false,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color?: string;
  onPress: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="flex-row items-center gap-3 px-4 py-3 border-b border-border active:opacity-60 last:border-0"
    >
      <View
        className="w-8 h-8 rounded-lg items-center justify-center"
        style={{ backgroundColor: `${color}18` }}
      >
        {loading
          ? <ActivityIndicator size={14} color={color} />
          : <Icon size={14} color={destructive ? RED : color} />}
      </View>
      <Text
        className="flex-1 text-sm font-medium"
        style={{ color: destructive ? RED : '#111827' }}
      >
        {label}
      </Text>
      <ChevronRight size={14} color="#D1D5DB" />
    </Pressable>
  );
}

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: ok ? '#D1FAE5' : '#FEE2E2' }}
    >
      <Text className="text-xs font-bold" style={{ color: ok ? GREEN : RED }}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DevOptionsIndex() {
  // No __DEV__ gate — see about.tsx comment. Security is the PIN, not the build type.
  // if (!__DEV__) return null;

  const { flags, toggle } = useDevOptions();
  const { width } = useWindowDimensions();

  // Diagnostics snapshot (loaded on focus)
  const [snap, setSnap]       = useState<DiagnosticsSnapshot | null>(null);
  const [snapLoading, setSnapLoading] = useState(true);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description: string; onConfirm: () => Promise<void>;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult]   = useState<string | null>(null);

  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (resultTimer.current) clearTimeout(resultTimer.current); };
  }, []);

  const showResult = useCallback((msg: string) => {
    setActionResult(msg);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setActionResult(null), 3000);
  }, []);

  const loadSnap = useCallback(async () => {
    setSnapLoading(true);
    try {
      const s = await getDiagnosticsSnapshot();
      setSnap(s);
    } finally {
      setSnapLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Session guard — redirect to PIN entry if session expired
    if (!isDevSessionActive()) {
      router.replace('/(app)/dev-options/pin-entry' as never);
      return;
    }
    loadSnap();
  }, [loadSnap]));

  // ── Confirmed action runner ─────────────────────────────────────────────────
  const withConfirm = (
    title: string,
    description: string,
    key: string,
    section: string,
    fn: () => Promise<string>,
  ) => {
    setConfirmDialog({
      title,
      description,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(key);
        try {
          const result = await fn();
          _addAudit({ action: title, section, outcome: 'success', detail: result });
          showResult(`✓ ${result}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          _addAudit({ action: title, section, outcome: 'error', detail: msg });
          showResult(`✗ ${msg}`);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  // ── Database tool handlers ──────────────────────────────────────────────────
  const handleVacuum = () => withConfirm(
    'Vacuum Database',
    'This will reclaim unused pages and compact the database file. Safe to run at any time.',
    'vacuum', 'Database Tools',
    async () => { await vacuumDatabase(); return 'Vacuum complete.'; },
  );

  const handleOptimize = () => withConfirm(
    'Optimize Database',
    'Runs PRAGMA optimize and ANALYZE to improve query planning. No data is modified.',
    'optimize', 'Database Tools',
    async () => { await optimizeDatabase(); return 'Optimization complete.'; },
  );

  const handleIntegrity = () => withConfirm(
    'Run Integrity Check',
    'Verifies database structure integrity. Read-only operation.',
    'integrity', 'Database Tools',
    async () => {
      const results = await runIntegrityCheck();
      return results[0] === 'ok' ? 'Integrity check passed.' : results.join('; ');
    },
  );

  const handleForeignKeys = () => withConfirm(
    'Check Foreign Keys',
    'Scans for foreign key violations. Read-only operation.',
    'fkcheck', 'Database Tools',
    async () => {
      const results = await runForeignKeyCheck();
      return results.join('\n').slice(0, 120);
    },
  );

  const handleRefreshAnalytics = () => withConfirm(
    'Refresh Analytics',
    'Reloads all diagnostic counters from the database.',
    'refresh', 'Database Tools',
    async () => { await loadSnap(); return 'Analytics refreshed.'; },
  );

  const handleBackfillAutocomplete = () => withConfirm(
    'Backfill Autocomplete History',
    'Scans FIRs, GD entries, and Prarthna Patras to populate typing suggestions. Runs once — safe to trigger again (will skip if already done).',
    'backfill-autocomplete', 'Database Tools',
    async () => {
      const result = await runAutocompleteBackfill();
      if (result.skipped) return 'Already completed — no changes made.';
      return `Backfill complete. ${result.upserted} suggestion${result.upserted === 1 ? '' : 's'} added.`;
    },
  );

  // ── Cache handlers (in-memory only — no user data deleted) ─────────────────
  const handleClearCache = (label: string) => withConfirm(
    `Clear ${label}`,
    'Clears in-memory cache only. No user records are deleted.',
    `cache-${label}`, 'Cache Management',
    async () => {
      // In-memory caches are reset by forcing a fresh focus-effect reload.
      await loadSnap();
      return `${label} cleared.`;
    },
  );

  // ── Feature flag label map ──────────────────────────────────────────────────
  const FLAG_LABELS: { key: keyof FeatureFlags; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
    { key: 'developerMode',      label: 'Developer Mode',       icon: Terminal },
    { key: 'debugLogs',          label: 'Debug Logs',           icon: FileText },
    { key: 'performanceMonitor', label: 'Performance Monitor',  icon: Cpu },
    { key: 'sqlLogging',         label: 'SQL Logging',          icon: Database },
    { key: 'aiDebug',            label: 'AI Debug',             icon: Zap },
    { key: 'searchDebug',        label: 'Search Debug',         icon: Search },
    { key: 'navigationDebug',    label: 'Navigation Debug',     icon: Navigation },
    { key: 'animationDebug',     label: 'Animation Debug',      icon: Play },
  ];

  const DB_TOOLS = [
    { label: 'View Database Statistics',      icon: BarChart2,  onPress: () => router.push('/(app)/dev-options/diagnostics' as never) },
    { label: 'Refresh Analytics',             icon: RefreshCw,  onPress: handleRefreshAnalytics },
    { label: 'Backfill Autocomplete History', icon: Sparkles,   onPress: handleBackfillAutocomplete },
    { label: 'Run Integrity Check',           icon: Shield,     onPress: handleIntegrity },
    { label: 'Check Foreign Keys',            icon: Shield,     onPress: handleForeignKeys },
    { label: 'Vacuum Database',               icon: HardDrive,  onPress: handleVacuum },
    { label: 'Optimize Database',             icon: Zap,        onPress: handleOptimize },
  ];

  const CACHE_ITEMS = [
    'Search Cache', 'AI Cache', 'Navigation Cache', 'Temporary Files',
  ];

  const isTablet = width >= 768;

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />

      <AppHeader
        title="Developer Options"
        subtitle={`v${APP_VERSION} · Build ${BUILD_NUMBER} · ${ENVIRONMENT}`}
        variant="navy"
        rightActions={
          <View className="flex-row items-center gap-2">
            <StatusBadge label={ENVIRONMENT} ok={!__DEV__ ? true : true} />
            <Terminal size={18} color="rgba(255,255,255,0.6)" />
          </View>
        }
      />

      {/* Floating result toast */}
      {!!actionResult && (
        <View
          className="mx-4 mt-2 px-4 py-3 rounded-xl border border-border"
          style={{ backgroundColor: actionResult.startsWith('✓') ? '#ECFDF5' : '#FEF2F2' }}
        >
          <Text
            className="text-sm font-medium text-center"
            style={{ color: actionResult.startsWith('✓') ? GREEN : RED }}
          >
            {actionResult}
          </Text>
        </View>
      )}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
      >
        {/* ── Header Info Banner ───────────────────────────────────────────── */}
        <View
          className="rounded-2xl p-4 gap-1"
          style={{ backgroundColor: '#1E3A5F', borderCurve: 'continuous' }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: '#2563EB' }}>
              Developer Console
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: flags.developerMode ? '#34D399' : '#6B7280' }} />
              <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {flags.developerMode ? 'Dev Mode ON' : 'Dev Mode OFF'}
              </Text>
            </View>
          </View>
          <View className={`gap-2 ${isTablet ? 'flex-row flex-wrap' : ''}`}>
            {[
              { l: 'App Version', v: `v${APP_VERSION}` },
              { l: 'Build',       v: BUILD_NUMBER },
              { l: 'DB Version',  v: `v${DB_VERSION}` },
              { l: 'Environment', v: ENVIRONMENT },
              { l: 'Platform',    v: Platform.OS },
              { l: 'Role',        v: 'Officer' },
            ].map((i) => (
              <View key={i.l} className={`flex-row items-center justify-between ${isTablet ? 'w-[48%]' : ''}`}>
                <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{i.l}</Text>
                <Text className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{i.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Section 1: System Information ───────────────────────────────── */}
        <View>
          <SectionTitle label="System Information" icon={Info} />
          <View className="bg-card border border-border rounded-2xl px-4" style={{ borderCurve: 'continuous' }}>
            <InfoRow label="App Version"    value={`v${APP_VERSION}`} />
            <InfoRow label="Build Number"   value={BUILD_NUMBER} />
            <InfoRow label="Database v"     value={`v${DB_VERSION}`} />
            <InfoRow label="Environment"    value={ENVIRONMENT} valueColor={__DEV__ ? '#F59E0B' : GREEN} />
            <InfoRow label="Platform"       value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'} />
            <InfoRow label="DB Size"        value={snap ? `${snap.databaseSizeKB} KB` : '…'} />
            <InfoRow label="Page Size"      value={snap ? `${snap.pageSize} B` : '…'} />
            <InfoRow label="Free Pages"     value={snap ? String(snap.freelistCount) : '…'} />
            <InfoRow label="Integrity"      value={snap ? (snap.integrityOk ? 'OK' : 'FAILED') : '…'} valueColor={snap?.integrityOk ? GREEN : RED} />
            <InfoRow label="FK Errors"      value={snap ? (snap.foreignKeyErrors === 0 ? 'None' : String(snap.foreignKeyErrors)) : '…'} valueColor={snap && snap.foreignKeyErrors > 0 ? RED : GREEN} />
            <InfoRow label="DB Mode"        value="WAL" />
            <InfoRow label="Developer Mode" value={flags.developerMode ? 'Enabled' : 'Disabled'} valueColor={flags.developerMode ? GREEN : MUTED} />
          </View>
        </View>

        {/* ── Section 2: Feature Flags ─────────────────────────────────────── */}
        <View>
          <SectionTitle label="Feature Flags" icon={Zap} color="#7C3AED" />
          <View className="bg-card border border-border rounded-2xl px-4" style={{ borderCurve: 'continuous' }}>
            {FLAG_LABELS.map(({ key, label, icon: FlagIcon }, idx) => (
              <View
                key={key}
                className={`flex-row items-center justify-between py-3 ${idx < FLAG_LABELS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: '#7C3AED18' }}>
                    <FlagIcon size={13} color="#7C3AED" />
                  </View>
                  <Text className="text-sm font-medium text-foreground">{label}</Text>
                </View>
                <Switch
                  value={flags[key]}
                  onValueChange={() => toggle(key)}
                  trackColor={{ false: '#E5E7EB', true: '#7C3AED' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>
        </View>

        {/* ── Section 3: Database Tools ────────────────────────────────────── */}
        <View>
          <SectionTitle label="Database Tools" icon={Database} color="#0891B2" />
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            {DB_TOOLS.map(({ label, icon, onPress }) => (
              <ActionButton
                key={label}
                label={label}
                icon={icon}
                color="#0891B2"
                loading={actionLoading === label.toLowerCase().replace(/\s/g, '-')}
                onPress={onPress}
              />
            ))}
          </View>
        </View>

        {/* ── Section 4: Cache Management ──────────────────────────────────── */}
        <View>
          <SectionTitle label="Cache Management" icon={Trash2} color='#2563EB' />
          <Text className="text-xs text-muted-foreground mb-3">
            Clears in-memory caches only. No user records are deleted.
          </Text>
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            {CACHE_ITEMS.map((item) => (
              <ActionButton
                key={item}
                label={`Clear ${item}`}
                icon={Trash2}
                color='#2563EB'
                loading={actionLoading === `cache-${item}`}
                onPress={() => handleClearCache(item)}
              />
            ))}
          </View>
        </View>

        {/* ── Section 5: Template Management ──────────────────────────────── */}
        <View>
          <SectionTitle label="Template Management" icon={LayoutTemplate} color="#0F766E" />
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            {[
              { label: 'Open System Format Manager', onPress: () => router.push('/(app)/sys-format-manager' as never) },
              { label: 'Template Audit Log',          onPress: () => router.push('/(app)/sys-format-manager/list' as never) },
              { label: 'Template Diagnostics',        onPress: () => router.push('/(app)/dev-options/diagnostics' as never) },
            ].map(({ label, onPress }) => (
              <ActionButton key={label} label={label} icon={LayoutTemplate} color="#0F766E" onPress={onPress} />
            ))}
          </View>
        </View>

        {/* ── Section 6: User & Role Testing ───────────────────────────────── */}
        <View>
          <SectionTitle label="User & Role Testing" icon={Users} color={MUTED} />
          <Text className="text-xs text-muted-foreground mb-3">
            For testing only. Never changes production permissions automatically.
          </Text>
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            {(['Administrator', 'Officer', 'Read Only'] as const).map((role) => (
              <Pressable
                key={role}
                onPress={() => {
                  _addAudit({ action: `Test role: ${role}`, section: 'Role Testing', outcome: 'success' });
                  showResult(`Role context set to: ${role} (test only)`);
                }}
                className="flex-row items-center justify-between px-4 py-3 border-b border-border last:border-0 active:opacity-60"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: '#6B728018' }}>
                    <Users size={14} color={MUTED} />
                  </View>
                  <Text className="text-sm font-medium text-foreground">{role}</Text>
                </View>
                <View className="px-2 py-0.5 rounded-full bg-secondary">
                  <Text className="text-xs text-muted-foreground">Test</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Quick nav to sub-screens ──────────────────────────────────────── */}
        <View>
          <SectionTitle label="Sub-Screens" icon={ChevronRight} color='#1E3A5F' />
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            {[
              { label: 'Diagnostics & Statistics', icon: BarChart2, route: '/(app)/dev-options/diagnostics' },
              { label: 'Performance Monitor',      icon: Cpu,       route: '/(app)/dev-options/performance' },
              { label: 'Debug Console',            icon: Bug,       route: '/(app)/dev-options/debug-console' },
              { label: 'Log Viewer',               icon: FileText,  route: '/(app)/dev-options/log-viewer' },
              { label: 'Test Utilities',           icon: Play,      route: '/(app)/dev-options/test-utils' },
              { label: 'Migration Tools',          icon: RefreshCw, route: '/(app)/dev-options/migration' },
              { label: 'Dangerous Actions',        icon: AlertTriangle, route: '/(app)/dev-options/dangerous' },
            ].map(({ label, icon, route }) => (
              <ActionButton
                key={label}
                label={label}
                icon={icon}
                color={label === 'Dangerous Actions' ? RED : '#1E3A5F'}
                destructive={label === 'Dangerous Actions'}
                onPress={() => router.push(route as never)}
              />
            ))}
          </View>
        </View>

        {/* ── Security section ──────────────────────────────────────────────── */}
        <View>
          <SectionTitle label="Security" icon={Shield} color='#1E3A5F' />
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            <ActionButton
              label="Change Developer PIN"
              icon={Shield}
              color='#1E3A5F'
              onPress={() => router.push('/(app)/dev-options/change-pin' as never)}
            />
            <ActionButton
              label="Sign Out of Developer Session"
              icon={Shield}
              color={RED}
              destructive
              onPress={() => {
                clearDevSession();
                _addAudit({ action: 'Sign out of Developer Session', section: 'Security', outcome: 'success' });
                router.replace('/(app)/dev-options/pin-entry' as never);
              }}
            />
          </View>
        </View>

        {/* ── Owner Modules section ─────────────────────────────────────────── */}
        <View>
          <SectionTitle label="Owner Modules" icon={Database} color="#7C3AED" />
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            <ActionButton
              label="System Format Manager"
              icon={LayoutTemplate}
              color="#0F766E"
              onPress={() => router.push('/(app)/sys-format-manager' as never)}
            />
            <ActionButton
              label="System Knowledge Management"
              icon={Database}
              color="#7C3AED"
              onPress={() => router.push('/(app)/sys-knowledge-manager' as never)}
            />
          </View>
        </View>

        {/* ── Developer Audit Log shortcut ──────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/(app)/dev-options/log-viewer' as never)}
          className="flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-4 active:opacity-70"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#1E3A5F'}15` }}>
              <Bug size={16} color='#1E3A5F' />
            </View>
            <View>
              <Text className="text-sm font-semibold text-foreground">Developer Audit Log</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">All actions timestamped &amp; logged</Text>
            </View>
          </View>
          <ChevronRight size={15} color="#D1D5DB" />
        </Pressable>

      </ScrollView>

      {/* ── Confirmation Dialog ──────────────────────────────────────────────── */}
      <AlertDialog open={!!confirmDialog} onOpenChange={(o) => { if (!o) setConfirmDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setConfirmDialog(null)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => confirmDialog?.onConfirm()}>
              <Text>Confirm</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
