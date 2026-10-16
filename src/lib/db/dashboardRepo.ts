/**
 * dashboardRepo.ts
 * Aggregates data from every module repository for the Analytics Dashboard.
 * Never duplicates logic — calls existing repo functions only.
 * All analytics are computed in pure JS from loaded arrays (SSOT, no NaN).
 */

import { safeNum, safePct } from '../safeNum';
import { getAllFIRs, type FIR } from './firRepo';
import { getAllGdEntries, type GdEntry } from './gdRepo';
import {
  getAllNyayalayDocuments,
  computeAnalyticsFromDocs,
  nylDaysUntilDeadline,
  DOC_TYPE_LABELS,
  type NyayalayDocument,
  type NyayalayAnalytics,
} from './nyayalayRepo';
import {
  getAllPrarthnaPatra,
  daysUntilDeadline as ppDaysUntilDeadline,
  isActionWorkflow,
  type PrarthnaPatra,
  type PPDashboardAnalytics,
  type PPAnalytics,
  type PetitionType,
} from './prarthnaPatraRepo';
import { getAllNirodhatmakKaryvahi, type NirodhatmakKaryvahi } from './nirodhatmakRepo';
import { getAnalytics as getHalkaAnalytics } from './gramPanchayatRepo';
import { getKnowledgeAnalytics, getKnowledgeTotalCount } from './knowledgeRepo';
import { searchFIRs } from './firRepo';
import { searchGdEntries } from './gdRepo';
import { searchNyayalayDocuments } from './nyayalayRepo';
import { searchPrarthnaPatra } from './prarthnaPatraRepo';
import { searchKnowledgeAll } from './knowledgeRepo';
import { searchNirodhatmakKaryvahi } from './nirodhatmakRepo';
import { globalSearch } from './searchRepo';

