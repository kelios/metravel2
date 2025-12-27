// components/FormFieldWithValidation.tsx
// ✅ УЛУЧШЕНИЕ: Компонент поля формы с валидацией в реальном времени

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface FormFieldWithValidationProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  showError?: boolean;
}

const palette = DESIGN_TOKENS.colors;

export default function FormFieldWithValidation({
  label,
  error,
  hint,
  required = false,
  children,
  showError = true,
}: FormFieldWithValidationProps) {
  const [showHint, setShowHint] = useState(false);

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
              <Feather name="help-circle" size={16} color={palette.textMuted} />
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
          <Feather name="alert-circle" size={16} color={palette.danger} style={styles.errorIcon} />
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  required: {
    color: palette.danger,
  },
  hintContainer: {
    position: 'relative',
  },
  hintButton: {
    padding: 4,
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTooltip: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    padding: 10,
    backgroundColor: palette.surface,
    borderRadius: 12,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    maxWidth: 250,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(31, 31, 31, 0.1), 0 2px 4px rgba(31, 31, 31, 0.06)',
      },
      ios: {
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  hintMobile: {
    marginTop: 8,
    padding: 12,
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
  },
  hintText: {
    fontSize: 12,
    color: palette.textMuted,
    lineHeight: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    padding: 10,
    backgroundColor: palette.dangerLight,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: palette.danger,
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    fontSize: 13, // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для читаемости
    color: palette.danger,
    fontWeight: '500', // ✅ ИСПРАВЛЕНИЕ: Добавлен font-weight
    flex: 1,
    lineHeight: 18,
  },
});

