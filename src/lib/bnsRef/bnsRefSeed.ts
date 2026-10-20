/**
 * bnsRefSeed.ts — assets/seed/bns_ref_seed.json (10 knowledge rows,
 * ids sys-ref-bns-*, content_type 'bns_ref'). Loaded through the same
 * seed pipeline as the Regulations seeds (token seed_file:bns_ref_seed.json).
 */
import type { RegSeedFile, RegSeedRow } from '@/lib/regulations/regSeedFiles';

export const BNS_REF_SEED_NAME = 'bns_ref_seed.json';

function load(): RegSeedFile {
  try {
    const data = require('../../../assets/seed/bns_ref_seed.json') as { knowledge?: RegSeedRow[] } | null;
    const rows = Array.isArray(data?.knowledge) ? data!.knowledge! : [];
    return {
      fileName: BNS_REF_SEED_NAME,
      rows: rows.map((r) => ({
        ...r,
        category: r.category || 'Law',
        source: 'system',
        editable: 0,
        content_type: r.content_type || 'bns_ref',
        seed_version: Number(r.seed_version ?? 1) || 1,
      })),
    };
  } catch (e) {
    return { fileName: BNS_REF_SEED_NAME, rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export const BNS_REF_SEED_FILE: RegSeedFile = load();

export const BNS_REF_PINNED = [
  { id: 'sys-ref-bns-overview', label: 'BNS 2023 — सामान्य परिचय' },
  { id: 'sys-ref-bns-annex1', label: 'नई धाराएँ (अनुलग्नक-I)' },
  { id: 'sys-ref-bns-annex3', label: 'हटाई धाराएँ (अनुलग्नक-III)' },
  { id: 'sys-ref-bns-annex7', label: 'दैनिक पुलिसिंग (अनुलग्नक-VII)' },
];

export const BNSS_KEY_IDS = [
  'sys-ref-bns-bnss-105', 'sys-ref-bns-bnss-176_3', 'sys-ref-bns-bnss-183',
  'sys-ref-bns-bnss-185', 'sys-ref-bns-bnss-187', 'sys-ref-bns-bnss-193',
];
