import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function useHorizontalScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;

      // Если есть горизонтальная прокрутка, и она больше вертикальной (например, тачпад),
      // то позволяем нативному поведению работать.
      // Но если это мышь (обычно только deltaY), то преобразуем в горизонтальную.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return;
      }

      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      
      // Если скролить некуда, не перехватываем
      if (maxScrollLeft <= 0) return;

      // Проверяем, достигли ли мы границ
      const isAtLeft = el.scrollLeft <= 0;
      const isAtRight = el.scrollLeft >= maxScrollLeft;

      // Если мы пытаемся скролить за границы, даем странице скролиться вертикально
      if ((isAtLeft && e.deltaY < 0) || (isAtRight && e.deltaY > 0)) {
        return;
      }

      e.preventDefault();
      el.scrollTo({
        left: el.scrollLeft + e.deltaY,
        behavior: 'auto' // Instant scroll for better feel on wheel
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return scrollRef;
}
