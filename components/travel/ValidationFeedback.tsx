/**
 * Компоненты для визуального отображения валидации
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { FieldValidationResult } from '@/utils/travelWizardValidation';

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
        return DESIGN_TOKENS.colors.dangerDark;
      case 'warning':
        return '#FF9800';
      case 'success':
        return DESIGN_TOKENS.colors.textMuted;
    }
  };

  const getProgressWidth = () => {
    if (!hasMax) return 0;
    return Math.min((current / max) * 100, 100);
  };

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
  if (validation.isValid && !validation.warning) {
    return null;
  }

  const message = validation.error || validation.warning;
  const isError = !!validation.error;

  return (
    <View style={[styles.messageContainer, isError ? styles.errorContainer : styles.warningContainer]}>
      <Feather
        name={isError ? 'alert-circle' : 'info'}
        size={14}
        color={isError ? DESIGN_TOKENS.colors.dangerDark : '#FF9800'}
        style={styles.messageIcon}
      />
      <Text style={[styles.messageText, isError ? styles.errorText : styles.warningText]}>
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
  const getConfig = () => {
    switch (level) {
      case 'excellent':
        return {
          color: DESIGN_TOKENS.colors.successDark,
          icon: 'check-circle' as const,
          label: 'Отлично',
          bgColor: DESIGN_TOKENS.colors.successSoft,
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
          color: DESIGN_TOKENS.colors.dangerDark,
          icon: 'x-circle' as const,
          label: 'Требует улучшения',
          bgColor: DESIGN_TOKENS.colors.errorSoft,
        };
    }
  };

  const config = getConfig();

  return (
    <View style={[styles.qualityContainer, { backgroundColor: config.bgColor }]}>
      <Feather name={config.icon} size={16} color={config.color} />
      <Text style={[styles.qualityLabel, { color: config.color }]}>
        {config.label}
      </Text>
      <Text style={[styles.qualityScore, { color: config.color }]}>
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
  if (errorCount === 0 && warningCount === 0) {
    return (
      <View style={[styles.summaryContainer, styles.successSummary]}>
        <Feather name="check-circle" size={16} color={DESIGN_TOKENS.colors.successDark} />
        <Text style={styles.successSummaryText}>Все поля заполнены корректно</Text>
      </View>
    );
  }

  return (
    <View style={styles.summaryContainer}>
      {errorCount > 0 && (
        <View style={styles.summaryItem}>
          <Feather name="alert-circle" size={16} color={DESIGN_TOKENS.colors.dangerDark} />
          <Text style={styles.errorSummaryText}>
            {errorCount} {errorCount === 1 ? 'ошибка' : 'ошибки'}
          </Text>
        </View>
      )}
      {warningCount > 0 && (
        <View style={styles.summaryItem}>
          <Feather name="info" size={16} color="#FF9800" />
          <Text style={styles.warningSummaryText}>
            {warningCount} {warningCount === 1 ? 'предупреждение' : 'предупреждения'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: DESIGN_TOKENS.colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  messageContainer: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: DESIGN_TOKENS.colors.errorSoft,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.dangerLight,
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
    color: DESIGN_TOKENS.colors.dangerDark,
  },
  warningText: {
    color: '#F57C00',
  },
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  qualityLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    flex: 1,
  },
  qualityScore: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  successSummary: {
    backgroundColor: DESIGN_TOKENS.colors.successSoft,
    borderColor: DESIGN_TOKENS.colors.successLight,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successSummaryText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.successDark,
    fontWeight: '600',
  },
  errorSummaryText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.dangerDark,
    fontWeight: '600',
  },
  warningSummaryText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: '#F57C00',
    fontWeight: '600',
  },
});
