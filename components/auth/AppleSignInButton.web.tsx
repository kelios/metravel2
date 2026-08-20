import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AppleCredentialPayload } from '@/api/appleAuth';
import type { AppleSignInButtonProps } from '@/components/auth/appleSignInTypes';
import SocialAuthButton, {
    SocialAuthButtonPlaceholder,
} from '@/components/auth/SocialAuthButton.web';
import { useExternalScript } from '@/hooks/useExternalScript';
import { useHydrationReady } from '@/hooks/useHydrationReady';
import { useTheme } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';

/**
 * IOS-17 (#1506): веб-паритет Sign in with Apple.
 *
 * Аккаунт, созданный в iPhone-приложении через Apple, пароля не имеет, а при
 * «Скрыть мою почту» ещё и не имеет доставляемого адреса — без веб-кнопки
 * попасть на сайт ему было нечем.
 *
 * Выбран Apple JS SDK в popup-режиме, а не редирект `response_mode=form_post`:
 * popup отдаёт `id_token` прямо в JS, поэтому переиспользуется уже готовый
 * контракт `POST /user/apple-login/` (#1412) и весь разбор сессии
 * (`parseSocialSession`, `useAuth`). Редирект потребовал бы отдельного
 * серверного callback-эндпоинта, обмена one-time кодом и своей ветки в auth —
 * то есть нового контракта там, где хватает существующего.
 *
 * `expo-apple-authentication` здесь по-прежнему НЕ импортируется: нативный
 * модуль в web-бандле — регресс веса. SDK Apple подключается тегом `<script>`
 * во время монтирования формы входа, в бандл не попадает.
 *
 * Отличия от нативной поверхности, осознанные:
 * - кнопка своя (`Pressable` + логотип), а не системная: Apple разрешает
 *   custom-кнопку на вебе по HIG, и только так надпись проходит через `@/i18n`
 *   и получает BE/UK, которых у Apple в списке локалей SDK нет;
 * - `client_id` уходит на сервер: у веба свой audience (Services ID), отличный
 *   от bundle ID приложения, и сервер по нему выбирает ключ проверки.
 */

const SDK_SCRIPT_ID = 'apple-signin-sdk';

/**
 * Локаль SDK намеренно фиксирована. Файл лежит по пути с локалью, и на
 * неподдерживаемой (`be_BY`) отдаёт 404 — кнопка бы просто перестала работать.
 * Смысла рисковать нет: локализованные строки SDK видны только в его
 * собственной кнопке, которую мы не используем, а страницу входа Apple
 * локализует сама по языку Apple ID.
 */
const SDK_LOCALE = 'en_US';
const SDK_SRC = `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${SDK_LOCALE}/appleid.auth.js`;

type AppleAuthorization = {
    code?: string;
    id_token?: string;
    state?: string;
};

export type AppleSignInResponse = {
    authorization?: AppleAuthorization;
    /** Apple присылает только при ПЕРВОМ входе — дальше поля нет вовсе. */
    user?: {
        name?: { firstName?: string; lastName?: string };
        email?: string;
    };
};

declare global {
    interface Window {
        AppleID?: {
            auth: {
                init: (config: {
                    clientId: string;
                    scope: string;
                    redirectURI: string;
                    state: string;
                    usePopup: boolean;
                }) => void;
                signIn: () => Promise<AppleSignInResponse>;
            };
        };
    }
}

export type AppleWebConfig = {
    clientId: string;
    redirectUri: string;
};

/**
 * Services ID и Return URL из Apple Developer. Пока их нет, кнопки на вебе тоже
 * нет — это не мок и не заглушка, а тот же приём, что у Facebook
 * (`EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED`): невыпущенный провайдер не показывается.
 */
export const getAppleWebConfig = (): AppleWebConfig => ({
    clientId: String(process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID || '').trim(),
    redirectUri: String(process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI || '').trim(),
});

/** `redirectURI` обязателен даже в popup-режиме: Apple сверяет его с Return URL. */
export const isAppleWebConfigured = (config: AppleWebConfig): boolean =>
    Boolean(config.clientId) && Boolean(config.redirectUri);

export const getAppleRenderState = (configured: boolean, hydrationReady: boolean) => {
    if (!configured) return 'hidden' as const;
    return hydrationReady ? ('button' as const) : ('hydration-placeholder' as const);
};

/**
 * `state` против подмены ответа: Apple возвращает его как есть, и чужой ответ
 * из другого окна значение не угадает.
 */
