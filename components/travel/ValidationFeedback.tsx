/**
 * Компоненты для визуального отображения валидации
 * ✅ РЕДИЗАЙН: Темная тема
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
        return colors.warning;
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
      backgroundColor: colors.warningSoft,
      borderWidth: 1,
      borderColor: colors.warningLight,
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
      color: colors.warningDark,
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
        color={isError ? colors.danger : colors.warning}
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
          color: colors.success,
          icon: 'thumbs-up' as const,
          label: 'Хорошо',
          bgColor: colors.successSoft,
        };
      case 'fair':
        return {
          color: colors.warning,
          icon: 'alert-triangle' as const,
          label: 'Удовлетворительно',
          bgColor: colors.warningSoft,
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
  errorMessages?: string[];
  warningMessages?: string[];
}

function pluralRu(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

/**
 * Сводка по валидации (количество ошибок/предупреждений)
 */
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errorCount,
  warningCount,
  errorMessages,
  warningMessages,
}) => {
  const colors = useThemedColors();

  const summaryStyles = useMemo(() => StyleSheet.create({
    summaryContainer: {
      flexDirection: 'column',
      alignItems: 'stretch',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
      color: colors.warning,
      fontWeight: '600',
    },
    messagesWrapper: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 6,
    },
    messageLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    messageText: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
    messageTextError: {
      color: colors.dangerDark,
    },
    messageTextWarning: {
      color: colors.warningDark,
    },
  }), [colors]);

  if (errorCount === 0 && warningCount === 0) {
    return (
      <View style={[summaryStyles.summaryContainer, summaryStyles.successSummary]}>
        <View style={summaryStyles.summaryRow}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={summaryStyles.successSummaryText}>Все поля заполнены корректно</Text>
        </View>
      </View>
    );
  }

  const normalizedErrorMessages = (errorMessages ?? []).filter(Boolean);
  const normalizedWarningMessages = (warningMessages ?? []).filter(Boolean);
  const hasAnyMessages = normalizedErrorMessages.length > 0 || normalizedWarningMessages.length > 0;

  return (
    <View style={summaryStyles.summaryContainer}>
      <View style={summaryStyles.summaryRow}>
        {errorCount > 0 && (
          <View style={summaryStyles.summaryItem}>
            <Feather name="alert-circle" size={16} color={colors.danger} />
            <Text style={summaryStyles.errorSummaryText}>
              {errorCount} {pluralRu(errorCount, 'ошибка', 'ошибки', 'ошибок')}
            </Text>
          </View>
        )}
        {warningCount > 0 && (
          <View style={summaryStyles.summaryItem}>
            <Feather name="info" size={16} color={colors.warning} />
            <Text style={summaryStyles.warningSummaryText}>
              {warningCount} {pluralRu(warningCount, 'предупреждение', 'предупреждения', 'предупреждений')}
            </Text>
          </View>
        )}
      </View>

      {hasAnyMessages && (
        <View style={summaryStyles.messagesWrapper}>
          {normalizedErrorMessages.slice(0, 5).map((message, idx) => (
            <View key={`err-${idx}`} style={summaryStyles.messageLine}>
              <Feather name="alert-circle" size={14} color={colors.danger} style={{ marginTop: 2 }} />
              <Text style={[summaryStyles.messageText, summaryStyles.messageTextError]}>{message}</Text>
            </View>
          ))}
          {normalizedWarningMessages.slice(0, 5).map((message, idx) => (
            <View key={`warn-${idx}`} style={summaryStyles.messageLine}>
              <Feather name="info" size={14} color={colors.warning} style={{ marginTop: 2 }} />
              <Text style={[summaryStyles.messageText, summaryStyles.messageTextWarning]}>{message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
