import { useCallback, useEffect, useRef, useState } from 'react';

// A fit is a short-lived user command, not an instruction to move the map
// whenever an offline query eventually recovers. Expiration only cancels it.
export const FIT_REQUEST_EXPIRY_MS = 10_000;

/**
 * #2218 — «fit the map to the results» for actions that change the result set
 * first («Сбросить всё» in the chips row, `map-mobile-show-all`). The fit used
 * to run one animation frame after the reset, over the result set that was on
 * screen BEFORE it: after a one-place filter the map zoomed onto that place, and
 * from an empty result it did not move at all (device QA on Android; the same
 * timing on web).
 *
 * `requestFit()` arms a pending fit; it fires once the results belong to the
 * current input — `settled`: no debounce in flight (synchronous since #2218),
 * no fetch, no placeholder of the previous query. If the action changed nothing
 * the results are already settled and the fit runs on the next commit.
 * The fit itself (`fit`) reads the current result set (the map's latest API).
 */
export function useFitToResultsWhenSettled(settled: boolean, fit: () => void): () => void {
  const [request, setRequest] = useState(0);
  const pendingRef = useRef(false);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useEffect(() => {
    if (!pendingRef.current || !settled) return;
    pendingRef.current = false;
    if (expiryRef.current !== null) clearTimeout(expiryRef.current);
    expiryRef.current = null;
    fitRef.current();
  }, [request, settled]);

  useEffect(() => () => {
    pendingRef.current = false;
    if (expiryRef.current !== null) clearTimeout(expiryRef.current);
  }, []);

  return useCallback(() => {
    pendingRef.current = true;
    if (expiryRef.current !== null) clearTimeout(expiryRef.current);
    expiryRef.current = setTimeout(() => {
      pendingRef.current = false;
      expiryRef.current = null;
    }, FIT_REQUEST_EXPIRY_MS);
    setRequest((value) => value + 1);
  }, []);
}
