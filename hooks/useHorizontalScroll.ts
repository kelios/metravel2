import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function useHorizontalScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const el = scrollRef.current;
    if (!el) return;

    const shouldHandle = (e: WheelEvent) => {
      if (!e.deltaY) return false;
      // For trackpads, allow native horizontal scrolling.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return false;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (maxScrollLeft <= 0) return false;
      const isAtLeft = el.scrollLeft <= 0;
      const isAtRight = el.scrollLeft >= maxScrollLeft;
      if ((isAtLeft && e.deltaY < 0) || (isAtRight && e.deltaY > 0)) return false;
      return true;
    };

    let usingActive = false;

    const activeWheel = (e: WheelEvent) => {
      if (!shouldHandle(e)) return;
      if (e.cancelable) e.preventDefault();
      el.scrollTo({
        left: el.scrollLeft + e.deltaY,
        behavior: 'auto',
      });
    };

    const passiveWheel = (e: WheelEvent) => {
      if (!shouldHandle(e)) return;
      // Passive handler cannot preventDefault; do a best-effort scroll.
      el.scrollLeft += e.deltaY;
      // If the event is cancelable, we likely want to prevent vertical page scroll.
      // Upgrade to non-passive for subsequent wheel events.
      if (!usingActive && e.cancelable) {
        usingActive = true;
        try {
          el.removeEventListener('wheel', passiveWheel as any);
        } catch {
          // noop
        }
        try {
          el.addEventListener('wheel', activeWheel as any, { passive: false } as any);
        } catch {
          // noop
        }
      }
    };

    el.addEventListener('wheel', passiveWheel as any, { passive: true } as any);
    return () => {
      try {
        el.removeEventListener('wheel', passiveWheel as any);
        el.removeEventListener('wheel', activeWheel as any);
      } catch {
        // noop
      }
    };
  }, []);

  return scrollRef;
}
