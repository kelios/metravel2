// utils/haptics.ts
// ANIM-01: Haptic feedback utility
// Обёртка для тактильной обратной связи на native.
// На web или если expo-haptics недоступен — no-op.
import { Platform } from 'react-native';

type ImpactStyle = 'light' | 'medium' | 'heavy';

let HapticsModule: any = null;

if (Platform.OS !== 'web') {
  try {
    // Динамический require — не ломает web бандл
    HapticsModule = require('expo-haptics');
  } catch {
    // expo-haptics не установлен — ok
  }
}

/**
 * Тактильный импульс (на iOS/Android).
 * На web — no-op.
 */
export function hapticImpact(style: ImpactStyle = 'light'): void {
  if (!HapticsModule) return;
  try {
    const impactStyle =
      style === 'heavy'
        ? HapticsModule.ImpactFeedbackStyle?.Heavy
        : style === 'medium'
          ? HapticsModule.ImpactFeedbackStyle?.Medium
          : HapticsModule.ImpactFeedbackStyle?.Light;
    if (impactStyle != null) {
      HapticsModule.impactAsync(impactStyle);
    }
  } catch {
    // silently ignore
  }
}

/**
 * Тактильный «успех» / «предупреждение» / «ошибка».
 */
export function hapticNotification(type: 'success' | 'warning' | 'error' = 'success'): void {
  if (!HapticsModule) return;
  try {
    const notificationType =
      type === 'error'
        ? HapticsModule.NotificationFeedbackType?.Error
        : type === 'warning'
          ? HapticsModule.NotificationFeedbackType?.Warning
          : HapticsModule.NotificationFeedbackType?.Success;
    if (notificationType != null) {
      HapticsModule.notificationAsync(notificationType);
    }
  } catch {
    // silently ignore
  }
}

/**
 * Тактильный отклик выбора (selection tap).
 */
export function hapticSelection(): void {
  if (!HapticsModule) return;
  try {
    HapticsModule.selectionAsync();
  } catch {
    // silently ignore
  }
}

