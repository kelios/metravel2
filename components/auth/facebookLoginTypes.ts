export type FacebookCredential = {
    accessToken: string;
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
