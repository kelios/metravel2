import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { getGoogleSignInButtonTheme } from './googleSignInButtonTheme';
import { translate as i18nT } from '@/i18n'
import { useHydrationReady } from '@/hooks/useHydrationReady';


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

export function getGoogleAvailability(hasClientId: boolean, hydrationReady: boolean) {
    if (!hasClientId) {
        return {
            enabled: false,
            fallbackText: i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_ne_nastroen_e2df8d6f'),
        };
    }

    // Keep SSR and the first hydration render identical. Host-specific policy is
    // applied immediately after this component commits via useSyncExternalStore.
    if (!hydrationReady || typeof window === 'undefined') {
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
        fallbackText: i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_nedostupen_na_localhost_ispol_9023147b'),
    };
}

export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const colors = useThemedColors();
    const { isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    });

    const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const hasClientId = googleClientId.length > 0;
    const hydrationReady = useHydrationReady();
    const googleAvailability = useMemo(
        () => getGoogleAvailability(hasClientId, hydrationReady),
        [hasClientId, hydrationReady],
    );
    const shouldShowFallback = !googleAvailability.enabled;
    const isButtonDisabled = disabled || !isGoogleLoaded || shouldShowFallback || !hasClientId;

    useEffect(() => {
        if (!hasClientId) {
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_ne_nastroen_otsutstvuet_expo__4517e59c'));
            return;
        }
        if (!googleAvailability.enabled) return;

        let cancelled = false;
        const markLoaded = () => {
            if (!cancelled) setIsGoogleLoaded(true);
        };
        const handleScriptError = () => {
            if (!cancelled) onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_zagruzit_google_sign_in_3373f8ec'));
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
        if (!isGoogleLoaded || !window.google) return;
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
                        onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_poluchit_dannye_ot_google_cf8f67c9'));
                    }
                },
            });
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In initialization error:', error);
            }
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_initsializatsii_google_sign_in_0e857099'));
        }
    }, [googleAvailability.enabled, googleClientId, hasClientId, isGoogleLoaded]);

    useEffect(() => {
        if (!googleAvailability.enabled) return;
        if (!isGoogleLoaded || !window.google || !hasClientId) return;
        if (!buttonContainerRef.current) return;

        try {
            buttonContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(buttonContainerRef.current, {
                type: 'standard',
                theme: getGoogleSignInButtonTheme(isDark),
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'center',
                width: 300,
            });
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In button render error:', error);
            }
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_otobrazheniya_knopki_google_sign_in_9e8d05a4'));
        }
    }, [googleAvailability.enabled, hasClientId, isDark, isGoogleLoaded]);

    return (
        <View
            style={[
                styles.button,
                disabled && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('auth:components.auth.GoogleSignInButton.voyti_cherez_google_43bd772c')}
            accessibilityState={{ disabled: isButtonDisabled }}
        >
            {shouldShowFallback ? (
                <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>{googleAvailability.fallbackText}</Text>
                </View>
            ) : !isGoogleLoaded && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.text} />
                    <Text style={styles.loadingText}>{i18nT('auth:components.auth.GoogleSignInButton.zagruzka_google_sign_in_33b991c3')}</Text>
                </View>
            )}
            <div
                ref={buttonContainerRef}
                style={{
                    width: '100%',
                    minHeight: 44,
                    display: isGoogleLoaded && !shouldShowFallback ? 'flex' : 'none',
                    justifyContent: 'center',
                    pointerEvents: disabled ? 'none' : 'auto',
                    opacity: disabled ? 0.6 : 1,
                    // GSI-iframe светлый: при color-scheme:dark на html Chrome рисует
                    // под кросс-доменным iframe непрозрачный белый фон
                    colorScheme: 'light',
                }}
            />
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    button: {
        backgroundColor: 'transparent',
        borderRadius: DESIGN_TOKENS.radii.lg,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed' as any,
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
});
