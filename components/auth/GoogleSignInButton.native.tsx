import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';
import {
    GoogleSignin,
    isCancelledResponse,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface GoogleSignInButtonProps {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
}

const GOOGLE_NATIVE_UNAVAILABLE_TEXT = 'Google Sign-In не настроен';
const GOOGLE_NATIVE_UNAVAILABLE_A11Y = 'Google Sign-In не настроен для мобильного приложения';

type GoogleSignInButtonConfiguredProps = GoogleSignInButtonProps & {
    webClientId: string;
    iosClientId: string;
};

const getNativeGoogleClientId = (androidClientId: string, iosClientId: string) =>
    Platform.OS === 'ios' ? iosClientId : androidClientId;

const configureGoogleSignIn = (webClientId: string, iosClientId: string) => {
    GoogleSignin.configure({
        webClientId,
        ...(Platform.OS === 'ios' && iosClientId ? { iosClientId } : {}),
        offlineAccess: false,
    });
};

export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const webClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const androidClientId = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
    const iosClientId = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

    if (!webClientId || !getNativeGoogleClientId(androidClientId, iosClientId)) {
        return <GoogleSignInButtonUnavailable />;
    }

    return (
        <GoogleSignInButtonConfigured
            onSuccess={onSuccess}
            onError={onError}
            disabled={disabled}
            webClientId={webClientId}
            iosClientId={iosClientId}
        />
    );
}

function GoogleSignInButtonUnavailable() {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Pressable
            disabled
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={GOOGLE_NATIVE_UNAVAILABLE_A11Y}
            style={[styles.button, styles.buttonDisabled]}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.text}>{GOOGLE_NATIVE_UNAVAILABLE_TEXT}</Text>
            </View>
        </Pressable>
    );
}

function GoogleSignInButtonConfigured({
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

            if (isSuccessResponse(result)) {
                let token = result.data.idToken;
                if (!token) {
                    token = (await GoogleSignin.getTokens()).idToken;
                }
                setIsLoading(false);
                if (!token) {
                    onError?.('Не удалось получить id_token от Google');
                    return;
                }
                onSuccess(token);
                return;
            }

            setIsLoading(false);
            if (!isCancelledResponse(result)) {
                onError?.('Не удалось завершить Google Sign-In');
            }
        } catch (error) {
            setIsLoading(false);
            if (isErrorWithCode(error)) {
                if (error.code === statusCodes.IN_PROGRESS) {
                    onError?.('Google Sign-In уже выполняется');
                    return;
                }
                if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                    onError?.('Google Play Services недоступны или требуют обновления');
                    return;
                }
                if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                    return;
                }
            }
            if (__DEV__) {
                console.error('Google native sign-in error:', error);
            }
            onError?.('Ошибка при открытии Google Sign-In');
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
