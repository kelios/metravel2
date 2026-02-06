// ✅ УЛУЧШЕНИЕ: Компонент для ввода чисел с валидацией
import React, { useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface NumberInputComponentProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    min?: number; // ✅ УЛУЧШЕНИЕ: Минимальное значение
    max?: number; // ✅ УЛУЧШЕНИЕ: Максимальное значение
    placeholder?: string;
    error?: string | null; // ✅ УЛУЧШЕНИЕ: Поддержка ошибок
    hint?: string; // ✅ УЛУЧШЕНИЕ: Подсказка
    required?: boolean;
    disabled?: boolean; // ✅ УЛУЧШЕНИЕ: Поддержка disabled состояния
}

const NumberInputComponent: React.FC<NumberInputComponentProps> = ({
    label,
    value,
    onChange,
    min,
    max,
    placeholder,
    error,
    hint,
    required = false,
    disabled = false,
}) => {
    const colors = useThemedColors();

    // ✅ УЛУЧШЕНИЕ: Валидация с учетом min/max
    const handleChange = useCallback((text: string) => {
        // Разрешаем только цифры
        if (!/^\d*$/.test(text)) {
            return;
        }

        // Проверяем диапазон
        if (text !== '') {
            const numValue = parseInt(text, 10);
            if (min !== undefined && numValue < min) {
                return;
            }
            if (max !== undefined && numValue > max) {
                return;
            }
        }

        onChange(text);
    }, [onChange, min, max]);

    // ✅ УЛУЧШЕНИЕ: Динамические стили в зависимости от темы
    const styles = useMemo(() => StyleSheet.create({
        container: {
            marginBottom: DESIGN_TOKENS.spacing.md,
        },
        labelRow: {
            marginBottom: DESIGN_TOKENS.spacing.xs,
        },
        label: {
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            color: colors.text,
            fontWeight: '600',
        },
        required: {
            color: colors.danger,
        },
        input: {
            borderRadius: DESIGN_TOKENS.radii.md,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            backgroundColor: colors.surface,
            color: colors.text,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            minHeight: 44, // ✅ УЛУЧШЕНИЕ: Минимальная высота для touch-целей
            ...Platform.select({
                web: {
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: DESIGN_TOKENS.shadows.light,
                },
                default: {
                    ...DESIGN_TOKENS.shadowsNative.light,
                },
            }),
        },
        inputError: {
            backgroundColor: colors.dangerLight,
            borderColor: colors.danger,
            borderWidth: 2,
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
        hint: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            color: colors.textMuted,
            marginTop: DESIGN_TOKENS.spacing.xs,
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
        errorText: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            color: colors.dangerDark,
            fontWeight: '500',
            flex: 1,
        },
    }), [colors, error]);

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Text style={styles.label}>
                    {label}
                    {required ? <Text style={styles.required}> *</Text> : null}
                </Text>
            </View>
            <TextInput
                style={[
                    styles.input,
                    error && styles.inputError,
                    disabled && styles.inputDisabled,
                ]}
                value={value}
                onChangeText={handleChange}
                keyboardType="numeric"
                placeholder={placeholder || `Введите ${label.toLowerCase()}`}
                placeholderTextColor={colors.textMuted}
                editable={!disabled}
                accessibilityLabel={label}
                accessibilityHint={hint || `Введите число${min !== undefined ? ` от ${min}` : ''}${max !== undefined ? ` до ${max}` : ''}`}
                accessibilityState={{ disabled }}
                {...Platform.select({
                    web: {
                        // @ts-ignore
                        'aria-required': required,
                        'aria-invalid': !!error,
                        'aria-describedby': error ? 'error-message' : hint ? 'hint-message' : undefined,
                    },
                })}
            />

            {/* ✅ УЛУЧШЕНИЕ: Подсказка */}
            {!!hint && !error && (
                <Text
                    style={styles.hint}
                    {...Platform.select({
                        web: {
                            // @ts-ignore
                            id: 'hint-message',
                        },
                    })}
                >
                    {hint}
                </Text>
            )}

            {/* ✅ УЛУЧШЕНИЕ: Сообщение об ошибке */}
            {!!error && (
                <View
                    style={styles.errorContainer}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    {...Platform.select({
                        web: {
                            // @ts-ignore
                            id: 'error-message',
                            role: 'alert',
                        },
                    })}
                >
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
};

export default React.memo(NumberInputComponent);
