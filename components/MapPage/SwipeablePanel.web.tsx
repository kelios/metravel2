import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, ViewStyle, Pressable } from 'react-native';

interface SwipeablePanelProps {
  children: React.ReactNode;
  onClose: () => void;
  isOpen: boolean;
  style?: ViewStyle | ViewStyle[];
  swipeDirection?: 'left' | 'right';
  threshold?: number;
}

/**
 * SwipeablePanel - веб-версия компонента с поддержкой свайпа для закрытия
 * Использует нативные события браузера вместо react-native-gesture-handler
 */
const SwipeablePanel: React.FC<SwipeablePanelProps> = ({
  children,
  onClose,
  isOpen,
  style,
  swipeDirection = 'right',
  threshold = 100,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);

  const closePanel = useCallback(() => {
    onClose();
  }, [onClose]);

  const finalizeDrag = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    activePointerIdRef.current = null;

    const distance = Math.abs(translateX);

    // Закрываем панель если превышен порог
    if (distance > threshold) {
      const finalPosition = swipeDirection === 'right' ? 400 : -400;
      setTranslateX(finalPosition);
      // Give CSS transition time to finish.
      setTimeout(() => closePanel(), 300);
    } else {
      // Возвращаем панель на место
      setTranslateX(0);
    }
  }, [isDragging, threshold, swipeDirection, translateX, closePanel]);

  const handlePointerDown = useCallback((e: any) => {
    const event = e.nativeEvent as PointerEvent;
    if (!event) return;
    if (activePointerIdRef.current != null) return;
    if ((event as any).isPrimary === false) return;
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);
    startXRef.current = event.clientX;
    try {
      (event.target as any)?.setPointerCapture?.(event.pointerId);
    } catch {
      // noop
    }
  }, []);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging) return;
    const event = e.nativeEvent as PointerEvent;
    if (!event) return;
    if (activePointerIdRef.current !== event.pointerId) return;

    const deltaX = event.clientX - startXRef.current;

    // Разрешаем свайп только в указанном направлении
    if (swipeDirection === 'right' && deltaX > 0) {
      setTranslateX(deltaX);
    } else if (swipeDirection === 'left' && deltaX < 0) {
      setTranslateX(deltaX);
    }
  }, [isDragging, swipeDirection]);

  const handlePointerUp = useCallback((e: any) => {
    const event = e.nativeEvent as PointerEvent;
    if (event && activePointerIdRef.current != null && activePointerIdRef.current !== event.pointerId) return;
    finalizeDrag();
  }, [finalizeDrag]);

  const handlePointerCancel = useCallback(() => {
    finalizeDrag();
  }, [finalizeDrag]);

  // Сбрасываем позицию при изменении isOpen
  useEffect(() => {
    if (isOpen) {
      setTranslateX(0);
      setIsDragging(false);
      activePointerIdRef.current = null;
    }
  }, [isOpen]);

  const panelStyle = useMemo(() => {
    const base: any = {
      transform: [{ translateX }],
    };
    if (Platform.OS === 'web') {
      base.transitionProperty = 'transform';
      base.transitionDuration = isDragging ? '0ms' : '300ms';
      base.transitionTimingFunction = 'ease-out';
      base.willChange = 'transform';
    }
    return base;
  }, [isDragging, translateX]);

  // Добавляем глобальные обработчики для отслеживания движения за пределами компонента
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalPointerMove = (e: PointerEvent) => {
        if (activePointerIdRef.current == null) return;
        if (e.pointerId !== activePointerIdRef.current) return;
        const deltaX = e.clientX - startXRef.current;

        if (swipeDirection === 'right' && deltaX > 0) {
          setTranslateX(deltaX);
        } else if (swipeDirection === 'left' && deltaX < 0) {
          setTranslateX(deltaX);
        }
      };

      const handleGlobalPointerUp = (e: PointerEvent) => {
        if (activePointerIdRef.current == null) return;
        if (e.pointerId !== activePointerIdRef.current) return;
        finalizeDrag();
      };

      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
      window.addEventListener('pointercancel', handleGlobalPointerUp);

      return () => {
        window.removeEventListener('pointermove', handleGlobalPointerMove);
        window.removeEventListener('pointerup', handleGlobalPointerUp);
        window.removeEventListener('pointercancel', handleGlobalPointerUp);
      };
    }
    return () => undefined;
  }, [isDragging, swipeDirection, translateX, finalizeDrag]);

  if (!isOpen) return null;

  return (
    <View
      style={[styles.container, panelStyle, style]}
      // @ts-ignore - web-only pointer events
      onPointerDown={handlePointerDown as any}
      // @ts-ignore - web-only pointer events
      onPointerMove={handlePointerMove as any}
      // @ts-ignore - web-only pointer events
      onPointerUp={handlePointerUp as any}
      // @ts-ignore - web-only pointer events
      onPointerCancel={handlePointerCancel as any}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.panel, style]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    flex: 1,
  },
});

export default React.memo(SwipeablePanel);

