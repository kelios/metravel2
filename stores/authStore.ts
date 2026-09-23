// stores/authStore.ts
// Zustand-стор для аутентификации. Содержит всё состояние и действия,
// ранее находившиеся в AuthContext. AuthProvider остаётся тонким фасадом
// для инициализации и регистрации invalidation handler.

import { Alert } from 'react-native';
import { create } from 'zustand';
import { readSecureItem } from '@/utils/secureStorage';
import {
    clearSessionTokens,
    getSessionWriteMark,
    persistSessionTokens,
} from '@/utils/authTokenStore';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { getActiveQueryClient } from '@/api/activeQueryClient';
import { refreshQuestsCatalogIdentity } from '@/api/questsCatalogInvalidation';
import { dropQueryCacheForIdentityChange } from '@/api/identityQueryCache';
import { queryKeys } from '@/api/queryKeys';
import type { UserProfileDto } from '@/api/user';
import type { FacebookAuthResult } from '@/api/auth';
import type { SocialSessionPayload } from '@/api/authShared';
import {
    authFailure,
    authFailureFromError,
    type AuthFailure,
    type AuthFailureReason,
} from '@/utils/authFailure';
import { ACCESS_TOKEN_STORAGE_KEY, shouldUseStoredAuthToken } from '@/utils/authPlatform';
import { normalizeAvatarUrl } from '@/utils/mediaUrl';
import { normalizeProfileName, resolveProfileFullName } from '@/utils/profileName';
import { translate as i18nT } from '@/i18n'


const getAuthApi = async () => import('@/api/auth');
const getAppleAuthApi = async () => import('@/api/appleAuth');
const getUserApi = async () => import('@/api/user');
const getPushRegistration = async () => import('@/services/pushRegistration');

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
// epoch race. Two different events bump `authEpoch`, and they need opposite
// handling here:
//   • logout/invalidate — the session is gone (`isAuthenticated === false`), so
//     our half-written tokens+storage must be scrubbed or they'd silently
//     re-authenticate on next launch (the original reason this rollback exists).
//   • a successful email confirmation (#1462) — `confirmAccount` already persisted
//     the NEW session under these exact same keys before bumping the epoch. Scrubbing
//     then would wipe a live session: the store stays authenticated while disk empties,
//     and the next reload drops the user to guest (#1469).
// The current store state discriminates the two: only invalidate leaves
// `isAuthenticated === false`. When a session is authenticated, the disk creds
// belong to that winning session, so leave both tokens and storage untouched.
// On web (the reported surface) this is exact — storageBatch writes localStorage
// synchronously, so the confirm inside this login's post-write yield is always the
// last writer. The native token half is no longer left to this discriminator either:
// writes go through the serialized chokepoint in `@/utils/authTokenStore`, which
// keeps the pair whole and drops a superseded login's write outright (#1545).
const rollbackPersistedCredentials = async (): Promise<void> => {
    if (useAuthStore.getState().isAuthenticated) return;
    await Promise.all([
        clearSessionTokens(),
        removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar']),
    ]).catch(() => undefined);
};

// Формы состояния/экшенов и INITIAL_AUTH_STATE вынесены в лист-модуль
// `@/stores/authState` (без рантайм-зависимостей), чтобы потребители типов и
// начального состояния не тянули тяжёлый store и не создавали цикл импорта.
// Ре-экспортируем для обратной совместимости существующих импортов из этого файла.
import { INITIAL_AUTH_STATE, type AuthStore } from '@/stores/authState';

export { INITIAL_AUTH_STATE } from '@/stores/authState';
export type { AuthState, AuthStore } from '@/stores/authState';

// Epoch counter to guard against races where an in-flight auth check
// finishes after logout and re-applies stale authenticated state.
let authEpoch = 0;
let logoutCredentialsReady: Promise<void> | undefined;
let catalogIdentityVersion = 0;
// #1829: был ли в этом процессе вошедший пользователь. Отличает холодный старт
// (сбрасывать нечего) от входа следующего пользователя после чужого выхода.
let sessionHadIdentity = false;

// #1944: вход проиграл гонку (logout или чужая запись сессии во время запроса).
// Сервер тут ни при чём, поэтому причина `unknown`, а не `rejected`: писать
// пользователю «неверный пароль» в этой ветке было бы враньём.
const signInInterrupted = (): AuthFailure => authFailure('unknown', i18nT('errorsStatic:api.auth.signInFailed'));

