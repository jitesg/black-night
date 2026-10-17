import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { stripHtmlTags } from '@/lib/stringUtils';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell, Calendar, CheckSquare, Edit3,
  FileText, Square,
} from 'lucide-react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getNyayalayDocWithDetails,
  getNyayalayReport,
  updateChecklistItems,
  computeReminderInfo,
  nylDaysUntilDeadline,
  todayStr,
  DOC_TYPE_LABELS,
  type NyayalayDocWithDetails,
  type NyayalayReport,
  type NyayalayChecklistItem,
} from '@/lib/db/nyayalayRepo';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AddFromFormatCard } from '@/components/ui/ds/AddFromFormatCard';

const MODULE_COLOR = '#1D4ED8';

// ── Shared UI helpers ────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="mb-4">
      <Text className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</Text>
      <Text className="text-sm text-foreground leading-6">{value}</Text>
    </View>
  );
}

function PersonSection({
  persons, label,
}: { persons: NyayalayDocWithDetails['persons']; label: string }) {
  const { t } = useTranslation();
  if (!persons.length) return null;
  return (
    <View className="mb-4">
      <Text className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
        {label} ({persons.length})
      </Text>
      {persons.map((p, i) => (
        <View key={p.id}
          className="bg-card border border-border rounded-2xl p-4 mb-3"
          style={{ borderCurve: 'continuous' }}>
          <Text className="text-sm font-semibold text-foreground mb-1">{i + 1}. {p.name}</Text>
          {p.father_name ? <Text className="text-xs text-muted-foreground">{t('nyayalay.detail.fatherPrefix')}: {p.father_name}</Text> : null}
          {p.mobile ? <Text className="text-xs text-muted-foreground">{t('nyayalay.detail.mobilePrefix')}: {p.mobile}</Text> : null}
          {p.address ? <Text className="text-xs text-muted-foreground">{t('nyayalay.detail.addressPrefix')}: {p.address}</Text> : null}
          {p.remarks ? <Text className="text-xs text-muted-foreground">{t('nyayalay.detail.remarksPrefix')}: {p.remarks}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ReminderPanel({
  doc,
}: { doc: NyayalayDocWithDetails }) {
  const { t } = useTranslation();
  const info = computeReminderInfo(
    doc.doc_type, doc.sub_type, doc.deadline_date, doc.status
  );
  const bg = info.isActive
    ? (doc.deadline_date < todayStr() ? '#FEF2F2' : '#EFF6FF')
    : '#F0FDF4';
  const borderColor = info.isActive
    ? (doc.deadline_date < todayStr() ? '#FECACA' : '#BFDBFE')
    : '#BBF7D0';
  const textColor = info.isActive
    ? (doc.deadline_date < todayStr() ? '#991B1B' : '#1D4ED8')
    : '#065F46';

  const statusLabelText = info.statusLabel === 'Finished'
    ? t('fir.list.filterFinished')
    : info.statusLabel === 'Overdue'
    ? t('nyayalay.status.overdue')
    : t('nyayalay.reminder.active');

  return (
    <View className="rounded-2xl p-4 mb-4"
      style={{ backgroundColor: bg, borderWidth: 1, borderColor, borderCurve: 'continuous' }}>
      <View className="flex-row items-center gap-2 mb-2">
        <Bell size={14} color={textColor} />
        <Text className="text-xs font-semibold uppercase tracking-widest" style={{ color: textColor }}>
          {t('nyayalay.reminder.title')}
        </Text>
      </View>
      <Text className="text-sm font-semibold mb-1" style={{ color: textColor }}>
        {info.category}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: info.isActive ? (doc.deadline_date < todayStr() ? '#FEE2E2' : '#DBEAFE') : '#DCFCE7' }}>
          <Text className="text-xs font-semibold" style={{ color: textColor }}>
            {statusLabelText}
          </Text>
        </View>
        <Calendar size={12} color={textColor} />
        <Text className="text-xs flex-1" style={{ color: textColor }}>{info.daysInfo}</Text>
      </View>
    </View>
  );
}

function ReportCard({ report }: { report: NyayalayReport }) {
  const { t } = useTranslation();
  return (
    <View className="bg-card border border-border rounded-2xl p-4 mb-4"
      style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center gap-2 mb-3">
        <FileText size={14} color={MODULE_COLOR} />
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {t('nyayalay.report.attachedReport')}
        </Text>
        <View className="rounded-full px-2 py-0.5 ml-auto" style={{ backgroundColor: '#D1FAE5' }}>
          <Text className="text-xs font-semibold" style={{ color: '#065F46' }}>{t('nyayalay.report.savedBadge')}</Text>
        </View>
      </View>
      {report.format_title ? (
        <Text className="text-xs text-muted-foreground mb-1">{t('nyayalay.report.templatePrefix')}: {report.format_title}</Text>
      ) : null}
      <Text className="text-xs text-muted-foreground mb-2">{t('nyayalay.report.datePrefix')}: {report.report_date}</Text>
      <Text className="text-sm text-foreground leading-6" numberOfLines={6}>
        {stripHtmlTags(report.report_content)}
      </Text>
    </View>
  );
}

// ── Checklist Section (High Court) ────────────────────────────────────────

const CHECKLIST_KEY_MAP: Record<string, string> = {
  'bail-report': 'nyayalay.checklist.bailReport',
  'vadi-suchna': 'nyayalay.checklist.vadiSuchna',
  'dcrb-report': 'nyayalay.checklist.dcrbReport',
  'status-report': 'nyayalay.checklist.statusReport',
};
const CHECKLIST_LABEL_FALLBACK_MAP: Record<string, string> = {
  'Bail Report': 'nyayalay.checklist.bailReport',
  'Vadi Suchna': 'nyayalay.checklist.vadiSuchna',
  'DCRB Report': 'nyayalay.checklist.dcrbReport',
  'Status Report': 'nyayalay.checklist.statusReport',
};

function ChecklistSection({
  items, onChange,
}: {
  items: NyayalayChecklistItem[];
  onChange: (id: string, val: boolean) => void;
}) {
  const { t } = useTranslation();
  const done = items.filter((i) => i.is_done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs text-muted-foreground uppercase tracking-widest">
          {t('nyayalay.checklist.title')}
        </Text>
        <Text className="text-xs text-muted-foreground">{done}/{total} · {pct}%</Text>
      </View>
      {/* Progress bar */}
      <View className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
        <View className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10B981' : MODULE_COLOR }} />
      </View>
      {items.map((item) => {
        const itemKey = (item as unknown as { _key?: string })._key;
        const i18nKey = (itemKey && CHECKLIST_KEY_MAP[itemKey])
          ? CHECKLIST_KEY_MAP[itemKey]
          : CHECKLIST_LABEL_FALLBACK_MAP[item.label];
        const displayLabel = i18nKey ? t(i18nKey) : item.label;

        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id, !item.is_done)}
            className="flex-row items-center gap-3 py-3 border-b border-border active:opacity-70"
          >
            {item.is_done
              ? <CheckSquare size={18} color={MODULE_COLOR} />
              : <Square size={18} color="#9CA3AF" />}
            <Text className="flex-1 text-sm"
              style={{ color: item.is_done ? '#6B7280' : '#111827',
                textDecorationLine: item.is_done ? 'line-through' : 'none' }}>
              {displayLabel}
            </Text>
            {item.is_optional && (
              <Text className="text-xs text-muted-foreground">{t('nyayalay.checklist.optional')}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NyayalayDocDetailScreen() {
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const { t } = useTranslation();

  const [doc, setDoc] = useState<NyayalayDocWithDetails | null>(null);
  const [report, setReport] = useState<NyayalayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Checklist local state (HC type)
  const [checklistItems, setChecklistItems] = useState<NyayalayChecklistItem[]>([]);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [backDialog, setBackDialog] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        getNyayalayDocWithDetails(docId),
        getNyayalayReport(docId),
      ]);
      setDoc(d);
      setReport(r);
      if (d) setChecklistItems(d.checklist);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Hardware back protection for checklist changes
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (checklistDirty) { setBackDialog(true); return true; }
      return false;
    });
    return () => sub.remove();
  }, [checklistDirty]);

  const handleBack = () => {
    if (checklistDirty) setBackDialog(true);
    else router.back();
  };

  const handleChecklistToggle = (id: string, val: boolean) => {
    setChecklistItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, is_done: val } : item)
    );
    setChecklistDirty(true);
  };

  const handleSaveChecklist = async () => {
    if (!docId) return;
    setSaving(true);
    try {
      await updateChecklistItems(
        checklistItems.map((i) => ({ id: i.id, is_done: i.is_done }))
      );
      setChecklistDirty(false);
      setSaveSuccessMsg(t('nyayalay.detail.checklistSaved'));
      setTimeout(() => setSaveSuccessMsg(''), 2500);
      // Reload doc so analytics + progress bar reflect the saved state
      await load();
    } catch {
      setSaveSuccessMsg(t('nyayalay.detail.checklistSaveFailed'));
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  // ── Navigation helpers ────────────────────────────────────────────────

  const goToReport = () => {
    router.push(`/(app)/nyayalay/${docId}/report` as never);
  };

  const goToSelectFormat = (options: { tag?: string; mode?: string; formatType?: string } = {}) => {
    const { tag, mode, formatType } = options;
    if (formatType) {
      router.push(
        `/(app)/nyayalay/select-format?docId=${docId}&mode=formatType&formatType=${encodeURIComponent(formatType)}` as never
      );
    } else if (tag) {
      router.push(`/(app)/nyayalay/select-format?docId=${docId}&tag=${tag}` as never);
    } else {
      router.push(`/(app)/nyayalay/select-format?docId=${docId}&mode=${mode ?? 'anya'}` as never);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={MODULE_COLOR} />
      </View>
    );
  }

  if (!doc) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-5">
        <StatusBar style="dark" />
        <Text className="text-base text-muted-foreground">{t('nyayalay.detail.docNotFound')}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-70">
          <Text className="text-sm" style={{ color: MODULE_COLOR }}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const days = nylDaysUntilDeadline(doc.deadline_date, doc.status);
  const isFinished = doc.status === 'Finished';
  const isOverdue = !isFinished && days < 0;

  const statusLabel = isFinished
    ? t('fir.list.filterFinished')
    : isOverdue
    ? t('nyayalay.status.overdue')
    : t('fir.list.filterPending');

  const dayLabel = isFinished
    ? t('fir.list.filterFinished')
    : days > 0
    ? t('nyayalay.daysLeft', { count: days, days })
    : days === 0
    ? t('nyayalay.dueToday')
    : t('nyayalay.daysOverdue', { count: Math.abs(days), days: Math.abs(days) });

  const accused = doc.persons.filter((p) => p.person_type === 'accused');
  const appellants = doc.persons.filter((p) => p.person_type === 'appellant');

  // ── Common document details ──────────────────────────────────────────
  // BUG-6 fix: use renderXxx() function-call pattern instead of <XxxComponent />
  // Hidden entirely for NBW — NBW uses renderNBWDetails() instead.

  const renderCommonDetails = () => {
    if (doc.doc_type === 'NBW') return null;
    return (
      <>
        {/* Status bar */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="rounded-full px-3 py-1"
            style={{ backgroundColor: isFinished ? '#D1FAE5' : isOverdue ? '#FEE2E2' : '#FEF3C7' }}>
            <Text className="text-sm font-semibold"
              style={{ color: isFinished ? '#065F46' : isOverdue ? '#991B1B' : '#92400E' }}>
              {statusLabel}
            </Text>
          </View>
          <Calendar size={14} color="#9CA3AF" />
          <Text className="text-sm text-muted-foreground">{doc.deadline_date}</Text>
          <Text className="text-sm font-medium ml-auto"
            style={{ color: isFinished ? '#065F46' : days > 0 ? MODULE_COLOR : '#DC2626' }}>
            {dayLabel}
          </Text>
        </View>

        <DetailRow label={t('nyayalay.detail.regNumber')} value={doc.registration_number} />
        <DetailRow label={t('nyayalay.detail.courtName')} value={doc.court_name} />
        <DetailRow label={t('nyayalay.detail.vadSankhya')} value={doc.vad_sankhya} />
        <DetailRow label={t('nyayalay.detail.apradhSankhya')} value={doc.apradh_sankhya} />
        <DetailRow label={t('nyayalay.detail.applicableSections')} value={doc.applicable_sections} />
        <DetailRow
          label={t('nyayalay.detail.fir')}
          value={doc.fir_number
            ? `${doc.fir_number}/${doc.fir_year}${doc.fir_ps ? ` — ${doc.fir_ps}` : ''}`
            : null}
        />
        <DetailRow label={t('nyayalay.detail.matter')} value={doc.matter} />
        <DetailRow label={t('nyayalay.detail.documentTitle')} value={doc.document_title} />
        <DetailRow label={t('nyayalay.detail.writType')} value={doc.writ_type} />
        <PersonSection persons={accused} label={t('nyayalay.form.accused')} />
        <PersonSection persons={appellants} label={t('nyayalay.form.appellants')} />
      </>
    );
  };

  // ── Compact detail card — shared by NBW and Summons ─────────────────
  // Shows the 4 fields essential to both report workflows. The section title
  // is parameterised so NBW gets "NBW Details" and Summons gets "Summons Details".
  // Uses flex-row + flex-wrap + numberOfLines={1} to prevent horizontal overflow
  // on small Android screens.

  const renderCompactDetails = (sectionTitleKey: string) => {
    const accusedNames = accused.map((a) => a.name).join(', ') || t('nbw.noAccused');
    return (
      <View
        className="bg-card border border-border rounded-2xl p-4 mb-4"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          {t(sectionTitleKey)}
        </Text>

        {/* Row: court name + status badge */}
        <View className="flex-row flex-wrap items-center gap-2 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground mb-0.5">{t('nbw.courtName')}</Text>
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {doc.court_name || '—'}
            </Text>
          </View>
          <View className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: isFinished ? '#D1FAE5' : isOverdue ? '#FEE2E2' : '#FEF3C7' }}>
            <Text className="text-xs font-semibold"
              style={{ color: isFinished ? '#065F46' : isOverdue ? '#991B1B' : '#92400E' }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Row: case no + FIR / apradh no */}
        <View className="flex-row flex-wrap gap-4 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground mb-0.5">{t('nbw.caseStNo')}</Text>
            <Text className="text-sm text-foreground font-medium" numberOfLines={1}>
              {doc.vad_sankhya || '—'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground mb-0.5">{t('nbw.firNumber')}</Text>
            <Text className="text-sm text-foreground font-medium" numberOfLines={1}>
              {doc.apradh_sankhya || doc.fir_number || '—'}
            </Text>
          </View>
        </View>

        {/* Accused names — comma-separated inline */}
        <View>
          <Text className="text-xs text-muted-foreground mb-0.5">{t('nbw.accusedDetails')}</Text>
          <Text className="text-sm text-foreground leading-5" numberOfLines={2}>
            {accusedNames}
          </Text>
        </View>
      </View>
    );
  };

  // Convenience wrappers so call-sites remain self-documenting.
  const renderNBWDetails     = () => renderCompactDetails('nbw.nbwDetails');
  const renderSummonsDetails = () => renderCompactDetails('nbw.summonsDetails');

  // ── Report workflow — shared by NBW and Summons ──────────────────────
  // Streamlined: Generate button FIRST, ReportCard BELOW.
  // No AutoFillKeyPanel or analytics row clutter (matches NBW's original
  // renderNBWWorkflow layout exactly).
  // Button label uses i18n keys so both types get the same translation coverage.

  const renderReportWorkflow = () => (
    <View className="mt-2">
      {!isFinished ? (
        <Pressable
          onPress={goToReport}
          className="rounded-xl py-4 px-5 items-center flex-row justify-center gap-2 active:opacity-80 mb-3"
          style={{ backgroundColor: MODULE_COLOR, borderCurve: 'continuous' }}
        >
          <FileText size={16} color="#fff" />
          <Text className="text-white font-semibold text-sm">
            {report ? t('nbw.editReport') : t('nbw.generateReport')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={goToReport}
          className="border border-border rounded-xl py-4 px-5 items-center flex-row justify-center gap-2 active:opacity-70 mb-3"
        >
          <FileText size={16} color="#6B7280" />
          <Text className="text-sm text-muted-foreground font-medium">{t('nbw.viewEditReport')}</Text>
        </Pressable>
      )}

      {/* Saved report card appears BELOW the action button */}
      {report && <ReportCard report={report} />}
    </View>
  );

  // Keep the old name as a direct alias so the NBW call-site below is unchanged.
  const renderNBWWorkflow = renderReportWorkflow;

  // ── High Court checklist section ─────────────────────────────────────
  // Checklist is now fully active: toggles work, progress is tracked,
  // analytics update on save. Items always shown (even if empty — save button
  // will be absent so no accidental empty saves).

  const renderHCWorkflow = () => (
    <View className="mt-2">
      <ReminderPanel doc={doc} />

      {/* Always-active checklist */}
      <ChecklistSection items={checklistItems} onChange={handleChecklistToggle} />

      {/* Vadi Suchna — Add from Format (only 'वादी सूचना' type) */}
      {!isFinished && (
        <AddFromFormatCard
          title={t('nyayalay.detail.addVadiSuchna')}
          onPress={() => goToSelectFormat({ formatType: 'वादी सूचना' })}
          color={MODULE_COLOR}
          className="mt-3"
        />
      )}

      {/* DCRB Report — Add from Format (only 'DCRB रिपोर्ट' type) */}
      {!isFinished && (
        <AddFromFormatCard
          title={t('nyayalay.detail.addDcrbReport')}
          onPress={() => goToSelectFormat({ formatType: 'DCRB रिपोर्ट' })}
          color={MODULE_COLOR}
          className="mt-2"
        />
      )}

      {checklistDirty && (
        <Pressable
          onPress={handleSaveChecklist}
          disabled={saving}
          className="rounded-xl py-3.5 px-5 items-center active:opacity-80 mt-3"
          style={{ backgroundColor: MODULE_COLOR, borderCurve: 'continuous' }}
        >
          <Text className="text-white font-semibold text-sm">
            {saving ? t('common.saving') : t('nyayalay.detail.saveChecklist')}
          </Text>
        </Pressable>
      )}
      {saveSuccessMsg ? (
        <Text className="text-sm text-center mt-2"
          style={{ color: saveSuccessMsg.includes('failed') ? '#DC2626' : '#065F46' }}>
          {saveSuccessMsg}
        </Text>
      ) : null}
    </View>
  );

  // ── Bail Lower Court info section ────────────────────────────────────

  const renderBailLowerCourtInfo = () => (
    <View className="mt-2">
      <ReminderPanel doc={doc} />
      <View className="bg-muted rounded-2xl p-4" style={{ borderCurve: 'continuous' }}>
        <Text className="text-xs text-muted-foreground text-center">
          {t('nyayalay.detail.bailLowerCourtNotice')}
        </Text>
      </View>
    </View>
  );

  // ── Anya workflow section ────────────────────────────────────────────

  // BUG-1 fix: same double-push fix as renderReportWorkflow above.
  const renderAnyaWorkflow = () => (
    <View className="mt-2">
      {report && <ReportCard report={report} />}
      {!isFinished ? (
        <Pressable
          onPress={() => {
            // Go to report screen; it has a built-built "Select template" button
            goToReport();
          }}
          className="rounded-xl py-3.5 px-5 items-center flex-row justify-center gap-2 active:opacity-80"
          style={{ backgroundColor: MODULE_COLOR, borderCurve: 'continuous' }}
        >
          <FileText size={16} color="#fff" />
          <Text className="text-white font-semibold text-sm">
            {report ? t('nyayalay.report.editReport') : t('nyayalay.report.createReport')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={goToReport}
          className="border border-border rounded-xl py-3 px-5 items-center flex-row justify-center gap-2 active:opacity-70"
        >
          <FileText size={16} color="#6B7280" />
          <Text className="text-sm text-muted-foreground font-medium">{t('nyayalay.report.viewEditReport')}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={doc.court_name || doc.document_title || doc.registration_number}
        subtitle={`${DOC_TYPE_LABELS[doc.doc_type] ? t(`nyayalay.docType.${doc.doc_type}`) : doc.doc_type}${doc.sub_type ? ` — ${doc.sub_type}` : ''}`}
        onBack={handleBack}
        rightActions={
          <Pressable onPress={() => router.push(`/(app)/nyayalay/add?editId=${doc.id}` as never)} className="active:opacity-70 px-3 py-1.5 border border-border rounded-xl">
            <Edit3 size={14} color="#6B7280" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* BUG-6 fix: call as plain functions, not JSX components */}
        {/* NBW + Summons: compact detail card; all other types: generic long-form */}
        {doc.doc_type === 'NBW'
          ? renderNBWDetails()
          : doc.doc_type === 'Summons'
          ? renderSummonsDetails()
          : renderCommonDetails()}

        <View className="my-4 border-t border-border" />

        {/* Type-dispatched workflow */}
        {doc.doc_type === 'NBW' && renderNBWWorkflow()}
        {doc.doc_type === 'Summons' && renderReportWorkflow()}
        {doc.doc_type === 'Bail_Lower_Court' && renderBailLowerCourtInfo()}
        {doc.doc_type === 'High_Court_Documents' && renderHCWorkflow()}
        {doc.doc_type === 'Anya' && renderAnyaWorkflow()}
      </ScrollView>

      {/* Back protection for checklist */}
      <AlertDialog open={backDialog} onOpenChange={setBackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nyayalay.dialog.unsavedChecklistTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nyayalay.dialog.unsavedChecklistDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialog(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { setBackDialog(false); setChecklistDirty(false); router.back(); }}
            >
              <Text>{t('common.discard')}</Text>
            </AlertDialogAction>
            <AlertDialogAction
              onPress={async () => {
                setBackDialog(false);
                await handleSaveChecklist();
                router.back();
              }}
              className="bg-primary"
            >
              <Text className="text-primary-foreground font-semibold">{t('common.save')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
