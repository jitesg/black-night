import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { View, Text, Pressable, ActivityIndicator, TextInput, ScrollView, Modal, KeyboardAvoidingView } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import {
  Plus, CheckCircle2, Circle, Trash2, AlertTriangle, ChevronRight,
  Info, BookOpen, ChevronDown, ChevronUp, Ban, Pause,
  PlayCircle, Lock, CalendarDays, Search, X, ListChecks,
} from 'lucide-react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getKaryvahiByFIR, deleteKaryvahi, updateKaryvahiStatus, updateKaryvahiQueuedFlag,
  nextKaryvahiInstanceId,
  type FIRKaryvahi, type KaryvahiPriority, type KaryvahiStatus,
} from '@/lib/db/firKaryvahiRepo';
import { getConditionsForFIR, type ActionCondition } from '@/lib/db/actionConditionsRepo';
import {
  getCaseDiariesByFIR, createCaseDiary, getNextDiaryNumber,
  getKaryvahiTimelineForFIR,
  type CaseDiary, type KaryvahiTimelineEntry,
} from '@/lib/db/caseDiaryRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useFIRContext } from '@/context/FIRContext';
import { THEME } from '@/lib/theme';
import { matchDefaultKaryvahi } from '@/lib/karyvahiNames';
import { getDefaultKnowledge } from '@/lib/defaultKaryvahiKnowledge';

type FilterMode = 'all' | 'pending' | 'completed';
type ActiveView = 'general' | 'diary';

// ── Semantic colours helper ───────────────────────────────────────────────────
type SemanticKey = KaryvahiPriority | 'COMPLETED_STATUS' | 'IN_PROGRESS_STATUS' | 'PENDING_STATUS';
type SemanticColor = { fg: string; bg: string; border: string };

function getSemanticColors(scheme: 'light' | 'dark'): Record<SemanticKey, SemanticColor> {
  const dark = scheme === 'dark';
  return {
    MANDATORY:         { fg: dark ? '#F87171' : '#DC2626', bg: dark ? '#F871711A' : '#FEF2F2', border: dark ? '#F8717140' : '#FECACA' },
    CONDITIONAL:       { fg: dark ? '#FBBF24' : '#D97706', bg: dark ? '#FBBF241A' : '#FFFBEB', border: dark ? '#FBBF2440' : '#FDE68A' },
    RECOMMENDED:       { fg: dark ? '#4ADE80' : '#16A34A', bg: dark ? '#4ADE801A' : '#F0FDF4', border: dark ? '#4ADE8040' : '#BBF7D0' },
    COMPLETED_STATUS:  { fg: dark ? '#4ADE80' : '#16A34A', bg: dark ? '#4ADE801A' : '#F0FDF4', border: dark ? '#4ADE8040' : '#BBF7D0' },
    IN_PROGRESS_STATUS:{ fg: dark ? '#60A5FA' : '#2563EB', bg: dark ? '#60A5FA1A' : '#EFF6FF', border: dark ? '#60A5FA40' : '#BFDBFE' },
    PENDING_STATUS:    { fg: dark ? '#94A3B8' : '#6B7280', bg: dark ? '#94A3B81A' : '#F9FAFB', border: dark ? '#334155'   : '#E5E7EB' },
  };
}

// ── Priority config — labels and emoji ───────────────────────────────────────
const PRIORITY_CONFIG: Record<KaryvahiPriority, { label: string; emoji: string }> = {
  MANDATORY:    { label: 'Mandatory',    emoji: '🔴' },
  CONDITIONAL:  { label: 'Conditional',  emoji: '🟡' },
  RECOMMENDED:  { label: 'Recommended',  emoji: '🟢' },
};

// ── Status config — icon is a factory fn taking dynamic color ────────────────
const STATUS_CONFIG: Record<KaryvahiStatus, { label: string; icon: (color: string) => React.ReactNode }> = {
  PENDING:        { label: 'Pending',        icon: (c) => <Circle       size={12} color={c} /> },
  IN_PROGRESS:    { label: 'In Progress',    icon: (c) => <PlayCircle   size={12} color={c} /> },
  COMPLETED:      { label: 'Completed',      icon: (c) => <CheckCircle2 size={12} color={c} /> },
  NOT_APPLICABLE: { label: 'Not Applicable', icon: (c) => <Ban          size={12} color={c} /> },
  DEFERRED:       { label: 'Deferred',       icon: (c) => <Pause        size={12} color={c} /> },
};

function getStatusColor(status: KaryvahiStatus, sem: Record<SemanticKey, SemanticColor>): SemanticColor {
  switch (status) {
    case 'COMPLETED':
      return sem.COMPLETED_STATUS;
    case 'IN_PROGRESS':
      return sem.IN_PROGRESS_STATUS;
    case 'PENDING':
    default:
      return sem.PENDING_STATUS;
  }
}

const STATUS_ORDER: KaryvahiStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// ── Reusable presentational card component ────────────────────────────────────
function KaryvahiRowCard({
  leftAccentColor,
  title,
  subtitle,
  statusSlot,
  badgeSlot,
  footerSlot,
  bannerSlot,
  onPress,
  dimmed,
}: {
  leftAccentColor: string;
  title: string;
  subtitle?: React.ReactNode;
  statusSlot?: React.ReactNode;
  badgeSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  bannerSlot?: React.ReactNode;
  onPress: () => void;
  dimmed?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      className={`bg-card border border-border rounded-2xl mb-2.5 px-3.5 py-3 active:opacity-70 ${dimmed ? 'opacity-60' : ''}`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: leftAccentColor,
        borderCurve: 'continuous',
        ...(isDark ? {} : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }),
      }}
    >
      {bannerSlot && <View className="mb-2">{bannerSlot}</View>}

      <View className="flex-row items-start justify-between gap-2.5">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={2}>
              {title}
            </Text>
            {badgeSlot}
          </View>
          {subtitle}
        </View>

        {statusSlot && (
          <View className="items-end justify-start flex-shrink-0">
            {statusSlot}
          </View>
        )}
      </View>

      {footerSlot && (
        <View className="mt-2.5 pt-2.5 border-t border-border">
          {footerSlot}
        </View>
      )}
    </Pressable>
  );
}