export const useAuthStore = create<AuthStore>((set, get) => {
    // Общий финиш нативного социального входа (Google/Facebook/Apple): токены в
    // SecureStore, профиль, единое состояние. Любой проигрыш epoch-гонке —
    // logout, прилетевший во время входа, — откатывает уже записанные креды,
    // поэтому частичная сессия на диске не остаётся. (#923/#810, IOS-05)
    const applySocialSession = async (
        userData: SocialSessionPayload,
        epochAtStart: number,
        writeMarkAtStart: number,
    ): Promise<boolean> => {
        if (epochAtStart !== authEpoch) return false;

        // `superseded` — пока шёл соц-вход, свои креды на диск положила другая
        // сессия (подтверждение почты). Дописывать поверх нечего: отказываемся,
        // не трогая чужую пару. (#1545)
        const persisted = await persistSessionTokens(userData.token, userData.refresh, {
            expectedMark: writeMarkAtStart,
        });
        if (persisted === 'superseded') return false;

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
        if (avatar) items.push(['userAvatar', avatar]);

        await setStorageBatch(items);
        if (!avatar) await removeStorageBatch(['userAvatar']);

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
    };

    // Провайдеры с discriminated-результатом (Facebook, Apple) отличаются только
    // текстом отказа, поэтому маппинг общий.
    const finishSocialAuthentication = async (
        userData: SocialSessionPayload,
        epochAtStart: number,
        writeMarkAtStart: number,
        resolveFailureMessage: () => string,
    ): Promise<
        | { status: 'authenticated'; user: SocialSessionPayload }
        | { status: 'error'; reason: AuthFailureReason; message: string }
    > => {
        const applied = await applySocialSession(userData, epochAtStart, writeMarkAtStart);
        // Отказ здесь — всегда проигранная гонка сессий, а не ответ сервера (#1944).
        if (!applied) return { status: 'error', reason: 'unknown', message: resolveFailureMessage() };
        return { status: 'authenticated', user: userData };
    };

    const finishFacebookAuthentication = (
        userData: SocialSessionPayload,
        epochAtStart: number,
        writeMarkAtStart: number,
    ): Promise<FacebookAuthResult> =>
        finishSocialAuthentication(userData, epochAtStart, writeMarkAtStart, () =>
            i18nT('errorsStatic:api.auth.facebookSignInFailed'),
        );

    return {
    // --- state ---
    ...INITIAL_AUTH_STATE,

    // --- setters ---
    // Только аватар: остальные поля личности пишутся атомарными действиями,
    // чтобы нельзя было завести «залогинен без userId» одним сеттером (#1470, см. AuthActions).
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

    // --- вход по подтверждению почты ---
    // Экран подтверждения аккаунта входит в сессию мимо `login`/`checkAuthentication`:
    // токены и storage пишет уже `confirmAccount`, а стору доставался только флаг
    // `isAuthenticated` — `userId` оставался `null` до следующей проверки авторизации.
    // В этом окне всё, что приложение сохраняет «на пользователя» (ключ прогресса
    // квеста, #1456), теряло владельца и на общем устройстве смешивалось между
    // аккаунтами. Ставим личность атомарно, одним набором. (#1462)
    applyConfirmedAccountSession: ({ userId, userName }) => {
        // Проверка авторизации, стартовавшая до подтверждения, читала storage ещё без
        // нового `userId`: без смены эпохи её поздний ответ разлогинил бы нас обратно.
        authEpoch += 1;
        set((s) => ({
            isAuthenticated: true,
            userId: String(userId),
            username: normalizeProfileName(userName),
            // Свежеподтверждённый аккаунт не наследует личность предыдущего: на общем
            // устройстве в сторе могли остаться его права, аватар и premium-флаг.
            isSuperuser: false,
            userAvatar: null,
            isPremium: false,
            authReady: true,
            profileRefreshToken: s.profileRefreshToken + 1,
        }));
    },

    // --- check stored auth on mount ---
    checkAuthentication: async () => {
        const epochAtStart = authEpoch;
        try {
            const usesStoredToken = shouldUseStoredAuthToken();
            const [tokenRead, storageData] = await Promise.all([
                usesStoredToken
                    ? readSecureItem(ACCESS_TOKEN_STORAGE_KEY)
                    : Promise.resolve({ value: null, unavailable: false }),
                getStorageBatch(['userId', 'userName', 'isSuperuser', 'userAvatar']),
            ]);

            if (epochAtStart !== authEpoch) return;

            // Сбой Keychain/SecureStore — не «токена нет». Схлопывать его в гостя
            // нельзя: сессия на сервере жива, а UI до конца запуска молчит (#1936).
            if (usesStoredToken && tokenRead.unavailable) {
                const current = get();
                const storedUserId = typeof storageData.userId === 'string' ? storageData.userId : '';
                const hasSession = Boolean(current.isAuthenticated || current.userId || storedUserId);
                if (hasSession) {
                    const restoredAvatar = normalizeAvatar(storageData.userAvatar);
                    set({
                        isAuthenticated: true,
                        userId: storedUserId || current.userId,
                        username: normalizeProfileName(storageData.userName) || current.username,
                        isSuperuser: storageData.isSuperuser === 'true' || current.isSuperuser,
                        userAvatar: restoredAvatar ?? current.userAvatar,
                    });
                    Alert.alert(
                        i18nT('errorsStatic:api.auth.signInErrorTitle'),
                        i18nT('errorsStatic:api.client.sessionExpired'),
                    );
                }
                return;
            }

            const token = tokenRead.value;

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

            // Профиль уже получен выше через общий кэш ради дедупликации с
            // useUserProfile. Смена владельца (#1829) сбрасывает кэш синхронно
            // внутри `set` выше, поэтому свежий профиль возвращается обратно —
            // иначе экран профиля запросил бы его вторым запросом.
            if (verifiedWebProfile && storageData.userId) {
                getActiveQueryClient()?.setQueryData(
                    queryKeys.userProfile(storageData.userId),
                    verifiedWebProfile,
                );
            }

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
        // Метка диска на момент старта входа: если пока шёл запрос свои креды
        // записала другая сессия (подтверждение почты), запись входа отбрасывается
        // вместо того, чтобы затереть половину чужой пары (#1545).
        const writeMarkAtStart = getSessionWriteMark();
        try {
            const { loginApi } = await getAuthApi();
            // #1944: причина отказа доходит до формы. Единственный источник текста —
            // слой api: стор не пересказывает отказ своими словами и не показывает Alert.
            const attempt = await loginApi(email, password);
            if (!attempt.ok) return attempt;
            const userData = attempt.user;
            if (epochAtStart !== authEpoch) return signInInterrupted();

            const persisted = await persistSessionTokens(userData.token, userData.refresh, {
                expectedMark: writeMarkAtStart,
            });
            if (persisted === 'superseded') return signInInterrupted();

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
                return signInInterrupted();
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
                return signInInterrupted();
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

            return { ok: true };
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа:', error);
            }
            return authFailureFromError(error, i18nT('errorsStatic:api.auth.signInFailed'));
        }
    },

    // --- login with Google ---
    loginWithGoogle: async (credential) => {
        const epochAtStart = authEpoch;
        const writeMarkAtStart = getSessionWriteMark();
        try {
            const { googleAuthApi } = await getAuthApi();
            const attempt = await googleAuthApi(credential);
            if (!attempt.ok) return attempt;
            const applied = await applySocialSession(attempt.user, epochAtStart, writeMarkAtStart);
            return applied
                ? { ok: true }
                : authFailure('unknown', i18nT('errorsStatic:api.auth.googleSignInFailed'));
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа через Google:', error);
            }
            return authFailureFromError(error, i18nT('errorsStatic:api.auth.googleSignInFailed'));
        }
    },

    // --- login with Apple (IOS-05) ---
    loginWithApple: async (credential) => {
        const epochAtStart = authEpoch;
        const writeMarkAtStart = getSessionWriteMark();
        try {
            const { appleAuthApi } = await getAppleAuthApi();
            const result = await appleAuthApi(credential);
            if (result.status !== 'authenticated') return result;
            return await finishSocialAuthentication(result.user, epochAtStart, writeMarkAtStart, () =>
                i18nT('errorsStatic:api.auth.appleSignInFailed'),
            );
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа через Apple:', error);
            }
            const failure = authFailureFromError(error, i18nT('errorsStatic:api.auth.appleSignInFailed'));
            return { status: 'error', reason: failure.reason, message: failure.message };
        }
    },

    // --- login with Facebook ---
    loginWithFacebook: async (credential) => {
        const epochAtStart = authEpoch;
        const writeMarkAtStart = getSessionWriteMark();
        try {
            const { facebookAuthApi } = await getAuthApi();
            const result = await facebookAuthApi(credential);
            if (result.status !== 'authenticated') return result;
            return await finishFacebookAuthentication(result.user, epochAtStart, writeMarkAtStart);
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка входа через Facebook:', error);
            }
            // Как и Apple/Google выше: причина отказа (network/server/rejected/unknown)
            // идёт через общую таксономию, а не голый текст «не удалось войти».
            const failure = authFailureFromError(error, i18nT('errorsStatic:api.auth.facebookSignInFailed'));
            return { status: 'error', reason: failure.reason, message: failure.message };
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
            const failure = authFailureFromError(error, i18nT('errorsStatic:api.auth.facebookSignInFailed'));
            return { status: 'error', reason: failure.reason, message: failure.message };
        }
    },

    confirmFacebookEmailCompletion: async (completionHandle, code) => {
        const epochAtStart = authEpoch;
        const writeMarkAtStart = getSessionWriteMark();
        try {
            const { confirmFacebookEmailCompletionApi } = await getAuthApi();
            const result = await confirmFacebookEmailCompletionApi(completionHandle, code);
            if (result.status !== 'authenticated') return result;
            return await finishFacebookAuthentication(result.user, epochAtStart, writeMarkAtStart);
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка подтверждения email Facebook:', error);
            }
            const failure = authFailureFromError(error, i18nT('errorsStatic:api.auth.facebookSignInFailed'));
            return { status: 'error', reason: failure.reason, message: failure.message };
        }
    },

    // --- logout ---
    logout: async () => {
        try {
            // Push-token DELETE must run while the native auth credential still
            // exists. The adapter is best-effort: a failed unregister never
            // blocks local logout, and it never reports fake success.
            const { unregisterPushBeforeLogout } = await getPushRegistration();
            await unregisterPushBeforeLogout();
        } catch {
            // Logout must still clear the local session.
        }

        let releaseCatalogRefresh!: () => void;
        const credentialsReady = new Promise<void>((resolve) => { releaseCatalogRefresh = resolve; });
        logoutCredentialsReady = credentialsReady;
        get().invalidateAuthState();

        try {
            const { logoutApi } = await getAuthApi();
            await logoutApi();
        } catch (e) {
            if (__DEV__) {
                console.warn('Ошибка при логауте с сервера:', e);
            }
        } finally {
            try {
                await Promise.all([
                    clearSessionTokens(),
                    removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar']),
                ]);
            } finally {
                if (logoutCredentialsReady === credentialsReady) logoutCredentialsReady = undefined;
                releaseCatalogRefresh();
            }
        }
    },

    // --- password reset ---
    sendPassword: async (email) => {
        try {
            const { resetPasswordLinkApi } = await getAuthApi();
            return await resetPasswordLinkApi(email);
        } catch (error) {
            if (__DEV__) {
                console.error('Ошибка при сбросе пароля:', error);
            }
            return authFailure('unknown', i18nT('shared:stores.authStore.proizoshla_oshibka_poprobuyte_esche_raz_fa0eb9e8'));
        }
    },

    // --- set new password ---
    setNewPassword: async (token, newPassword) => {
        const { setNewPasswordApi } = await getAuthApi();
        return await setNewPasswordApi(token, newPassword);
    },
    };
});

