/**
 * Tiny global store for the AI Copilot sheet, so a header button on any
 * screen can open it. The sheet itself is mounted once by CopilotHost
 * (root app layout, or the FIR layout with the active FIR).
 */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function set(v: boolean): void {
  if (open === v) return;
  open = v;
  listeners.forEach((l) => l());
}

export const openCopilot = (): void => set(true);
export const closeCopilot = (): void => set(false);

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useCopilotOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}
