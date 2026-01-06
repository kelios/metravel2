import React, { memo, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform, Modal } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface FormFieldWithHintProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  examples?: string[];
  required?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  error?: string;
  helpTitle?: string;
  helpContent?: string;
}

const FormFieldWithHint = ({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  examples = [],
  required = false,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  error,
  helpTitle,
  helpContent,
}: FormFieldWithHintProps) => {
  const [showHelp, setShowHelp] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Label с кнопкой помощи */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        
        {(helpTitle || helpContent) && (
          <Pressable
            style={styles.helpButton}
            onPress={() => setShowHelp(true)}
            accessibilityLabel="Показать подсказку"
          >
            <Feather name="help-circle" size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Поле ввода */}
      <TextInput
        style={[
          multiline ? styles.textarea : styles.input,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
      />

      {/* Счетчик символов */}
      {maxLength && (
        <Text style={styles.charCounter}>
          {value.length}/{maxLength}
        </Text>
      )}

      {/* Ошибка */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Подсказка */}
      {hint && (
        <View style={styles.hintContainer}>
          <Feather name="info" size={12} color={colors.textMuted} />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}

      {/* Примеры */}
      {examples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Pressable
            style={styles.examplesToggle}
            onPress={() => setShowExamples(!showExamples)}
          >
            <Feather
              name={showExamples ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.primary}
            />
            <Text style={styles.examplesToggleText}>
              {showExamples ? 'Скрыть примеры' : 'Показать примеры'}
            </Text>
          </Pressable>

          {showExamples && (
            <View style={styles.examplesList}>
              {examples.map((example, index) => (
                <Pressable
                  key={index}
                  style={styles.exampleItem}
                  onPress={() => onChangeText(example)}
                >
                  <Feather name="corner-down-right" size={12} color={colors.textMuted} />
                  <Text style={styles.exampleText}>{example}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Модалка с подробной помощью */}
      {(helpTitle || helpContent) && (
        <Modal
          visible={showHelp}
          transparent
          animationType="fade"
          onRequestClose={() => setShowHelp(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowHelp(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{helpTitle || label}</Text>
                <Pressable onPress={() => setShowHelp(false)}>
                  <Feather name="x" size={20} color={colors.text} />
                </Pressable>
              </View>
              <Text style={styles.modalText}>{helpContent}</Text>
              <Pressable
                style={styles.modalButton}
                onPress={() => setShowHelp(false)}
              >
                <Text style={styles.modalButtonText}>Понятно</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  required: {
    color: colors.danger,
  },
  helpButton: {
    padding: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  charCounter: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  examplesContainer: {
    marginTop: 8,
  },
  examplesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  examplesToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  examplesList: {
    marginTop: 8,
    gap: 8,
  },
  exampleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: colors.mutedBackground,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 24,
    maxWidth: 500,
    width: '100%',
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.modal,
      },
      default: {
        ...colors.shadows.heavy,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});

export default memo(FormFieldWithHint);
