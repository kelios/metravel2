// stores/authState.ts
// Лист-модуль: формы состояния/экшенов auth + начальное состояние. Держим его
// БЕЗ рантайм-зависимостей (тяжёлый `authStore` тянет zustand/secureStorage/i18n),
// чтобы потребители типов и `INITIAL_AUTH_STATE` (напр. `authContextBase`) не
// создавали циклический импорт через store. (FE-ARCH P3)

import type {
    FacebookAuthResult,
    FacebookCompletionStartResult,
} from '@/api/auth';

export interface AuthState {
    isAuthenticated: boolean;
    username: string;
    isSuperuser: boolean;
    userId: string | null;
    userAvatar: string | null;
    authReady: boolean;
    profileRefreshToken: number;
    // Серверный premium-флаг для PDF-paywall (BE #293). Не персистится — берём свежим из профиля.
    isPremium: boolean;
}

export interface AuthActions {
    setIsAuthenticated: (v: boolean) => void;
    setUsername: (v: string) => void;
    setIsSuperuser: (v: boolean) => void;
    setUserId: (v: string | null) => void;
    setUserAvatar: (v: string | null) => void;
    triggerProfileRefresh: () => void;
    invalidateAuthState: () => void;
    checkAuthentication: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    loginWithGoogle: (credential: string) => Promise<boolean>;
    loginWithFacebook: (credential: string) => Promise<FacebookAuthResult>;
    startFacebookEmailCompletion: (
        completionHandle: string,
        email: string,
    ) => Promise<FacebookCompletionStartResult>;
    confirmFacebookEmailCompletion: (
        completionHandle: string,
        code: string,
    ) => Promise<FacebookAuthResult>;
    logout: () => Promise<void>;
    sendPassword: (email: string) => Promise<string>;
    setNewPassword: (token: string, newPassword: string) => Promise<boolean>;
}

export type AuthStore = AuthState & AuthActions;

export const INITIAL_AUTH_STATE: AuthState = {
    isAuthenticated: false,
    username: '',
    isSuperuser: false,
    userId: null,
    userAvatar: null,
    authReady: false,
    profileRefreshToken: 0,
    isPremium: false,
};
