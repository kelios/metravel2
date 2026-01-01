/**
 * Компоненты для визуального отображения валидации
 * ✅ РЕДИЗАЙН: Темная тема
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { FieldValidationResult } from '@/utils/travelWizardValidation';
import { useThemedColors } from '@/hooks/useTheme';

interface CharacterCounterProps {
  current: number;
  min?: number;
  max?: number;
  showProgress?: boolean;
}

/**
 * Счетчик символов с индикатором прогресса
 */
export const CharacterCounter: React.FC<CharacterCounterProps> = ({
  current,
  min,
  max,
  showProgress = true,
}) => {
  const colors = useThemedColors();
  const hasMin = min !== undefined;
  const hasMax = max !== undefined;
  
  let status: 'error' | 'warning' | 'success' = 'success';
  let message = '';
  
  if (hasMin && current < min) {
    status = 'error';
    message = `${current} / ${min} символов (минимум)`;
  } else if (hasMax && current > max) {
    status = 'error';
    message = `${current} / ${max} символов (превышен лимит)`;
  } else if (hasMax) {
    message = `${current} / ${max} символов`;
    if (current > max * 0.9) {
      status = 'warning';
    }
  } else if (hasMin) {
    message = `${current} символов`;
  } else {
    message = `${current} символов`;
  }

  const getColor = () => {
    switch (status) {
      case 'error':
        return colors.danger;
      case 'warning':
        return '#FF9800';
      case 'success':
        return colors.textMuted;
    }
  };

  const getProgressWidth = () => {
    if (!hasMax) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const styles = useMemo(() => StyleSheet.create({
    counterContainer: {
      marginTop: 4,
    },
    counterText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '500',
    },
    progressBar: {
      marginTop: 4,
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
  }), [colors]);

  return (
    <View style={styles.counterContainer}>
      <Text style={[styles.counterText, { color: getColor() }]}>
        {message}
      </Text>
      {showProgress && hasMax && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${getProgressWidth()}%`,
                backgroundColor: getColor(),
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

interface FieldValidationMessageProps {
  validation: FieldValidationResult;
  fieldName?: string;
}

/**
 * Сообщение об ошибке/предупреждении валидации
 */
export const FieldValidationMessage: React.FC<FieldValidationMessageProps> = ({
  validation,
}) => {
  const colors = useThemedColors();

  const messageStyles = useMemo(() => StyleSheet.create({
    messageContainer: {
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorContainer: {
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerLight,
    },
    warningContainer: {
      backgroundColor: '#FFF3E0',
      borderWidth: 1,
      borderColor: '#FFE0B2',
    },
    messageIcon: {
      marginRight: 6,
    },
    messageText: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '500',
    },
    errorText: {
      color: colors.danger,
    },
    warningText: {
      color: '#F57C00',
    },
  }), [colors]);

  if (validation.isValid && !validation.warning) {
    return null;
  }

  const message = validation.error || validation.warning;
  const isError = !!validation.error;

  return (
    <View style={[messageStyles.messageContainer, isError ? messageStyles.errorContainer : messageStyles.warningContainer]}>
      <Feather
        name={isError ? 'alert-circle' : 'info'}
        size={14}
        color={isError ? colors.danger : '#FF9800'}
        style={messageStyles.messageIcon}
      />
      <Text style={[messageStyles.messageText, isError ? messageStyles.errorText : messageStyles.warningText]}>
        {message}
      </Text>
    </View>
  );
};

interface QualityIndicatorProps {
  level: 'poor' | 'fair' | 'good' | 'excellent';
  score: number;
}

/**
 * Индикатор качества заполнения
 */
export const QualityIndicator: React.FC<QualityIndicatorProps> = ({ level, score }) => {
  const colors = useThemedColors();

  const getConfig = () => {
    switch (level) {
      case 'excellent':
        return {
          color: colors.success,
          icon: 'check-circle' as const,
          label: 'Отлично',
          bgColor: colors.successSoft,
        };
      case 'good':
        return {
          color: '#4CAF50',
          icon: 'thumbs-up' as const,
          label: 'Хорошо',
          bgColor: '#E8F5E9',
        };
      case 'fair':
        return {
          color: '#FF9800',
          icon: 'alert-triangle' as const,
          label: 'Удовлетворительно',
          bgColor: '#FFF3E0',
        };
      case 'poor':
        return {
          color: colors.danger,
          icon: 'x-circle' as const,
          label: 'Требует улучшения',
          bgColor: colors.dangerSoft,
        };
    }
  };

  const config = getConfig();

  const qualityStyles = useMemo(() => StyleSheet.create({
    qualityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 8,
      backgroundColor: config.bgColor,
    },
    qualityLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      flex: 1,
      color: config.color,
    },
    qualityScore: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: config.color,
    },
  }), [config]);

  return (
    <View style={qualityStyles.qualityContainer}>
      <Feather name={config.icon} size={16} color={config.color} />
      <Text style={qualityStyles.qualityLabel}>
        {config.label}
      </Text>
      <Text style={qualityStyles.qualityScore}>
        {score}%
      </Text>
    </View>
  );
};

interface ValidationSummaryProps {
  errorCount: number;
  warningCount: number;
  onErrorClick?: () => void;
}

/**
 * Сводка по валидации (количество ошибок/предупреждений)
 */
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errorCount,
  warningCount,
}) => {
  const colors = useThemedColors();

  const summaryStyles = useMemo(() => StyleSheet.create({
    summaryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    successSummary: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successLight,
    },
    summaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    successSummaryText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.success,
      fontWeight: '600',
    },
    errorSummaryText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.danger,
      fontWeight: '600',
    },
    warningSummaryText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: '#F57C00',
      fontWeight: '600',
    },
  }), [colors]);

  if (errorCount === 0 && warningCount === 0) {
    return (
      <View style={[summaryStyles.summaryContainer, summaryStyles.successSummary]}>
        <Feather name="check-circle" size={16} color={colors.success} />
        <Text style={summaryStyles.successSummaryText}>Все поля заполнены корректно</Text>
      </View>
    );
  }

  return (
    <View style={summaryStyles.summaryContainer}>
      {errorCount > 0 && (
        <View style={summaryStyles.summaryItem}>
          <Feather name="alert-circle" size={16} color={colors.danger} />
          <Text style={summaryStyles.errorSummaryText}>
            {errorCount} {errorCount === 1 ? 'ошибка' : 'ошибки'}
          </Text>
        </View>
      )}
      {warningCount > 0 && (
        <View style={summaryStyles.summaryItem}>
          <Feather name="info" size={16} color="#FF9800" />
          <Text style={summaryStyles.warningSummaryText}>
            {warningCount} {warningCount === 1 ? 'предупреждение' : 'предупреждения'}
          </Text>
        </View>
      )}
    </View>
  );
};

