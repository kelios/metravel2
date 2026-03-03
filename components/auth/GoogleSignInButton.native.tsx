// components/auth/GoogleSignInButton.native.tsx
// AND-03: Native Google Sign-In using expo-auth-session.
// Platform split: this file is used only on Android/iOS native builds.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface GoogleSignInButtonProps {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
}

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isLoading, setIsLoading] = useState(false);

    const webClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const expoClientId = String(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '').trim();
    const androidClientId = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || webClientId).trim();
    const iosClientId = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || webClientId).trim();

    const hasRequiredClientId = Platform.OS === 'ios' ? iosClientId.length > 0 : androidClientId.length > 0;

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        webClientId: webClientId || undefined,
        clientId: expoClientId || undefined,
        androidClientId: androidClientId || undefined,
        iosClientId: iosClientId || undefined,
        scopes: ['openid', 'profile', 'email'],
    });

    useEffect(() => {
        if (!response) return;

        if (response.type === 'success') {
            const token = response.params?.id_token;
            setIsLoading(false);
            if (token) {
                onSuccess(token);
            } else {
                onError?.('Не удалось получить id_token от Google');
            }
            return;
        }

        if (response.type === 'error') {
            setIsLoading(false);
            onError?.('Ошибка авторизации Google');
        }
    }, [onError, onSuccess, response]);

    const handlePress = async () => {
        if (disabled || isLoading) return;

        if (!hasRequiredClientId) {
            onError?.(
                'Google Sign-In не настроен для мобильного приложения: задайте EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID и EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
            );
            return;
        }

        if (!request) {
            onError?.('Google Sign-In инициализируется, попробуйте еще раз');
            return;
        }

        setIsLoading(true);
        try {
            const result = await promptAsync();
            if (result.type !== 'success') {
                setIsLoading(false);
                if (result.type === 'error') {
                    onError?.('Не удалось завершить Google Sign-In');
                }
            }
        } catch (error) {
            if (__DEV__) {
                console.error('Google native sign-in error:', error);
            }
            setIsLoading(false);
            onError?.('Ошибка при открытии Google Sign-In');
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled || isLoading || !hasRequiredClientId}
            android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: false }}
            style={({ pressed }) => [
                styles.button,
                (disabled || isLoading || !hasRequiredClientId) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Войти через Google"
        >
            <View style={styles.content}>
                {isLoading ? (
                    <ActivityIndicator size="small" color={colors.text} />
                ) : (
                    <>
                        <View style={styles.iconContainer}>
                            <Text style={styles.googleIcon}>G</Text>
                        </View>
                        <Text style={styles.text}>Войти через Google</Text>
                    </>
                )}
            </View>
        </Pressable>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    button: {
        backgroundColor: colors.background,
        borderRadius: DESIGN_TOKENS.radii.lg,
        minHeight: 48, // M3 touch target (48dp)
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleIcon: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    text: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
});

