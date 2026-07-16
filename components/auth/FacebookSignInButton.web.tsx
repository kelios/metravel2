import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { translate as i18nT } from '@/i18n';
import type { SupportedLocale } from '@/i18n';

type FacebookSignInButtonProps = {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
    disabled?: boolean;
};

type FacebookLoginResponse = {
    status?: string;
    authResponse?: { accessToken?: string };
};

declare global {
    interface Window {
        FB?: {
            init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
            login: (
                callback: (response: FacebookLoginResponse) => void,
                options: { scope: string; return_scopes: boolean },
            ) => void;
        };
        fbAsyncInit?: () => void;
    }
}

const SDK_SCRIPT_ID = 'facebook-jssdk';
const SDK_LOCALES = {
    ru: 'ru_RU',
    be: 'be_BY',
    uk: 'uk_UA',
    pl: 'pl_PL',
    en: 'en_US',
} as const;

export const isFacebookLoginEnabled = () =>
    String(process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED || '').trim().toLowerCase() === 'true';

export const getFacebookSdkLocale = (locale: SupportedLocale) => SDK_LOCALES[locale];

export const getFacebookCredential = (response: FacebookLoginResponse): string | null => {
    const accessToken = response.authResponse?.accessToken?.trim();
    return response.status === 'connected' && accessToken ? accessToken : null;
};

export default function FacebookSignInButton({
    onSuccess,
    onError,
    onCancel,
    disabled,
}: FacebookSignInButtonProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { locale } = useLocale();
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onCancelRef = useRef(onCancel);
    const appId = String(process.env.EXPO_PUBLIC_META_APP_ID || '').trim();
    const apiVersion = String(process.env.EXPO_PUBLIC_META_API_VERSION || 'v23.0').trim();
    const enabled = isFacebookLoginEnabled();

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
        onCancelRef.current = onCancel;
    });

    useEffect(() => {
        if (!enabled || !appId) return;
        let cancelled = false;

        const initialize = () => {
            if (cancelled || !window.FB) return;
            window.FB.init({ appId, cookie: true, xfbml: false, version: apiVersion });
            setReady(true);
        };
        window.fbAsyncInit = initialize;

        if (window.FB) {
            initialize();
            return () => {
                cancelled = true;
            };
        }

        const existingScript = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
            const handleLoad = () => initialize();
            const handleError = () => onErrorRef.current?.(i18nT('authStatic:facebook.sdkLoadFailed'));
            existingScript.addEventListener('load', handleLoad, { once: true });
            existingScript.addEventListener('error', handleError, { once: true });
            return () => {
                cancelled = true;
                existingScript.removeEventListener('load', handleLoad);
                existingScript.removeEventListener('error', handleError);
            };
        }

        const script = document.createElement('script');
        script.id = SDK_SCRIPT_ID;
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.src = `https://connect.facebook.net/${getFacebookSdkLocale(locale)}/sdk.js`;
        script.addEventListener('error', () => {
            if (!cancelled) onErrorRef.current?.(i18nT('authStatic:facebook.sdkLoadFailed'));
        }, { once: true });
        document.body.appendChild(script);

        return () => {
            cancelled = true;
        };
    }, [apiVersion, appId, enabled, locale]);

    if (!enabled) return null;

    const unavailable = !appId;
    const handlePress = () => {
        if (disabled || loading || unavailable) return;
        if (!ready || !window.FB) {
            onErrorRef.current?.(i18nT('authStatic:facebook.unavailable'));
            return;
        }

        setLoading(true);
        try {
            window.FB.login((response) => {
                setLoading(false);
                const credential = getFacebookCredential(response);
                if (credential) {
                    onSuccessRef.current(credential);
                    return;
                }
                onCancelRef.current?.();
            }, { scope: 'public_profile,email', return_scopes: true });
        } catch (error) {
            setLoading(false);
            if (__DEV__) console.error('Facebook Login initialization error:', error);
            onErrorRef.current?.(i18nT('authStatic:facebook.signInFailed'));
        }
    };

    const isDisabled = Boolean(disabled || loading || unavailable || !ready);
    return (
        <Pressable
            onPress={handlePress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={unavailable
                ? i18nT('authStatic:facebook.unavailableA11y')
                : i18nT('authStatic:facebook.signIn')}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            testID="facebook-sign-in-button"
            style={({ pressed }) => [
                styles.button,
                isDisabled && styles.buttonDisabled,
                pressed && styles.buttonPressed,
            ]}
        >
            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                    <Feather name="facebook" size={20} color={colors.textOnPrimary} />
                )}
                <Text style={styles.text}>
                    {unavailable
                        ? i18nT('authStatic:facebook.unavailable')
                        : loading
                            ? i18nT('authStatic:facebook.loading')
                            : i18nT('authStatic:facebook.signIn')}
                </Text>
            </View>
        </Pressable>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    button: {
        width: '100%',
        minHeight: 48,
        borderRadius: DESIGN_TOKENS.radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.info,
    },
    buttonDisabled: {
        opacity: 0.55,
    },
    buttonPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.99 }],
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
    },
    text: {
        color: colors.textOnPrimary,
        fontSize: 16,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'center',
    },
});
