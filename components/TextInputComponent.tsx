import React from 'react';
import { StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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

const palette = DESIGN_TOKENS.colors;

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
                placeholderTextColor={palette.textMuted}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                numberOfLines={numberOfLines}
                editable={!disabled} // ✅ ИСПРАВЛЕНИЕ
                {...Platform.select({
                    web: {
                        outlineWidth: 0,
                        // @ts-ignore
                        ':focus': {
                            borderColor: error ? '#ef4444' : palette.primary,
                            outlineWidth: 2,
                            outlineColor: error ? '#ef4444' : palette.primary,
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

const styles = StyleSheet.create({
    container: { marginBottom: 16 },
    containerNoLabel: { marginBottom: 0 },
    labelRow: {
        marginBottom: 6,
    },
    label: { 
        fontSize: 14, 
        color: palette.text, 
        fontWeight: '600' 
    },
    required: {
        color: palette.danger,
    },
    input: {
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        backgroundColor: palette.surface,
        color: palette.text,
        minHeight: 44, // Минимальный размер для touch-целей
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        ...Platform.select({
            web: {
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: DESIGN_TOKENS.shadows.light,
                ':focus': {
                    boxShadow: `0 0 0 3px ${palette.focus}, ${DESIGN_TOKENS.shadows.medium}`,
                },
            },
        }),
    },
    inputError: {
        backgroundColor: palette.dangerLight,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон и тень
        ...Platform.select({
            web: {
                boxShadow: `0 0 0 2px ${palette.danger}, ${DESIGN_TOKENS.shadows.light}`,
            },
        }),
    },
    // ✅ ИСПРАВЛЕНИЕ: Добавлен стиль для disabled состояния
    inputDisabled: {
        opacity: 0.6,
        backgroundColor: palette.mutedBackground,
        color: palette.textMuted,
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
        color: palette.textMuted,
        marginTop: 4,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        padding: 10,
        backgroundColor: palette.dangerLight,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: palette.danger,
    },
    errorText: {
        fontSize: 13,
        color: palette.dangerDark,
        fontWeight: '500',
        flex: 1,
    },
});

export default React.memo(TextInputComponent);
