/**
 * @jest-environment jsdom
 */

// IOS-17 (#1506): поведение веб-кнопки Apple целиком — от гейта конфигурации до
// разбора ответа popup. Прогон в браузере на этой машине недоступен (три
// параллельных Metro, load average ~75), поэтому доказательство здесь.

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AppleSignInButton from '@/components/auth/AppleSignInButton.web';

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ isDark: false }),
}));

jest.mock('@/hooks/useHydrationReady', () => ({
    useHydrationReady: () => true,
}));

jest.mock('@/i18n', () => ({
    translate: (key: string) => key,
}));

const CLIENT_ID = 'by.metravel.web';
const REDIRECT_URI = 'https://metravel.by/api/user/apple-web-callback/';

const appleAuthorization = {
    id_token: 'apple-id-token',
    code: 'one-time-code',
};

const setConfig = (clientId = CLIENT_ID, redirectUri = REDIRECT_URI) => {
    process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID = clientId;
    process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI = redirectUri;
};

/** Подставляет SDK так, как он выглядит уже загруженным. */
const installAppleSdk = (signIn: jest.Mock) => {
    const init = jest.fn();
    (window as any).AppleID = { auth: { init, signIn } };
    return init;
};

describe('AppleSignInButton.web', () => {
    const originalClientId = process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID;
    const originalRedirect = process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI;

    afterEach(() => {
        process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID = originalClientId;
        process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI = originalRedirect;
        delete (window as any).AppleID;
        document.getElementById('apple-signin-sdk')?.remove();
        jest.clearAllMocks();
    });

    // Регрессионный контроль: пока Services ID не выпущен, веб-формы остаются
    // ровно такими же, какими были до #1506.
    it('без конфигурации не рендерит ничего и не трогает страницу', () => {
        process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID = '';
        process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI = '';

        const { queryByTestId } = render(<AppleSignInButton onSuccess={jest.fn()} />);

        expect(queryByTestId('apple-sign-in-button')).toBeNull();
        expect(document.getElementById('apple-signin-sdk')).toBeNull();
    });

    it('подключает SDK Apple ровно с фиксированной локалью en_US', () => {
        setConfig();

        render(<AppleSignInButton onSuccess={jest.fn()} />);

        const script = document.getElementById('apple-signin-sdk') as HTMLScriptElement | null;
        expect(script?.src).toBe(
            'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
        );
    });

    it('инициализирует SDK Services ID, Return URL и popup-режимом', () => {
        setConfig();
        const init = installAppleSdk(jest.fn());

        const { getByTestId } = render(<AppleSignInButton onSuccess={jest.fn()} />);

        expect(getByTestId('apple-sign-in-button')).toBeTruthy();
        expect(init).toHaveBeenCalledTimes(1);
        expect(init).toHaveBeenCalledWith(
            expect.objectContaining({
                clientId: CLIENT_ID,
                redirectURI: REDIRECT_URI,
                scope: 'name email',
                usePopup: true,
                state: expect.any(String),
            }),
        );
        expect(init.mock.calls[0][0].state).not.toBe('');
    });

    it('успешный popup отдаёт credential с web-audience', async () => {
        setConfig();
        const signIn = jest.fn();
        const init = installAppleSdk(signIn);
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const { getByTestId } = render(
            <AppleSignInButton onSuccess={onSuccess} onError={onError} />,
        );
        const state = init.mock.calls[0][0].state;
        signIn.mockResolvedValueOnce({
            authorization: { ...appleAuthorization, state },
            user: { name: { firstName: 'Apple', lastName: 'User' } },
        });

        fireEvent.press(getByTestId('apple-sign-in-button'));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(onSuccess).toHaveBeenCalledWith({
            identityToken: 'apple-id-token',
            authorizationCode: 'one-time-code',
            givenName: 'Apple',
            familyName: 'User',
            clientId: CLIENT_ID,
        });
        expect(onError).not.toHaveBeenCalled();
    });

    it('закрытое окно Apple не показывает ошибку', async () => {
        setConfig();
        const signIn = jest.fn().mockRejectedValueOnce({ error: 'popup_closed_by_user' });
        installAppleSdk(signIn);
        const onError = jest.fn();
        const onCancel = jest.fn();

        const { getByTestId } = render(
            <AppleSignInButton onSuccess={jest.fn()} onError={onError} onCancel={onCancel} />,
        );
        fireEvent.press(getByTestId('apple-sign-in-button'));

        await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
        expect(onError).not.toHaveBeenCalled();
    });

    it('после неудачи кнопка снова активна: иначе повторить вход было бы нечем', async () => {
        setConfig();
        const signIn = jest.fn().mockRejectedValueOnce({ error: 'invalid_client' });
        installAppleSdk(signIn);
        const onError = jest.fn();
        const onSuccess = jest.fn();

        const { getByTestId } = render(
            <AppleSignInButton onSuccess={onSuccess} onError={onError} />,
        );
        fireEvent.press(getByTestId('apple-sign-in-button'));

        await waitFor(() => expect(onError).toHaveBeenCalledWith('authStatic:apple.signInFailed'));
        expect(onSuccess).not.toHaveBeenCalled();

        signIn.mockResolvedValueOnce({ authorization: undefined });
        fireEvent.press(getByTestId('apple-sign-in-button'));
        await waitFor(() => expect(signIn).toHaveBeenCalledTimes(2));
    });

    it('ответ с чужим state сессией не становится', async () => {
        setConfig();
        const signIn = jest.fn().mockResolvedValueOnce({
            authorization: { ...appleAuthorization, state: 'someone-elses-state' },
        });
        installAppleSdk(signIn);
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const { getByTestId } = render(
            <AppleSignInButton onSuccess={onSuccess} onError={onError} />,
        );
        fireEvent.press(getByTestId('apple-sign-in-button'));

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('режим регистрации меняет надпись на «зарегистрироваться»', () => {
        setConfig();
        installAppleSdk(jest.fn());

        const { getByTestId } = render(
            <AppleSignInButton onSuccess={jest.fn()} mode="sign_up" />,
        );

        expect(getByTestId('apple-sign-in-button').props.accessibilityLabel).toBe(
            'authStatic:apple.signUp',
        );
    });
});
