import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, StyleSheet, View, useWindowDimensions } from 'react-native';
import Toast, { BaseToast, ErrorToast, InfoToast, SuccessToast } from 'react-native-toast-message';

import { useDockReservePx, useNativeBottomChromeOcclusion } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';
import { toastBottomOffset, type ToastAction } from '@/utils/toast.native';

type ToastRenderer = (params: any) => React.ReactElement;

function ToastActionButton({ action }: { action: ToastAction }) {
  const colors = useThemedColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      testID="toast-action"
      hitSlop={8}
      style={styles.action}
      onPress={() => {
        Toast.hide();
        action.onPress();
      }}
    >
      <Text style={[styles.actionText, { color: colors.primary }]}>{action.label}</Text>
    </Pressable>
  );
}

// Тост с кнопкой («Отменить»): action приходит через props из showToast.
// Рисуется поверх штатного тоста библиотеки через renderTrailingIcon, остальные
// тосты (без action) выглядят как раньше.
function withAction(Base: React.ComponentType<any>): ToastRenderer {
  return function ToastWithAction(toastProps: any) {
    const action: ToastAction | undefined = toastProps?.props?.action;
    return (
      <Base
        {...toastProps}
        renderTrailingIcon={action ? () => <ToastActionButton action={action} /> : undefined}
      />
    );
  };
}

const toastConfig = {
  success: withAction(SuccessToast),
  error: withAction(ErrorToast),
  info: withAction(InfoToast),
  warning: withAction(BaseToast),
};

const KEYBOARD_OFFSET = 10;

type ToastHostProps = {
  /**
   * false — хост внутри полноэкранного Modal, где дока нет (#844): тост над
   * home indicator, а не над доком корневого экрана.
   */
  overDock?: boolean;
};

/**
 * Хост тостов native (#2161, #2168). Отступ — из того же резерва дока, что и
 * у экранов (`useDockReservePx`, #2097), и измеренной верхней границы активного
 * футера относительно слоя хоста. Позиция по умолчанию — снизу, как у web-хоста и
 * `useActionFeedback`. Слой — верхний: тост рисуется поверх дока и
 * sticky-баров с `elevation` на Android.
 */
export default function ToastHost({ overDock = true }: ToastHostProps) {
  const dockReservePx = useDockReservePx();
  const insets = useSafeAreaInsetsSafe();
  const { top } = useNativeBottomChromeOcclusion();
  const { width, height } = useWindowDimensions();
  const layerRef = useRef<View>(null);
  const generation = useRef(0);
  const [layerBottom, setLayerBottom] = useState<number | null>(null);
  const [keyboardLift, setKeyboardLift] = useState(KEYBOARD_OFFSET);
  const measureLayer = useCallback(() => {
    if (Platform.OS === 'web') return;
    const request = ++generation.current;
    layerRef.current?.measureInWindow((_x, y, _width, measuredHeight) => {
      if (request !== generation.current || !Number.isFinite(y + measuredHeight) || measuredHeight <= 0) return;
      setLayerBottom(y + measuredHeight);
    });
  }, []);
  useEffect(() => {
    measureLayer();
    return () => { generation.current += 1; };
  }, [measureLayer, width, height]);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) => {
      setKeyboardLift(Math.max(0, endCoordinates.height) + KEYBOARD_OFFSET);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardLift(KEYBOARD_OFFSET));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (Platform.OS === 'web') return null;
  const footerReserve = layerBottom !== null && top !== null ? Math.max(0, layerBottom - top) : 0;
  const reserve = Math.max(overDock ? Math.max(dockReservePx, footerReserve) : 0, insets.bottom || 0);
  const bottomOffset = toastBottomOffset(reserve, insets.bottom);
  return (
    <View ref={layerRef} collapsable={false} onLayout={measureLayer} pointerEvents="box-none" style={styles.layer} testID="toast-layer">
      {/* The library snapshots its offsets at show(); move this layer for live remeasurements.
          Its iOS keyboard animation already supplies keyboardLift, so reserve only the remainder. */}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { bottom: Math.max(0, bottomOffset - keyboardLift) }]} testID="toast-positioning">
        <Toast config={toastConfig} position="bottom" bottomOffset={0} keyboardOffset={KEYBOARD_OFFSET} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: DESIGN_TOKENS.zIndex.toast,
    elevation: DESIGN_TOKENS.zIndex.toast,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
