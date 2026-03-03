// components/ui/FadeInSection.tsx
// SEC-05: Scroll-triggered fade-in анимация для секций
import React, { useRef, useState, useEffect, memo } from 'react';
import { View, Platform, type ViewStyle, type StyleProp } from 'react-native';

interface FadeInSectionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Задержка перед анимацией (мс) */
  delay?: number;
}

/**
 * Обёртка, которая анимирует появление секции при скролле (web).
 * На native просто рендерит children без анимации.
 */
function FadeInSection({ children, style, delay = 0 }: FadeInSectionProps) {
  const ref = useRef<View>(null);
  const [visible, setVisible] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => setVisible(true), delay);
          } else {
            setVisible(true);
          }
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  const webStyle = Platform.OS === 'web'
    ? ({
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      } as any)
    : undefined;

  return (
    <View ref={ref} style={[style, webStyle]}>
      {children}
    </View>
  );
}

export default memo(FadeInSection);

