/**
 * AIContextBuilder.ts
 * Lightweight snapshot builder for quick session init.
 * The heavy lifting is now done by InvestigationContextBuilder.
 *
 * AIContextBuilder is kept for backward compat with AICopilotModal / AIContextBar.
 */

import { getWorkspaceSettings } from '@/lib/db/workspaceRepo';
import { getFIRById } from '@/lib/db/firRepo';
import { loadDashboardData } from '@/lib/db/dashboardRepo';
import type { AIContextSnapshot, AIWorkspaceContext } from './AITypes';
import type { FIR } from '@/lib/db/firRepo';
import type { DashboardData } from '@/lib/db/dashboardRepo';

// Re-export so existing imports still work
export { InvestigationContextBuilder } from './InvestigationContextBuilder';

export interface FullContext {
  snapshot: AIContextSnapshot;
  activeFir?: FIR;
  recentFirs?: FIR[];
  dashboardData?: DashboardData;
}

export class AIContextBuilder {
  static async buildSnapshot(activeFirId?: string): Promise<AIContextSnapshot> {
    const ws = await getWorkspaceSettings();
    const workspace: AIWorkspaceContext = {
      policeStation: ws.police_station,
      district: ws.district,
      officerName: ws.officer_name,
      halka: ws.halka,
      beat: ws.beat,
    };

    let activeFirNumber: string | undefined;
    if (activeFirId) {
      try {
        const fir = await getFIRById(activeFirId);
        activeFirNumber = fir?.fir_number;
      } catch {
        // non-fatal
      }
    }

    return { workspace, activeFirId, activeFirNumber, timestamp: Date.now() };
  }

  static async buildFullContext(activeFirId?: string): Promise<FullContext> {
    const [snapshot, allFIRs, dashboardData] = await Promise.allSettled([
      AIContextBuilder.buildSnapshot(activeFirId),
      import('@/lib/db/firRepo').then((m) => m.getAllFIRs()),
      loadDashboardData(),
    ]);

    const snap = snapshot.status === 'fulfilled' ? snapshot.value : await AIContextBuilder.buildSnapshot();
    const firs = allFIRs.status === 'fulfilled' ? allFIRs.value : [];
    const dash = dashboardData.status === 'fulfilled' ? dashboardData.value : undefined;

    return {
      snapshot: snap,
      activeFir: firs.find((f) => f.id === activeFirId),
      recentFirs: firs.slice(0, 5),
      dashboardData: dash,
    };
  }

  static formatContextHeader(snapshot: AIContextSnapshot): string {
    const { workspace, activeFirNumber } = snapshot;
    const lines = [
      `Police Station: ${workspace.policeStation || 'Not set'}`,
      `District: ${workspace.district || 'Not set'}`,
      `Officer: ${workspace.officerName || 'Not set'}`,
    ];
    if (activeFirNumber) lines.push(`Active FIR: ${activeFirNumber}`);
    return lines.join(' | ');
  }
}

