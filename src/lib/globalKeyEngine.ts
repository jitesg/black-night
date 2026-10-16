/**
 * Global System Key Engine
 *
 * Centralized registry that maps well-known template keys (e.g. {{State}},
 * {{PoliceStation}}) to their corresponding Station Workspace fields.
 *
 * Execution order:
 *   1. resolveGlobalKeys() runs first — consumes all registry keys from Workspace.
 *   2. filterDynamicKeys() returns the remaining keys for user input (Dynamic Key Engine).
 *   3. Caller merges both value sets and calls generateReport().
 *
 * Adding a new Global System Key:
 *   • Add an entry to GLOBAL_KEY_REGISTRY.
 *   • Add a human-readable label to GLOBAL_KEY_LABELS.
 *   • No changes needed in the report generation engine.
 *
 * Adding a new Nyayalay Auto-fill Key:
 *   • Add an entry to NYAYALAY_KEY_REGISTRY with the NyayalayDocument field name.
 *   • Add a human-readable label to NYAYALAY_KEY_LABELS.
 *   • resolveNyayalayKeys() will automatically pick it up at report generation time.
 */

import { type WorkspaceSettings } from './db/workspaceRepo';
import { type NyayalayDocument } from './db/nyayalayRepo';

// ─── Workspace Registry ────────────────────────────────────────────────────
// Maps template key name → WorkspaceSettings field.
export const GLOBAL_KEY_REGISTRY: Readonly<Record<string, keyof WorkspaceSettings>> = {
  State:         'state',
  District:      'district',
  PoliceStation: 'police_station',
  OfficerName:   'officer_name',
} as const;

// Human-readable labels used in validation / missing-field messages.
export const GLOBAL_KEY_LABELS: Readonly<Record<string, string>> = {
  State:         'State',
  District:      'District',
  PoliceStation: 'Police Station',
  OfficerName:   'Officer Name',
} as const;

// ─── Nyayalay Auto-fill Registry ───────────────────────────────────────────
// Maps template placeholder key → NyayalayDocument field.
// Add new entries here; no other code changes required.
export const NYAYALAY_KEY_REGISTRY: Readonly<Record<string, keyof NyayalayDocument>> = {
  NBW_NO:             'registration_number',
  NBW_DATE:           'deadline_date',
  NBW_COURT:          'court_name',
  NBW_EXECUTION_DATE: 'deadline_date',
  SUMMON_NO:          'registration_number',
  SUMMON_DATE:        'deadline_date',
  HEARING_DATE:       'deadline_date',
  COURT_NAME:         'court_name',
  CASE_NO:            'vad_sankhya',
  court_name:         'court_name',
  vad_sankhya:        'vad_sankhya',
  apradh_sankhya:     'apradh_sankhya',
  fir_number:         'fir_number',
} as const;

// Human-readable display names for the key reference panel shown in the detail screen.
export const NYAYALAY_KEY_LABELS: Readonly<Record<string, string>> = {
  NBW_NO:             'NBW Number',
  NBW_DATE:           'NBW Date',
  NBW_COURT:          'NBW Court',
  NBW_EXECUTION_DATE: 'NBW Execution Date',
  SUMMON_NO:          'Summons Number',
  SUMMON_DATE:        'Summons Date',
  HEARING_DATE:       'Hearing Date',
  COURT_NAME:         'Court Name',
  CASE_NO:            'Case (Vad) Number',
  court_name:         'Court Name',
  vad_sankhya:        'Case / ST No.',
  apradh_sankhya:     'FIR Number',
  fir_number:         'FIR Number',
  accused_names:      'Accused Names',
} as const;

/** Keys shown specifically for NBW documents. */
export const NBW_AUTO_FILL_KEYS: ReadonlyArray<string> = [
  'NBW_NO', 'NBW_DATE', 'NBW_COURT', 'NBW_EXECUTION_DATE',
  'COURT_NAME', 'CASE_NO', 'court_name', 'vad_sankhya', 'apradh_sankhya', 'accused_names',
] as const;

