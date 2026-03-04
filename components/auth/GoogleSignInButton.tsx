// components/auth/GoogleSignInButton.tsx
// AND-03: Platform-agnostic barrel.
// Metro resolves GoogleSignInButton.web.tsx / GoogleSignInButton.native.tsx automatically.
// This file exists as fallback for test environments and tooling that don't resolve platform extensions.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
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

/**
 * AND-03: Google Sign-In button — runtime platform split.
 * In production builds, Metro resolves .web.tsx or .native.tsx directly.
 * This file is the fallback for Jest and other non-Metro environments.
 */
export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    if (Platform.OS === 'web') {
        return <GoogleSignInButtonWeb onSuccess={onSuccess} onError={onError} disabled={disabled} />;
    }

    return <GoogleSignInButtonNative onSuccess={onSuccess} onError={onError} disabled={disabled} />;
}

// --- Web implementation (GSI SDK) ---

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential?: string }) => void;
                        itp_support?: boolean;
                        use_fedcm_for_prompt?: boolean;
                    }) => void;
                    renderButton: (
                        parent: HTMLElement,
                        options: {
                            type?: 'standard' | 'icon';
                            theme?: 'outline' | 'filled_blue' | 'filled_black';
                            size?: 'large' | 'medium' | 'small';
                            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
                            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
                            logo_alignment?: 'left' | 'center';
                            width?: string | number;
                        }
                    ) => void;
                };
            };
        };
    }
}

const GOOGLE_GSI_SCRIPT_ID = 'google-gsi-client-script';
const LOOPBACK_WEB_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function GoogleSignInButtonWeb({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const [isGoogleButtonRendered, setIsGoogleButtonRendered] = useState(false);
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const hasClientId = googleClientId.length > 0;
    const googleAvailability = useMemo(() => {
        if (!hasClientId) {
            return {
                enabled: false,
                fallbackText: 'Google Sign-In не настроен.',
            };
        }
        if (typeof window === 'undefined') {
            return { enabled: true, fallbackText: '' };
        }

        const hostname = String(window.location.hostname || '').toLowerCase();
        const isLoopbackHost = LOOPBACK_WEB_HOSTS.has(hostname);
        if (!isLoopbackHost) {
            return { enabled: true, fallbackText: '' };
        }

        const localOverride = String(process.env.EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN_LOCAL || '').trim().toLowerCase() === 'true';
        const hasInjectedGoogle = Boolean(window.google?.accounts?.id);
        if (localOverride || hasInjectedGoogle) {
            return { enabled: true, fallbackText: '' };
        }

        return {
            enabled: false,
            fallbackText: 'Google Sign-In недоступен на localhost. Используйте email и пароль.',
        };
    }, [hasClientId]);
    const shouldShowFallback = !googleAvailability.enabled;
    const isButtonDisabled = disabled || !isGoogleLoaded || shouldShowFallback || !hasClientId;

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!hasClientId) {
            onError?.('Google Sign-In не настроен: отсутствует EXPO_PUBLIC_GOOGLE_CLIENT_ID');
            return;
        }
        if (!googleAvailability.enabled) return;

        const loadGoogleScript = () => {
            if (window.google?.accounts?.id) {
                setIsGoogleLoaded(true);
                return;
            }

            const existingScript = document.getElementById(GOOGLE_GSI_SCRIPT_ID) as HTMLScriptElement | null;
            if (existingScript) {
                if (window.google?.accounts?.id) {
                    setIsGoogleLoaded(true);
                    return;
                }
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
    }, [hasClientId, googleAvailability.enabled, onError]);

    useEffect(() => {
        if (!googleAvailability.enabled) return;
        if (Platform.OS !== 'web' || !isGoogleLoaded || !window.google) return;
        if (!hasClientId) return;

        try {
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                itp_support: true,
                use_fedcm_for_prompt: true,
                callback: (response) => {
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
    }, [googleAvailability.enabled, googleClientId, hasClientId, isGoogleLoaded, onSuccess, onError]);

    useEffect(() => {
        if (!googleAvailability.enabled) return;
        if (Platform.OS !== 'web' || !isGoogleLoaded || !window.google || !hasClientId) return;
        if (!buttonContainerRef.current || isGoogleButtonRendered) return;

        try {
            buttonContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(buttonContainerRef.current, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 300,
            });
            setIsGoogleButtonRendered(true);
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In button render error:', error);
            }
            onError?.('Ошибка отображения кнопки Google Sign-In');
        }
    }, [googleAvailability.enabled, hasClientId, isGoogleButtonRendered, isGoogleLoaded, onError]);

    if (Platform.OS !== 'web') {
        return null;
    }

    return (
        <View
            style={[
                styles.button,
                isButtonDisabled && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Войти через Google"
        >
            {shouldShowFallback ? (
                <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>{googleAvailability.fallbackText}</Text>
                </View>
            ) : !isGoogleLoaded && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.text} />
                    <Text style={styles.loadingText}>Загрузка Google Sign-In...</Text>
                </View>
            )}
            <div
                ref={buttonContainerRef}
                style={{
                    width: '100%',
                    minHeight: 44,
                    display: isGoogleLoaded && !shouldShowFallback ? 'block' : 'none',
                    pointerEvents: disabled ? 'none' : 'auto',
                    opacity: disabled ? 0.6 : 1,
                }}
            />
        </View>
    );
}

// --- Native implementation (expo-auth-session) ---

function GoogleSignInButtonNative({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
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
            android_ripple={{ color: colors.overlay, borderless: false }}
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
        ...Platform.select({
            web: {
                width: '100%',
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
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 44,
    },
    loadingText: {
        fontSize: 14,
        color: colors.text,
    },
    fallbackContainer: {
        width: '100%',
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    fallbackText: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
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
