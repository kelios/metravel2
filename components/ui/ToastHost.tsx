import React from 'react';
import { Platform, Pressable, Text, StyleSheet, View } from 'react-native';
import Toast, { BaseToast, ErrorToast, InfoToast, SuccessToast } from 'react-native-toast-message';

import { useDockReservePx } from '@/components/layout/bottomChromeInset';
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

type ToastHostProps = {
  /**
   * false — хост внутри полноэкранного Modal, где дока нет (#844): тост над
   * home indicator, а не над доком корневого экрана.
   */
  overDock?: boolean;
};

/**
 * Хост тостов native (#2161, #2168). Отступ — из того же резерва дока, что и
 * у экранов (`useDockReservePx`, #2097), поэтому тост целиком над доком на
 * любой нижней safe-area. Позиция по умолчанию — снизу, как у web-хоста и
 * `useActionFeedback`. Слой — верхний: тост рисуется поверх дока и
 * sticky-баров с `elevation` на Android.
 */
export default function ToastHost({ overDock = true }: ToastHostProps) {
  const dockReservePx = useDockReservePx();
  const insets = useSafeAreaInsetsSafe();
  if (Platform.OS === 'web') return null;
  const bottomOffset = toastBottomOffset(overDock ? dockReservePx : 0, insets.bottom);
  return (
    <View pointerEvents="box-none" style={styles.layer} testID="toast-layer">
      <Toast config={toastConfig} position="bottom" bottomOffset={bottomOffset} />
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
