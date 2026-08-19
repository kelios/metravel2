import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { AppleSignInButtonProps } from '@/components/auth/appleSignInTypes';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTheme } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';

/** Один touch-таргет с остальными соц-кнопками формы (Google/Facebook — 48). */
const APPLE_BUTTON_HEIGHT = 48;

/** Отмена пользователем приходит отдельным кодом и ошибкой входа не является. */
export const isAppleSignInCancellation = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';

/**
 * Приводит Apple credential к форме запроса #1412.
 * `fullName` Apple отдаёт только при первом входе, поэтому дальше поля пустые —
 * имя сохраняет сервер, клиент повторно его не выдумывает.
 */
export const toAppleCredentialPayload = (
    credential: Pick<
        AppleAuthentication.AppleAuthenticationCredential,
        'identityToken' | 'authorizationCode' | 'fullName'
    >,
) => {
    const identityToken = String(credential.identityToken || '').trim();
    if (!identityToken) return null;
    return {
        identityToken,
        authorizationCode: credential.authorizationCode ?? null,
        givenName: credential.fullName?.givenName ?? null,
        familyName: credential.fullName?.familyName ?? null,
    };
};

/**
 * IOS-05: Sign in with Apple. Обязателен по App Review Guideline 4.8, пока в
 * приложении есть сторонний соцвход.
 *
 * Рисуем системную `AppleAuthenticationButton`: она сама следует HIG и сама
 * доступна для VoiceOver — своя отрисовка логотипа Apple была бы нарушением
 * брендбука.
 *
 * Осознанный компромисс по локализации: надпись рисует iOS по языку УСТРОЙСТВА,
 * пропа локали у компонента нет. Поэтому текст кнопки не проходит через `@/i18n`
 * и в соц-блоке возможен смешанный язык (RU в приложении, English на кнопке),
 * а для BE и UK iOS подставит ближайший системный язык. Требование HIG
 * использовать системную кнопку перевешивает: своя кнопка с логотипом Apple —
 * повод для отказа в App Review.
 *
 * На не-iOS `isAvailableAsync()` возвращает `false`, компонент отдаёт `null`,
 * поэтому Android получает тот же набор провайдеров, что и раньше.
 */
export default function AppleSignInButton({
    onSuccess,
    onError,
    onCancel,
    disabled,
    mode = 'sign_in',
}: AppleSignInButtonProps) {
    const { isDark } = useTheme();
    const [available, setAvailable] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'ios') return undefined;
        let active = true;
        AppleAuthentication.isAvailableAsync()
            .then((value) => {
                if (active) setAvailable(value);
            })
            .catch(() => {
                if (active) setAvailable(false);
            });
        return () => {
            active = false;
        };
    }, []);

    if (!available) return null;

    const isDisabled = Boolean(disabled || busy);

    const handlePress = async () => {
        if (isDisabled) return;
        setBusy(true);
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            const payload = toAppleCredentialPayload(credential);
            if (!payload) {
                onError?.(i18nT('authStatic:apple.signInFailed'));
                return;
            }
            onSuccess(payload);
        } catch (error) {
            if (isAppleSignInCancellation(error)) {
                onCancel?.();
                return;
            }
            onError?.(i18nT('authStatic:apple.signInFailed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View
            testID="apple-sign-in-button"
            pointerEvents={isDisabled ? 'none' : 'auto'}
            style={[styles.container, isDisabled && styles.containerDisabled]}
        >
            <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                    mode === 'sign_up'
                        ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                        : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                // Тёмная тема — светлая кнопка, светлая тема — чёрная: так требует HIG.
                buttonStyle={
                    isDark
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={DESIGN_TOKENS.radii.lg}
                style={styles.button}
                onPress={handlePress}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    containerDisabled: {
        opacity: 0.55,
    },
    button: {
        width: '100%',
        height: APPLE_BUTTON_HEIGHT,
    },
});
