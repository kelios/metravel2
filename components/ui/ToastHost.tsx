import React from 'react';
import { Platform, Pressable, Text, StyleSheet } from 'react-native';
import Toast, { BaseToast, ErrorToast, InfoToast, SuccessToast } from 'react-native-toast-message';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { ToastAction } from '@/utils/toast.native';

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

export default function ToastHost() {
  if (Platform.OS === 'web') return null;
  return <Toast config={toastConfig} />;
}

const styles = StyleSheet.create({
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
