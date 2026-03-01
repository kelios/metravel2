// stores/authStore.ts
// Zustand-стор для аутентификации. Содержит всё состояние и действия,
// ранее находившиеся в AuthContext. AuthProvider остаётся тонким фасадом
// для инициализации и регистрации invalidation handler.

import { create } from 'zustand';
import { setSecureItem, getSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import * as authApiModule from '@/api/auth';
import * as userApiModule from '@/api/user';

const getAuthApi = async () => authApiModule;
const getUserApi = async () => userApiModule;

const normalizeAvatar = (raw: unknown): string | null => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
};

export interface AuthState {
    isAuthenticated: boolean;
    username: string;
    isSuperuser: boolean;
    userId: string | null;
    userAvatar: string | null;
    authReady: boolean;
    profileRefreshToken: number;
}

interface AuthActions {
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
    logout: () => Promise<void>;
    sendPassword: (email: string) => Promise<string>;
    setNewPassword: (token: string, newPassword: string) => Promise<boolean>;
}

export type AuthStore = AuthState & AuthActions;

// Epoch counter to guard against races where an in-flight auth check
// finishes after logout and re-applies stale authenticated state.
let authEpoch = 0;

export const useAuthStore = create<AuthStore>((set, get) => ({
    // --- state ---
    isAuthenticated: false,
    username: '',
    isSuperuser: false,
    userId: null,
    userAvatar: null,
    authReady: false,
    profileRefreshToken: 0,

    // --- setters ---
    setIsAuthenticated: (v) => set({ isAuthenticated: v }),
    setUsername: (v) => set({ username: v }),
    setIsSuperuser: (v) => set({ isSuperuser: v }),
    setUserId: (v) => set({ userId: v }),
    setUserAvatar: (v) => set({ userAvatar: v }),
    triggerProfileRefresh: () => set((s) => ({ profileRefreshToken: s.profileRefreshToken + 1 })),

    // --- invalidate (used by api client on 401) ---
    invalidateAuthState: () => {
        authEpoch += 1;
        set({
            isAuthenticated: false,
            userId: null,
            username: '',
            isSuperuser: false,
            userAvatar: null,
            authReady: true,
        });
        Promise.resolve(removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar'])).catch(() => undefined);
    },

    // --- check stored auth on mount ---
    checkAuthentication: async () => {
        const epochAtStart = authEpoch;
        try {
            const [token, storageData] = await Promise.all([
                getSecureItem('userToken'),
                getStorageBatch(['userId', 'userName', 'isSuperuser', 'userAvatar']),
            ]);

            if (epochAtStart !== authEpoch) return;

            if (!token) {
                set({
                    isAuthenticated: false,
                    userId: null,
                    username: '',
                    isSuperuser: false,
                    userAvatar: null,
                });
                return;
            }

            const restoredAvatar = normalizeAvatar(storageData.userAvatar);

            set({
                isAuthenticated: true,
                userId: storageData.userId,
                username: storageData.userName || '',
                isSuperuser: storageData.isSuperuser === 'true',
                userAvatar: restoredAvatar,
            });

            // Always fetch profile in background to ensure avatar is up-to-date
            if (storageData.userId) {
                getUserApi()
                    .then(({ fetchUserProfile }) => fetchUserProfile(storageData.userId!))
                    .then((profile) => {
                        if (epochAtStart !== authEpoch) return;
                        const avatar = normalizeAvatar(profile?.avatar);
                        if (avatar) {
                            set((s) => ({
                                userAvatar: avatar,
                                profileRefreshToken: s.profileRefreshToken + 1,
                            }));
                            setStorageBatch([['userAvatar', avatar]]).catch(() => undefined);
                        } else if (restoredAvatar) {
                            // Avatar was removed on server — clear local copy
                            set({ userAvatar: null });
                            removeStorageBatch(['userAvatar']).catch(() => undefined);
                        }
                    })
                    .catch(() => undefined);
            }
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка при проверке аутентификации:', error);
            }
            set({
                isAuthenticated: false,
                userId: null,
                username: '',
                isSuperuser: false,
                userAvatar: null,
            });
        } finally {
            if (epochAtStart === authEpoch) {
                set({ authReady: true });
            }
        }
    },

    // --- login ---
    login: async (email, password) => {
        const epochAtStart = authEpoch;
        try {
            const { loginApi } = await getAuthApi();
            const userData = await loginApi(email, password);
            if (!userData) return false;
            if (epochAtStart !== authEpoch) return false;

            await setSecureItem('userToken', userData.token);
            if (userData.refresh) {
                await setSecureItem('refreshToken', userData.refresh);
            }

            let profile: any = null;
            try {
                const { fetchUserProfile } = await getUserApi();
                profile = await fetchUserProfile(String(userData.id));
            } catch (e) {
                if (__DEV__) {
                    console.warn('Не удалось загрузить профиль пользователя:', e);
                }
            }

            if (epochAtStart !== authEpoch) return false;

            const normalizedFirstName = String(profile?.first_name ?? '').trim();
            const displayName = normalizedFirstName || userData.name?.trim() || userData.email;
            const avatar = normalizeAvatar(profile?.avatar);

            const items: Array<[string, string]> = [
                ['userId', String(userData.id)],
                ['userName', displayName],
                ['isSuperuser', userData.is_superuser ? 'true' : 'false'],
            ];
            if (avatar) {
                items.push(['userAvatar', avatar]);
            }

            await setStorageBatch(items);
            if (!avatar) {
                await removeStorageBatch(['userAvatar']);
            }

            if (epochAtStart !== authEpoch) return false;

            set((s) => ({
                isAuthenticated: true,
                userId: String(userData.id),
                username: displayName,
                isSuperuser: userData.is_superuser,
                userAvatar: avatar,
                authReady: true,
                profileRefreshToken: s.profileRefreshToken + 1,
            }));

            return true;
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа:', error);
            }
            return false;
        }
    },

    // --- login with Google ---
    loginWithGoogle: async (credential) => {
        const epochAtStart = authEpoch;
        try {
            const { googleAuthApi } = await getAuthApi();
            const userData = await googleAuthApi(credential);
            if (!userData) return false;
            if (epochAtStart !== authEpoch) return false;

            await setSecureItem('userToken', userData.token);
            if (userData.refresh) {
                await setSecureItem('refreshToken', userData.refresh);
            }

            let profile: any = null;
            try {
                const { fetchUserProfile } = await getUserApi();
                profile = await fetchUserProfile(String(userData.id));
            } catch (e) {
                if (__DEV__) {
                    console.warn('Не удалось загрузить профиль пользователя:', e);
                }
            }

            if (epochAtStart !== authEpoch) return false;

            const normalizedFirstName = String(profile?.first_name ?? '').trim();
            const displayName = normalizedFirstName || userData.name?.trim() || userData.email;
            const avatar = normalizeAvatar(profile?.avatar);

            const items: Array<[string, string]> = [
                ['userId', String(userData.id)],
                ['userName', displayName],
                ['isSuperuser', userData.is_superuser ? 'true' : 'false'],
            ];
            if (avatar) {
                items.push(['userAvatar', avatar]);
            }

            await setStorageBatch(items);
            if (!avatar) {
                await removeStorageBatch(['userAvatar']);
            }

            if (epochAtStart !== authEpoch) return false;

            set((s) => ({
                isAuthenticated: true,
                userId: String(userData.id),
                username: displayName,
                isSuperuser: userData.is_superuser,
                userAvatar: avatar,
                authReady: true,
                profileRefreshToken: s.profileRefreshToken + 1,
            }));

            return true;
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа через Google:', error);
            }
            return false;
        }
    },

    // --- logout ---
    logout: async () => {
        get().invalidateAuthState();

        try {
            const { logoutApi } = await getAuthApi();
            await logoutApi();
        } catch (e) {
            if (__DEV__) {
                console.warn('Ошибка при логауте с сервера:', e);
            }
        } finally {
            await Promise.all([
                removeSecureItems(['userToken', 'refreshToken']),
                removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar']),
            ]);
        }
    },

    // --- password reset ---
    sendPassword: async (email) => {
        try {
            const { resetPasswordLinkApi } = await getAuthApi();
            const response = await resetPasswordLinkApi(email);
            return typeof response === 'string'
                ? response
                : 'Что-то пошло не так. Попробуйте снова.';
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка при сбросе пароля:', error);
            }
            return 'Произошла ошибка. Попробуйте ещё раз.';
        }
    },

    // --- set new password ---
    setNewPassword: async (token, newPassword) => {
        const { setNewPasswordApi } = await getAuthApi();
        return await setNewPasswordApi(token, newPassword);
    },
}));
