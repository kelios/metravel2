import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, TextInput, View, Platform} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface YoutubeLinkComponentProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string | null;
    hint?: string;
}

const palette = DESIGN_TOKENS.colors;

const YoutubeLinkComponent: React.FC<YoutubeLinkComponentProps> = ({ 
    label, 
    value, 
    onChange,
    error,
    hint,
}) => {
    const [inputValue, setInputValue] = useState(value);
    const [localError, setLocalError] = useState<string | null>(null);

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
                placeholderTextColor={palette.textMuted}
                {...Platform.select({
                    web: {
                        outlineWidth: 0,
                        // @ts-ignore
                        ':focus': {
                            borderColor: displayError ? '#ef4444' : palette.primary,
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

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 6,
        fontSize: 14,
        fontWeight: '600',
        color: palette.text,
    },
    hint: {
        fontSize: 12,
        color: palette.textMuted,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        backgroundColor: palette.surface,
        color: palette.text,
        minHeight: 44,
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease',
            },
        }),
    },
    invalidInput: {
        borderColor: '#ef4444',
    },
    errorContainer: {
        marginTop: 4,
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
    },
});

export default YoutubeLinkComponent;
