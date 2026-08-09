// components/trips/planning/useRoutePointDrag.ts
// #1303: перетаскивание точек маршрута прямо в списке конструктора.
// Web (desktop + mobile) слушает pointer-события, native — PanResponder: тот же
// раздел ролей, что у свайпа карточки места (`MapPlaceBottomCard`), потому что
// RN-Web pointer-пропсы и нативный responder закрывают разные половины.
// Сторонняя DnD-библиотека не подключается: обе ветки строятся на примитивах RN.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, type LayoutChangeEvent } from 'react-native';

import { resolveDropIndex, type RouteRowSpan } from './routePointReorder';

/**
 * Касание начинает перетаскивание только после удержания: короткий смах по ручке
 * не должен молча переставлять точку. Значение общее для mobile web и Android —
 * иначе поверхности разъедутся по ощущению (AGENTS 3.3).
 */
export const TOUCH_HOLD_MS = 200;
const TOUCH_CANCEL_TOLERANCE_PX = 8;

/** Пропсы, которые строка вешает на ручку: pointer-хендлеры на web, panHandlers на native. */
export type RouteDragHandlers = Record<string, unknown>;

export type RoutePointDragState = {
  /** Индекс строки, которую держит пользователь. */
  index: number;
  /** Индекс, куда точка встанет при отпускании. */
  dropIndex: number;
  /** Сдвиг строки относительно её места в списке. */
  offsetY: number;
};

type Gesture = {
  index: number;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

type PointerLike = { clientY?: number; pointerType?: string; button?: number };

const readPointer = (event: unknown): PointerLike => {
  const source = event as (PointerLike & { nativeEvent?: PointerLike }) | null;
  if (!source) return {};
  if (typeof source.clientY === 'number') return source;
  return source.nativeEvent ?? {};
};

type Options = {
  /** Перетаскивание доступно только владельцу и только когда точек больше одной. */
  enabled: boolean;
  count: number;
  onReorder: (from: number, to: number) => void;
};

export function useRoutePointDrag({ enabled, count, onReorder }: Options) {
  const isWeb = Platform.OS === 'web';
  const spansRef = useRef<Array<RouteRowSpan | undefined>>([]);
  const gestureRef = useRef<Gesture | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const pointerStartYRef = useRef(0);
  const enabledRef = useRef(enabled);
  const onReorderRef = useRef(onReorder);

  const [drag, setDrag] = useState<RoutePointDragState | null>(null);
  // Окно слушаем только пока палец/кнопка мыши зажаты: постоянные глобальные
  // слушатели ловили бы чужие жесты страницы.
  const [pointerTracking, setPointerTracking] = useState(false);

  enabledRef.current = enabled;
  onReorderRef.current = onReorder;

  const clearTimer = useCallback(() => {
    const timer = gestureRef.current?.timer;
    if (timer) clearTimeout(timer);
    if (gestureRef.current) gestureRef.current.timer = null;
  }, []);

  const activate = useCallback((gesture: Gesture) => {
    gesture.active = true;
    dropIndexRef.current = gesture.index;
    setDrag({ index: gesture.index, dropIndex: gesture.index, offsetY: 0 });
  }, []);

  const beginGesture = useCallback(
    (index: number, immediate: boolean) => {
      clearTimer();
      const gesture: Gesture = { index, active: false, timer: null };
      gestureRef.current = gesture;
      dropIndexRef.current = null;
      if (immediate) {
        activate(gesture);
        return;
      }
      gesture.timer = setTimeout(() => {
        if (gestureRef.current !== gesture) return;
        gesture.timer = null;
        activate(gesture);
      }, TOUCH_HOLD_MS);
    },
    [activate, clearTimer],
  );

  const endGesture = useCallback(
    (commit: boolean) => {
      const gesture = gestureRef.current;
      const dropIndex = dropIndexRef.current;
      clearTimer();
      gestureRef.current = null;
      dropIndexRef.current = null;
      setPointerTracking(false);
      setDrag(null);
      if (!commit || !gesture?.active || dropIndex == null) return;
      if (dropIndex === gesture.index) return;
      onReorderRef.current(gesture.index, dropIndex);
    },
    [clearTimer],
  );

  const updateGesture = useCallback((deltaY: number) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (!gesture.active) {
      // Палец поехал раньше, чем сработало удержание — это скролл/промах, а не
      // перетаскивание.
      if (Math.abs(deltaY) > TOUCH_CANCEL_TOLERANCE_PX) {
        const timer = gesture.timer;
        if (timer) clearTimeout(timer);
        gestureRef.current = null;
      }
      return;
    }
    const dropIndex = resolveDropIndex(spansRef.current, gesture.index, deltaY);
    dropIndexRef.current = dropIndex;
    setDrag({ index: gesture.index, dropIndex, offsetY: deltaY });
  }, []);

  useEffect(() => {
    if (!isWeb || !pointerTracking || typeof window === 'undefined') return;
    const handleMove = (event: PointerEvent) => {
      updateGesture(event.clientY - pointerStartYRef.current);
      if (gestureRef.current?.active) event.preventDefault();
    };
    const handleUp = () => endGesture(true);
    const handleCancel = () => endGesture(false);
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [endGesture, isWeb, pointerTracking, updateGesture]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Список стал короче прямо во время жеста (удалили точку) — держать индексы
  // старой раскладки нельзя.
  useEffect(() => {
    spansRef.current.length = count;
    const gesture = gestureRef.current;
    if (gesture && gesture.index >= count) endGesture(false);
  }, [count, endGesture]);

  const registerRowLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    spansRef.current[index] = { y, height };
  }, []);

  const handleProps = useMemo<RouteDragHandlers[]>(() => {
    if (isWeb) {
      return Array.from({ length: count }, (_, index) => ({
        onPointerDown: (event: unknown) => {
          if (!enabledRef.current) return;
          const pointer = readPointer(event);
          const isMouse = pointer.pointerType === 'mouse';
          if (isMouse && pointer.button != null && pointer.button !== 0) return;
          pointerStartYRef.current = pointer.clientY ?? 0;
          setPointerTracking(true);
          beginGesture(index, isMouse);
        },
      }));
    }

    return Array.from({ length: count }, (_, index) => {
      const responder = PanResponder.create({
        // Ручка забирает касание на себя: пока удержание не сработало, жест
        // просто ничего не делает, а скроллить можно всей остальной строкой.
        onStartShouldSetPanResponder: () => enabledRef.current,
        onMoveShouldSetPanResponder: () => enabledRef.current,
        // Capture нужен, чтобы ScrollView не увёл активное перетаскивание себе.
        onMoveShouldSetPanResponderCapture: () => gestureRef.current?.active === true,
        onPanResponderGrant: () => beginGesture(index, false),
        onPanResponderMove: (_event, state) => updateGesture(state.dy),
        onPanResponderTerminationRequest: () => gestureRef.current?.active !== true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderRelease: () => endGesture(true),
        onPanResponderTerminate: () => endGesture(false),
      });
      return { ...responder.panHandlers };
    });
  }, [beginGesture, count, endGesture, isWeb, updateGesture]);

  return {
    drag: enabled ? drag : null,
    registerRowLayout,
    handleProps,
  };
}
