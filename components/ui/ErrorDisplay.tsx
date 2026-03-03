// components/ErrorDisplay.tsx
// ✅ УЛУЧШЕНИЕ: Компонент для отображения понятных ошибок пользователю
// ✅ МИГРАЦИЯ: Полная поддержка динамических цветов через useThemedColors

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

/** AND-10: Detect network-related errors from message text */
function isNetworkRelatedMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes('network') ||
    lower.includes('сет') || // сеть, сетевая
    lower.includes('подключен') ||
    lower.includes('соединен') ||
    lower.includes('timeout') ||
    lower.includes('failed to fetch') ||
    lower.includes('превышено время') ||
    lower.includes('network request failed') ||
    lower.includes('нет интернета') ||
    lower.includes('offline')
  );
}

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string; // Технические детали (опционально)
  onRetry?: () => void;
  onDismiss?: () => void;
  showContact?: boolean; // Показывать ли кнопку связи с поддержкой
  variant?: 'error' | 'warning' | 'info';
  /** AND-10: Сетевая ошибка — показывает специализированную иконку и текст */
  isNetworkError?: boolean;
}

export default function ErrorDisplay({
  title,
  message,
  details,
  onRetry,
  onDismiss,
  showContact = true,
  variant = 'error',
  isNetworkError: isNetworkErrorProp = false,
}: ErrorDisplayProps) {
  const colors = useThemedColors();

  // AND-10: Auto-detect network errors from message text
  const isNetworkError = isNetworkErrorProp || isNetworkRelatedMessage(message);

  // AND-10: При сетевой ошибке переопределяем defaults
  const effectiveTitle = title ?? (isNetworkError ? 'Нет подключения к интернету' : 'Что-то пошло не так');
  const effectiveVariant = isNetworkError ? 'warning' : variant;
  const effectiveMessage = isNetworkError && !message
    ? 'Проверьте подключение к интернету и попробуйте ещё раз'
    : message;

  const iconName = isNetworkError ? 'wifi-off' :
                   effectiveVariant === 'warning' ? 'alert-triangle' :
                   effectiveVariant === 'info' ? 'info' : 'alert-circle';

  const iconColor = effectiveVariant === 'warning' ? colors.warning :
                    effectiveVariant === 'info' ? colors.info :
                    colors.danger;

  const backgroundColor = effectiveVariant === 'warning' ? colors.warningLight :
                          effectiveVariant === 'info' ? colors.infoLight :
                          colors.dangerLight;

  // ✅ Динамические стили на основе текущей темы
  const styles = useMemo(() => StyleSheet.create({
    container: {
      borderRadius: 12,
      padding: 16,
      margin: 16,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
        },
        default: {
          ...DESIGN_TOKENS.shadowsNative.medium,
        },
      }),
    },
    content: {
      flexDirection: 'column',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    textContainer: {
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      textAlign: 'center',
    },
    detailsContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.mutedBackground,
      borderRadius: 8,
    },
    detailsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
    },
    details: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: Platform.select({ web: 'monospace', default: undefined }),
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      alignItems: 'center',
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
      minHeight: 44,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    secondaryButtonText: {
      color: colors.primaryText,
    },
    dismissButton: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }), [colors]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        {/* Иконка */}
        <View style={styles.iconContainer}>
          <Feather name={iconName as any} size={24} color={iconColor} />
        </View>

        {/* Текст ошибки */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{effectiveTitle}</Text>
          <Text style={styles.message}>{effectiveMessage}</Text>

          {/* Детали (только в dev режиме) */}
          {details && __DEV__ && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsLabel}>Технические детали:</Text>
              <Text style={styles.details}>{details}</Text>
            </View>
          )}
        </View>

        {/* Действия */}
        <View style={styles.actions}>
          {onRetry && (
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={isNetworkError ? 'Повторить попытку подключения' : 'Попробовать снова'}
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore -- CSS pseudo-selector :hover is web-only, not in RN style types
                  ':hover': {
                    opacity: 0.9,
                  },
                },
              })}
            >
              <Feather name={isNetworkError ? 'wifi' : 'refresh-cw'} size={16} color={colors.textOnPrimary} />
              <Text style={styles.buttonText}>
                {isNetworkError ? 'Повторить' : 'Попробовать снова'}
              </Text>
            </Pressable>
          )}

          {showContact && (
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window?.open?.('https://www.instagram.com/metravelby/', '_blank');
                } else {
                  // На мобильных можно открыть приложение Instagram
                  // или показать email
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Связаться с поддержкой"
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore -- CSS pseudo-selector :hover is web-only, not in RN style types
                  ':hover': {
                    opacity: 0.8,
                  },
                },
              })}
            >
              <Feather name="mail" size={16} color={colors.primary} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Связаться с поддержкой
              </Text>
            </Pressable>
          )}

          {onDismiss && (
            <Pressable
              style={styles.dismissButton}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Закрыть уведомление об ошибке"
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore -- CSS pseudo-selector :hover is web-only, not in RN style types
                  ':hover': {
                    opacity: 0.7,
                  },
                },
              })}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

