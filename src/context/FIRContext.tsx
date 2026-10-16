/**
 * FIRContext.tsx
 *
 * Stores the currently active FIR ID so that child tab screens (karyvahi,
 * details, case-diary) have a reliable fallback when useLocalSearchParams()
 * transiently returns { firId: undefined } during navigation transitions.
 *
 * ARCHITECTURE
 * ────────────
 * The [firId]/_layout.tsx Stack is the FIRST component expo-router mounts
 * after resolving the dynamic [firId] segment. It receives the real firId
 * before any tab screen mounts. By capturing it here and providing it via
 * context, all tab children can read it even during the frame where their
 * own useLocalSearchParams() hasn't been hydrated yet.
 *
 * PRIORITY ORDER for tab screens:
 *   1. stableFirId  — from own useLocalSearchParams() (most current)
 *   2. activeFirId  — from FIRContext (last known good value from layout)
 *   3. undefined    — block render, show waiting state, log [FIR_CTX_MISS]
 *
 * USAGE
 * ─────
 *   // In [firId]/_layout.tsx:
 *   <FIRProvider firId={firIdFromParams}>
 *     <Stack … />
 *   </FIRProvider>
 *
 *   // In any tab screen:
 *   const { activeFirId } = useFIRContext();
 *   const resolvedFirId = stableFirId ?? activeFirId;
 */

import React, {
  createContext, useContext, useEffect, useRef, useState,
} from 'react';
import { logger } from '@/lib/logger';

interface FIRContextValue {
  /** Last valid FIR UUID seen by the layout. Never reverts to undefined. */
  activeFirId: string | undefined;
}

const FIRContext = createContext<FIRContextValue>({ activeFirId: undefined });

interface FIRProviderProps {
  /** firId from [firId]/_layout.tsx's useLocalSearchParams. May be transiently undefined. */
  firId: string | undefined;
  children: React.ReactNode;
}

export function FIRProvider({ firId, children }: FIRProviderProps) {
  // lastValidRef: once a valid UUID is seen it is never cleared.
  // We use a ref + state pair so that:
  //   - the ref is updated synchronously on every render (no stale closure)
  //   - state triggers a re-render so children receive the updated value
  const lastValidRef = useRef<string | undefined>(undefined);
  const [activeFirId, setActiveFirId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!firId || firId === 'undefined' || firId.trim() === '') return;
    const clean = firId.trim();
    if (clean === lastValidRef.current) return;  // no change
    lastValidRef.current = clean;
    setActiveFirId(clean);
    logger.warn(
      `[FIR_CTX] activeFirId updated to "${clean}" t=${Date.now()}`
    );
  }, [firId]);

  return (
    <FIRContext.Provider value={{ activeFirId }}>
      {children}
    </FIRContext.Provider>
  );
}

export function useFIRContext(): FIRContextValue {
  return useContext(FIRContext);
}
