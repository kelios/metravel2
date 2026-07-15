// Плашка-предупреждение об ответственности в точках личного взаимодействия
// (обмен контактами, переписка, договорённости о встречах). Trust & Safety.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { translate as i18nT } from '@/i18n'


const STORAGE_PREFIX = 'metravel_safety_notice_dismissed:';

interface SafetyNoticeProps {
  /** Текст предупреждения. По умолчанию — про ответственность MeTravel. */
  text?: string;
  /** Если задан — закрытие плашки запоминается, и она больше не показывается. */
  storageKey?: string;
  /** Показывать кнопку закрытия. По умолчанию true, когда задан storageKey. */
  dismissible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function readDismissedSync(storageKey?: string): boolean {
  if (!storageKey) return false;
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(STORAGE_PREFIX + storageKey) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

function SafetyNotice({ text, storageKey, dismissible, style, testID }: SafetyNoticeProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canDismiss = dismissible ?? Boolean(storageKey);
  const displayText = text ?? i18nT('sharedStatic:safetyNotice.default');

  // На web стартовое значение читаем синхронно (без мигания плашки), на native —
  // дочитываем в эффекте.
  const [dismissed, setDismissed] = useState(() => readDismissedSync(storageKey));

  useEffect(() => {
    if (!storageKey || Platform.OS === 'web') return;
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_PREFIX + storageKey)
      .then((v) => {
        if (!cancelled && v === 'true') setDismissed(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (!storageKey) return;
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(STORAGE_PREFIX + storageKey, 'true');
      } catch {
        /* noop */
      }
    } else {
      void AsyncStorage.setItem(STORAGE_PREFIX + storageKey, 'true').catch(() => {});
    }
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="alert"
      accessibilityLabel={displayText}
      testID={testID ?? 'safety-notice'}
    >
      <Feather name="shield" size={18} color={colors.warning} style={styles.icon} />
      <Text style={styles.text}>{displayText}</Text>
      {canDismiss && (
        <Pressable
          onPress={handleDismiss}
          style={[styles.closeButton, globalFocusStyles.focusable]}
          accessibilityRole="button"
          accessibilityLabel={i18nT('shared:components.ui.SafetyNotice.skryt_preduprezhdenie_de851520')}
          testID={`${testID ?? 'safety-notice'}-dismiss`}
          hitSlop={8}
          {...Platform.select({ web: { cursor: 'pointer' as any } })}
        >
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.warningLight,
      borderLeftWidth: 3,
      borderLeftColor: colors.warning,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    icon: {
      marginTop: 1,
    },
    text: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    closeButton: {
      padding: 2,
      marginLeft: DESIGN_TOKENS.spacing.xs,
    },
  });

export default React.memo(SafetyNotice);
