// stores/authStore.ts
// Zustand-стор для аутентификации. Содержит всё состояние и действия,
// ранее находившиеся в AuthContext. AuthProvider остаётся тонким фасадом
// для инициализации и регистрации invalidation handler.

import { create } from 'zustand';
import { setSecureItem, getSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { getActiveQueryClient } from '@/api/activeQueryClient';
import { queryKeys } from '@/api/queryKeys';
import type { UserProfileDto } from '@/api/user';

const getAuthApi = async () => import('@/api/auth');
const getUserApi = async () => import('@/api/user');

// Fetch the current user's profile through the mounted QueryClient so the request
// dedupes with useUserProfile (shared queryKey) and serves the cache when fresh.
// Falls back to a direct fetch if no client is mounted yet (early native boot).
const fetchUserProfileSafe = async (userId: string): Promise<UserProfileDto | null> => {
    const [{ fetchUserProfile }, { ApiError }] = await Promise.all([
        getUserApi(),
        import('@/api/client'),
    ]);
    try {
        return await fetchUserProfile(userId);
    } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            return null;
        }
        throw e;
    }
};

const fetchUserProfileViaCache = async (userId: string): Promise<UserProfileDto | null> => {
    const client = getActiveQueryClient();
    if (!client) {
        return fetchUserProfileSafe(userId);
    }
    return client.fetchQuery({
        queryKey: queryKeys.userProfile(userId),
        queryFn: () => fetchUserProfileSafe(userId),
        staleTime: 5 * 60 * 1000,
    });
};

const normalizeAvatar = (raw: unknown): string | null => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
};

// Roll back credentials persisted during an in-flight login that lost the
// epoch race against a logout. Prevents stale tokens lingering on disk and
// silently re-authenticating on next launch.
const rollbackPersistedCredentials = async (): Promise<void> => {
    await Promise.all([
        removeSecureItems(['userToken', 'refreshToken']),
        removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar']),
    ]).catch(() => undefined);
};

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

// Epoch counter to guard against races where an in-flight auth check
// finishes after logout and re-applies stale authenticated state.
let authEpoch = 0;

export const useAuthStore = create<AuthStore>((set, get) => ({
    // --- state ---
    ...INITIAL_AUTH_STATE,

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
            isPremium: false,
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
                    isPremium: false,
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
                isPremium: false,
            });

            // Always fetch profile in background to ensure avatar + premium flag are up-to-date.
            // Route through the mounted QueryClient + shared queryKey so this request
            // dedupes with useUserProfile (the profile screen) instead of firing twice.
            if (storageData.userId) {
                fetchUserProfileViaCache(storageData.userId)
                    .then((profile) => {
                        if (epochAtStart !== authEpoch) return;
                        set({ isPremium: profile?.is_premium ?? false });
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

            let profile: UserProfileDto | null = null;
            try {
                const { fetchUserProfile } = await getUserApi();
                profile = await fetchUserProfile(String(userData.id));
            } catch (e) {
                if (__DEV__) {
                    console.warn('Не удалось загрузить профиль пользователя:', e);
                }
            }

            if (epochAtStart !== authEpoch) {
                await rollbackPersistedCredentials();
                return false;
            }

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

            if (epochAtStart !== authEpoch) {
                await rollbackPersistedCredentials();
                return false;
            }

            set((s) => ({
                isAuthenticated: true,
                userId: String(userData.id),
                username: displayName,
                isSuperuser: userData.is_superuser,
                userAvatar: avatar,
                authReady: true,
                profileRefreshToken: s.profileRefreshToken + 1,
                isPremium: profile?.is_premium ?? false,
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

            let profile: UserProfileDto | null = null;
            try {
                const { fetchUserProfile } = await getUserApi();
                profile = await fetchUserProfile(String(userData.id));
            } catch (e) {
                if (__DEV__) {
                    console.warn('Не удалось загрузить профиль пользователя:', e);
                }
            }

            if (epochAtStart !== authEpoch) {
                await rollbackPersistedCredentials();
                return false;
            }

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

            if (epochAtStart !== authEpoch) {
                await rollbackPersistedCredentials();
                return false;
            }

            set((s) => ({
                isAuthenticated: true,
                userId: String(userData.id),
                username: displayName,
                isSuperuser: userData.is_superuser,
                userAvatar: avatar,
                authReady: true,
                profileRefreshToken: s.profileRefreshToken + 1,
                isPremium: profile?.is_premium ?? false,
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

export const resetAuthStoreForTests = () => {
    authEpoch = 0;
    useAuthStore.setState(INITIAL_AUTH_STATE);
};
