// components/ErrorDisplay.tsx
// ✅ УЛУЧШЕНИЕ: Компонент для отображения понятных ошибок пользователю
// ✅ МИГРАЦИЯ: Полная поддержка динамических цветов через useThemedColors

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string; // Технические детали (опционально)
  onRetry?: () => void;
  onDismiss?: () => void;
  showContact?: boolean; // Показывать ли кнопку связи с поддержкой
  variant?: 'error' | 'warning' | 'info';
}

export default function ErrorDisplay({
  title = 'Что-то пошло не так',
  message,
  details,
  onRetry,
  onDismiss,
  showContact = true,
  variant = 'error',
}: ErrorDisplayProps) {
  const colors = useThemedColors();

  const iconName = variant === 'warning' ? 'alert-triangle' :
                   variant === 'info' ? 'info' : 'alert-circle';
  
  const iconColor = variant === 'warning' ? colors.warning :
                    variant === 'info' ? colors.info :
                    colors.danger;

  const backgroundColor = variant === 'warning' ? colors.warningLight :
                          variant === 'info' ? colors.infoLight :
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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
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
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore
                  ':hover': {
                    opacity: 0.9,
                  },
                },
              })}
            >
              <Feather name="refresh-cw" size={16} color={colors.textOnPrimary} />
              <Text style={styles.buttonText}>Попробовать снова</Text>
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
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore
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
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore
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

