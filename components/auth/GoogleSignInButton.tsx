import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
    GoogleSignin,
    isErrorWithCode,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { getGoogleSignInButtonTheme } from './googleSignInButtonTheme';
import { translate as i18nT } from '@/i18n'


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
                            theme?: 'outline' | 'filled_blue' | 'filled_black' | 'outline_dark';
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
type GoogleSignInButtonConfiguredProps = GoogleSignInButtonProps & {
    webClientId: string;
    iosClientId: string;
};

type GoogleSignInUserResult = Awaited<ReturnType<typeof GoogleSignin.signIn>>;
type GoogleSignInSuccessResult = { type: 'success'; data: GoogleSignInUserResult };
type GoogleSignInCancelledResult = { type: 'cancelled'; data: null };
type GoogleSignInResult = GoogleSignInUserResult | GoogleSignInSuccessResult | GoogleSignInCancelledResult;

const isGoogleSignInResponseEnvelope = (
    result: GoogleSignInResult,
): result is GoogleSignInSuccessResult | GoogleSignInCancelledResult =>
    typeof result === 'object' && result !== null && 'type' in result;

const getGoogleSignInIdToken = (result: GoogleSignInResult): string | null => {
    if (isGoogleSignInResponseEnvelope(result)) {
        return result.type === 'success' ? result.data.idToken : null;
    }

    return result.idToken;
};

const isGoogleSignInCancelled = (result: GoogleSignInResult): result is GoogleSignInCancelledResult =>
    isGoogleSignInResponseEnvelope(result) && result.type === 'cancelled';

const getNativeGoogleClientId = (androidClientId: string, iosClientId: string) =>
    Platform.OS === 'ios' ? iosClientId : androidClientId;

const configureGoogleSignIn = (webClientId: string, iosClientId: string) => {
    GoogleSignin.configure({
        webClientId,
        ...(Platform.OS === 'ios' && iosClientId ? { iosClientId } : {}),
        offlineAccess: false,
    });
};

function GoogleSignInButtonWeb({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const colors = useThemedColors();
    const { isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const [isGoogleButtonRendered, setIsGoogleButtonRendered] = useState(false);
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    // Latest-рефы на колбэки: родитель часто передаёт инлайн onSuccess/onError, из-за
    // чего init-эффект иначе пере-вызывал google.accounts.id.initialize на каждый рендер.
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    });
    const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const hasClientId = googleClientId.length > 0;
    const googleAvailability = useMemo(() => {
        if (!hasClientId) {
            return {
                enabled: false,
                fallbackText: i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_ne_nastroen_1ed9f07a'),
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
            fallbackText: i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_nedostupen_na_localhost_ispol_6a3728e1'),
        };
    }, [hasClientId]);
    const shouldShowFallback = !googleAvailability.enabled;
    const isButtonDisabled = disabled || !isGoogleLoaded || shouldShowFallback || !hasClientId;

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!hasClientId) {
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_ne_nastroen_otsutstvuet_expo__2060d11b'));
            return;
        }
        if (!googleAvailability.enabled) return;

        let cancelled = false;
        const markLoaded = () => {
            if (!cancelled) setIsGoogleLoaded(true);
        };
        const handleScriptError = () => {
            if (!cancelled) onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_zagruzit_google_sign_in_b5eb8e60'));
        };

        let attachedScript: HTMLScriptElement | null = null;
        const loadGoogleScript = () => {
            if (window.google?.accounts?.id) {
                markLoaded();
                return;
            }

            const existingScript = document.getElementById(GOOGLE_GSI_SCRIPT_ID) as HTMLScriptElement | null;
            if (existingScript) {
                if (window.google?.accounts?.id) {
                    markLoaded();
                    return;
                }
                attachedScript = existingScript;
                existingScript.addEventListener('load', markLoaded, { once: true });
                existingScript.addEventListener('error', handleScriptError, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = GOOGLE_GSI_SCRIPT_ID;
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            attachedScript = script;
            script.addEventListener('load', markLoaded, { once: true });
            script.addEventListener('error', handleScriptError, { once: true });
            document.head.appendChild(script);
        };

        loadGoogleScript();

        return () => {
            cancelled = true;
            if (attachedScript) {
                attachedScript.removeEventListener('load', markLoaded);
                attachedScript.removeEventListener('error', handleScriptError);
            }
        };
    }, [hasClientId, googleAvailability.enabled]);

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
                        onSuccessRef.current(response.credential);
                    } else {
                        onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_poluchit_dannye_ot_google_c9bf56fd'));
                    }
                },
            });
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In initialization error:', error);
            }
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_initsializatsii_google_sign_in_206f71df'));
        }
    }, [googleAvailability.enabled, googleClientId, hasClientId, isGoogleLoaded]);

    useEffect(() => {
        if (!googleAvailability.enabled) return;
        if (Platform.OS !== 'web' || !isGoogleLoaded || !window.google || !hasClientId) return;
        if (!buttonContainerRef.current || isGoogleButtonRendered) return;

        try {
            buttonContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(buttonContainerRef.current, {
                type: 'standard',
                theme: getGoogleSignInButtonTheme(isDark),
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
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_otobrazheniya_knopki_google_sign_in_4b06f7ad'));
        }
    }, [googleAvailability.enabled, hasClientId, isDark, isGoogleButtonRendered, isGoogleLoaded]);

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
            accessibilityLabel={i18nT('auth:components.auth.GoogleSignInButton.voyti_cherez_google_572f82b0')}
        >
            {shouldShowFallback ? (
                <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>{googleAvailability.fallbackText}</Text>
                </View>
            ) : !isGoogleLoaded && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.text} />
                    <Text style={styles.loadingText}>{i18nT('auth:components.auth.GoogleSignInButton.zagruzka_google_sign_in_cfa4830b')}</Text>
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
    const webClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const androidClientId = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
    const iosClientId = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

    if (!webClientId || !getNativeGoogleClientId(androidClientId, iosClientId)) {
        return <GoogleSignInButtonNativeUnavailable />;
    }

    return (
        <GoogleSignInButtonNativeConfigured
            onSuccess={onSuccess}
            onError={onError}
            disabled={disabled}
            webClientId={webClientId}
            iosClientId={iosClientId}
        />
    );
}

function GoogleSignInButtonNativeUnavailable() {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Pressable
            disabled
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={i18nT('authStatic:google.unavailable.a11y')}
            style={[styles.button, styles.buttonDisabled]}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={styles.googleIcon}>{i18nT('auth:components.auth.GoogleSignInButton.g_c25ce9e0')}</Text>
                </View>
                <Text style={styles.text}>{i18nT('authStatic:google.unavailable.text')}</Text>
            </View>
        </Pressable>
    );
}

