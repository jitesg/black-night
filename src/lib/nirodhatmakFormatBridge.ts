/**
 * Nirodhatmak Karyvahi ↔ Format Bridge  (v1)
 *
 * Single-producer / single-consumer mailbox that hands a generated report
 * from formats/preview.tsx (producer, callingModule=NK) back to
 * nirodhatmak/add-proceeding.tsx (consumer).
 *
 * Architecture mirrors gdFormatBridge.ts exactly — see that file for the
 * full design rationale, ownership model, and atomicity guarantees.
 *
 * ── Ownership rules ──────────────────────────────────────────────────────
 *  • ONLY producer : formats/preview.tsx  (calls set, when callingModule=NK)
 *  • ONLY consumer : nirodhatmak/add-proceeding.tsx  (calls beginSession / consume / endSession)
 *  • No other module may read or write this bridge.
 *
 * ── Dev logging ──────────────────────────────────────────────────────────
 *  • All console.log statements are guarded by __DEV__ — zero output in prod.
 */

interface PendingFormat {
  text: string;
  formatId?: string;
}

let _pending: PendingFormat | null = null;
/** True only between set() (producer stages) and consume() (consumer delivers). */
let _deliveryPending = false;
/** Session ID of the currently active add-proceeding instance. */
let _expectedSessionId: string | null = null;

export const nirodhatmakFormatBridge = {
  /**
   * Register bridge ownership for a (re)mounted add-proceeding instance.
   * Called on mount (useEffect with [] deps).
   *
   * _pending is cleared ONLY when _deliveryPending is false (no active delivery).
   */
  beginSession(sessionId: string): void {
    _expectedSessionId = sessionId;
    if (!_deliveryPending) {
      _pending = null;
    }
    if (__DEV__) {
      console.log('[NkBridge] session registered:', sessionId,
        '| deliveryPending:', _deliveryPending,
        '| pending payload:', _pending !== null ? `${_pending.text.length} chars` : 'none');
    }
  },

  /**
   * Stage a generated report for delivery to add-proceeding.
   * Called only by formats/preview.tsx when callingModule=NK.
   */
  set(text: string, formatId?: string): void {
    _pending = { text, formatId };
    _deliveryPending = true;
    if (__DEV__) {
      console.log('[NkBridge] set — chars:', text.length,
        '| formatId:', formatId ?? 'none',
        '| active session:', _expectedSessionId ?? 'none (navigating)');
    }
  },

  /**
   * Transactional atomic read + clear.
   * Called only by nirodhatmak/add-proceeding.tsx inside useFocusEffect.
   *
   * Returns payload on ownership match + clears, null otherwise.
   */
  consume(sessionId: string): PendingFormat | null {
    if (!_pending) {
      if (__DEV__) console.log('[NkBridge] consume — bridge empty | session:', sessionId);
      return null;
    }
    if (_expectedSessionId !== sessionId) {
      if (__DEV__) {
        console.log('[NkBridge] consume — ownership mismatch, payload preserved',
          '| expected:', _expectedSessionId ?? 'none', '| caller:', sessionId);
      }
      return null;
    }
    const val = _pending;
    _pending = null;
    _deliveryPending = false;
    if (__DEV__) {
      console.log('[NkBridge] consumed — chars:', val.text.length,
        '| formatId:', val.formatId ?? 'none', '| session:', sessionId);
    }
    return val;
  },

  /**
   * Release bridge ownership when add-proceeding unmounts.
   * _pending and _deliveryPending are preserved to survive cross-stack navigation.
   */
  endSession(sessionId: string): void {
    if (_expectedSessionId !== sessionId) return;
    _expectedSessionId = null;
    if (__DEV__) {
      console.log('[NkBridge] session released:', sessionId,
        '| deliveryPending:', _deliveryPending,
        '| pending preserved:', _pending !== null ? `${_pending.text.length} chars` : 'none');
    }
  },

  /** Non-destructive peek — does NOT clear the payload. */
  has(): boolean {
    return _pending !== null;
  },
};
