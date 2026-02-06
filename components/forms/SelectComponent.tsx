// ✅ УЛУЧШЕНИЕ: Компонент выбора из списка с улучшенной доступностью
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    label?: string;
    options?: SelectOption[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    error?: string | null; // ✅ УЛУЧШЕНИЕ: Поддержка ошибок
    hint?: string; // ✅ УЛУЧШЕНИЕ: Подсказка
    required?: boolean;
    disabled?: boolean; // ✅ УЛУЧШЕНИЕ: Поддержка disabled состояния
}

const SelectComponent: React.FC<SelectProps> = ({
    label,
    options = [],
    value = '',
    onChange,
    placeholder = 'Выберите...',
    error,
    hint,
    required = false,
    disabled = false,
}) => {
    const colors = useThemedColors();

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
        selectContainer: {
            borderRadius: DESIGN_TOKENS.radii.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            overflow: 'hidden',
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
        selectContainerError: {
            backgroundColor: colors.dangerLight,
            borderColor: colors.danger,
            borderWidth: 2,
        },
        selectContainerDisabled: {
            opacity: 0.6,
            backgroundColor: colors.mutedBackground,
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

    const handleChange = (event: any) => {
        if (!disabled) {
            const newValue = Platform.OS === 'web'
                ? event.target.value
                : event.nativeEvent?.text || '';
            onChange?.(newValue);
        }
    };

    if (Platform.OS === 'web') {
        // ✅ На web используем нативный select
        return (
            <div style={{ marginBottom: DESIGN_TOKENS.spacing.md }}>
                {!!label && (
                    <div style={{ marginBottom: DESIGN_TOKENS.spacing.xs }}>
                        <label style={{
                            fontSize: DESIGN_TOKENS.typography.sizes.sm,
                            color: colors.text,
                            fontWeight: '600',
                        }}>
                            {label}
                            {required && <span style={{ color: colors.danger }}> *</span>}
                        </label>
                    </div>
                )}

                <select
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                    required={required}
                    aria-label={label}
                    aria-required={required}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'error-message' : hint ? 'hint-message' : undefined}
                    style={{
                        width: '100%',
                        padding: `${DESIGN_TOKENS.spacing.sm}px ${DESIGN_TOKENS.spacing.md}px`,
                        borderRadius: DESIGN_TOKENS.radii.md,
                        border: `1px solid ${error ? colors.danger : colors.border}`,
                        backgroundColor: disabled ? colors.mutedBackground : colors.surface,
                        color: colors.text,
                        fontSize: DESIGN_TOKENS.typography.sizes.md,
                        minHeight: 44,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1,
                        outline: 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    {placeholder && <option value="">{placeholder}</option>}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                {/* ✅ УЛУЧШЕНИЕ: Подсказка */}
                {!!hint && !error && (
                    <div
                        id="hint-message"
                        style={{
                            fontSize: DESIGN_TOKENS.typography.sizes.xs,
                            color: colors.textMuted,
                            marginTop: DESIGN_TOKENS.spacing.xs,
                        }}
                    >
                        {hint}
                    </div>
                )}

                {/* ✅ УЛУЧШЕНИЕ: Сообщение об ошибке */}
                {!!error && (
                    <div
                        id="error-message"
                        role="alert"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: DESIGN_TOKENS.spacing.xs,
                            marginTop: DESIGN_TOKENS.spacing.xs,
                            padding: DESIGN_TOKENS.spacing.sm,
                            backgroundColor: colors.dangerLight,
                            borderRadius: DESIGN_TOKENS.radii.sm,
                            borderLeft: `3px solid ${colors.danger}`,
                            fontSize: DESIGN_TOKENS.typography.sizes.xs,
                            color: colors.dangerDark,
                            fontWeight: '500',
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // ✅ На mobile используем простой компонент (можно расширить с @react-native-picker/picker при необходимости)
    return (
        <View style={styles.container}>
            {!!label && (
                <View style={styles.labelRow}>
                    <Text style={styles.label}>
                        {label}
                        {required ? <Text style={styles.required}> *</Text> : null}
                    </Text>
                </View>
            )}

            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                Select компонент на mobile требует установки @react-native-picker/picker
            </Text>

            {/* ✅ УЛУЧШЕНИЕ: Подсказка */}
            {!!hint && !error && (
                <Text style={styles.hint}>{hint}</Text>
            )}

            {/* ✅ УЛУЧШЕНИЕ: Сообщение об ошибке */}
            {!!error && (
                <View
                    style={styles.errorContainer}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                >
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
};

export default React.memo(SelectComponent);