export const createAppleAuthState = (): string => {
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (cryptoApi?.getRandomValues) {
        const bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    // jsdom/SSR без Web Crypto: значение всё равно одноразовое и сверяется
    // только с самим собой, поэтому детерминированность не ломает проверку.
    return `apple-${Date.now().toString(16)}`;
};

/** Закрытое пользователем окно — не ошибка входа, а отмена. */
export const isAppleWebCancellation = (error: unknown): boolean => {
    if (typeof error !== 'object' || error === null) return false;
    const code = (error as { error?: unknown }).error;
    return code === 'popup_closed_by_user' || code === 'user_cancelled_authorize';
};

/**
 * Ответ SDK → payload `POST /user/apple-login/`.
 * Возвращает `null`, если ответ непригоден: нет `id_token` или `state` не тот,
 * что мы отправляли.
 */
export const toAppleWebCredential = (
    response: AppleSignInResponse | null | undefined,
    clientId: string,
    expectedState: string,
): AppleCredentialPayload | null => {
    const authorization = response?.authorization;
    const identityToken = String(authorization?.id_token || '').trim();
    if (!identityToken) return null;
    if (expectedState && String(authorization?.state || '') !== expectedState) return null;

    return {
        identityToken,
        authorizationCode: String(authorization?.code || '').trim() || null,
        givenName: response?.user?.name?.firstName?.trim() || null,
        familyName: response?.user?.name?.lastName?.trim() || null,
        clientId,
    };
};

/**
 * Логотип Apple. Инлайн-SVG, а не иконочный шрифт: ради одного глифа тянуть
 * `MaterialCommunityIcons` (~1 МБ) на экран входа — тот же регресс веса,
 * от которого этот файл и уходит. Форма — обязательная часть custom-кнопки
 * по HIG.
 */
function AppleLogo({ color }: { color: string }) {
    return React.createElement(
        'svg',
        {
            width: 18,
            height: 22,
            viewBox: '0 0 24 24',
            fill: color,
            'aria-hidden': true,
            focusable: 'false',
            style: { display: 'block', flexShrink: 0 },
        },
        React.createElement('path', {
            d: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
        }),
    );
}

export default function AppleSignInButton({
    onSuccess,
    onError,
    onCancel,
    disabled,
    mode = 'sign_in',
}: AppleSignInButtonProps) {
    const { isDark } = useTheme();
    const hydrationReady = useHydrationReady();
    const config = useMemo(getAppleWebConfig, []);
    const configured = isAppleWebConfigured(config);
    const renderState = getAppleRenderState(configured, hydrationReady);
    const palette = getAppleButtonPalette(isDark);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const stateRef = useRef('');
    const mountedRef = useRef(true);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onCancelRef = useRef(onCancel);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
        onCancelRef.current = onCancel;
    });

    useEffect(() => () => {
        mountedRef.current = false;
    }, []);

    const initialize = useCallback(() => {
        if (!configured || !window.AppleID) return;
        try {
            if (!stateRef.current) stateRef.current = createAppleAuthState();
            window.AppleID.auth.init({
                clientId: config.clientId,
                // `name` Apple отдаёт только при первом входе; без scope имя
                // не пришло бы вообще и аккаунт остался бы безымянным.
                scope: 'name email',
                redirectURI: config.redirectUri,
                state: stateRef.current,
                usePopup: true,
            });
            setReady(true);
        } catch {
            onErrorRef.current?.(i18nT('authStatic:apple.sdkLoadFailed'));
        }
    }, [config.clientId, config.redirectUri, configured]);

    const handleSdkError = useCallback(() => {
        onErrorRef.current?.(i18nT('authStatic:apple.sdkLoadFailed'));
    }, []);

    useEffect(() => {
        initialize();
    }, [initialize]);

    const hasAppleSdk = typeof window !== 'undefined' && Boolean(window.AppleID);
    useExternalScript({
        id: SDK_SCRIPT_ID,
        src: SDK_SRC,
        onReady: initialize,
        onError: handleSdkError,
        enabled: configured && !hasAppleSdk,
    });

    if (renderState === 'hidden') return null;
    if (renderState === 'hydration-placeholder') return <SocialAuthButtonPlaceholder />;

    const isDisabled = Boolean(disabled || loading || !ready);
    const idleLabel = mode === 'sign_up'
        ? i18nT('authStatic:apple.signUp')
        : i18nT('authStatic:apple.signIn');

    const handlePress = async () => {
        if (isDisabled || !window.AppleID) return;
        setLoading(true);
        try {
            const response = await window.AppleID.auth.signIn();
            const credential = toAppleWebCredential(response, config.clientId, stateRef.current);
            if (!credential) {
                onErrorRef.current?.(i18nT('authStatic:apple.signInFailed'));
                return;
            }
            onSuccessRef.current(credential);
        } catch (error) {
            if (isAppleWebCancellation(error)) {
                onCancelRef.current?.();
                return;
            }
            onErrorRef.current?.(i18nT('authStatic:apple.signInFailed'));
        } finally {
            // На успехе экран уходит в навигацию и компонент размонтируется:
            // снимать спиннер там уже некому и незачем. На ошибке форма
            // остаётся на месте, и кнопка обязана вернуться в рабочее
            // состояние — иначе повторить вход было бы нечем.
            if (mountedRef.current) setLoading(false);
        }
    };

    return (
        <SocialAuthButton
            label={loading ? i18nT('authStatic:apple.loading') : idleLabel}
            accessibilityLabel={idleLabel}
            icon={<AppleLogo color={palette.foreground} />}
            backgroundColor={palette.background}
            foregroundColor={palette.foreground}
            onPress={handlePress}
            testID="apple-sign-in-button"
            loading={loading}
            disabled={isDisabled}
        />
    );
}

/**
 * Apple допускает ровно два варианта кнопки — чёрную и белую. Берём тот, что
 * контрастен теме: чёрная на светлой, белая на тёмной. Токены темы здесь не
 * годятся, цвета кнопки заданы брендбуком Apple и не тянутся за палитрой.
 */
export const getAppleButtonPalette = (isDark: boolean) => ({
    background: isDark ? '#FFFFFF' : '#000000',
    foreground: isDark ? '#000000' : '#FFFFFF',
});
