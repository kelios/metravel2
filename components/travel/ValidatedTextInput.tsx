/**
 * Текстовое поле с встроенной валидацией и счетчиком символов
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TextInputComponent from '@/components/forms/TextInputComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { validateField, STEP_VALIDATION_RULES } from '@/utils/travelWizardValidation';
import { CharacterCounter, FieldValidationMessage } from './ValidationFeedback';
import { useThemedColors } from '@/hooks/useTheme';

interface ValidatedTextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldName: string;
  step: number;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  showCounter?: boolean;
  nativeID?: string;
}

export const ValidatedTextInput: React.FC<ValidatedTextInputProps> = ({
  label,
  value,
  onChange,
  fieldName,
  step,
  required = false,
  multiline = false,
  placeholder,
  hint,
  showCounter = true,
  nativeID,
}) => {
  const colors = useThemedColors();

  const rules = useMemo(() => {
    const stepRules = STEP_VALIDATION_RULES[step];
    return stepRules?.fields?.[fieldName];
  }, [step, fieldName]);

  const validation = useMemo(() => {
    return validateField(fieldName, value, rules);
  }, [fieldName, value, rules]);

  const hasError = !validation.isValid;
  const showValidation = value.length > 0 || hasError;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
    required: {
      color: colors.danger,
      fontWeight: '700',
    },
    hint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      marginBottom: 8,
      lineHeight: 18,
    },
    inputWrapper: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
    },
    inputError: {
      borderColor: colors.dangerLight,
      borderWidth: 2,
    },
    inputSuccess: {
      borderColor: colors.successLight,
    },
  }), [colors]);

  return (
    <View style={styles.container} nativeID={nativeID}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      {!!hint && <Text style={styles.hint}>{hint}</Text>}

      <TextInputComponent
        label=""
        value={value}
        onChange={onChange}
        multiline={multiline}
        placeholder={placeholder}
      />

      {showCounter && rules && (rules.minLength || rules.maxLength) && (
        <CharacterCounter
          current={value.length}
          min={rules.minLength}
          max={rules.maxLength}
          showProgress={!!rules.maxLength}
        />
      )}

      {showValidation && <FieldValidationMessage validation={validation} fieldName={fieldName} />}
    </View>
  );
};

