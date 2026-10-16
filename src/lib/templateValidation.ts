/**
 * Template Validation Service — SSOT
 *
 * Single reusable validation engine for all fill-format screens.
 * Builds a per-field error map so each field can show its own inline error.
 */
import type { FormatKey } from '@/lib/db/predefinedFormatRepo';

export interface ValidationResult {
  /** keyed by key_name → error message; empty if field is valid */
  fieldErrors: Record<string, string>;
  /** key_name of the first invalid required field, or null if all valid */
  firstErrorKey: string | null;
  /** true when at least one required field is empty */
  hasErrors: boolean;
}

/**
 * Validate all required keys in a dynamic-key list against current values.
 * Returns a per-field error map, the first invalid key (for scroll-to), and
 * a boolean hasErrors flag — all derived from a single pass.
 */
export function validateRequiredFields(
  keys: FormatKey[],
  values: Record<string, string>
): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  let firstErrorKey: string | null = null;

  for (const key of keys) {
    if (key.is_required !== 1) continue;

    // accused_group / person_group: valid when the JSON array has at least one entry with a name filled
    if (key.field_type === 'accused_group' || key.field_type === 'person_group') {
      const emptyMsg = key.field_type === 'accused_group'
        ? `${key.label || key.key_name}: कम से कम एक अभियुक्त का नाम भरें`
        : `${key.label || key.key_name}: कम से कम एक व्यक्ति का नाम भरें`;
      let hasNamed = false;
      try {
        const arr = JSON.parse(values[key.key_name] ?? '[]');
        hasNamed = Array.isArray(arr) && arr.some((e: { name?: string }) => e.name?.trim());
      } catch { /* treat as invalid */ }
      if (!hasNamed) {
        fieldErrors[key.key_name] = emptyMsg;
        if (!firstErrorKey) firstErrorKey = key.key_name;
      }
      continue;
    }

    if (!values[key.key_name]?.trim()) {
      fieldErrors[key.key_name] = `${key.label || key.key_name} is required`;
      if (!firstErrorKey) firstErrorKey = key.key_name;
    }
  }

  return {
    fieldErrors,
    firstErrorKey,
    hasErrors: firstErrorKey !== null,
  };
}

/**
 * Clear a single field's error from an existing error map.
 * Returns a new map (immutable update) — safe to call in onChange handlers.
 */
export function clearFieldError(
  fieldErrors: Record<string, string>,
  keyName: string
): Record<string, string> {
  if (!fieldErrors[keyName]) return fieldErrors;
  const next = { ...fieldErrors };
  delete next[keyName];
  return next;
}
