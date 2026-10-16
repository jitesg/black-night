/**
 * ContradictionEngine.ts
 * Cross-checks all investigation modules and detects contradictions.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { ContradictionReport, Contradiction, ContradictionType } from './IntelligenceTypes';

let cid = 0;
function makeId() { return `CONTR-${String(++cid).padStart(3, '0')}`; }

export class ContradictionEngine {
  static evaluate(ctx: InvestigationContext): ContradictionReport {
    cid = 0;
    const contradictions: Contradiction[] = [];

    // ── C1: Arrest without Arrest Memo ───────────────────────────────────────
    const hasArrest    = ctx.karyvahi.all.some((k) => /arrest|गिरफ्तार/i.test(k.name));
    const hasArrestMemo = ctx.karyvahi.all.some((k) => /arrest\s*memo|गिरफ्तारी.*पंचनामा/i.test(k.name));
    if (hasArrest && !hasArrestMemo) {
      contradictions.push({
        id: makeId(),
        type: 'critical',
        title: 'Arrest Recorded — Arrest Memo Missing',
        description: 'Arrest action is recorded in Karyvahi but no Arrest Memo document was found. Arrest without memo violates BNSS Section 47.',
        modulesInvolved: ['Karyvahi', 'Documentation'],
        recommendation: 'Prepare Arrest Memo immediately with two witness signatures.',
        legalImplication: 'Arrest without memo is procedurally defective and may be challenged in court.',
      });
    }

    // ── C2: Recovery/Seizure without Seizure Memo ────────────────────────────
    const hasSeizure     = ctx.karyvahi.all.some((k) => /seizure|recovery|जब्ती|बरामद/i.test(k.name));
    const hasSeizureMemo = ctx.karyvahi.all.some((k) => /seizure.*memo|panchnama|पंचनामा|जब्ती.*पंचनामा/i.test(k.name));
    if (hasSeizure && !hasSeizureMemo) {
      contradictions.push({
        id: makeId(),
        type: 'critical',
        title: 'Recovery Recorded — Seizure Memo / Panchnama Missing',
        description: 'Evidence recovery/seizure is recorded but no Seizure Memo/Panchnama found. Seized evidence without proper documentation may be inadmissible.',
        modulesInvolved: ['Karyvahi', 'Evidence'],
        recommendation: 'Prepare Seizure Memo/Panchnama with independent witnesses immediately.',
        legalImplication: 'Seizure without panchnama makes evidence legally questionable.',
      });
    }

    // ── C3: Medical Report contradicts injury sections ────────────────────────
    const hasMedical  = ctx.karyvahi.all.some((k) => /medical|mlc|doctor|injury/i.test(k.name));
    const hasInjurySec = /307|302|324|325|326|323|304|109|115/
      .test(ctx.fir?.section ?? '');
    if (hasInjurySec && !hasMedical) {
      contradictions.push({
        id: makeId(),
        type: 'critical',
        title: 'Injury Section in FIR — Medical Report Missing',
        description: `FIR registered under injury/offence sections (${ctx.fir?.section}) but no Medical Examination / MLC found.`,
        modulesInvolved: ['FIR', 'Medical', 'Karyvahi'],
        recommendation: 'Obtain MLC / medical report immediately. This is mandatory for injury offences.',
        legalImplication: 'Missing medical report weakens prosecution evidence for injury charges.',
      });
    }

    // ── C4: Witness count mismatch FIR vs Statements ─────────────────────────
    const witnessStatements = ctx.karyvahi.all.filter((k) => /statement|bayan|witness|गवाह|gavah/i.test(k.name));
    const firText = `${ctx.fir?.complainant_name ?? ''} ${ctx.fir?.crime_type ?? ''}`;
    const mentionedWitnesses = (firText.match(/witness|gavah|गवाह/gi) ?? []).length;
    if (mentionedWitnesses > 0 && witnessStatements.length === 0) {
      contradictions.push({
        id: makeId(),
        type: 'warning',
        title: 'Witnesses Mentioned in FIR — No Statements Recorded',
        description: 'FIR mentions witnesses but no witness statement actions found in Karyvahi.',
        modulesInvolved: ['FIR', 'Karyvahi', 'Witness'],
        recommendation: 'Record statements of all witnesses mentioned in FIR under BNSS Section 180.',
      });
    }

    // ── C5: Case Diary missing completed investigation steps ──────────────────
    const completedCount = ctx.karyvahi.completed.length;
    if (completedCount >= 3 && ctx.caseDiaries.length === 0) {
      contradictions.push({
        id: makeId(),
        type: 'critical',
        title: 'Investigation Steps Completed — Case Diary Not Maintained',
        description: `${completedCount} investigation actions are marked completed but no Case Diary entries are recorded.`,
        modulesInvolved: ['Karyvahi', 'CaseDiary'],
        recommendation: 'Maintain Case Diary immediately for all completed investigation steps.',
        legalImplication: 'Case Diary is a statutory requirement under BNSS Section 193. Missing diary weakens investigation record.',
      });
    }

    // ── C6: Court action missing supporting document ──────────────────────────
    const pendingCourtDocs = ctx.courtDocs.filter((d) => d.status === 'Pending');
    pendingCourtDocs.forEach((doc) => {
      const today = new Date().toISOString().split('T')[0];
      if (doc.deadline_date < today) {
        contradictions.push({
          id: makeId(),
          type: 'critical',
          title: `Overdue Court Action: ${doc.doc_type}`,
          description: `Court document "${doc.doc_type}" (${doc.registration_number}) was due on ${doc.deadline_date} and is still pending.`,
          modulesInvolved: ['Nyayalay', 'Court'],
          recommendation: `Take immediate action on ${doc.doc_type}. Court deadline has passed.`,
          legalImplication: 'Non-compliance with court orders may result in adverse orders or contempt.',
        });
      }
    });

    // ── C7: FSL evidence sent but no FSL report follow-up ────────────────────
    const fslSent    = ctx.karyvahi.all.some((k) => /fsl.*sent|send.*fsl|evidence.*fsl/i.test(k.name));
    const fslReceived = ctx.karyvahi.all.some((k) => /fsl.*report|fsl.*received|forensic.*report/i.test(k.name));
    if (fslSent && !fslReceived) {
      contradictions.push({
        id: makeId(),
        type: 'warning',
        title: 'FSL Evidence Sent — FSL Report Not Received',
        description: 'Evidence was sent to FSL but no follow-up or receipt of FSL report is recorded.',
        modulesInvolved: ['FSL', 'Karyvahi'],
        recommendation: 'Follow up with FSL for pending report. Record follow-up in Case Diary.',
      });
    }

    // ── C8: Accused produced in court but no remand order ────────────────────
    const produced = ctx.karyvahi.all.some((k) => /court.*production|production|पेशी/i.test(k.name));
    const hasRemand = ctx.courtDocs.some((d) => /remand|judicial.*custody|police.*custody/i.test(d.doc_type));
    if (produced && !hasRemand && hasArrest) {
      contradictions.push({
        id: makeId(),
        type: 'warning',
        title: 'Court Production Recorded — No Remand Order Found',
        description: 'Accused was produced in court but no corresponding remand/custody order is documented.',
        modulesInvolved: ['Karyvahi', 'Nyayalay'],
        recommendation: 'Obtain and file the court remand order in the Nyayalay module.',
      });
    }

    // ── C9: Investigation inactivity while FIR pending ────────────────────────
    if (ctx.fir?.status === 'Pending') {
      const dates = [
        ...ctx.karyvahi.all.map((k) => k.created_at * 1000),
        ...ctx.caseDiaries.map((d) => new Date(d.preparation_date).getTime()),
      ];
      if (dates.length > 0) {
        const lastActivity = Math.max(...dates);
        const daysSince = Math.floor((Date.now() - lastActivity) / 86_400_000);
        if (daysSince >= 10) {
          contradictions.push({
            id: makeId(),
            type: 'warning',
            title: `Investigation Inactive for ${daysSince} Days`,
            description: `No karyvahi or case diary activity recorded in the last ${daysSince} days while the FIR is still pending.`,
            modulesInvolved: ['Karyvahi', 'CaseDiary', 'FIR'],
            recommendation: 'Resume investigation immediately. Update Case Diary with all recent actions.',
          });
        }
      }
    }

    // ── C10: FIR registered but zero karyvahi ─────────────────────────────────
    if (ctx.fir && ctx.karyvahi.all.length === 0) {
      contradictions.push({
        id: makeId(),
        type: 'critical',
        title: 'FIR Registered — No Investigation Actions Recorded',
        description: 'A FIR has been registered but no investigation actions (Karyvahi) are recorded.',
        modulesInvolved: ['FIR', 'Karyvahi'],
        recommendation: 'Begin investigation immediately. Create Karyvahi entries for all actions taken.',
      });
    }

    // ── C11: Prarthna Patra overdue ───────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const overduePP = ctx.prarthnaPatra.filter(
      (p) => p.status === 'Pending' && p.deadline_date && p.deadline_date < today
    );
    if (overduePP.length > 0) {
      contradictions.push({
        id: makeId(),
        type: 'warning',
        title: `${overduePP.length} Prarthna Patra Overdue`,
        description: `${overduePP.length} application(s) (Prarthna Patra) have passed their deadline without resolution.`,
        modulesInvolved: ['PrarthnaPatra'],
        recommendation: 'Review and resolve overdue Prarthna Patra immediately.',
      });
    }

    const criticalCount = contradictions.filter((c) => c.type === 'critical').length;
    const warningCount  = contradictions.filter((c) => c.type === 'warning').length;
    const infoCount     = contradictions.filter((c) => c.type === 'information').length;

    const summary =
      contradictions.length === 0
        ? '✅ No contradictions detected across investigation modules.'
        : `${contradictions.length} contradiction(s) found: ` +
          (criticalCount > 0 ? `🔴 ${criticalCount} critical, ` : '') +
          (warningCount  > 0 ? `🟡 ${warningCount} warning, ` : '') +
          (infoCount     > 0 ? `ℹ️ ${infoCount} info. ` : '');

    return {
      totalContradictions: contradictions.length,
      criticalCount,
      warningCount,
      infoCount,
      contradictions,
      summary,
    };
  }
}
