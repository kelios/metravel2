// components/FormFieldWithValidation.tsx
// ✅ УЛУЧШЕНИЕ: Компонент поля формы с валидацией в реальном времени
// ✅ РЕДИЗАЙН: Поддержка темной темы с useThemedColors

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface FormFieldWithValidationProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  showError?: boolean;
}

export default function FormFieldWithValidation({
  label,
  error,
  hint,
  required = false,
  children,
  showError = true,
}: FormFieldWithValidationProps) {
  const [showHint, setShowHint] = useState(false);
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Динамическая поддержка тем

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
    required: {
      color: colors.danger,
    },
    hintContainer: {
      position: 'relative',
    },
    hintButton: {
      padding: DESIGN_TOKENS.spacing.xs,
      minWidth: DESIGN_TOKENS.touchTarget.minWidth,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintTooltip: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      maxWidth: 250,
      zIndex: 1000,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        android: {
          elevation: 3,
        },
        default: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 3,
        },
      }),
    },
    hintMobile: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.primarySoft,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    hintText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 16,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.dangerLight,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.danger,
    },
    errorIcon: {
      flexShrink: 0,
    },
    errorText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm, // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для читаемости
      color: colors.danger,
      fontWeight: '500', // ✅ ИСПРАВЛЕНИЕ: Добавлен font-weight
      flex: 1,
      lineHeight: 18,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {hint && (
          <View style={styles.hintContainer}>
            <Pressable
              onPress={() => setShowHint(!showHint)}
              style={styles.hintButton}
              accessibilityLabel="Показать подсказку"
              accessibilityRole="button"
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
              <Feather name="help-circle" size={16} color={colors.textMuted} />
            </Pressable>
            {showHint && Platform.OS === 'web' && (
              <View style={styles.hintTooltip}>
                <Text style={styles.hintText}>{hint}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {children}

      {showError && error && (
        <View
          style={styles.errorContainer}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Feather name="alert-circle" size={16} color={colors.danger} style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {hint && showHint && Platform.OS !== 'web' && (
        <View style={styles.hintMobile}>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}
    </View>
  );
}
