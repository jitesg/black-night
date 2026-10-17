/**
 * openLaw.ts
 *
 * Deep-link routing helper for Law Library sections.
 */
import type { Router } from 'expo-router';
import type { ActId } from './lawLibrary';

export function openSection(router: Router, act: ActId, n: number): void {
  try {
    router.push(`/(app)/knowledge/law/${act}/${n}` as never);
  } catch {
    // Fallback if typed routes require string
    router.push(`/(app)/knowledge/law/${act}/${n}` as any);
  }
}
