// components/ProgressIndicator.tsx
// ✅ УЛУЧШЕНИЕ: Компонент для отображения прогресса длительных операций
// ✅ МИГРАЦИЯ: Полная поддержка динамических цветов через useThemedColors

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  stage?: string; // Текущий этап операции
  message?: string; // Дополнительное сообщение
  showPercentage?: boolean; // Показывать ли процент
  onCancel?: () => void; // Функция отмены
  size?: 'small' | 'medium' | 'large';
}

export default function ProgressIndicator({
  progress,
  stage,
  message,
  showPercentage = true,
  onCancel,
  size = 'medium',
}: ProgressIndicatorProps) {
  const colors = useThemedColors();
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // ✅ Динамические стили на основе текущей темы
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
    },
    spinner: {
      marginBottom: 16,
    },
    info: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 16,
    },
    stage: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 8,
      textAlign: 'center',
    },
    percentage: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primaryText,
    },
    progressBarContainer: {
      width: '100%',
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 12,
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
      ...Platform.select({
        web: {
          transition: 'width 0.3s ease',
        },
      }),
    },
    cancelContainer: {
      marginTop: 8,
    },
    cancelButton: {
      fontSize: 14,
      color: colors.textMuted,
      textDecorationLine: 'underline',
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Индикатор загрузки */}
        <ActivityIndicator 
          size={size === 'small' ? 'small' : 'large'} 
          color={colors.primary}
          style={styles.spinner}
        />

        {/* Информация о прогрессе */}
        <View style={styles.info}>
          {!!stage && (
            <Text style={styles.stage}>{stage}</Text>
          )}
          
          {!!message && (
            <Text style={styles.message}>{message}</Text>
          )}

          {showPercentage && (
            <Text style={styles.percentage}>{Math.round(clampedProgress)}%</Text>
          )}
        </View>

        {/* Прогресс-бар */}
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${clampedProgress}%` }
            ]} 
          />
        </View>

        {/* Кнопка отмены */}
        {onCancel && (
          <View style={styles.cancelContainer}>
            <Text 
              style={styles.cancelButton}
              onPress={onCancel}
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
              Отменить
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}


