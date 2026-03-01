import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface GoogleSignInButtonProps {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
}

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential?: string }) => void;
                    }) => void;
                    prompt: (callback?: (notification: {
                        isNotDisplayed?: () => boolean;
                        isSkippedMoment?: () => boolean;
                        isDismissedMoment?: () => boolean;
                    }) => void) => void;
                };
            };
        };
    }
}

const GOOGLE_GSI_SCRIPT_ID = 'google-gsi-client-script';

export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const hasClientId = googleClientId.length > 0;

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!hasClientId) {
            onError?.('Google Sign-In не настроен: отсутствует EXPO_PUBLIC_GOOGLE_CLIENT_ID');
            return;
        }

        const loadGoogleScript = () => {
            if (window.google?.accounts?.id) {
                setIsGoogleLoaded(true);
                return;
            }

            const existingScript = document.getElementById(GOOGLE_GSI_SCRIPT_ID) as HTMLScriptElement | null;
            if (existingScript) {
                existingScript.addEventListener('load', () => setIsGoogleLoaded(true), { once: true });
                existingScript.addEventListener('error', () => {
                    onError?.('Не удалось загрузить Google Sign-In');
                }, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = GOOGLE_GSI_SCRIPT_ID;
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                setIsGoogleLoaded(true);
            };
            script.onerror = () => {
                onError?.('Не удалось загрузить Google Sign-In');
            };
            document.head.appendChild(script);
        };

        loadGoogleScript();
    }, [hasClientId, onError]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !isGoogleLoaded || !window.google) return;
        if (!hasClientId) return;

        try {
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: (response) => {
                    setIsLoading(false);
                    if (response.credential) {
                        onSuccess(response.credential);
                    } else {
                        onError?.('Не удалось получить данные от Google');
                    }
                },
            });
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In initialization error:', error);
            }
            onError?.('Ошибка инициализации Google Sign-In');
        }
    }, [googleClientId, hasClientId, isGoogleLoaded, onSuccess, onError]);

    const handlePress = () => {
        if (Platform.OS !== 'web' || !window.google || disabled) return;

        setIsLoading(true);
        try {
            window.google.accounts.id.prompt((notification) => {
                const notDisplayed = Boolean(notification?.isNotDisplayed?.());
                const skipped = Boolean(notification?.isSkippedMoment?.());
                const dismissed = Boolean(notification?.isDismissedMoment?.());

                if (notDisplayed || skipped || dismissed) {
                    setIsLoading(false);
                }
            });
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In prompt error:', error);
            }
            setIsLoading(false);
            onError?.('Ошибка при открытии окна Google Sign-In');
        }
    };

    if (Platform.OS !== 'web') {
        return null;
    }

    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled || isLoading || !isGoogleLoaded || !hasClientId}
            style={({ pressed }) => [
                styles.button,
                (disabled || isLoading || !isGoogleLoaded || !hasClientId) && styles.buttonDisabled,
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.lg,
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
                transition: 'all 0.2s ease' as any,
            },
        }),
    },
    buttonDisabled: {
        opacity: 0.5,
        ...Platform.select({
            web: {
                cursor: 'not-allowed' as any,
            },
        }),
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