// ── Execution info modal content ──────────────────────────────────────────────
function ExecutionInfoContent({ item }: { item: FIRKaryvahi }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const sem = getSemanticColors(colorScheme ?? 'light');
  const count = item.execution_count ?? 0;
  return (
    <View className="gap-3">
      <Text className="text-sm text-foreground leading-6">
        {count === 0
          ? t('fir.karyvahi.executionInfo_zero')
          : count === 1
            ? t('fir.karyvahi.executionInfo_one')
            : t('fir.karyvahi.executionInfo_other', { count })}
      </Text>
      {count > 1 && (
        <View
          className="flex-row items-start gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: sem.CONDITIONAL.bg, borderWidth: 1, borderColor: sem.CONDITIONAL.border }}
        >
          <AlertTriangle size={13} color={sem.CONDITIONAL.fg} style={{ marginTop: 1 }} />
          <Text className="text-xs flex-1" style={{ color: sem.CONDITIONAL.fg }}>
            {t('fir.karyvahi.executionMultiWarning', { count })}
          </Text>
        </View>
      )}
      <Text className="text-xs text-muted-foreground">
        {t('fir.karyvahi.completionAutoNote')}
      </Text>
    </View>
  );
}

// ── StatusDropdown — Modal-anchored with theme tokens & index-based borders ───
function StatusDropdown({
  current,
  onSelect,
}: {
  current: KaryvahiStatus;
  onSelect: (s: KaryvahiStatus) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [anchor, setAnchor]   = useState({ x: 0, y: 0, w: 0, h: 0 });
  const triggerRef            = useRef<View>(null);
  const { colorScheme }       = useColorScheme();
  const isDark                = colorScheme === 'dark';
  const c                     = THEME[colorScheme ?? 'light'];
  const sem                   = getSemanticColors(colorScheme ?? 'light');

  const cfg = STATUS_CONFIG[current] ?? STATUS_CONFIG.PENDING;
  const statusColor = getStatusColor(current, sem);

  const openDropdown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    triggerRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setAnchor({ x: px, y: py, w: width, h: height });
      setOpen(true);
    });
  };

  const PANEL_WIDTH = 160;
  const panelLeft   = anchor.x + anchor.w - PANEL_WIDTH;
  const panelTop    = anchor.y + anchor.h + 4;

  return (
    <View>
      <Pressable
        ref={triggerRef}
        onPress={openDropdown}
        className="flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 border border-border active:opacity-70 bg-secondary"
        hitSlop={6}
      >
        {cfg.icon(statusColor.fg)}
        <Text className="text-xs font-semibold" style={{ color: statusColor.fg }}>{cfg.label}</Text>
        {open ? <ChevronUp size={11} color={c.mutedForeground} /> : <ChevronDown size={11} color={c.mutedForeground} />}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: panelLeft,
              top: panelTop,
              width: PANEL_WIDTH,
              backgroundColor: c.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              ...(isDark ? {} : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.10,
                shadowRadius: 12,
                elevation: 8,
              }),
            }}
          >
            {STATUS_ORDER.map((s, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === STATUS_ORDER.length - 1;
              const sCfg = STATUS_CONFIG[s];
              const sColor = getStatusColor(s, sem);
              return (
                <Pressable
                  key={s}
                  onPress={(e) => { e.stopPropagation(); setOpen(false); onSelect(s); }}
                  className="flex-row items-center gap-2 px-3 py-2.5 active:bg-secondary"
                  style={{
                    borderBottomWidth: !isLast ? 0.5 : 0,
                    borderBottomColor: c.border,
                    borderTopLeftRadius: isFirst ? 12 : 0,
                    borderTopRightRadius: isFirst ? 12 : 0,
                    borderBottomLeftRadius: isLast ? 12 : 0,
                    borderBottomRightRadius: isLast ? 12 : 0,
                  }}
                >
                  {sCfg.icon(sColor.fg)}
                  <Text className="text-xs font-medium" style={{ color: sColor.fg }}>{sCfg.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Reason modal (for N.A. / Deferred) ────────────────────────────────────────
function ReasonModal({
  visible,
  statusLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  statusLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  useEffect(() => { if (visible) setReason(''); }, [visible]);
  if (!visible) return null;
  return (
    <AlertDialog open={visible} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
          style={{ width: '100%' }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Reason Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for marking this action as "{statusLabel}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason…"
            multiline
            numberOfLines={3}
            className="border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-card"
            style={{ minHeight: 72, textAlignVertical: 'top' }}
            placeholderTextColor={c.mutedForeground}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onPress={onCancel}><Text>Cancel</Text></AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { if (reason.trim()) onConfirm(reason.trim()); }}
              disabled={!reason.trim()}
            >
              <Text>Confirm</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </KeyboardAvoidingView>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Karyvahi card (General tab) ───────────────────────────────────────────────
function KaryvahiCard({
  item,
  firId,
  diaries,
  onDelete,
  onCircleInfo,
  onStatusChange,
  onQueueToggle,
  blockerName,
}: {
  item: FIRKaryvahi;
  firId: string;
  diaries: CaseDiary[];
  onDelete: (id: string) => void;
  onCircleInfo: (item: FIRKaryvahi) => void;
  onStatusChange: (item: FIRKaryvahi, newStatus: KaryvahiStatus) => void;
  onQueueToggle: (item: FIRKaryvahi) => void;
  blockerName?: string;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const sem = getSemanticColors(colorScheme ?? 'light');

  const count        = item.execution_count ?? 0;
  const done         = count > 0;
  const multipleExec = count > 1;
  const locked       = (item.is_locked ?? 0) === 1 && !done;
  const status: KaryvahiStatus = done ? 'COMPLETED' : ((item.status as KaryvahiStatus) ?? 'PENDING');
  const priority     = (item.priority as KaryvahiPriority) ?? 'MANDATORY';
  const queued       = (item.queued_for_diary ?? 0) === 1;

  const defKey       = matchDefaultKaryvahi(item.name);
  const defKnowledge = defKey ? getDefaultKnowledge(defKey) : null;
  const subtitleWhat = defKnowledge?.what;

  const leftAccentColor = multipleExec
    ? sem.CONDITIONAL.fg
    : done
      ? sem.COMPLETED_STATUS.fg
      : sem[priority].fg;

  const diaryNumber = useMemo(() => {
    if (!done || !item.completed_by_diary_id) return null;
    const idx = diaries.findIndex((d) => d.id === item.completed_by_diary_id);
    return idx >= 0 ? idx + 1 : null;
  }, [done, item.completed_by_diary_id, diaries]);

  const banner = locked ? (
    <View
      className="flex-row items-center gap-1.5 rounded-lg px-2.5 py-1"
      style={{ backgroundColor: c.secondary }}
    >
      <Lock size={12} color={c.mutedForeground} />
      <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
        {blockerName
          ? t('fir.karyvahi.lockedWaiting', { name: blockerName })
          : t('fir.karyvahi.locked')}
      </Text>
    </View>
  ) : undefined;

  const badge = count > 0 ? (
    <View
      className="rounded-full items-center justify-center px-2.5 py-1"
      style={{
        backgroundColor: multipleExec ? sem.CONDITIONAL.bg : sem.COMPLETED_STATUS.bg,
        borderWidth: 1,
        borderColor: multipleExec ? sem.CONDITIONAL.border : sem.COMPLETED_STATUS.border,
      }}
    >
      <Text textBreakStrategy="simple"
        className="text-xs font-bold"
        style={{ color: multipleExec ? sem.CONDITIONAL.fg : sem.COMPLETED_STATUS.fg }}
      >
        Done ×{count}
      </Text>
    </View>
  ) : undefined;

  const subtitleContent = (
    <View className="gap-0.5">
      {subtitleWhat ? (
        <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
          {subtitleWhat}
        </Text>
      ) : null}
      {done && diaryNumber !== null && (
        <View className="flex-row items-center gap-1 mt-0.5">
          <BookOpen size={11} color={c.mutedForeground} />
          <Text className="text-xs text-muted-foreground">
            {t('fir.karyvahi.performedInDiary', { n: String(diaryNumber).padStart(2, '0') })}
          </Text>
        </View>
      )}

      {multipleExec && (
        <View className="flex-row items-center gap-1 mt-0.5">
          <AlertTriangle size={11} color={sem.CONDITIONAL.fg} />
          <Text className="text-xs font-medium" style={{ color: sem.CONDITIONAL.fg }}>
            {t('fir.karyvahi.performedTimes', { count })}
          </Text>
        </View>
      )}
    </View>
  );

  const statusControl = done ? (
    <View
      className="flex-row items-center gap-1 rounded-lg px-2.5 py-1 border"
      style={{
        backgroundColor: sem.COMPLETED_STATUS.bg,
        borderColor: sem.COMPLETED_STATUS.border,
      }}
    >
      <CheckCircle2 size={13} color={sem.COMPLETED_STATUS.fg} />
      <Text className="text-xs font-semibold" style={{ color: sem.COMPLETED_STATUS.fg }}>
        Completed
      </Text>
    </View>
  ) : (
    <StatusDropdown
      current={status}
      onSelect={(s) => onStatusChange(item, s)}
    />
  );

  const actionsRow = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        {/* Info button */}
        <Pressable
          onPress={(e) => { e.stopPropagation(); onCircleInfo(item); }}
          className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary active:opacity-70"
          hitSlop={6}
        >
          <Info size={13} color={c.mutedForeground} />
          <Text className="text-xs font-medium text-muted-foreground">
            {t('fir.karyvahi.actionInfo')}
          </Text>
        </Pressable>

        {/* Diary button */}
        <Pressable
          onPress={(e) => { e.stopPropagation(); onQueueToggle(item); }}
          className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg active:opacity-70"
          style={{
            backgroundColor: queued ? `${c.primary}18` : c.secondary,
            borderWidth: queued ? 1 : 0,
            borderColor: queued ? `${c.primary}40` : 'transparent',
          }}
          hitSlop={6}
        >
          <View className="relative">
            <BookOpen size={13} color={queued ? c.primary : c.mutedForeground} />
            {queued && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: c.primary,
                }}
              />
            )}
          </View>
          <Text
            className="text-xs font-medium"
            style={{ color: queued ? c.primary : c.mutedForeground }}
          >
            {t('fir.karyvahi.actionDiary')}
          </Text>
        </Pressable>
      </View>

      {/* Delete button (right end, min 24px spacing, low emphasis) */}
      <Pressable
        onPress={(e) => { e.stopPropagation(); onDelete(item.id); }}
        className="p-1.5 rounded-lg active:opacity-70 ml-auto"
        hitSlop={8}
      >
        <Trash2 size={15} color={c.destructive} style={{ opacity: 0.6 }} />
      </Pressable>
    </View>
  );

  return (
    <KaryvahiRowCard
      leftAccentColor={leftAccentColor}
      title={item.name}
      subtitle={subtitleContent}
      statusSlot={statusControl}
      badgeSlot={badge}
      footerSlot={actionsRow}
      bannerSlot={banner}
      dimmed={locked}
      onPress={() => router.push(`/(app)/mukadma/${firId}/karyvahi-detail?karyvahiId=${item.id}` as never)}
    />
  );
}

// ── Radial progress ring ──────────────────────────────────────────────────────
function RadialRing({
  completed, total, color, trackColor, size = 34, stroke = 3,
}: {
  completed: number; total: number; color: string; trackColor: string;
  size?: number; stroke?: number;
}) {
  const pct    = total > 0 ? completed / total : 0;
  const radius = (size - stroke) / 2;
  const circ   = 2 * Math.PI * radius;
  const arc    = pct * circ;
  const cx     = size / 2;
  const cy     = size / 2;
  const pctInt = Math.round(pct * 100);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <SvgCircle cx={cx} cy={cy} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <SvgCircle
          cx={cx} cy={cy} r={radius} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
          rotation={-90} originX={cx} originY={cy}
        />
      </Svg>
      <View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 8, fontWeight: '700', color, lineHeight: 10 }}>{pctInt}%</Text>
      </View>
    </View>
  );
}

function PrioritySection({
  priority, items, firId, diaries, onDelete, onCircleInfo, onStatusChange,
  onQueueToggle, conditions, allItems,
}: {
  priority: KaryvahiPriority;
  items: FIRKaryvahi[];
  firId: string;
  diaries: CaseDiary[];
  onDelete: (id: string) => void;
  onCircleInfo: (item: FIRKaryvahi) => void;
  onStatusChange: (item: FIRKaryvahi, newStatus: KaryvahiStatus) => void;
  onQueueToggle: (item: FIRKaryvahi) => void;
  conditions: ActionCondition[];
  allItems: FIRKaryvahi[];
}) {
  const [expanded, setExpanded] = useState(true);
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const sem = getSemanticColors(colorScheme ?? 'light');

  const cfg = PRIORITY_CONFIG[priority];
  const completedCount = items.filter(
    (i) => (i.status as KaryvahiStatus) === 'COMPLETED' || (i.execution_count ?? 0) > 0
  ).length;

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of allItems) m[it.id] = it.name;
    return m;
  }, [allItems]);

  return (
    <View className="mb-2">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center justify-between py-2 px-3 rounded-xl bg-secondary/60 mb-2 active:opacity-70"
      >
        <View className="flex-row items-center gap-2.5">
          <RadialRing
            completed={completedCount}
            total={items.length}
            color={sem[priority].fg}
            trackColor={sem[priority].bg}
          />
          <Text className="text-sm font-bold" style={{ color: sem[priority].fg }}>
            {cfg.label}
          </Text>
          <Text className="text-xs text-muted-foreground font-medium">
            {completedCount}/{items.length}
          </Text>
        </View>
        {expanded
          ? <ChevronUp size={16} color={c.mutedForeground} />
          : <ChevronDown size={16} color={c.mutedForeground} />}
      </Pressable>
      {expanded && items.map((item) => {
        const blocker = conditions
          .filter((cnd) => cnd.dependent_id === item.id)
          .map((cnd) => nameById[cnd.blocker_id])
          .find(Boolean);
        return (
          <KaryvahiCard
            key={item.id}
            item={item}
            firId={firId}
            diaries={diaries}
            onDelete={onDelete}
            onCircleInfo={onCircleInfo}
            onStatusChange={onStatusChange}
            onQueueToggle={onQueueToggle}
            blockerName={blocker}
          />
        );
      })}
    </View>
  );
}

