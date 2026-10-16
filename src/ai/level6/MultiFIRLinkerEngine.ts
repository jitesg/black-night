/**
 * MultiFIRLinkerEngine.ts
 * Level-6: Detects linked FIRs across repeat accused, witness, location,
 * vehicle, mobile, and modus operandi. Shows suggestions only.
 *
 * SAFETY: Read-only advisory. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { MultiFIRLinkerReport, LinkedFIRCluster } from './L6Types';

function normalize(s?: string | null): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// clusterIdx is local to each analyze() call — passed by reference via closure
function mkClusterFactory(counter: { n: number }) {
  return function mkCluster(
    linkType: LinkedFIRCluster['linkType'],
    firIds: string[],
    firNumbers: string[],
    matchedValue: string,
    confidence: number,
    description: string,
    recommendation: string,
  ): LinkedFIRCluster {
    counter.n += 1;
    return {
      clusterId:  `l6-cluster-${counter.n}`,
      linkType,
      firIds,
      firNumbers,
      matchedValue,
      confidence,
      description,
      recommendation,
    };
  };
}

function extractTokens(text: string): string[] {
  return text.toLowerCase().split(/[\s,;|/]+/).filter((t) => t.length >= 3);
}

export class MultiFIRLinkerEngine {
  static analyze(contexts: InvestigationContext[]): MultiFIRLinkerReport {
    const counter = { n: 0 };
    const mkCluster = mkClusterFactory(counter);
    const clusters: LinkedFIRCluster[] = [];

    if (contexts.length < 2) {
      return {
        generatedAt:              new Date().toISOString(),
        totalFIRsAnalyzed:        contexts.length,
        clusters:                 [],
        repeatAccusedCount:       0,
        repeatWitnessCount:       0,
        repeatLocationCount:      0,
        repeatVehicleCount:       0,
        repeatMobileCount:        0,
        suspectedSerialCrimeCount: 0,
        summary:                  'Insufficient FIRs for cross-FIR intelligence. Provide at least 2 FIR contexts.',
      };
    }

    // Build lookup maps
    const accusedMap   = new Map<string, { firId: string; firNumber: string }[]>();
    const witnessMap   = new Map<string, { firId: string; firNumber: string }[]>();
    const locationMap  = new Map<string, { firId: string; firNumber: string }[]>();
    const vehicleMap   = new Map<string, { firId: string; firNumber: string }[]>();
    const mobileMap    = new Map<string, { firId: string; firNumber: string }[]>();
    const modusMap     = new Map<string, { firId: string; firNumber: string }[]>();

    function addToMap(
      map: Map<string, { firId: string; firNumber: string }[]>,
      key: string,
      firId: string,
      firNumber: string
    ) {
      const k = normalize(key);
      if (!k || k.length < 3) return;
      const arr = map.get(k) ?? [];
      if (!arr.some((e) => e.firId === firId)) {
        arr.push({ firId, firNumber });
      }
      map.set(k, arr);
    }

    for (const ctx of contexts) {
      const firId     = ctx.activeFirId ?? '';
      const firNumber = ctx.fir?.fir_number ?? '';
      const fir       = ctx.fir;

      // Accused names from fir.complainant_name
      if (fir?.complainant_name) {
        fir.complainant_name.split(/[,;|]/).forEach((n: string) => addToMap(accusedMap, n, firId, firNumber));
      }

      // Crime location
      if (fir?.ghatnasthal) {
        addToMap(locationMap, fir.ghatnasthal, firId, firNumber);
      }

      // Extract vehicle numbers, mobile numbers, witness names from karyvahi remarks
      for (const kv of ctx.karyvahi.all) {
        const text = (kv.precautions ?? '') + ' ' + kv.name;
        // Vehicle pattern: 2 letters + 2 digits + 2 letters + 4 digits (approx)
        const veh = text.match(/[A-Z]{2}\s?\d{2}\s?[A-Z]{1,2}\s?\d{4}/gi) ?? [];
        veh.forEach((v) => addToMap(vehicleMap, v.replace(/\s/g, '').toUpperCase(), firId, firNumber));
        // Mobile pattern
        const mob = text.match(/[6-9]\d{9}/g) ?? [];
        mob.forEach((m) => addToMap(mobileMap, m, firId, firNumber));
        // Witness names in bayan karyvahi
        if (/witness|bayan/.test(kv.name.toLowerCase()) && kv.precautions) {
          kv.precautions.split(/[,;|]/).slice(0, 3).forEach((w: string) => addToMap(witnessMap, w, firId, firNumber));
        }
      }

      // Modus operandi from crime_type
      if (fir?.crime_type) {
        extractTokens(fir.crime_type).forEach((t) => addToMap(modusMap, t, firId, firNumber));
      }
    }

    // ── Generate clusters from map entries with ≥2 FIRs ──────────────────────
    function buildClusters(
      map: Map<string, { firId: string; firNumber: string }[]>,
      linkType: LinkedFIRCluster['linkType'],
      descTemplate: (val: string, count: number) => string,
      rec: string,
      confidence: number
    ) {
      map.forEach((entries, key) => {
        if (entries.length >= 2) {
          clusters.push(mkCluster(
            linkType,
            entries.map((e) => e.firId),
            entries.map((e) => e.firNumber),
            key,
            confidence,
            descTemplate(key, entries.length),
            rec
          ));
        }
      });
    }

    buildClusters(accusedMap, 'repeat-accused',
      (v, n) => `Accused "${v}" appears in ${n} FIRs. Possible serial offender.`,
      'Investigate connections between FIRs. Consider combining investigation for efficiency.', 88);

    buildClusters(witnessMap, 'repeat-witness',
      (v, n) => `Witness "${v}" appears in ${n} FIRs. Verify relationship and cross-examine.`,
      'Cross-examine witness statement consistency across FIRs.', 72);

    buildClusters(locationMap, 'repeat-location',
      (v, n) => `Location "${v}" recurs across ${n} FIRs. Possible crime hotspot.`,
      'Alert patrol to crime hotspot. Consider coordinated surveillance.', 80);

    buildClusters(vehicleMap, 'repeat-vehicle',
      (v, n) => `Vehicle "${v}" linked to ${n} FIRs. Check registration and surveillance footage.`,
      'Trace vehicle owner and check CCTV from all incident locations.', 90);

    buildClusters(mobileMap, 'repeat-mobile',
      (v, n) => `Mobile number ${v} appears in ${n} FIRs. Possible shared contact or accused.`,
      'Obtain call detail records and trace mobile owner.', 85);

    buildClusters(modusMap, 'repeat-modus-operandi',
      (v, n) => `Crime type "${v}" recurs in ${n} FIRs. Possible serial crime pattern.`,
      'Investigate for serial crime angle. Coordinate with crime branch.', 70);

    // ── Counts ────────────────────────────────────────────────────────────────
    const countOf = (t: LinkedFIRCluster['linkType']) => clusters.filter((c) => c.linkType === t).length;
    const suspectedSerial = clusters.filter((c) =>
      c.linkType === 'repeat-accused' || c.linkType === 'repeat-modus-operandi'
    ).length;

    return {
      generatedAt:               new Date().toISOString(),
      totalFIRsAnalyzed:         contexts.length,
      clusters,
      repeatAccusedCount:        countOf('repeat-accused'),
      repeatWitnessCount:        countOf('repeat-witness'),
      repeatLocationCount:       countOf('repeat-location'),
      repeatVehicleCount:        countOf('repeat-vehicle'),
      repeatMobileCount:         countOf('repeat-mobile'),
      suspectedSerialCrimeCount: suspectedSerial,
      summary: clusters.length === 0
        ? `No cross-FIR links detected across ${contexts.length} FIR(s).`
        : `${clusters.length} cross-FIR link(s) detected across ${contexts.length} FIRs. ${suspectedSerial} possible serial crime pattern(s).`,
    };
  }
}
