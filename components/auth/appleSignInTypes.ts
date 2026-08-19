import type { AppleCredentialPayload } from '@/api/appleAuth';

/**
 * Apple различает «войти» и «зарегистрироваться» на уровне надписи системной
 * кнопки, поэтому режим приходит от экрана — как у Facebook-кнопки.
 */
export type AppleSignInMode = 'sign_in' | 'sign_up';

export type AppleSignInButtonProps = {
    onSuccess: (credential: AppleCredentialPayload) => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
    disabled?: boolean;
    mode?: AppleSignInMode;
};