// ── Diary action sheet (AlertDialog with 2 options) ───────────────────────────
function DiaryActionSheet({
  visible,
  item,
  latestDiary,
  firId,
  onClose,
}: {
  visible: boolean;
  item: FIRKaryvahi | null;
  latestDiary: CaseDiary | null;
  firId: string;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const sem = getSemanticColors(colorScheme ?? 'light');

  const handleAddToExisting = () => {
    if (!item || !latestDiary) return;
    onClose();
    router.push({
      pathname: '/(app)/mukadma/[firId]/add-case-diary-karyvahi' as never,
      params: { firId, diaryId: latestDiary.id, karyvahiId: item.id },
    });
  };

  const handleCreateNew = async () => {
    if (!item || creating) return;
    setCreating(true);
    try {
      await getNextDiaryNumber(firId);
      const today = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })();
      const newDiary = await createCaseDiary({
        fir_id: firId,
        preparation_date: today,
      });
      onClose();
      router.push({
        pathname: '/(app)/mukadma/[firId]/add-case-diary-karyvahi' as never,
        params: { firId, diaryId: newDiary.id, karyvahiId: item.id },
      });
    } catch (e) {
      logger.warn('[DiaryActionSheet] createCaseDiary failed:', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AlertDialog open={visible} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle numberOfLines={2}>{item?.name ?? ''}</AlertDialogTitle>
          <AlertDialogDescription>केस डायरी में दर्ज करने का तरीका चुनें</AlertDialogDescription>
        </AlertDialogHeader>

        {/* Option 1: add to latest diary */}
        <Pressable
          onPress={latestDiary ? handleAddToExisting : undefined}
          className="flex-row items-center gap-3 rounded-xl px-4 py-3 border border-border bg-card active:opacity-70"
          style={{ opacity: latestDiary ? 1 : 0.4 }}
        >
          <View
            className="w-9 h-9 rounded-lg items-center justify-center"
            style={{ backgroundColor: latestDiary ? `${c.primary}18` : c.secondary }}
          >
            <BookOpen size={18} color={latestDiary ? c.primary : c.mutedForeground} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">
              {latestDiary ? 'वर्तमान केस डायरी में जोड़ें' : 'अभी कोई केस डायरी नहीं है'}
            </Text>
            {latestDiary && (
              <Text className="text-xs text-muted-foreground">{latestDiary.preparation_date}</Text>
            )}
          </View>
          {latestDiary && <ChevronRight size={16} color={c.mutedForeground} />}
        </Pressable>

        {/* Option 2: create new diary */}
        <Pressable
          onPress={creating ? undefined : handleCreateNew}
          className="flex-row items-center gap-3 rounded-xl px-4 py-3 border border-border bg-card active:opacity-70"
          style={{ opacity: creating ? 0.5 : 1 }}
        >
          <View
            className="w-9 h-9 rounded-lg items-center justify-center"
            style={{ backgroundColor: sem.COMPLETED_STATUS.bg }}
          >
            {creating
              ? <ActivityIndicator size="small" color={sem.COMPLETED_STATUS.fg} />
              : <Plus size={18} color={sem.COMPLETED_STATUS.fg} />}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">नई केस डायरी बनाएं और जोड़ें</Text>
            <Text className="text-xs text-muted-foreground">आज की तारीख से नई डायरी शुरू होगी</Text>
          </View>
          <ChevronRight size={16} color={c.mutedForeground} />
        </Pressable>

        <AlertDialogFooter>
          <AlertDialogCancel onPress={onClose}><Text>रद्द करें</Text></AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Diary view (activeView === 'diary') ────────────────────────────────────────
function DiaryView({
  firId,
  items,
  diaries,
  timeline,
  onItemPress,
}: {
  firId: string;
  items: FIRKaryvahi[];
  diaries: CaseDiary[];
  timeline: KaryvahiTimelineEntry[];
  onItemPress: (item: FIRKaryvahi) => void;
}) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const sem = getSemanticColors(colorScheme ?? 'light');

  // Section A: queued + not yet completed
  const queued = items.filter(
    (i) =>
      (i.queued_for_diary ?? 0) === 1 &&
      ['PENDING', 'IN_PROGRESS', 'DEFERRED'].includes((i.status as KaryvahiStatus) ?? 'PENDING') &&
      (i.execution_count ?? 0) === 0,
  );

  // Section B: chronological serial numbers then group newest-first
  const { grouped, serialMap } = useMemo(() => {
    const ascending = [...timeline].sort((a, b) => {
      const d = a.preparation_date.localeCompare(b.preparation_date);
      return d !== 0 ? d : (a.sequence_order ?? 0) - (b.sequence_order ?? 0);
    });
    const _serialMap: Record<string, number> = {};
    ascending.forEach((e, idx) => { _serialMap[e.id] = idx + 1; });

    const sortedDiaries = [...diaries].sort((a, b) => a.created_at - b.created_at);
    const cdNumberForDiaryId = (diaryId: string): number => {
      const idx = sortedDiaries.findIndex((d) => d.id === diaryId);
      return idx >= 0 ? idx + 1 : 0;
    };

    const map = new Map<string, { cdNumber: number; entries: KaryvahiTimelineEntry[] }>();
    for (const e of timeline) {
      const key = e.preparation_date;
      if (!map.has(key)) {
        map.set(key, { cdNumber: cdNumberForDiaryId(e.case_diary_id), entries: [] });
      }
      map.get(key)!.entries.push(e);
    }
    return { grouped: Array.from(map.entries()), serialMap: _serialMap };
  }, [timeline, diaries]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
    >
      {/* ── Section A: लंबित कार्यवाही ─────────────────────────────────── */}
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-2">
        लंबित कार्यवाही
      </Text>

      {queued.length === 0 ? (
        <View className="rounded-2xl bg-secondary/50 border border-border px-4 py-5 mb-2">
          <View className="flex-row items-center gap-2 mb-1">
            <BookOpen size={14} color={c.mutedForeground} />
            <Text className="text-sm font-semibold text-muted-foreground">
              कोई चिह्नित कार्यवाही नहीं
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground leading-5">
            {'\'सामान्य कार्यवाही\' में जाकर किसी कार्यवाही को'}
            {' '}
            <Text style={{ color: c.primary, fontWeight: '600' }}>डायरी बटन</Text>
            {' से केस डायरी में जोड़ें'}
          </Text>
        </View>
      ) : (
        queued.map((item) => {
          const priority = (item.priority as KaryvahiPriority) ?? 'MANDATORY';
          const priCfg = PRIORITY_CONFIG[priority];
          const priColor = sem[priority];

          return (
            <KaryvahiRowCard
              key={item.id}
              leftAccentColor={priColor.fg}
              title={item.name}
              badgeSlot={
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: priColor.bg,
                    borderWidth: 1,
                    borderColor: priColor.border,
                  }}
                >
                  <Text textBreakStrategy="simple" className="text-[10px] font-semibold" style={{ color: priColor.fg }}>
                    {priCfg.label}
                  </Text>
                </View>
              }
              statusSlot={
                <View
                  className="w-7 h-7 rounded-lg items-center justify-center"
                  style={{ backgroundColor: `${c.primary}18` }}
                >
                  <BookOpen size={14} color={c.primary} />
                </View>
              }
              onPress={() => onItemPress(item)}
            />
          );
        })
      )}

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <View className="my-4 border-t border-border" />

      {/* ── Section B: दर्ज कार्यवाही ────────────────────────────────────── */}
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
        दर्ज कार्यवाही
      </Text>

      {grouped.length === 0 ? (
        <View className="rounded-2xl bg-secondary/50 border border-border px-4 py-5">
          <View className="flex-row items-center gap-2 mb-1">
            <CalendarDays size={14} color={c.mutedForeground} />
            <Text className="text-sm font-semibold text-muted-foreground">
              अभी तक कोई दर्ज कार्यवाही नहीं
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            केस डायरी में दर्ज की गई कार्यवाहियाँ यहाँ दिखेंगी।
          </Text>
        </View>
      ) : (
        grouped.map(([date, { cdNumber, entries }]) => (
          <View key={date} className="mb-4">
            {/* CD number + date header */}
            <View className="flex-row items-center gap-2 mb-2">
              <CalendarDays size={13} color={c.primary} />
              <Text className="text-xs font-bold" style={{ color: c.primary }}>
                {cdNumber > 0
                  ? `CD No. ${String(cdNumber).padStart(2, '0')} · ${date}`
                  : date}
              </Text>
            </View>
            {entries.map((entry) => {
              const priority = entry.priority as KaryvahiPriority | undefined;
              const priCfg = priority ? PRIORITY_CONFIG[priority] : null;
              const priColor = priority ? sem[priority] : null;
              const serial = serialMap[entry.id];

              return (
                <KaryvahiRowCard
                  key={entry.id}
                  leftAccentColor={sem.COMPLETED_STATUS.fg}
                  title={entry.karyvahi_name}
                  subtitle={
                    entry.vivran ? (
                      <Text className="text-xs text-muted-foreground leading-5 mt-0.5" numberOfLines={2}>
                        {entry.vivran}
                      </Text>
                    ) : undefined
                  }
                  badgeSlot={
                    <View className="flex-row items-center gap-1.5">
                      {serial != null && (
                        <View
                          className="rounded-full items-center justify-center"
                          style={{ width: 18, height: 18, backgroundColor: `${c.primary}20` }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: '700', color: c.primary }}>
                            {serial}
                          </Text>
                        </View>
                      )}
                      {priCfg && priColor && (
                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{
                            backgroundColor: priColor.bg,
                            borderWidth: 1,
                            borderColor: priColor.border,
                          }}
                        >
                          <Text textBreakStrategy="simple" className="text-[10px] font-semibold" style={{ color: priColor.fg }}>
                            {priCfg.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  }
                  statusSlot={
                    <View className="w-7 h-7 rounded-lg items-center justify-center bg-secondary">
                      <CheckCircle2 size={14} color={sem.COMPLETED_STATUS.fg} />
                    </View>
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/mukadma/[firId]/view-case-diary' as never,
                      params: { firId, diaryId: entry.case_diary_id },
                    })
                  }
                />
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function KaryvahiTab() {
  const params = useLocalSearchParams<{ firId: string }>();
  const { activeFirId } = useFIRContext();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const sem = getSemanticColors(colorScheme ?? 'light');

  const stableFirId = useMemo((): string | undefined => {
    const fromParams  = params.firId?.trim();
    const fromContext = activeFirId?.trim();
    const paramsOk    = !!fromParams  && fromParams  !== 'undefined';
    const contextOk   = !!fromContext && fromContext !== 'undefined';
    const final       = paramsOk ? fromParams : contextOk ? fromContext : undefined;
    logger.warn(
      `[KARYVAHI_ID_RESOLVE] params="${params.firId ?? 'undefined'}"` +
      ` context="${activeFirId ?? 'undefined'}" finalStable="${final ?? 'undefined'}" t=${Date.now()}`
    );
    return final;
  }, [params.firId, activeFirId]);

  const instanceId = useRef(nextKaryvahiInstanceId()).current;

  // ── View state ──────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('general');

  const [items, setItems]               = useState<FIRKaryvahi[]>([]);
  const [diaries, setDiaries]           = useState<CaseDiary[]>([]);
  const [timeline, setTimeline]         = useState<KaryvahiTimelineEntry[]>([]);
  const [conditions, setConditions]     = useState<ActionCondition[]>([]);
  const [loading, setLoading]           = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [infoTarget, setInfoTarget]     = useState<FIRKaryvahi | null>(null);
  const [query, setQuery]               = useState('');
  const [filterMode, setFilterMode]     = useState<FilterMode>('all');

  // Diary action sheet
  const [diarySheetItem, setDiarySheetItem] = useState<FIRKaryvahi | null>(null);

  // Phase 1: reason modal state
  const [reasonModal, setReasonModal]   = useState<{
    item: FIRKaryvahi; status: KaryvahiStatus;
  } | null>(null);
  // Phase 4: prompt to open auto-linked format after COMPLETED
  const [formatPrompt, setFormatPrompt] = useState<{ karyvahiName: string; formatId: string } | null>(null);

  const mountedRef       = useRef(true);
  const hasDataRef       = useRef(false);
  const loadedFirIdRef   = useRef<string | undefined>(undefined);
  const inFlightFirIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    logger.warn(`[KARYVAHI_MOUNT] instance=${instanceId} t=${Date.now()}`);
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const t0 = Date.now();
    if (!stableFirId) { if (mountedRef.current) setLoading(false); return; }
    if (inFlightFirIdRef.current === stableFirId) return;
    const requestedId = stableFirId;
    inFlightFirIdRef.current = requestedId;
    if (!hasDataRef.current && mountedRef.current) setLoading(true);
    try {
      const [data, diaryData, condData, timelineData] = await Promise.all([
        getKaryvahiByFIR(requestedId, `KaryvahiTab#${instanceId}`),
        getCaseDiariesByFIR(requestedId),
        getConditionsForFIR(requestedId),
        getKaryvahiTimelineForFIR(requestedId),
      ]);
      if (!mountedRef.current) return;
      if (stableFirId === requestedId) {
        setItems(data);
        setDiaries(diaryData);
        setConditions(condData);
        setTimeline(timelineData);
        hasDataRef.current     = true;
        loadedFirIdRef.current = requestedId;
      }
    } catch (e) {
      logger.warn(`[KARYVAHI_LOAD] ERROR instance=${instanceId} elapsed=${Date.now()-t0}ms`, e);
    } finally {
      inFlightFirIdRef.current = undefined;
      if (mountedRef.current) setLoading(false);
    }
  }, [stableFirId, instanceId]);

  useEffect(() => {
    if (!stableFirId) return;
    if (stableFirId !== loadedFirIdRef.current) {
      hasDataRef.current       = false;
      loadedFirIdRef.current   = undefined;
      inFlightFirIdRef.current = undefined;
    }
    load();
  }, [stableFirId, load]);

  useFocusEffect(useCallback(() => { load(); return () => {}; }, [load]));

  const handleDelete = async (id: string) => {
    if (!stableFirId) return;
    await deleteKaryvahi(id, stableFirId);
    setDeleteTarget(null);
    load();
  };

  const handleStatusChange = useCallback((item: FIRKaryvahi, newStatus: KaryvahiStatus) => {
    if (newStatus === 'NOT_APPLICABLE' || newStatus === 'DEFERRED') {
      setReasonModal({ item, status: newStatus });
    } else {
      applyStatusChange(item.id, newStatus, undefined, newStatus === 'COMPLETED' ? item : undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableFirId]);

  const applyStatusChange = useCallback(async (
    id: string,
    status: KaryvahiStatus,
    opts?: { not_applicable_reason?: string; deferred_reason?: string },
    completedItem?: FIRKaryvahi,
  ) => {
    if (!stableFirId) return;
    await updateKaryvahiStatus(id, stableFirId, status, opts);
    load();
    if (status === 'COMPLETED' && completedItem?.auto_generate_format_id) {
      setFormatPrompt({ karyvahiName: completedItem.name, formatId: completedItem.auto_generate_format_id });
    }
  }, [stableFirId, load]);

  const handleReasonConfirm = useCallback(async (reason: string) => {
    if (!reasonModal) return;
    const { item, status } = reasonModal;
    setReasonModal(null);
    await applyStatusChange(
      item.id, status,
      status === 'NOT_APPLICABLE'
        ? { not_applicable_reason: reason }
        : { deferred_reason: reason },
    );
  }, [reasonModal, applyStatusChange]);

  const handleQueueToggle = useCallback(async (item: FIRKaryvahi) => {
    if (!stableFirId) return;
    const nowQueued = (item.queued_for_diary ?? 0) === 1;
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, queued_for_diary: nowQueued ? 0 : 1 } : i)
    );
    await updateKaryvahiQueuedFlag(item.id, stableFirId, !nowQueued);
  }, [stableFirId]);

  const effectiveStatus = (item: FIRKaryvahi): KaryvahiStatus =>
    (item.execution_count ?? 0) > 0 ? 'COMPLETED' : ((item.status as KaryvahiStatus) ?? 'PENDING');

  const filtered = useMemo(() => items.filter((it) => {
    const matchesSearch = query.trim() === '' ||
      it.name.toLowerCase().includes(query.toLowerCase()) ||
      (it.precautions ?? '').toLowerCase().includes(query.toLowerCase());
    const s = effectiveStatus(it);
    const matchesFilter =
      filterMode === 'all' ||
      (filterMode === 'completed' && s === 'COMPLETED') ||
      (filterMode === 'pending'   && s !== 'COMPLETED');
    return matchesSearch && matchesFilter;
  }), [items, query, filterMode]);

  const mandatory   = filtered.filter((i) => ((i.priority as KaryvahiPriority) ?? 'MANDATORY') === 'MANDATORY');
  const conditional = filtered.filter((i) => (i.priority as KaryvahiPriority) === 'CONDITIONAL');
  const recommended = filtered.filter((i) => (i.priority as KaryvahiPriority) === 'RECOMMENDED');

  const completed = items.filter((i) => effectiveStatus(i) === 'COMPLETED').length;
  const total     = items.length;
  const progress  = total > 0 ? completed / total : 0;

  const FILTERS: { label: string; value: FilterMode }[] = [
    { label: t('fir.karyvahi.filterAll'),       value: 'all'       },
    { label: t('fir.karyvahi.filterPending'),   value: 'pending'   },
    { label: t('fir.karyvahi.filterCompleted'), value: 'completed' },
  ];

  const sharedSectionProps = {
    firId: stableFirId!,
    diaries,
    conditions,
    allItems: items,
    onDelete:       (id: string) => setDeleteTarget(id),
    onCircleInfo:   (it: FIRKaryvahi) => setInfoTarget(it),
    onStatusChange: handleStatusChange,
    onQueueToggle:  handleQueueToggle,
  };

  const latestDiary = diaries.length > 0 ? diaries[0] : null;

  const VIEWS: { label: string; value: ActiveView }[] = [
    { label: 'सामान्य कार्यवाही',       value: 'general' },
    { label: 'केस डायरी की कार्यवाही', value: 'diary'   },
  ];

  const queuedCount = items.filter((i) => (i.queued_for_diary ?? 0) === 1).length;
  const [searchExpanded, setSearchExpanded] = useState(false);

  return (
    <View className="flex-1 bg-background">
      {/* ── Header + Segmented control ─────────────────────────────────── */}
      <AppHeader
        title={t('fir.karyvahi.title')}
        showBack
        titleSlot={
          <View>
            <Text
              numberOfLines={1}
              style={{ fontSize: 17, fontWeight: '600', color: c.foreground, letterSpacing: -0.2 }}
            >
              {t('fir.karyvahi.title')}
            </Text>
            {/* Segmented control sits immediately under title — one compact unit */}
            <View className="flex-row rounded-lg bg-secondary p-0.5 gap-0.5 mt-1.5" style={{ alignSelf: 'stretch' }}>
              {VIEWS.map((v) => {
                const isActive = activeView === v.value;
                return (
                  <Pressable
                    key={v.value}
                    onPress={() => setActiveView(v.value)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-1.5 rounded-md active:opacity-70"
                    style={{ backgroundColor: isActive ? c.card : 'transparent' }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: isActive ? c.primary : c.mutedForeground,
                      }}
                      numberOfLines={1}
                    >
                      {v.label}
                    </Text>
                    {v.value === 'diary' && queuedCount > 0 && (
                      <View
                        className="rounded-full items-center justify-center"
                        style={{ width: 16, height: 16, backgroundColor: c.primary }}
                      >
                        <Text style={{ fontSize: 9, color: c.primaryForeground, fontWeight: '700' }}>
                          {queuedCount > 9 ? '9+' : queuedCount}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : activeView === 'general' ? (
        /* ── General view ──────────────────────────────────────────────────── */
        <>
          {/* ── Compact toolbar: [progress · bar · 🔍] + [filter chips] ──── */}
          <View className="px-4 pt-2.5 pb-2 border-b border-border bg-background gap-2">

            {/* Row 1: progress + search icon / expanded search input */}
            {searchExpanded ? (
              /* Expanded: full-width search input */
              <View className="flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center bg-secondary rounded-lg px-3 h-8 gap-2 border border-border">
                  <Search size={14} color={c.mutedForeground} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('fir.karyvahi.searchPlaceholder')}
                    placeholderTextColor={c.mutedForeground}
                    autoFocus
                    className="flex-1 text-xs text-foreground"
                    style={{ height: 32 }}
                  />
                </View>
                <Pressable
                  onPress={() => { setSearchExpanded(false); setQuery(''); }}
                  hitSlop={8}
                  className="active:opacity-60"
                >
                  <X size={16} color={c.mutedForeground} />
                </Pressable>
              </View>
            ) : (
              /* Collapsed: progress text + bar + search icon */
              <View className="flex-row items-center gap-3">
                {total > 0 && (
                  <View className="flex-1 gap-1">
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: progress === 1 ? sem.COMPLETED_STATUS.fg : c.primary,
                      }}
                    >
                      {completed} of {total} done · {Math.round(progress * 100)}%
                    </Text>
                    <View className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${progress * 100}%`,
                          backgroundColor: progress === 1 ? sem.COMPLETED_STATUS.fg : c.primary,
                        }}
                      />
                    </View>
                  </View>
                )}
                <Pressable
                  onPress={() => setSearchExpanded(true)}
                  hitSlop={8}
                  className="p-1.5 rounded-lg bg-secondary active:opacity-60"
                >
                  <Search size={16} color={c.mutedForeground} />
                </Pressable>
              </View>
            )}

            {/* Row 2: compact filter chips */}
            <View className="flex-row gap-1.5">
              {FILTERS.map((f) => {
                const isSelected = filterMode === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setFilterMode(f.value)}
                    className="rounded-full min-h-[32px] items-center justify-center active:opacity-70 px-3 py-1.5"
                    style={{ backgroundColor: isSelected ? c.primary : c.secondary }}
                  >
                    <Text textBreakStrategy="simple"
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: isSelected ? c.primaryForeground : c.mutedForeground,
                      }}
                    >
                      {f.label}
                      {f.value === 'pending'   && !loading ? ` (${items.filter(i => effectiveStatus(i) !== 'COMPLETED').length})` : ''}
                      {f.value === 'completed' && !loading ? ` (${completed})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 96 }}
          >
            {filtered.length === 0 ? (
              <View className="items-center justify-center py-16 gap-2">
                <Text className="text-sm text-muted-foreground">
                  {query.trim() || filterMode !== 'all' ? t('fir.karyvahi.noTasksFilter') : t('fir.karyvahi.noTasksYet')}
                </Text>
              </View>
            ) : (
              <>
                {mandatory.length > 0 && (
                  <PrioritySection priority="MANDATORY" items={mandatory} {...sharedSectionProps} />
                )}
                {conditional.length > 0 && (
                  <PrioritySection priority="CONDITIONAL" items={conditional} {...sharedSectionProps} />
                )}
                {recommended.length > 0 && (
                  <PrioritySection priority="RECOMMENDED" items={recommended} {...sharedSectionProps} />
                )}
              </>
            )}

            {/* Add actions: Add from Checklist + Add custom */}
            <View className="gap-2.5 mt-2">
              <Pressable
                onPress={() => router.push(`/(app)/mukadma/${stableFirId}/add-karyvahi-checklist` as never)}
                className="flex-row items-center justify-between border border-dashed border-border bg-card rounded-2xl px-4 py-3.5 active:opacity-70"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{ backgroundColor: `${c.primary}18` }}
                  >
                    <ListChecks size={16} color={c.primary} />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-foreground">
                      {t('fir.karyvahi.addFromChecklist', 'चेकलिस्ट से जोड़ें')}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {t('fir.karyvahi.addFromChecklistSub', 'मानक विवेचना चेकलिस्ट से कार्य चुनें')}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={c.mutedForeground} />
              </Pressable>

              <Pressable
                onPress={() => router.push(`/(app)/mukadma/${stableFirId}/add-karyvahi` as never)}
                className="flex-row items-center justify-between border border-dashed border-border bg-card rounded-2xl px-4 py-3.5 active:opacity-70"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{ backgroundColor: `${c.primary}18` }}
                  >
                    <Plus size={16} color={c.primary} />
                  </View>
                  <Text className="text-sm font-semibold text-foreground">{t('fir.karyvahi.addCustom')}</Text>
                </View>
                <ChevronRight size={16} color={c.mutedForeground} />
              </Pressable>
            </View>
          </ScrollView>
        </>
      ) : (
        /* ── Diary view ────────────────────────────────────────────────────── */
        <DiaryView
          firId={stableFirId!}
          items={items}
          diaries={diaries}
          timeline={timeline}
          onItemPress={(item) => setDiarySheetItem(item)}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.karyvahi.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fir.karyvahi.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}><Text>{t('fir.karyvahi.cancel')}</Text></AlertDialogCancel>
            <AlertDialogAction onPress={() => deleteTarget && handleDelete(deleteTarget)}><Text>{t('fir.karyvahi.delete')}</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execution info dialog */}
      <AlertDialog open={!!infoTarget} onOpenChange={(o) => { if (!o) setInfoTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle numberOfLines={2}>{infoTarget?.name}</AlertDialogTitle>
          </AlertDialogHeader>
          {infoTarget && <ExecutionInfoContent item={infoTarget} />}
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setInfoTarget(null)}><Text>{t('fir.karyvahi.ok')}</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* N.A. / Deferred reason modal */}
      <ReasonModal
        visible={!!reasonModal}
        statusLabel={reasonModal ? STATUS_CONFIG[reasonModal.status].label : ''}
        onConfirm={handleReasonConfirm}
        onCancel={() => setReasonModal(null)}
      />

      {/* Phase 4: auto-generate format prompt */}
      <AlertDialog open={!!formatPrompt} onOpenChange={(o) => { if (!o) setFormatPrompt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.karyvahi.formatPromptTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('fir.karyvahi.formatPromptDesc', { name: formatPrompt?.karyvahiName ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setFormatPrompt(null)}>
              <Text>{t('fir.karyvahi.formatPromptSkip')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => {
                const fid = formatPrompt!.formatId;
                setFormatPrompt(null);
                router.push(
                  `/(app)/formats/fill?formatId=${encodeURIComponent(fid)}&callingModule=KARYVAHI&firId=${encodeURIComponent(stableFirId ?? '')}` as never
                );
              }}
            >
              <Text>{t('fir.karyvahi.formatPromptOpen')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diary action sheet */}
      <DiaryActionSheet
        visible={!!diarySheetItem}
        item={diarySheetItem}
        latestDiary={latestDiary}
        firId={stableFirId!}
        onClose={() => setDiarySheetItem(null)}
      />
    </View>
  );
}
