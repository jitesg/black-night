/**
 * firNavigation.ts
 *
 * Single source of truth for all navigation into the FIR detail tab screens.
 *
 * WHY THIS EXISTS
 * ───────────────
 * expo-router resolves dynamic route segments (e.g. [firId]) by parsing the
 * URL string when you call router.replace/push with a template-literal path:
 *
 *   router.replace(`/(app)/mukadma/${id}/(tabs)/karyvahi`)   ← BAD
 *
 * During the navigation transition, React Navigation rebuilds the [firId]
 * subtree. While that rebuild is in progress there is at least one render
 * frame where useLocalSearchParams() returns { firId: undefined } in every
 * tab screen. Any useEffect / useFocusEffect that closes over firId in that
 * frame will fire with an undefined value.
 *
 * Using the object form instead:
 *
 *   router.replace({ pathname: '/(app)/mukadma/[firId]/(tabs)/karyvahi',
 *                    params: { firId: id } })
 *
 * tells expo-router to resolve the segment by value rather than string-
 * parsing, which eliminates the rebuild-from-scratch transition and keeps
 * useLocalSearchParams stable throughout.
 *
 * USAGE
 * ─────
 *   import { navigateToFIRTab } from '@/lib/firNavigation';
 *
 *   // After saving a new FIR:
 *   navigateToFIRTab('karyvahi', fir.id, 'replace');
 *
 *   // When navigating from a tab:
 *   navigateToFIRTab('details', firId);           // default: push
 */

import { router } from 'expo-router';
import { logger } from '@/lib/logger';

export type FIRTab = 'details' | 'karyvahi' | 'case-diary';
export type NavMethod = 'replace' | 'push';

/**
 * Navigate to a specific FIR detail tab.
 *
 * @param tab      - Which tab to open: 'details' | 'karyvahi' | 'case-diary'
 * @param firId    - The FIR UUID. Must be a non-empty string.
 * @param method   - 'replace' (default) removes current screen from stack;
 *                   'push' adds to stack (use when navigating from outside the
 *                   [firId] subtree, e.g. the FIR list screen).
 */
export function navigateToFIRTab(
  tab: FIRTab,
  firId: string,
  method: NavMethod = 'replace',
): void {
  if (!firId || firId === 'undefined' || firId.trim() === '') {
    logger.error(
      `[NAVIGATE_FIR] BLOCKED — invalid firId="${firId ?? 'undefined'}"` +
      ` tab="${tab}" method="${method}" t=${Date.now()}`
    );
    return;
  }

  // [NAV_CALL] + [NAVIGATE_FIR] — visible in Log Viewer under either tag
  logger.warn(
    `[NAV_CALL] pathname="/(app)/mukadma/[firId]/(tabs)/${tab}"` +
    ` params.firId="${firId}" method="${method}" t=${Date.now()}`
  );
  logger.warn(
    `[NAVIGATE_FIR] firId="${firId}" tab="${tab}" method="${method}" t=${Date.now()}`
  );

  const target = {
    // Use literal bracket notation — expo-router matches this against the
    // [firId] file-system segment and injects the value via params, avoiding
    // any URL-parse rebuild of the navigation state.
    pathname: `/(app)/mukadma/[firId]/(tabs)/${tab}` as never,
    params: { firId },
  };

  if (method === 'replace') {
    router.replace(target as never);
  } else {
    router.push(target as never);
  }
}
