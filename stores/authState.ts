// stores/authState.ts
// Лист-модуль: формы состояния/экшенов auth + начальное состояние. Держим его
// БЕЗ рантайм-зависимостей (тяжёлый `authStore` тянет zustand/secureStorage/i18n),
// чтобы потребители типов и `INITIAL_AUTH_STATE` (напр. `authContextBase`) не
// создавали циклический импорт через store. (FE-ARCH P3)

import type { AppleAuthResult, AppleCredentialPayload } from '@/api/appleAuth';
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
    // Личность (isAuthenticated/userId/username/isSuperuser) меняется только
    // атомарными действиями (`login`, `applyConfirmedAccountSession`,
    // `invalidateAuthState`, соц-вход), которые держат инвариант
    // isAuthenticated ⇔ userId. Сырые сеттеры этих полей убраны: публичный
    // `setIsAuthenticated` (как и `setUserId(null)`) позволял вручную завести
    // состояние «залогинен без userId» и воспроизвести #1462 одной строкой. (#1470)
    // `setUserAvatar` оставлен — он меняет только аватар (оптимистичный апдейт в
    // useAvatarUpload/useUserProfile) и инвариант личности не трогает.
    setUserAvatar: (v: string | null) => void;
    triggerProfileRefresh: () => void;
    invalidateAuthState: () => void;
    applyConfirmedAccountSession: (session: {
        userId: string | number;
        userName?: unknown;
    }) => void;
    checkAuthentication: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    loginWithGoogle: (credential: string) => Promise<boolean>;
    loginWithApple: (credential: AppleCredentialPayload) => Promise<AppleAuthResult>;
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