/** Keys shown specifically for Summons documents. */
export const SUMMONS_AUTO_FILL_KEYS: ReadonlyArray<string> = [
  'SUMMON_NO', 'SUMMON_DATE', 'HEARING_DATE', 'COURT_NAME', 'CASE_NO',
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────
export interface GlobalKeyResolution {
  /** Keys resolved automatically from Workspace — ready to merge into report values. */
  autoValues: Record<string, string>;
  /**
   * Human-readable Workspace field names whose values are missing/empty.
   * When non-empty, generation must be blocked with a clear message.
   */
  missingWorkspaceFields: string[];
}

// ─── Core Functions ────────────────────────────────────────────────────────

/**
 * Step 1 of the Global System Key Engine.
 *
 * Scans a template string for all {{Key}} tokens.
 * For every token that exists in GLOBAL_KEY_REGISTRY:
 *   - If the Workspace has a non-empty value → adds to autoValues.
 *   - If the Workspace value is empty         → adds to missingWorkspaceFields.
 *
 * Non-registry tokens are ignored here; they flow to the Dynamic Key Engine.
 */
export function resolveGlobalKeys(
  template: string,
  workspace: WorkspaceSettings,
): GlobalKeyResolution {
  const autoValues: Record<string, string> = {};
  const missingWorkspaceFields: string[] = [];
  const seen = new Set<string>();

  const keyPattern = /\{\{([A-Za-z0-9_]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = keyPattern.exec(template)) !== null) {
    const keyName = match[1];
    if (seen.has(keyName)) continue;
    seen.add(keyName);

    if (keyName in GLOBAL_KEY_REGISTRY) {
      const wsField = GLOBAL_KEY_REGISTRY[keyName];
      const value = workspace[wsField]?.trim() ?? '';
      if (value) {
        autoValues[keyName] = value;
      } else {
        missingWorkspaceFields.push(GLOBAL_KEY_LABELS[keyName] ?? keyName);
      }
    }
  }

  return { autoValues, missingWorkspaceFields };
}

/**
 * Resolves Nyayalay document auto-fill keys from a NyayalayDocument.
 *
 * Handles the special `accused_names` virtual key by joining all accused
 * person names — this key is not a direct NyayalayDocument field.
 *
 * Used in fill-format.tsx before showing the dynamic-key form.
 * Only keys actually present in the template string are resolved.
 * Keys whose document field is empty are included with a '—' placeholder
 * so templates never render a raw {{KEY}} token in the generated output.
 */
export function resolveNyayalayKeys(
  template: string,
  doc: NyayalayDocument & { persons?: Array<{ person_type: string; name: string }> },
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const keyPattern = /\{\{([A-Za-z0-9_]+)\}\}/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = keyPattern.exec(template)) !== null) {
    const keyName = match[1];
    if (seen.has(keyName)) continue;
    seen.add(keyName);

    // Special virtual key: accused_names — derived from persons array
    if (keyName === 'accused_names') {
      const names = (doc.persons ?? [])
        .filter((p) => p.person_type === 'accused')
        .map((p) => p.name)
        .join(', ');
      resolved[keyName] = names || '—';
      continue;
    }

    if (!(keyName in NYAYALAY_KEY_REGISTRY)) continue;
    const docField = NYAYALAY_KEY_REGISTRY[keyName];
    // Always resolve — use '—' for empty values so the template placeholder
    // is replaced and never left as a raw {{KEY}} in the generated report.
    const raw = (doc as unknown as Record<string, unknown>)[docField];
    resolved[keyName] = (raw != null && String(raw).trim()) ? String(raw).trim() : '—';
  }

  return resolved;
}

/**
 * Step 2 — Dynamic Key Engine filter.
 *
 * Returns only the keys that require user input, i.e. keys whose key_name
 * is NOT in the Global Key Registry or Nyayalay Key Registry. The Global and
 * Nyayalay keys were already resolved automatically in Step 1.
 */
export function filterDynamicKeys<T extends { key_name: string }>(keys: T[]): T[] {
  return keys.filter(
    (k) => !(k.key_name in GLOBAL_KEY_REGISTRY) && !(k.key_name in NYAYALAY_KEY_REGISTRY)
  );
}

/** Returns true when the given key_name is managed by the Global Key Registry. */
export function isGlobalKey(keyName: string): boolean {
  return keyName in GLOBAL_KEY_REGISTRY;
}

/** Returns true when the given key_name is a Nyayalay auto-fill key. */
export function isNyayalayKey(keyName: string): boolean {
  return keyName in NYAYALAY_KEY_REGISTRY;
}
