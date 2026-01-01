import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface TextInputComponentProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    secureTextEntry?: boolean;
    placeholder?: string;
    error?: string | null;
    hint?: string;
    required?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
    disabled?: boolean; // ✅ ИСПРАВЛЕНИЕ: Добавлена поддержка disabled состояния
}

const TextInputComponent: React.FC<TextInputComponentProps> = ({
                                                                   label,
                                                                   value,
                                                                   onChange,
                                                                   secureTextEntry = false,
                                                                   placeholder,
                                                                   error,
                                                                   hint,
                                                                   required = false,
                                                                   multiline = false,
                                                                   numberOfLines = 1,
                                                                   disabled = false, // ✅ ИСПРАВЛЕНИЕ
                                                               }) => {
    const colors = useThemedColors();

    const styles = useMemo(() => StyleSheet.create({
        container: { marginBottom: 16 },
        containerNoLabel: { marginBottom: 0 },
        labelRow: {
            marginBottom: 6,
        },
        label: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '600'
        },
        required: {
            color: colors.danger,
        },
        input: {
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            backgroundColor: colors.surface,
            color: colors.text,
            minHeight: 44,
            ...DESIGN_TOKENS.shadowsNative.light,
            ...Platform.select({
                web: {
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: DESIGN_TOKENS.shadows.light,
                    ':focus': {
                        boxShadow: `0 0 0 3px ${colors.focus}, ${DESIGN_TOKENS.shadows.medium}`,
                    },
                },
            }),
        },
        inputError: {
            backgroundColor: colors.dangerLight,
            ...Platform.select({
                web: {
                    boxShadow: `0 0 0 2px ${colors.danger}, ${DESIGN_TOKENS.shadows.light}`,
                },
            }),
        },
        inputDisabled: {
            opacity: 0.6,
            backgroundColor: colors.mutedBackground,
            color: colors.textMuted,
            ...Platform.select({
                web: {
                    cursor: 'not-allowed',
                },
            }),
        },
        inputMultiline: {
            minHeight: 100,
            textAlignVertical: 'top',
        },
        hint: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 4,
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
            padding: 10,
            backgroundColor: colors.dangerLight,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: colors.danger,
        },
        errorText: {
            fontSize: 13,
            color: colors.dangerDark,
            fontWeight: '500',
            flex: 1,
        },
    }), [colors]);
    return (
        <View style={[styles.container, !label && styles.containerNoLabel]}>
            {label ? (
                <View style={styles.labelRow}>
                    <Text style={styles.label}>
                        {label}
                        {required ? <Text style={styles.required}> *</Text> : null}
                    </Text>
                </View>
            ) : null}
            <TextInput
                style={[
                    styles.input,
                    error && styles.inputError,
                    disabled && styles.inputDisabled, // ✅ ИСПРАВЛЕНИЕ: Добавлен disabled стиль
                    multiline && styles.inputMultiline,
                ]}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder || (label ? `Введите ${label.toLowerCase()}` : '')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                numberOfLines={numberOfLines}
                editable={!disabled} // ✅ ИСПРАВЛЕНИЕ
                {...Platform.select({
                    web: {
                        outlineWidth: 0,
                        // @ts-ignore
                        ':focus': {
                            borderColor: error ? colors.danger : colors.primary,
                            outlineWidth: 2,
                            outlineColor: error ? colors.danger : colors.primary,
                            outlineStyle: 'solid',
                            outlineOffset: 2,
                        },
                    },
                })}
            />
            {hint && !error ? (
                <Text style={styles.hint}>{hint}</Text>
            ) : null}
            {error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
};


export default React.memo(TextInputComponent);
