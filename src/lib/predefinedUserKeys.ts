/**
 * Predefined User Key Library
 *
 * Centralized SSOT for reusable police-investigation key definitions.
 * These keys are NOT auto-filled (unlike Global System Keys).
 * When inserted into a template they become Dynamic Keys and request
 * user input during report generation.
 *
 * Architecture notes:
 *   • This file is the ONLY place to add, edit, or remove predefined user keys.
 *   • No database table required — the library is static and shipped with the app.
 *   • Keys become regular FormatKeyInput entries once inserted into a template;
 *     their definitions here are only used for the one-tap insert UI.
 *   • The Template Engine, Global System Key Engine, and report generator
 *     require zero changes — inserted keys behave identically to manually
 *     created Dynamic Keys.
 */

import { type FormatKeyInput } from './db/predefinedFormatRepo';

// ─── Type ──────────────────────────────────────────────────────────────────
export interface PredefinedUserKey {
  /** Matches the {{KeyName}} token used in templates. */
  key_name: string;
  /** Human-readable label shown in the Dynamic Form. */
  label: string;
  /** Default field type. Users can change this after insertion. */
  field_type: FormatKeyInput['field_type'];
  /** Short description shown in the library picker. */
  description: string;
}

// ─── Master Library ────────────────────────────────────────────────────────
// To add a new key: append one entry here. No other file needs to change.
export const PREDEFINED_USER_KEYS: readonly PredefinedUserKey[] = [
  {
    key_name: 'Tehsil',
    label: 'तहसील / Block',
    field_type: 'text',
    description: 'Tehsil or block name',
  },
  {
    key_name: 'Complainant',
    label: 'वादी / Complainant / Plaintiff',
    field_type: 'text',
    description: 'Name of the complainant or plaintiff',
  },
  {
    key_name: 'Applicant',
    label: 'आवेदक / Applicant',
    field_type: 'text',
    description: 'Name of the applicant',
  },
  {
    key_name: 'Accused',
    label: 'अभियुक्त / Accused',
    field_type: 'text',
    description: 'Name(s) of the accused',
  },
  {
    key_name: 'IncidentLocation',
    label: 'घटनास्थल',
    field_type: 'text',
    description: 'Location where the incident occurred',
  },
  {
    key_name: 'FIRNumber',
    label: 'FIR / प्रथम सूचना रिपोर्ट',
    field_type: 'text',
    description: 'First Information Report number',
  },
  {
    key_name: 'Defendant',
    label: 'प्रतिवादी / Defendant / Respondent',
    field_type: 'text',
    description: 'Name of the defendant or respondent',
  },
  {
    key_name: 'Witness',
    label: 'गवाह / Witness',
    field_type: 'text',
    description: 'Name(s) of witness(es)',
  },
  {
    key_name: 'Bail',
    label: 'ज़मानत / Bail',
    field_type: 'text',
    description: 'Bail details',
  },
  {
    key_name: 'ChargeSheet',
    label: 'चार्जशीट / Chargesheet',
    field_type: 'text',
    description: 'Chargesheet reference or details',
  },
  {
    key_name: 'Warrant',
    label: 'वारंट / Warrant',
    field_type: 'text',
    description: 'Warrant number or details',
  },
  {
    key_name: 'Summons',
    label: 'समन / Summons',
    field_type: 'text',
    description: 'Summons number or details',
  },
  {
    key_name: 'Panchnama',
    label: 'पंचनामा / Inquest / Panchnama',
    field_type: 'text',
    description: 'Panchnama or inquest details',
  },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns true when the given key_name exists in the Predefined User Key Library. */
export function isPredefinedUserKey(keyName: string): boolean {
  return PREDEFINED_USER_KEYS.some((k) => k.key_name === keyName);
}

/** Look up a predefined user key definition by key_name. Returns undefined if not found. */
export function getPredefinedUserKey(keyName: string): PredefinedUserKey | undefined {
  return PREDEFINED_USER_KEYS.find((k) => k.key_name === keyName);
}

/**
 * Convert a PredefinedUserKey into a FormatKeyInput suitable for insertion
 * into a template's keys array. sort_order must be supplied by the caller.
 */
export function toFormatKeyInput(
  key: PredefinedUserKey,
  sortOrder: number,
): FormatKeyInput {
  return {
    key_name: key.key_name,
    label: key.label,
    field_type: key.field_type,
    is_required: 0,
    default_value: undefined,
    dropdown_options: undefined,
    sort_order: sortOrder,
  };
}