// ── Local date helper (timezone-safe) ──────────────────────────────────────
function localDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 1000);
}
function endOfDay(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T23:59:59`).getTime() / 1000);
}
function startOfWeek(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return Math.floor(monday.getTime() / 1000);
}
function startOfMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface TodaySummary {
  todayPending: number;
  todayCompleted: number;
  todayDue: number;
  todayOverdue: number;
  activeCase: number;
  activeCourtDocs: number;
  pendingPrarthnaPatra: number;
  todayGD: number;
}

export interface MukadmaAnalytics {
  total: number;
  pending: number;
  finished: number;
}

export interface GDAnalytics {
  total: number;
  todayCount: number;
  thisMonthCount: number;
}

export interface NirodhatmakAnalytics {
  total: number;
}

export interface HalkaAnalytics {
  gramPanchayats: number;
  hamlets: number;
  importantPersons: number;
  historySheeters: number;
  religiousPlaces: number;
  institutions: number;
}

export interface KnowledgeDashboardAnalytics {
  total: number;
  investigationGuides: number;
  checklists: number;
  sops: number;
  personalNotes: number;
  byCategory: Record<string, number>;
}

export interface ReminderItem {
  id: string;
  module: string;
  title: string;
  daysLeft: number;     // 0 = due today, >0 = upcoming, <0 = overdue
  route: string;
  color: string;
}

export interface OverdueItem {
  id: string;
  module: string;
  title: string;
  daysOverdue: number;
  route: string;
  color: string;
}

export interface RecentActivity {
  id: string;
  label: string;
  subtitle: string;
  time: number; // unix seconds
  route: string;
  color: string;
}

export interface ProductivityAnalytics {
  createdToday: number;
  createdThisWeek: number;
  createdThisMonth: number;
  totalPending: number;
  totalFinished: number;
  completionPct: number;   // 0–100
}

export interface DashboardData {
  today: TodaySummary;
  mukadma: MukadmaAnalytics;
  nyayalay: NyayalayAnalytics;
  pp: PPDashboardAnalytics;
  gd: GDAnalytics;
  nirodhatmak: NirodhatmakAnalytics;
  halka: HalkaAnalytics;
  knowledge: KnowledgeDashboardAnalytics;
  reminders: ReminderItem[];
  overdue: OverdueItem[];
  recentActivity: RecentActivity[];
  productivity: ProductivityAnalytics;
  // raw arrays for list screens
  rawFIRs: FIR[];
  rawNyayalay: NyayalayDocument[];
  rawPP: PrarthnaPatra[];
  rawGD: GdEntry[];
  rawNirodhatmak: NirodhatmakKaryvahi[];
}

const MODULE_COLORS: Record<string, string> = {
  Mukadma: '#7C3AED',
  Nyayalay: '#1D4ED8',
  'Prarthna Patra': '#7C3AED',
  GD: '#D97706',
  Nirodhatmak: '#DC2626',
  Halka: '#2D52B8',
  Knowledge: '#0F766E',
};

// ── Main loader ────────────────────────────────────────────────────────────

export async function loadDashboardData(): Promise<DashboardData> {
  const today = localDateString();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  // All repos fetched in parallel — single DB round-trip per module
  const [firs, nyayalayDocs, ppAll, gdAll, nirodhatmakAll, halkaStats, knowledgeTotal, knowledgeCats] =
    await Promise.all([
      getAllFIRs(),
      getAllNyayalayDocuments(),
      getAllPrarthnaPatra(),
      getAllGdEntries(),
      getAllNirodhatmakKaryvahi(),
      getHalkaAnalytics(),
      getKnowledgeTotalCount(),
      getKnowledgeAnalytics(),
    ]);

  // ── Mukadma ───────────────────────────────────────────────────────────
  const mukadma: MukadmaAnalytics = {
    total: firs.length,
    pending: firs.filter((f) => f.status === 'Pending').length,
    finished: firs.filter((f) => f.status === 'Finished').length,
  };

  // ── Nyayalay ──────────────────────────────────────────────────────────
  const nyayalayAnalytics = computeAnalyticsFromDocs(nyayalayDocs);

  // ── Prarthna Patra ────────────────────────────────────────────────────
  // All PP analytics computed inline from the already-fetched ppAll array.
  // BUG-C1 FIX: previously getDashboardAnalytics() was called here, which
  // internally called getAllPrarthnaPatra() a second time — a redundant DB
  // round-trip. Now we derive byType directly from ppAll (single fetch).
  const ppZero = (): PPAnalytics => ({ total: 0, pending: 0, nistarit: 0, finished: 0 });
  const ppOverall = ppZero();
  const ppByType: Record<PetitionType, PPAnalytics> = {
    RL: ppZero(), 'जनता दर्शन': ppZero(), 'CO पेशी': ppZero(),
    SDM: ppZero(), DM: ppZero(), RTI: ppZero(), 'अन्य': ppZero(),
    'बीट सूचना': { ...ppZero(), dueToday: 0, overdue: 0 },
    NCR: ppZero(),
    'थाना प्रार्थना पत्र': { ...ppZero(), dueToday: 0, overdue: 0 },
  };

  for (const pp of ppAll) {
    ppOverall.total++;
    if (pp.status === 'Pending') ppOverall.pending++;
    else if (pp.status === 'Finished') ppOverall.finished++;
    else ppOverall.nistarit++;

    const t = pp.petition_type as PetitionType;
    if (ppByType[t]) {
      ppByType[t].total++;
      if (pp.status === 'Pending') ppByType[t].pending++;
      else if (pp.status === 'Finished') ppByType[t].finished++;
      else ppByType[t].nistarit++;

      if (t === 'बीट सूचना' && pp.status === 'Pending') {
        const days = ppDaysUntilDeadline(pp.deadline_date, pp.status);
        if (days === 0) ppByType[t].dueToday = (ppByType[t].dueToday ?? 0) + 1;
        if (days < 0)  ppByType[t].overdue  = (ppByType[t].overdue  ?? 0) + 1;
      }
      if (t === 'थाना प्रार्थना पत्र' && pp.status === 'Pending') {
        const days = ppDaysUntilDeadline(pp.deadline_date, pp.status);
        if (days === 0) ppByType[t].dueToday = (ppByType[t].dueToday ?? 0) + 1;
        if (days < 0)  ppByType[t].overdue  = (ppByType[t].overdue  ?? 0) + 1;
      }
    }
  }

  const ppFull: PPDashboardAnalytics = { overall: ppOverall, byType: ppByType };

  // ── GD ────────────────────────────────────────────────────────────────
  const thisMonth = today.slice(0, 7);
  const gd: GDAnalytics = {
    total: gdAll.length,
    todayCount: gdAll.filter((g) => g.preparation_date === today).length,
    thisMonthCount: gdAll.filter((g) => g.preparation_date.startsWith(thisMonth)).length,
  };

  // ── Nirodhatmak ───────────────────────────────────────────────────────
  const nirodhatmak: NirodhatmakAnalytics = { total: nirodhatmakAll.length };

  // ── Halka ─────────────────────────────────────────────────────────────
  const halka: HalkaAnalytics = {
    gramPanchayats: halkaStats.totalGP,
    hamlets: halkaStats.totalHamlets,
    importantPersons: halkaStats.totalImportantPersons,
    historySheeters: halkaStats.totalHistorySheeters,
    religiousPlaces: halkaStats.totalReligiousPlaces,
    institutions: halkaStats.totalInstitutions,
  };

  // ── Knowledge ─────────────────────────────────────────────────────────
  const knowledge: KnowledgeDashboardAnalytics = {
    total: safeNum(knowledgeTotal),
    investigationGuides: safeNum(Number(knowledgeCats['Investigation Guides'])),
    checklists: safeNum(Number(knowledgeCats['Checklists'])),
    sops: safeNum(Number(knowledgeCats['SOPs'])),
    personalNotes: safeNum(Number(knowledgeCats['Personal Notes'])),
    byCategory: knowledgeCats,
  };

  // ── Reminders (due in next 14 days, sorted nearest first) ─────────────
  const reminders: ReminderItem[] = [];

  for (const doc of nyayalayDocs) {
    if (doc.status === 'Finished') continue;
    const days = nylDaysUntilDeadline(doc.deadline_date, doc.status);
    if (days >= -1 && days <= 14) {
      reminders.push({
        id: doc.id,
        module: 'Nyayalay',
        title: `${DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} — ${doc.court_name || doc.registration_number || doc.id.slice(0, 8)}`,
        daysLeft: days,
        route: `/(app)/nyayalay/${doc.id}`,
        color: MODULE_COLORS.Nyayalay,
      });
    }
  }

  for (const pp of ppAll) {
    if (pp.status !== 'Pending') continue;
    if (!isActionWorkflow(pp.petition_type as never)) continue;
    const days = ppDaysUntilDeadline(pp.deadline_date, pp.status);
    if (days >= -1 && days <= 14) {
      reminders.push({
        id: pp.id,
        module: 'Prarthna Patra',
        title: `${pp.petition_type} — ${pp.matter || pp.registration_number || pp.id.slice(0, 8)}`,
        daysLeft: days,
        route: `/(app)/prarthna-patra/${pp.id}`,
        color: MODULE_COLORS['Prarthna Patra'],
      });
    }
  }

  reminders.sort((a, b) => a.daysLeft - b.daysLeft);

  // ── Overdue Work ──────────────────────────────────────────────────────
  const overdue: OverdueItem[] = [];

  for (const doc of nyayalayDocs) {
    if (doc.status === 'Finished') continue;
    const days = nylDaysUntilDeadline(doc.deadline_date, doc.status);
    if (days < 0) {
      overdue.push({
        id: doc.id,
        module: 'Nyayalay',
        title: `${DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} — ${doc.court_name || doc.registration_number || doc.id.slice(0, 8)}`,
        daysOverdue: Math.abs(days),
        route: `/(app)/nyayalay/${doc.id}`,
        color: MODULE_COLORS.Nyayalay,
      });
    }
  }

  for (const pp of ppAll) {
    if (pp.status !== 'Pending') continue;
    if (!isActionWorkflow(pp.petition_type as never)) continue;
    const days = ppDaysUntilDeadline(pp.deadline_date, pp.status);
    if (days < 0) {
      overdue.push({
        id: pp.id,
        module: 'Prarthna Patra',
        title: `${pp.petition_type} — ${pp.matter || pp.registration_number || pp.id.slice(0, 8)}`,
        daysOverdue: Math.abs(days),
        route: `/(app)/prarthna-patra/${pp.id}`,
        color: MODULE_COLORS['Prarthna Patra'],
      });
    }
  }

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ── Recent Activity (latest 20 across all modules) ────────────────────
  const activities: RecentActivity[] = [];

  firs.forEach((f) =>
    activities.push({
      id: f.id,
      label: 'FIR Added',
      subtitle: `${f.fir_number || '—'} · ${f.crime_type}`,
      time: f.created_at,
      route: `/(app)/mukadma/${f.id}`,
      color: MODULE_COLORS.Mukadma,
    })
  );
  nyayalayDocs.forEach((d) =>
    activities.push({
      id: d.id,
      label: 'Court Document Added',
      subtitle: `${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type} · ${d.court_name || '—'}`,
      time: d.created_at,
      route: `/(app)/nyayalay/${d.id}`,
      color: MODULE_COLORS.Nyayalay,
    })
  );
  ppAll.forEach((p) =>
    activities.push({
      id: p.id,
      label: 'Prarthna Patra Added',
      subtitle: `${p.petition_type} · ${p.matter || p.registration_number || '—'}`,
      time: p.created_at,
      route: `/(app)/prarthna-patra/${p.id}`,
      color: MODULE_COLORS['Prarthna Patra'],
    })
  );
  gdAll.forEach((g) =>
    activities.push({
      id: g.id,
      label: 'GD Entry Created',
      subtitle: `${g.gd_type} · ${g.preparation_date}`,
      time: g.created_at,
      route: `/(app)/gd/${g.id}`,
      color: MODULE_COLORS.GD,
    })
  );
  nirodhatmakAll.forEach((n) =>
    activities.push({
      id: n.id,
      label: 'BNSS Proceeding Added',
      subtitle: n.format_title || '—',
      time: n.created_at,
      route: '/(app)/nirodhatmak',
      color: MODULE_COLORS.Nirodhatmak,
    })
  );

  activities.sort((a, b) => b.time - a.time);
  const recentActivity = activities.slice(0, 20);

  // ── Today's Summary ───────────────────────────────────────────────────
  const todayNylDue = nyayalayDocs.filter(
    (d) => d.status !== 'Finished' && d.deadline_date === today
  ).length;
  const todayPpDue = ppAll.filter(
    (p) => p.status === 'Pending' && p.deadline_date === today
  ).length;

  const totalOverdue =
    nyayalayAnalytics.overall.overdue +
    (ppFull.byType['बीट सूचना']?.overdue ?? 0);

  const today_summary: TodaySummary = {
    todayPending: safeNum(mukadma.pending + ppOverall.pending + nyayalayAnalytics.overall.pending),
    todayCompleted: safeNum(
      firs.filter((f) => f.created_at >= todayStart && f.created_at <= todayEnd && f.status === 'Finished').length +
      ppAll.filter((p) => p.created_at >= todayStart && p.created_at <= todayEnd && p.status !== 'Pending').length,
    ),
    todayDue: safeNum(todayNylDue + todayPpDue),
    todayOverdue: safeNum(totalOverdue),
    activeCase: safeNum(mukadma.pending),
    activeCourtDocs: safeNum(nyayalayDocs.filter((d) => d.status !== 'Finished').length),
    pendingPrarthnaPatra: safeNum(ppOverall.pending),
    todayGD: safeNum(gd.todayCount),
  };

  // ── Productivity ──────────────────────────────────────────────────────
  const allRecords = [...firs, ...nyayalayDocs, ...ppAll, ...gdAll, ...nirodhatmakAll];
  const createdToday = allRecords.filter(
    (r) => r.created_at >= todayStart && r.created_at <= todayEnd
  ).length;
  const createdThisWeek = allRecords.filter((r) => r.created_at >= weekStart).length;
  const createdThisMonth = allRecords.filter((r) => r.created_at >= monthStart).length;

  const totalFinished = safeNum(mukadma.finished) + safeNum(nyayalayAnalytics.overall.finished) + safeNum(ppOverall.finished);
  const totalPendingAll = safeNum(mukadma.pending) + safeNum(nyayalayAnalytics.overall.pending) + safeNum(ppOverall.pending);
  const grandTotal = totalFinished + totalPendingAll;
  const completionPct = safePct(totalFinished, grandTotal);

  const productivity: ProductivityAnalytics = {
    createdToday:    safeNum(createdToday),
    createdThisWeek: safeNum(createdThisWeek),
    createdThisMonth: safeNum(createdThisMonth),
    totalPending:    safeNum(totalPendingAll),
    totalFinished:   safeNum(totalFinished),
    completionPct,
  };

  return {
    today: today_summary,
    mukadma,
    nyayalay: nyayalayAnalytics,
    pp: ppFull,
    gd,
    nirodhatmak,
    halka,
    knowledge,
    reminders,
    overdue,
    recentActivity,
    productivity,
    rawFIRs: firs,
    rawNyayalay: nyayalayDocs,
    rawPP: ppAll,
    rawGD: gdAll,
    rawNirodhatmak: nirodhatmakAll,
  };
}

// ── Universal Search ───────────────────────────────────────────────────────

export type UniversalSearchModule = 'FIR' | 'GD' | 'Nyayalay' | 'Prarthna Patra' | 'Knowledge' | 'Nirodhatmak' | 'Halka';

export interface UniversalSearchItem {
  id: string;
  module: UniversalSearchModule;
  title: string;
  subtitle: string;
  route: string;
  color: string;
}

export async function universalSearch(query: string): Promise<UniversalSearchItem[]> {
  if (!query.trim()) return [];

  const [firs, gds, nylDocs, ppResults, knowledge, nirodhatmak, halkaEntities] = await Promise.all([
    searchFIRs(query).catch(() => []),
    searchGdEntries(query, 'All').catch(() => []),
    searchNyayalayDocuments(query).catch(() => []),
    searchPrarthnaPatra(query).catch(() => []),
    searchKnowledgeAll(query).catch(() => []),
    searchNirodhatmakKaryvahi(query).catch(() => []),
    globalSearch(query).catch(() => []),
  ]);

  const results: UniversalSearchItem[] = [];

  firs.slice(0, 5).forEach((f) =>
    results.push({
      id: f.id,
      module: 'FIR',
      title: `FIR ${f.fir_number || '—'}`,
      subtitle: `${f.crime_type} · ${f.complainant_name}`,
      route: `/(app)/mukadma/${f.id}`,
      color: MODULE_COLORS.Mukadma,
    })
  );
  gds.slice(0, 5).forEach((g) =>
    results.push({
      id: g.id,
      module: 'GD',
      title: `GD · ${g.gd_type}`,
      subtitle: g.preparation_date,
      route: `/(app)/gd/${g.id}`,
      color: MODULE_COLORS.GD,
    })
  );
  nylDocs.slice(0, 5).forEach((d) =>
    results.push({
      id: d.id,
      module: 'Nyayalay',
      title: `${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}`,
      subtitle: d.court_name || d.registration_number || '—',
      route: `/(app)/nyayalay/${d.id}`,
      color: MODULE_COLORS.Nyayalay,
    })
  );
  ppResults.slice(0, 5).forEach((p) =>
    results.push({
      id: p.id,
      module: 'Prarthna Patra',
      title: p.petition_type,
      subtitle: p.matter || p.registration_number || '—',
      route: `/(app)/prarthna-patra/${p.id}`,
      color: MODULE_COLORS['Prarthna Patra'],
    })
  );
  knowledge.slice(0, 5).forEach((k) =>
    results.push({
      id: k.id,
      module: 'Knowledge',
      title: k.title,
      subtitle: `${k.category} · ${k.subcategory}`,
      route: `/(app)/knowledge/${k.id}`,
      color: MODULE_COLORS.Knowledge,
    })
  );
  nirodhatmak.slice(0, 5).forEach((n) =>
    results.push({
      id: n.id,
      module: 'Nirodhatmak',
      title: n.format_title || n.proceeding_type || 'BNSS Proceeding',
      subtitle: n.village_name ? `${n.proceeding_type} · ${n.village_name}` : n.proceeding_type,
      route: '/(app)/nirodhatmak',
      color: MODULE_COLORS.Nirodhatmak,
    })
  );
  halkaEntities.slice(0, 5).forEach((h) =>
    results.push({
      id: h.id,
      module: 'Halka',
      title: h.title,
      subtitle: h.subtitle ?? h.gp_name ?? '—',
      route: h.gp_id ? `/(app)/halka/${h.gp_id}` : '/(app)/halka',
      color: MODULE_COLORS.Halka,
    })
  );

  return results;
}