useAuthStore.subscribe((state, previous) => {
    const identity = state.isAuthenticated ? state.userId : null;
    const previousIdentity = previous.isAuthenticated ? previous.userId : null;
    if (identity === previousIdentity) return;
    const version = ++catalogIdentityVersion;
    const client = getActiveQueryClient();
    if (!client) return;
    const isCurrentIdentity = () => {
        const current = useAuthStore.getState();
        return version === catalogIdentityVersion && (current.isAuthenticated ? current.userId : null) === identity;
    };
    const credentialsReady = identity === null ? logoutCredentialsReady : undefined;
    // Барьер учётных данных регистрируется до сброса: сброс поднимет активные
    // запросы на повторную загрузку, и каталог квестов не должен уехать за
    // данными раньше, чем сессия действительно закрыта.
    void refreshQuestsCatalogIdentity(client, isCurrentIdentity, credentialsReady);
    // #1829: чужой кэш не переживает смену владельца сессии. Вход тоже считается
    // сменой, если в этом процессе уже был вошедший пользователь: между сбросом
    // на выходе и входом следующего в кэш мог лечь ответ, стартовавший ещё со
    // старой сессией, и второй проход сброса его не снимет, если к тому моменту
    // личность сменилась. Холодный старт (первый вход в процессе) сбросом не
    // задет: там сбрасывать нечего, а восстановленный офлайн-персист
    // (`utils/queryPersist.ts`) он бы снёс и заставил перезапросить всё.
    const hadOwnerBefore = previousIdentity !== null || sessionHadIdentity;
    if (identity !== null) sessionHadIdentity = true;
    if (hadOwnerBefore) {
        void dropQueryCacheForIdentityChange(client, isCurrentIdentity, credentialsReady);
    }
});

export const resetAuthStoreForTests = () => {
    authEpoch = 0;
    sessionHadIdentity = false;
    useAuthStore.setState(INITIAL_AUTH_STATE);
};
