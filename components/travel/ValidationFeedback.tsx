/**
 * Компоненты для визуального отображения валидации
 * ✅ РЕДИЗАЙН: Темная тема
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { FieldValidationResult } from '@/utils/travelWizardValidation';
import { useThemedColors } from '@/hooks/useTheme';
import { selectPlural, translate as i18nT } from '@/i18n'


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
  const characterNoun = (count: number) => selectLocalizedPlural(
    count,
    i18nT('travel:common.characterNoun_one'),
    i18nT('travel:common.characterNoun_few'),
    i18nT('travel:common.characterNoun_many'),
    i18nT('travel:common.characterNoun_other'),
  );
  
  if (hasMin && current < min) {
    status = 'error';
    message = i18nT('travel:components.travel.ValidationFeedback.minimum', { value1: current, value2: min, value3: characterNoun(min) });
  } else if (hasMax && current > max) {
    status = 'error';
    message = i18nT('travel:components.travel.ValidationFeedback.limitExceeded', { value1: current, value2: max, value3: characterNoun(max) });
  } else if (hasMax) {
    message = i18nT('travel:components.travel.ValidationFeedback.withMaximum', { value1: current, value2: max, value3: characterNoun(max) });
    if (current > max * 0.9) {
      status = 'warning';
    }
  } else if (hasMin) {
    message = i18nT('travel:components.travel.ValidationFeedback.characterCount', { value1: current, value2: characterNoun(current) });
  } else {
    message = i18nT('travel:components.travel.ValidationFeedback.characterCount', { value1: current, value2: characterNoun(current) });
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
          label: i18nT('travel:components.travel.ValidationFeedback.otlichno_a8a2f6b7'),
          bgColor: colors.successSoft,
        };
      case 'good':
        return {
          color: colors.success,
          icon: 'thumbs-up' as const,
          label: i18nT('travel:components.travel.ValidationFeedback.horosho_c4ebe651'),
          bgColor: colors.successSoft,
        };
      case 'fair':
        return {
          color: colors.warning,
          icon: 'alert-triangle' as const,
          label: i18nT('travel:components.travel.ValidationFeedback.udovletvoritelno_c0510232'),
          bgColor: colors.warningSoft,
        };
      case 'poor':
        return {
          color: colors.danger,
          icon: 'x-circle' as const,
          label: i18nT('travel:components.travel.ValidationFeedback.trebuet_uluchsheniya_1052ec62'),
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

function selectLocalizedPlural(
  count: number,
  one: string,
  few: string,
  many: string,
  other: string = many,
): string {
  return selectPlural(count, { one, few, many, other });
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
          <Text style={summaryStyles.successSummaryText}>{i18nT('travel:components.travel.ValidationFeedback.vse_polya_zapolneny_korrektno_ea29a0ec')}</Text>
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
              {errorCount} {selectLocalizedPlural(errorCount, i18nT('travel:components.travel.ValidationFeedback.oshibka_a754c58d'), i18nT('travel:components.travel.ValidationFeedback.oshibki_71f0a30f'), i18nT('travel:components.travel.ValidationFeedback.oshibok_b6b2ef44'))}
            </Text>
          </View>
        )}
        {warningCount > 0 && (
          <View style={summaryStyles.summaryItem}>
            <Feather name="info" size={16} color={colors.warning} />
            <Text style={summaryStyles.warningSummaryText}>
              {warningCount} {selectLocalizedPlural(warningCount, i18nT('travel:components.travel.ValidationFeedback.preduprezhdenie_bf607953'), i18nT('travel:components.travel.ValidationFeedback.preduprezhdeniya_e11e2b0f'), i18nT('travel:components.travel.ValidationFeedback.preduprezhdeniy_b07ba364'))}
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

/**
 * Компактная сворачиваемая сводка валидации (для мобильного).
 * Свёрнута по умолчанию: показывает плашку «N ошибок · M рекомендаций»,
 * по тапу раскрывается в полную ValidationSummary.
 */
export const CollapsibleValidationSummary: React.FC<ValidationSummaryProps> = ({
  errorCount,
  warningCount,
  errorMessages,
  warningMessages,
}) => {
  const colors = useThemedColors();
  const [expanded, setExpanded] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        toggle: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: errorCount > 0 ? colors.dangerLight : colors.warningLight,
        },
        toggleText: {
          flex: 1,
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: '600',
          color: errorCount > 0 ? colors.danger : colors.warning,
        },
        body: {
          marginTop: 8,
        },
      }),
    [colors, errorCount],
  );

  if (errorCount === 0 && warningCount === 0) {
    return null;
  }

  const summaryParts: string[] = [];
  if (errorCount > 0) {
    summaryParts.push(`${errorCount} ${selectLocalizedPlural(errorCount, i18nT('travel:components.travel.ValidationFeedback.oshibka_a754c58d'), i18nT('travel:components.travel.ValidationFeedback.oshibki_71f0a30f'), i18nT('travel:components.travel.ValidationFeedback.oshibok_b6b2ef44'))}`);
  }
  if (warningCount > 0) {
    summaryParts.push(
      `${warningCount} ${selectLocalizedPlural(warningCount, i18nT('travel:components.travel.ValidationFeedback.rekomendatsiya_4d886a5e'), i18nT('travel:components.travel.ValidationFeedback.rekomendatsii_bb776a51'), i18nT('travel:components.travel.ValidationFeedback.rekomendatsiy_6a21604e'))}`,
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          styles.toggle,
          Platform.OS === 'web' && { cursor: 'pointer' },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${summaryParts.join(', ')}. ${expanded ? i18nT('travel:components.travel.ValidationFeedback.svernut_1800ff74') : i18nT('travel:components.travel.ValidationFeedback.razvernut_b73c99ec')}`}
        {...(Platform.OS === 'web' ? ({ 'aria-expanded': expanded } as any) : null)}
      >
        <Feather
          name={errorCount > 0 ? 'alert-circle' : 'info'}
          size={16}
          color={errorCount > 0 ? colors.danger : colors.warning}
        />
        <Text style={styles.toggleText} numberOfLines={1}>
          {summaryParts.join(' · ')}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <ValidationSummary
            errorCount={errorCount}
            warningCount={warningCount}
            errorMessages={errorMessages}
            warningMessages={warningMessages}
          />
        </View>
      )}
    </View>
  );
};
