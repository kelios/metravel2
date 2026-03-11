import { useCallback, useEffect, useRef, useState } from 'react';

const UNREAD_COUNT_POLL_INTERVAL = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export function useDeferredUnreadCount(enabled: boolean = true, pollEnabled: boolean = true) {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);
  const consecutiveFailuresRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    consecutiveFailuresRef.current = 0;
    setCount(0);
  }, [enabled]);

  const load = useCallback(async () => {
    if (!enabled || consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;

    try {
      const { fetchUnreadCount } = await import('@/api/messages');
      const data = await fetchUnreadCount();
      if (!mountedRef.current) return;
      consecutiveFailuresRef.current = 0;
      setCount(data?.count ?? 0);
    } catch {
      consecutiveFailuresRef.current += 1;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !pollEnabled) return;
    const id = setInterval(() => {
      void load();
    }, UNREAD_COUNT_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [enabled, load, pollEnabled]);

  return { count, refresh: load };
}

export default useDeferredUnreadCount;
