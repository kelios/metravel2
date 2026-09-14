import type { FacebookCredentialPayload } from '@/api/auth';

// Credential кнопки Facebook — размеченное объединение, а не два опциональных
// поля: на iPhone (#1918) вход идёт в режиме Meta Limited Login и отдаёт OIDC
// authentication token с nonce, а web и Android остаются на access token Graph
// API. Бэкенд принимает ровно одну из двух форм, поэтому «оба сразу» и «ни
// одного» обязаны отсекаться типом, а не проверкой в рантайме. Поля запроса
// живут в `api/auth.ts` рядом с самим запросом, здесь к ним добавляется то, что
// нужно только UI: выданные разрешения и признак согласия на email.
export type FacebookCredential = FacebookCredentialPayload & {
    grantedScopes: string[];
    emailPermissionGranted: boolean;
};

export type FacebookLoginMode = 'sign_in' | 'rerequest_email';

export type FacebookSignInButtonProps = {
    onSuccess: (credential: FacebookCredential) => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
    disabled?: boolean;
    mode?: FacebookLoginMode;
};

export type FacebookAuthFlowProps = {
    disabled?: boolean;
    onAttempt?: () => void;
    onAuthenticated: () => void;
    onFailure?: (reason: string) => void;
    onBusyChange?: (busy: boolean) => void;
};
