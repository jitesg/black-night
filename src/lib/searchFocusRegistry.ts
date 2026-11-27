/**
 * Which search box Ctrl+F / "/" on a tablet keyboard opens (owner, sample क): every SearchBar adds itself while its screen
 * is focused (useSearchBarRegistration in SearchBar.tsx) and leaves on blur / unmount; the LAST one added is the current
 * screen's. Pure (no React Native) — tests scripts/test_hardware_keys.ts; the key itself comes from plugins/withHardwareKeys.js.
 */
export interface Focusable { focus: () => void }

const stack: { id: number; target: Focusable }[] = [];
let nextId = 1;

/** Adds a search box; returns the function that removes it again (safe to call twice). */
export function addSearchTarget(target: Focusable): () => void {
  const id = nextId++;
  stack.push({ id, target });
  return () => {
    const i = stack.findIndex((e) => e.id === id);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Focuses the current screen's search box; false when there is none. */
export function focusCurrentSearch(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    try { stack[i].target.focus(); return true; } catch { /* box gone — try the one below */ }
  }
  return false;
}

/** For tests only. */
export function _resetSearchTargets(): void { stack.length = 0; }
