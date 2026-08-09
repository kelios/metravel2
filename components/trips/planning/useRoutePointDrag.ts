// components/trips/planning/useRoutePointDrag.ts
// #1303: перетаскивание точек маршрута прямо в списке конструктора.
// Web слушает pointer-события для мыши и raw touch-события для пальца;
// native — PanResponder: тот же
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
  countAtStart: number;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

type PointerLike = { clientY?: number; pointerType?: string; button?: number };
type TouchLike = { clientY?: number; identifier?: number };
type TouchListLike = ArrayLike<TouchLike>;
type TouchEventLike = {
  touches?: TouchListLike;
  changedTouches?: TouchListLike;
};

const readPointer = (event: unknown): PointerLike => {
  const source = event as (PointerLike & { nativeEvent?: PointerLike }) | null;
  if (!source) return {};
  if (typeof source.clientY === 'number') return source;
  return source.nativeEvent ?? {};
};

const readTouchEvent = (event: unknown): TouchEventLike | null => {
  const source = event as (TouchEventLike & { nativeEvent?: TouchEventLike }) | null;
  if (!source) return null;
  return source.touches || source.changedTouches ? source : source.nativeEvent ?? null;
};

const findTouch = (touches: TouchListLike | undefined, identifier: number): TouchLike | null => {
  if (!touches) return null;
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch?.identifier === identifier) return touch;
  }
  return null;
};

const readStartingTouch = (event: unknown): { clientY: number; identifier: number } | null => {
  const touchEvent = readTouchEvent(event);
  // changedTouches identifies the contact that actually started on the handle;
  // touches[0] may belong to a second finger already held elsewhere.
  const touch = touchEvent?.changedTouches?.[0] ?? touchEvent?.touches?.[0];
  return typeof touch?.clientY === 'number' && typeof touch.identifier === 'number'
    ? { clientY: touch.clientY, identifier: touch.identifier }
    : null;
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
  const touchIdentifierRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const countRef = useRef(count);
  const onReorderRef = useRef(onReorder);

  const [drag, setDrag] = useState<RoutePointDragState | null>(null);
  // Окно слушаем только пока палец/кнопка мыши зажаты: постоянные глобальные
  // слушатели ловили бы чужие жесты страницы. Touch ведём отдельно: ему нужен
  // non-passive touchmove, чтобы после long-press заблокировать скролл синхронно.
  const [webTracking, setWebTracking] = useState<'pointer' | 'touch' | null>(null);

  enabledRef.current = enabled;
  countRef.current = count;
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
      const gesture: Gesture = {
        index,
        countAtStart: countRef.current,
        active: false,
        timer: null,
      };
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
      touchIdentifierRef.current = null;
      setWebTracking(null);
      setDrag(null);
      if (
        !commit
        || !enabledRef.current
        || !gesture?.active
        || gesture.countAtStart !== countRef.current
        || dropIndex == null
      ) return;
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
    if (!isWeb || !webTracking || typeof window === 'undefined') return;

    if (webTracking === 'touch') {
      const handleTouchMove = (event: TouchEvent) => {
        const identifier = touchIdentifierRef.current;
        const touchEvent = readTouchEvent(event);
        if (identifier == null || !touchEvent) return;
        const touch = findTouch(touchEvent.touches, identifier)
          ?? findTouch(touchEvent.changedTouches, identifier);
        if (typeof touch?.clientY !== 'number') return;
        updateGesture(touch.clientY - pointerStartYRef.current);
        if (gestureRef.current?.active && event.cancelable) event.preventDefault();
      };
      const trackedTouchChanged = (event: TouchEvent) => {
        const identifier = touchIdentifierRef.current;
        return identifier != null
          && findTouch(readTouchEvent(event)?.changedTouches, identifier) != null;
      };
      const handleTouchEnd = (event: TouchEvent) => {
        if (trackedTouchChanged(event)) endGesture(true);
      };
      const handleTouchCancel = (event: TouchEvent) => {
        if (trackedTouchChanged(event)) endGesture(false);
      };
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchCancel);
      return () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchCancel);
      };
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateGesture(event.clientY - pointerStartYRef.current);
      if (gestureRef.current?.active) event.preventDefault();
    };
    const handlePointerUp = () => endGesture(true);
    const handlePointerCancel = () => endGesture(false);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [endGesture, isWeb, updateGesture, webTracking]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Reorder отключился или состав списка изменился прямо во время жеста —
  // старые from/to и замеры больше не описывают те же точки. countAtStart
  // также закрывает render→effect race в endGesture.
  useEffect(() => {
    spansRef.current.length = count;
    const gesture = gestureRef.current;
    if (gesture && (!enabled || gesture.countAtStart !== count)) endGesture(false);
  }, [count, enabled, endGesture]);

  const registerRowLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    spansRef.current[index] = { y, height };
  }, []);

  const handleProps = useMemo<RouteDragHandlers[]>(() => {
    if (isWeb) {
      return Array.from({ length: count }, (_, index) => ({
        onTouchStart: (event: unknown) => {
          if (!enabledRef.current) return;
          if (touchIdentifierRef.current != null) return;
          const touch = readStartingTouch(event);
          if (!touch) return;
          pointerStartYRef.current = touch.clientY;
          touchIdentifierRef.current = touch.identifier;
          setWebTracking('touch');
          beginGesture(index, false);
        },
        onPointerDown: (event: unknown) => {
          if (!enabledRef.current) return;
          const pointer = readPointer(event);
          // Touch uses raw touch events: unlike Pointer Events, a non-passive
          // touchmove can conditionally preserve scroll before the hold and
          // claim the same contact after the hold.
          if (pointer.pointerType === 'touch') return;
          const isMouse = pointer.pointerType === 'mouse';
          if (isMouse && pointer.button != null && pointer.button !== 0) return;
          pointerStartYRef.current = pointer.clientY ?? 0;
          setWebTracking('pointer');
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
