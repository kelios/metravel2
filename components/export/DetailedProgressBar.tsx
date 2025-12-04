// components/export/DetailedProgressBar.tsx
// Детализированный прогресс-бар для экспорта PDF

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ExportStage } from '@/src/types/pdf-export';

interface ProgressStep {
  stage: ExportStage;
  label: string;
  icon: string;
  weight: number; // Процент от общего прогресса
}

const PROGRESS_STEPS: ProgressStep[] = [
  {
    stage: ExportStage.VALIDATING,
    label: 'Проверка данных',
    icon: '🔍',
    weight: 5,
  },
  {
    stage: ExportStage.TRANSFORMING,
    label: 'Подготовка контента',
    icon: '⚙️',
    weight: 5,
  },
  {
    stage: ExportStage.GENERATING_HTML,
    label: 'Генерация страниц',
    icon: '📄',
    weight: 20,
  },
  {
    stage: ExportStage.LOADING_IMAGES,
    label: 'Загрузка изображений',
    icon: '🖼️',
    weight: 40,
  },
  {
    stage: ExportStage.RENDERING,
    label: 'Создание PDF',
    icon: '📚',
    weight: 25,
  },
  {
    stage: ExportStage.COMPLETE,
    label: 'Готово',
    icon: '✅',
    weight: 5,
  },
];

interface DetailedProgressBarProps {
  currentStage: ExportStage;
  progress: number; // 0-100
  message?: string;
  substeps?: string[]; // Подэтапы текущего этапа
  estimatedTimeRemaining?: number; // В секундах
  onCancel?: () => void;
}

export default function DetailedProgressBar({
  currentStage,
  progress,
  message,
  substeps = [],
  estimatedTimeRemaining,
  onCancel,
}: DetailedProgressBarProps) {
  const [animatedProgress] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const currentStepIndex = PROGRESS_STEPS.findIndex((step) => step.stage === currentStage);
  const isError = currentStage === ExportStage.ERROR;

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isError ? '❌ Ошибка экспорта' : '📖 Создание книги путешествий'}
        </Text>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {/* Основной прогресс-бар */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBackground, isError && styles.progressBarError]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              isError && styles.progressBarFillError,
              { width: progressWidth },
            ]}
          />
        </View>
      </View>

      {/* Этапы */}
      <View style={styles.stepsContainer}>
        {PROGRESS_STEPS.filter((step) => step.stage !== ExportStage.ERROR).map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <StepIndicator
              key={step.stage}
              step={step}
              isCompleted={isCompleted}
              isCurrent={isCurrent}
              isPending={isPending}
              substeps={isCurrent ? substeps : []}
            />
          );
        })}
      </View>

      {/* Сообщение */}
      {message && (
        <View style={styles.messageContainer}>
          <Text style={[styles.message, isError && styles.messageError]}>{message}</Text>
        </View>
      )}

      {/* Оставшееся время */}
      {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && !isError && (
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>Осталось примерно:</Text>
          <Text style={styles.timeValue}>{formatTime(estimatedTimeRemaining)}</Text>
        </View>
      )}

      {/* Кнопка отмены */}
      {onCancel && !isError && (
        <View style={styles.actionsContainer}>
          <Text style={styles.cancelButton} onPress={onCancel}>
            Отменить
          </Text>
        </View>
      )}
    </View>
  );
}

interface StepIndicatorProps {
  step: ProgressStep;
  isCompleted: boolean;
  isCurrent: boolean;
  isPending: boolean;
  substeps: string[];
}

function StepIndicator({
  step,
  isCompleted,
  isCurrent,
  isPending,
  substeps,
}: StepIndicatorProps) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepRow}>
        {/* Иконка */}
        <View
          style={[
            styles.stepIcon,
            isCompleted && styles.stepIconCompleted,
            isCurrent && styles.stepIconCurrent,
            isPending && styles.stepIconPending,
          ]}
        >
          <Text style={styles.stepIconText}>
            {isCompleted ? '✓' : isCurrent ? step.icon : step.icon}
          </Text>
        </View>

        {/* Название этапа */}
        <View style={styles.stepInfo}>
          <Text
            style={[
              styles.stepLabel,
              isCompleted && styles.stepLabelCompleted,
              isCurrent && styles.stepLabelCurrent,
              isPending && styles.stepLabelPending,
            ]}
          >
            {step.label}
          </Text>

          {/* Подэтапы */}
          {isCurrent && substeps.length > 0 && (
            <View style={styles.substepsContainer}>
              {substeps.map((substep, index) => (
                <View key={index} style={styles.substepRow}>
                  <View style={styles.substepDot} />
                  <Text style={styles.substepText}>{substep}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Статус */}
        <View style={styles.stepStatus}>
          {isCompleted && <Text style={styles.stepStatusCompleted}>✓</Text>}
          {isCurrent && <View style={styles.stepStatusSpinner} />}
        </View>
      </View>
    </View>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} сек`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} мин ${remainingSeconds} сек`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  progressBarContainer: {
    marginBottom: 24,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarError: {
    backgroundColor: '#fee2e2',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressBarFillError: {
    backgroundColor: '#ef4444',
  },
  stepsContainer: {
    gap: 12,
  },
  stepContainer: {
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  stepIconCompleted: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  stepIconCurrent: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  stepIconPending: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  stepIconText: {
    fontSize: 16,
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  stepLabelCompleted: {
    color: '#10b981',
  },
  stepLabelCurrent: {
    color: '#2563eb',
    fontWeight: '600',
  },
  stepLabelPending: {
    color: '#9ca3af',
  },
  stepStatus: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepStatusCompleted: {
    fontSize: 18,
    color: '#10b981',
  },
  stepStatusSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderTopColor: 'transparent',
    // Note: В реальном приложении нужна анимация вращения
  },
  substepsContainer: {
    marginTop: 8,
    gap: 6,
  },
  substepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
  },
  substepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
  },
  substepText: {
    fontSize: 13,
    color: '#6b7280',
  },
  messageContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  messageError: {
    color: '#ef4444',
    backgroundColor: '#fee2e2',
  },
  timeContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  actionsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelButton: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
