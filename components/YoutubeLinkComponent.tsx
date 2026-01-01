import React, {useEffect, useState, useMemo} from 'react';
import {StyleSheet, Text, TextInput, View, Platform} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface YoutubeLinkComponentProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string | null;
    hint?: string;
}

const YoutubeLinkComponent: React.FC<YoutubeLinkComponentProps> = ({
    label, 
    value, 
    onChange,
    error,
    hint,
}) => {
    const [inputValue, setInputValue] = useState(value);
    const [localError, setLocalError] = useState<string | null>(null);
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Динамическая поддержка тем

    const styles = useMemo(() => StyleSheet.create({
        container: {
            marginBottom: DESIGN_TOKENS.spacing.md,
        },
        label: {
            marginBottom: DESIGN_TOKENS.spacing.xs,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
        },
        hint: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: DESIGN_TOKENS.spacing.xs,
        },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: DESIGN_TOKENS.radii.sm,
            paddingHorizontal: DESIGN_TOKENS.spacing.sm,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            backgroundColor: colors.surface,
            color: colors.text,
            minHeight: DESIGN_TOKENS.touchTarget.minHeight,
            ...Platform.select({
                web: {
                    transition: 'border-color 0.2s ease',
                },
            }),
        },
        invalidInput: {
            borderColor: colors.danger,
        },
        errorContainer: {
            marginTop: DESIGN_TOKENS.spacing.xs,
        },
        errorText: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            color: colors.danger,
        },
    }), [colors]);

    useEffect(() => {
        setInputValue(value);
        setLocalError(null);
    }, [value]);

    const handleChange = (text: string) => {
        setInputValue(text);
        onChange(text);
        if (localError) {
            setLocalError(null);
        }
    };

    const validateLink = (text: string): string | null => {
        if (!text.trim()) {
            return null;
        }
        const youtubeRegex =
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|shorts\/)?[A-Za-z0-9_-]{11}/;
        return youtubeRegex.test(text.trim()) ? null : 'Неверная ссылка на YouTube';
    };

    useEffect(() => {
        if (!inputValue || !inputValue.trim()) {
            setLocalError(null);
            return;
        }

        const timeout = setTimeout(() => {
            setLocalError(validateLink(inputValue));
        }, 400);

        return () => clearTimeout(timeout);
    }, [inputValue]);

    const handleBlur = () => {
        setLocalError(validateLink(inputValue));
    };

    const displayError = error ?? localError ?? null;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            {hint && !displayError && (
                <Text style={styles.hint}>{hint}</Text>
            )}
            <TextInput
                style={[
                    styles.input,
                    displayError && styles.invalidInput,
                ]}
                value={inputValue}
                onChangeText={handleChange}
                onBlur={handleBlur}
                placeholder="Введите ссылку на YouTube"
                placeholderTextColor={colors.textMuted}
                {...Platform.select({
                    web: {
                        outlineWidth: 0,
                        // @ts-ignore
                        ':focus': {
                            borderColor: displayError ? colors.danger : colors.primary,
                        },
                    },
                })}
            />
            {displayError && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{displayError}</Text>
                </View>
            )}
        </View>
    );
};


export default YoutubeLinkComponent;
