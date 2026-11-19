/**
 * Module root screens → Home on the phone's back button (owner: speed).
 *
 * Before, every module screen did `router.replace('/(app)/home')`. On a stack that builds a BRAND-NEW Home on top
 * (full load + render each time) and leaves the old Home mounted underneath — after a few module visits several
 * Homes sat in memory and the app got slower the longer it ran.
 *
 * Now: when the screen right below is Home, simply go back to it (no new Home). Otherwise (e.g. the module was
 * opened from the drawer, which replaces the screen) the old replace still runs. Any error → the old replace, so the
 * back button can never stop working or crash the app.
 */
import { useCallback, useRef } from 'react';
import { router, useNavigation } from 'expo-router';

import { previousIsHome, type NavLike } from './navHome';

/** Stable function for a BackHandler: back to the Home below, else replace with Home (old behaviour). */
export function useGoHome(): () => void {
  const navigation = useNavigation() as unknown as NavLike;
  const navRef = useRef(navigation);
  navRef.current = navigation;
  return useCallback(() => {
    try {
      if (previousIsHome(navRef.current) && router.canGoBack()) {
        router.back();
        return;
      }
    } catch { /* fall through to the old way */ }
    try { router.replace('/(app)/home' as never); } catch { /* nothing more to do */ }
  }, []);
}
