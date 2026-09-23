// components/trips/planning/PlannerPageScrollView.tsx
// #2058: страничный скролл экрана поездки с входом «прокрути к узлу». На web
// узел сам делает `scrollIntoView`; у native `View` его нет, и `[⌖]` дня в
// мобильном списке поднимает страницу к карте через этот контекст:
// `measureLayout` относительно содержимого ScrollView → `scrollTo`.
import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps, type View } from 'react-native';

type ScrollToNode = (node: View | null) => void;

const PlannerPageScrollContext = createContext<ScrollToNode | null>(null);

export const usePlannerPageScrollTo = (): ScrollToNode | null => useContext(PlannerPageScrollContext);

export default function PlannerPageScrollView({ children, ...props }: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const innerRef = useRef<View>(null);
  const scrollToNode = useCallback<ScrollToNode>((node) => {
    const inner = innerRef.current;
    if (!node || !inner) return;
    node.measureLayout(
      inner,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true }),
      () => undefined,
    );
  }, []);

  return (
    <PlannerPageScrollContext.Provider value={scrollToNode}>
      <ScrollView
        ref={scrollRef}
        // RN-Web этот проп не знает и отдал бы его в DOM; web скроллит сам узел.
        // Тип RN ждёт `RefObject<View>` без `null` — отставание от React 19.
        {...(Platform.OS === 'web' ? {} : { innerViewRef: innerRef as React.RefObject<View> })}
        {...props}
      >
        {children}
      </ScrollView>
    </PlannerPageScrollContext.Provider>
  );
}
