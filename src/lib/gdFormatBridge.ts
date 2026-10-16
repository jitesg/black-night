/**
 * GD ↔ Format Bridge  (v93 — delivery-flag lifecycle)
 *
 * A single-producer / single-consumer mailbox that hands a generated report
 * from formats/preview.tsx (producer) back to gd/add-gd.tsx (consumer).
 *
 * ── Root cause (original) ─────────────────────────────────────────────────
 *  The previous design coupled payload lifetime to the mounted lifetime of
 *  add-gd.  When router.navigate('/(app)/gd/add-gd') triggers a cross-stack
 *  transition, React Navigation may unmount and remount the add-gd component.
 *  The old endSession() + beginSession() both cleared _pending, destroying
 *  the payload before the new instance could consume it.
 *
 * ── Payload-persistent ownership model ───────────────────────────────────
 *  _pending belongs to the WORKFLOW, not to a single mounted screen instance.
 *  A _deliveryPending boolean tracks whether a delivery is actively in flight.
 *
 *  • beginSession(sid)  — registers the active owner.
 *                         Clears _pending ONLY when _deliveryPending is false
 *                         (i.e., no active delivery) to remove genuinely stale
 *                         leftover data from previous sessions.
 *                         When _deliveryPending is true the payload MUST survive
 *                         the unmount/remount cycle so it is left untouched.
 *
 *  • endSession(sid)    — releases ownership (clears _expectedSessionId only).
 *                         NEVER touches _pending or _deliveryPending — the
 *                         consumer will clear both after successful delivery.
 *
 *  • set(text, fmtId)   — stages the payload and raises _deliveryPending.
 *                         Producer is trusted; only formats/preview.tsx calls
 *                         this, only inside the GD flow (callingModule==='GD').
 *
 *  • consume(sid)       — TRANSACTIONAL read + clear.
 *                         Validates _expectedSessionId === sid (ownership).
 *                         On SUCCESS : clears _pending + _deliveryPending, returns payload.
 *                         On FAILURE : returns null, everything preserved so
 *                         the correct owner can still consume it later.
 *
 * ── Atomicity ────────────────────────────────────────────────────────────
 *  consume() clears _pending only on a successful ownership match — a second
 *  call from the same session always gets null (idempotent).
 *
 * ── Ownership rules ──────────────────────────────────────────────────────
 *  • ONLY producer : formats/preview.tsx  (calls set)
 *  • ONLY consumer : gd/add-gd.tsx        (calls beginSession / consume / endSession)
 *  • No other module may read or write this bridge.
 *
 * ── Dev logging ──────────────────────────────────────────────────────────
 *  • All console.log statements are guarded by __DEV__ — zero output in prod.
 */

interface PendingFormat {
  text: string;
  formatId?: string;
  // No sessionId in the payload — ownership is tracked via _expectedSessionId
  // so it survives unmount/remount session rotation without a mismatch.
}

let _pending: PendingFormat | null = null;
/** True only between set() (producer stages) and consume() (consumer delivers). */
let _deliveryPending = false;
/** Session ID of the currently active add-gd instance; null between unmount and remount. */
let _expectedSessionId: string | null = null;

export const gdFormatBridge = {
  /**
   * Register bridge ownership for a (re)mounted add-gd instance.
   * Called by add-gd on mount (useEffect with [] deps).
   *
   * _pending is cleared ONLY when _deliveryPending is false (no active delivery).
   * When a delivery is in flight the payload MUST survive a temporary unmount,
   * so it is preserved until consume() clears it.
   */
  beginSession(sessionId: string): void {
    _expectedSessionId = sessionId;
    if (!_deliveryPending) {
      // No active delivery — safe to discard any lingering stale payload.
      _pending = null;
    }
    if (__DEV__) {
      console.log('[GdBridge] session registered:', sessionId,
        '| deliveryPending:', _deliveryPending,
        '| pending payload:', _pending !== null ? `${_pending.text.length} chars` : 'none');
    }
  },

  /**
   * Stage a generated report for delivery to add-gd.
   * Called only by formats/preview.tsx immediately before navigation.
   * Raises _deliveryPending so the payload survives the upcoming remount.
   */
  set(text: string, formatId?: string): void {
    _pending = { text, formatId };
    _deliveryPending = true;
    if (__DEV__) {
      console.log('[GdBridge] set — chars:', text.length,
        '| formatId:', formatId ?? 'none',
        '| active session:', _expectedSessionId ?? 'none (navigating)');
    }
  },

  /**
   * Transactional atomic read + clear.
   * Called only by gd/add-gd.tsx inside useFocusEffect.
   *
   * Validation order:
   *  1. Bridge empty        → return null (no-op, nothing changed).
   *  2. Ownership mismatch  → return null, _pending PRESERVED (not cleared).
   *  3. Valid owner         → clear _pending + _deliveryPending, return payload.
   */
  consume(sessionId: string): PendingFormat | null {
    if (!_pending) {
      if (__DEV__) console.log('[GdBridge] consume — bridge empty | session:', sessionId);
      return null;
    }

    if (_expectedSessionId !== sessionId) {
      // Ownership mismatch — preserve payload for the correct owner.
      if (__DEV__) {
        console.log('[GdBridge] consume — ownership mismatch, payload preserved',
          '| expected session:', _expectedSessionId ?? 'none', '| caller:', sessionId);
      }
      return null;
    }

    // Valid owner — atomically clear and return.
    const val = _pending;
    _pending = null;
    _deliveryPending = false;
    if (__DEV__) {
      console.log('[GdBridge] consumed — chars:', val.text.length,
        '| formatId:', val.formatId ?? 'none', '| session:', sessionId);
    }
    return val;
  },

  /**
   * Release bridge ownership when add-gd unmounts.
   * Clears _expectedSessionId ONLY — _pending and _deliveryPending are
   * intentionally preserved so the payload survives temporary unmounts
   * caused by cross-stack navigation.
   *
   * No-op if the caller is not the current owner.
   */
  endSession(sessionId: string): void {
    if (_expectedSessionId !== sessionId) return;
    _expectedSessionId = null;
    if (__DEV__) {
      console.log('[GdBridge] session released:', sessionId,
        '| deliveryPending:', _deliveryPending,
        '| pending payload preserved:', _pending !== null ? `${_pending.text.length} chars` : 'none');
    }
  },

  /** Non-destructive peek — does NOT clear the payload. */
  has(): boolean {
    return _pending !== null;
  },
};