function GoogleSignInButtonNativeConfigured({
    onSuccess,
    onError,
    disabled,
    webClientId,
    iosClientId,
}: GoogleSignInButtonConfiguredProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        configureGoogleSignIn(webClientId, iosClientId);
    }, [iosClientId, webClientId]);

    const handlePress = async () => {
        if (disabled || isLoading) return;

        setIsLoading(true);
        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const result = await GoogleSignin.signIn();

            if (isGoogleSignInCancelled(result)) {
                setIsLoading(false);
                return;
            }

            let token = getGoogleSignInIdToken(result);
            if (!token) {
                token = (await GoogleSignin.getTokens()).idToken;
            }
            setIsLoading(false);
            if (token) {
                onSuccess(token);
                return;
            }

            onError?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_poluchit_id_token_ot_google_12ff72b6'));
        } catch (error) {
            setIsLoading(false);
            if (isErrorWithCode(error)) {
                if (error.code === statusCodes.IN_PROGRESS) {
                    onError?.(i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_uzhe_vypolnyaetsya_5c2c3aea'));
                    return;
                }
                if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                    onError?.(i18nT('auth:components.auth.GoogleSignInButton.google_play_services_nedostupny_ili_trebuyut_e96c8fe1'));
                    return;
                }
                if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                    return;
                }
            }
            if (__DEV__) {
                console.error('Google native sign-in error:', error);
            }
            onError?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_pri_otkrytii_google_sign_in_c1bf910f'));
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled || isLoading}
            android_ripple={{ color: colors.overlay, borderless: false }}
            style={({ pressed }) => [
                styles.button,
                (disabled || isLoading) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('auth:components.auth.GoogleSignInButton.voyti_cherez_google_572f82b0')}
        >
            <View style={styles.content}>
                {isLoading ? (
                    <ActivityIndicator size="small" color={colors.text} />
                ) : (
                    <>
                        <View style={styles.iconContainer}>
                            <Text style={styles.googleIcon}>{i18nT('auth:components.auth.GoogleSignInButton.g_c25ce9e0')}</Text>
                        </View>
                        <Text style={styles.text}>{i18nT('auth:components.auth.GoogleSignInButton.voyti_cherez_google_572f82b0')}</Text>
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
        color: colors.primaryText,
    },
    text: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        flexShrink: 1,
        textAlign: 'center',
    },
});
