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
import type {
    FacebookAuthResult,
    FacebookCompletionStartResult,
    FacebookSessionPayload,
} from '@/api/auth';
import { shouldUseStoredAuthToken } from '@/utils/authPlatform';
import { normalizeAvatarUrl } from '@/utils/mediaUrl';
import { normalizeProfileName, resolveProfileFullName } from '@/utils/profileName';
import { translate as i18nT } from '@/i18n'


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
    return normalizeAvatarUrl(str) || null;
};

const resolveAuthDisplayName = (
    profile: UserProfileDto | null | undefined,
    fallbackName?: unknown,
    fallbackEmail?: unknown,
): string => {
    const profileName = resolveProfileFullName(profile);
    const safeFallbackName = normalizeProfileName(fallbackName);
    return profileName || safeFallbackName || String(fallbackEmail ?? '').trim();
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

// Epoch counter to guard against races where an in-flight auth check
// finishes after logout and re-applies stale authenticated state.
let authEpoch = 0;

export const useAuthStore = create<AuthStore>((set, get) => {
    const finishFacebookAuthentication = async (
        userData: FacebookSessionPayload,
        epochAtStart: number,
    ): Promise<FacebookAuthResult> => {
        if (epochAtStart !== authEpoch) {
            return {
                status: 'error',
                message: i18nT('errorsStatic:api.auth.facebookSignInFailed'),
            };
        }

        if (shouldUseStoredAuthToken()) {
            await setSecureItem('userToken', userData.token);
            if (userData.refresh) {
                await setSecureItem('refreshToken', userData.refresh);
            }
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
            return {
                status: 'error',
                message: i18nT('errorsStatic:api.auth.facebookSignInFailed'),
            };
        }

        const displayName = resolveAuthDisplayName(profile, userData.name, userData.email);
        const avatar = normalizeAvatar(profile?.avatar);
        const items: Array<[string, string]> = [
            ['userId', String(userData.id)],
            ['userName', displayName],
            ['isSuperuser', userData.is_superuser ? 'true' : 'false'],
        ];
        if (avatar) items.push(['userAvatar', avatar]);

        await setStorageBatch(items);
        if (!avatar) await removeStorageBatch(['userAvatar']);

        if (epochAtStart !== authEpoch) {
            await rollbackPersistedCredentials();
            return {
                status: 'error',
                message: i18nT('errorsStatic:api.auth.facebookSignInFailed'),
            };
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
        return { status: 'authenticated', user: userData };
    };

    return {
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
            const usesStoredToken = shouldUseStoredAuthToken();
            const [token, storageData] = await Promise.all([
                usesStoredToken ? getSecureItem('userToken') : Promise.resolve(null),
                getStorageBatch(['userId', 'userName', 'isSuperuser', 'userAvatar']),
            ]);

            if (epochAtStart !== authEpoch) return;

            if ((usesStoredToken && !token) || !storageData.userId) {
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
            let verifiedWebProfile: UserProfileDto | null = null;

            // HttpOnly cookies cannot be inspected from JavaScript. Validate the
            // ambient web session with a private endpoint before using the public
            // profile endpoint to restore non-secret display metadata.
            if (!usesStoredToken) {
                const { validateWebCookieSessionApi } = await getAuthApi();
                const hasActiveCookieSession = await validateWebCookieSessionApi();
                if (epochAtStart !== authEpoch) return;
                if (!hasActiveCookieSession) {
                    await removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar']);
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

                verifiedWebProfile = await fetchUserProfileViaCache(storageData.userId);
                if (epochAtStart !== authEpoch) return;
                if (!verifiedWebProfile) {
                    await removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar']);
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
            }

            const verifiedAvatar = normalizeAvatar(verifiedWebProfile?.avatar);
            const verifiedName = resolveProfileFullName(verifiedWebProfile);
            const storedName = normalizeProfileName(storageData.userName);

            set({
                isAuthenticated: true,
                userId: storageData.userId,
                username: verifiedName || storedName || '',
                isSuperuser: storageData.isSuperuser === 'true',
                userAvatar: verifiedAvatar ?? restoredAvatar,
                isPremium: verifiedWebProfile?.is_premium ?? false,
            });

            // Always fetch profile in background to ensure avatar + premium flag are up-to-date.
            // Route through the mounted QueryClient + shared queryKey so this request
            // dedupes with useUserProfile (the profile screen) instead of firing twice.
            if (usesStoredToken && storageData.userId) {
                fetchUserProfileViaCache(storageData.userId)
                    .then((profile) => {
                        if (epochAtStart !== authEpoch) return;
                        const profileName = resolveProfileFullName(profile);
                        set((s) => ({
                            isPremium: profile?.is_premium ?? false,
                            username: profileName || s.username,
                        }));
                        if (profileName) {
                            setStorageBatch([['userName', profileName]]).catch(() => undefined);
                        }
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

            if (shouldUseStoredAuthToken()) {
                await setSecureItem('userToken', userData.token);
                if (userData.refresh) {
                    await setSecureItem('refreshToken', userData.refresh);
                }
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

            const displayName = resolveAuthDisplayName(profile, userData.name, userData.email);
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

            if (shouldUseStoredAuthToken()) {
                await setSecureItem('userToken', userData.token);
                if (userData.refresh) {
                    await setSecureItem('refreshToken', userData.refresh);
                }
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

            const displayName = resolveAuthDisplayName(profile, userData.name, userData.email);
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

    // --- login with Facebook ---
    loginWithFacebook: async (credential) => {
        const epochAtStart = authEpoch;
        try {
            const { facebookAuthApi } = await getAuthApi();
            const result = await facebookAuthApi(credential);
            if (result.status !== 'authenticated') return result;
            return await finishFacebookAuthentication(result.user, epochAtStart);
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа через Facebook:', error);
            }
            return {
                status: 'error',
                message: i18nT('errorsStatic:api.auth.facebookSignInFailed'),
            };
        }
    },

    startFacebookEmailCompletion: async (completionHandle, email) => {
        try {
            const { startFacebookEmailCompletionApi } = await getAuthApi();
            return await startFacebookEmailCompletionApi(completionHandle, email);
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка запуска подтверждения email Facebook:', error);
            }
            return {
                status: 'error',
                message: i18nT('errorsStatic:api.auth.facebookSignInFailed'),
            };
        }
    },

    confirmFacebookEmailCompletion: async (completionHandle, code) => {
        const epochAtStart = authEpoch;
        try {
            const { confirmFacebookEmailCompletionApi } = await getAuthApi();
            const result = await confirmFacebookEmailCompletionApi(completionHandle, code);
            if (result.status !== 'authenticated') return result;
            return await finishFacebookAuthentication(result.user, epochAtStart);
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка подтверждения email Facebook:', error);
            }
            return {
                status: 'error',
                message: i18nT('errorsStatic:api.auth.facebookSignInFailed'),
            };
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
                : i18nT('shared:stores.authStore.chto_to_poshlo_ne_tak_poprobuyte_snova_6b2b849c');
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка при сбросе пароля:', error);
            }
            return i18nT('shared:stores.authStore.proizoshla_oshibka_poprobuyte_esche_raz_fa0eb9e8');
        }
    },

    // --- set new password ---
    setNewPassword: async (token, newPassword) => {
        const { setNewPasswordApi } = await getAuthApi();
        return await setNewPasswordApi(token, newPassword);
    },
    };
});

export const resetAuthStoreForTests = () => {
    authEpoch = 0;
    useAuthStore.setState(INITIAL_AUTH_STATE);
};
