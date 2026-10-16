/**
 * PolicyVersionManager.ts
 * Level-7: Versioned policy packs for rule management.
 * Supports UP Police, State Rules, BNSS Updates, Department Circulars.
 *
 * SAFETY: Read-only. In-memory registry. No DB access. No writes.
 */

import type { PolicyPack, PolicyVersionReport, PolicySource } from './L7Types';
import { RuleEngineStudio } from './RuleEngineStudio';

// ── Built-in policy packs ─────────────────────────────────────────────────────

const BUILT_IN_PACKS: PolicyPack[] = [
  {
    id: 'pack-bnss-v1',
    version: '1.0.0',
    source: 'BNSS Update',
    title: 'BNSS 2023 — Core Investigation Rules',
    description: 'Bharatiya Nagarik Suraksha Sanhita 2023 investigation procedure rules.',
    effectiveDate: '2024-07-01',
    ruleIds: ['L7-BNSS-001','L7-BNSS-002','L7-BNSS-003','L7-BNSS-004','L7-BNSS-005','L7-BNSS-006','L7-BNSS-007'],
    active: true,
    changelog: ['v1.0.0 — Initial BNSS rules pack (2024-07-01)'],
  },
  {
    id: 'pack-bns-v1',
    version: '1.0.0',
    source: 'BNS Update',
    title: 'BNS 2023 — Charge Sheet & Bail Rules',
    description: 'Bharatiya Nyaya Sanhita 2023 charge sheet timeline and bail rules.',
    effectiveDate: '2024-07-01',
    ruleIds: ['L7-BNS-001'],
    active: true,
    changelog: ['v1.0.0 — Initial BNS charge-sheet timeline rules'],
  },
  {
    id: 'pack-sop-v1',
    version: '1.0.0',
    source: 'UP Police',
    title: 'UP Police SOP — General Diary & Investigation Standards',
    description: 'Standard operating procedures for UP Police investigation documentation.',
    effectiveDate: '2023-01-01',
    ruleIds: ['L7-SOP-001'],
    active: true,
    changelog: ['v1.0.0 — UP Police SOP rules'],
  },
  {
    id: 'pack-court-v1',
    version: '1.0.0',
    source: 'Court Directive',
    title: 'Court Compliance Procedures',
    description: 'Compliance rules for court deadlines, warrants, and summons.',
    effectiveDate: '2024-01-01',
    ruleIds: ['L7-COURT-001'],
    active: true,
    changelog: ['v1.0.0 — Initial court compliance rules'],
  },
];

// ── Registry ──────────────────────────────────────────────────────────────────

const _packs: PolicyPack[] = [...BUILT_IN_PACKS];

export const PolicyVersionManager = {
  /** Register or update a policy pack. Rules inside are forwarded to RuleEngineStudio. */
  registerPack(pack: PolicyPack, rules?: Parameters<typeof RuleEngineStudio.registerPack>[0]): void {
    const idx = _packs.findIndex((p) => p.id === pack.id);
    if (idx >= 0) _packs[idx] = pack;
    else _packs.push(pack);
    if (rules) RuleEngineStudio.registerPack(rules);
  },

  /** Activate or deactivate a pack by id */
  setPack(id: string, active: boolean): void {
    const p = _packs.find((x) => x.id === id);
    if (p) p.active = active;
  },

  getPacks(): PolicyPack[] {
    return [..._packs];
  },

  getActivePacks(): PolicyPack[] {
    return _packs.filter((p) => p.active);
  },

  getBySource(source: PolicySource): PolicyPack[] {
    return _packs.filter((p) => p.source === source);
  },

  generateReport(): PolicyVersionReport {
    const active = _packs.filter((p) => p.active);
    const allRules = RuleEngineStudio.getRules();
    const latest = _packs.reduce((acc, p) => {
      return p.version > acc ? p.version : acc;
    }, '0.0.0');

    return {
      generatedAt: new Date().toISOString(),
      activePacks: active,
      allPacks: [..._packs],
      latestVersion: latest,
      totalRules: allRules.length,
      enabledRules: allRules.filter((r) => r.enabled).length,
    };
  },
};
