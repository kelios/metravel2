// components/ErrorDisplay.tsx
// ✅ УЛУЧШЕНИЕ: Компонент для отображения понятных ошибок пользователю

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string; // Технические детали (опционально)
  onRetry?: () => void;
  onDismiss?: () => void;
  showContact?: boolean; // Показывать ли кнопку связи с поддержкой
  variant?: 'error' | 'warning' | 'info';
}

const palette = DESIGN_TOKENS.colors;

export default function ErrorDisplay({
  title = 'Что-то пошло не так',
  message,
  details,
  onRetry,
  onDismiss,
  showContact = true,
  variant = 'error',
}: ErrorDisplayProps) {
  const iconName = variant === 'warning' ? 'alert-triangle' : 
                   variant === 'info' ? 'info' : 'alert-circle';
  
  const iconColor = variant === 'warning' ? '#f59e0b' :
                    variant === 'info' ? '#3b82f6' :
                    '#ef4444';

  const backgroundColor = variant === 'warning' ? '#fef3c7' :
                          variant === 'info' ? '#dbeafe' :
                          '#fee2e2';

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
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.buttonText}>Попробовать снова</Text>
            </Pressable>
          )}

          {showContact && (
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open('https://www.instagram.com/metravelby/', '_blank');
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
              <Feather name="mail" size={16} color={palette.primary} />
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
              <Feather name="x" size={20} color={palette.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    margin: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    textAlign: 'center',
  },
  detailsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  details: {
    fontSize: 11,
    color: '#6b7280',
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
    minHeight: 44, // Минимальный размер для touch-целей
  },
  primaryButton: {
    backgroundColor: palette.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: palette.primary,
  },
  dismissButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

