/** Pure part of goHome.ts (tests scripts/test_go_home.ts). */
export type NavLike = {
  getState?: () => { index?: number; routes?: { name?: string }[] } | undefined;
  getParent?: () => NavLike | undefined;
};

/** true when the route just below the current one (in the nearest stack that has one) is Home. */
export function previousIsHome(nav: NavLike | undefined): boolean {
  let n = nav;
  for (let depth = 0; n && depth < 6; depth++) {
    const st = n.getState?.();
    const idx = st?.index;
    if (st && Array.isArray(st.routes) && typeof idx === 'number' && idx > 0) {
      return st.routes[idx - 1]?.name === 'home';
    }
    n = n.getParent?.();
  }
  return false;
}
