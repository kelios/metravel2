import { createContext, FC, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {loginApi, logoutApi, resetPasswordLinkApi, setNewPasswordApi,} from '@/api/auth';
import { setAuthInvalidationHandler } from '@/api/client';
import { setSecureItem, getSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { fetchUserProfile } from '@/api/user';

interface AuthContextType {
    isAuthenticated: boolean;
    username: string;
    isSuperuser: boolean;
    userId: string | null;
    userAvatar: string | null;
    authReady: boolean;
    profileRefreshToken: number;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setUsername: (username: string) => void;
    setIsSuperuser: (isSuperuser: boolean) => void;
    setUserId: (id: string | null) => void;
    setUserAvatar: (avatar: string | null) => void;
    triggerProfileRefresh: () => void;
    logout: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    sendPassword: (email: string) => Promise<string>;
    setNewPassword: (token: string, newPassword: string) => Promise<boolean>;
}

interface AuthProviderProps {
    children: ReactNode;
}

const globalForAuthContext = globalThis as any;
const AuthContext: ReturnType<typeof createContext<AuthContextType | undefined>> =
    globalForAuthContext.__metravelAuthContext ?? createContext<AuthContextType | undefined>(undefined);
globalForAuthContext.__metravelAuthContext = AuthContext;

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
    // Вызов хуков (useState, useEffect) строго на верхнем уровне
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [isSuperuser, setIsSuperuser] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [profileRefreshToken, setProfileRefreshToken] = useState(0);

    // Guards against races where an in-flight auth check finishes after logout
    // and re-applies stale authenticated state.
    const authEpochRef = useRef(0);

    const invalidateAuthState = useCallback(() => {
        authEpochRef.current += 1;
        setIsAuthenticated(false);
        setUserId(null);
        setUsername('');
        setIsSuperuser(false);
        setUserAvatar(null);
        setAuthReady(true);

        Promise.resolve(removeStorageBatch(['userName', 'isSuperuser', 'userId', 'userAvatar'])).catch(() => undefined);
    }, []);

    const normalizeAvatar = (value: unknown): string | null => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const lower = raw.toLowerCase();
        if (lower === 'null' || lower === 'undefined') return null;
        return raw;
    };

    const checkAuthentication = useCallback(async () => {
        const epochAtStart = authEpochRef.current;
        try {
            // ✅ FIX-001: Используем безопасное хранилище для токена
            // ✅ FIX-004: Используем батчинг для остальных данных
            const [token, storageData] = await Promise.all([
                getSecureItem('userToken'),
                getStorageBatch(['userId', 'userName', 'isSuperuser', 'userAvatar']),
            ]);

            // If logout (or invalidation) happened while we were awaiting, ignore stale results.
            if (epochAtStart !== authEpochRef.current) {
                return;
            }

            // Если токена нет, считаем пользователя полностью разлогиненным,
            // даже если в AsyncStorage остались имя / userId.
            if (!token) {
                setIsAuthenticated(false);
                setUserId(null);
                setUsername('');
                setIsSuperuser(false);
                setUserAvatar(null);
                return;
            }

            setIsAuthenticated(true);
            setUserId(storageData.userId);
            setUsername(storageData.userName || '');
            setIsSuperuser(storageData.isSuperuser === 'true');
            setUserAvatar(normalizeAvatar(storageData.userAvatar));
        } catch (error) {
            // ✅ ИСПРАВЛЕНИЕ: Логируем ошибку и сбрасываем состояние при ошибке
            if (__DEV__) {
                console.error('Ошибка при проверке аутентификации:', error);
            }
            // Сбрасываем состояние при ошибке для предотвращения некорректного состояния
            setIsAuthenticated(false);
            setUserId(null);
            setUsername('');
            setIsSuperuser(false);
            setUserAvatar(null);
        } finally {
            if (epochAtStart === authEpochRef.current) {
                setAuthReady(true);
            }
        }
    }, []);

    // При первой загрузке проверяем данные аутентификации
    useEffect(() => {
        checkAuthentication();
    }, [checkAuthentication]);

    useEffect(() => {
        setAuthInvalidationHandler(invalidateAuthState);
        return () => {
            setAuthInvalidationHandler(null);
        };
    }, [invalidateAuthState]);

    const login = async (email: string, password: string): Promise<boolean> => {
        const epochAtStart = authEpochRef.current;
        try {
            const userData = await loginApi(email, password);
            if (userData) {
                if (epochAtStart !== authEpochRef.current) {
                    return false;
                }

                // Save token first so apiClient will include Authorization header for profile fetch.
                await setSecureItem('userToken', userData.token);

                let profile: any = null;
                try {
                    profile = await fetchUserProfile(String(userData.id));
                } catch (e) {
                    if (__DEV__) {
                        console.warn('Не удалось загрузить профиль пользователя:', e);
                    }
                }

                if (epochAtStart !== authEpochRef.current) {
                    return false;
                }

                const normalizedFirstName = String(profile?.first_name ?? '').trim();
                const displayName = normalizedFirstName || userData.name?.trim() || userData.email;
                const avatar = normalizeAvatar(profile?.avatar);

                // ✅ FIX-004: Используем батчинг для остальных данных
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

                if (epochAtStart !== authEpochRef.current) {
                    return false;
                }

                setIsAuthenticated(true);
                setUserId(String(userData.id));
                setUsername(displayName);
                setIsSuperuser(userData.is_superuser);
                setUserAvatar(avatar);
                setAuthReady(true);

                return true;
            }
            return false;
        } catch (error) {
            // ✅ ИСПРАВЛЕНИЕ: Логируем только в dev режиме
            if (__DEV__) {
                console.error('Ошибка входа:', error);
            }
            return false;
        }
    };

    const logout = async () => {
        // IMPORTANT: clear in-memory auth state immediately to prevent any
        // authenticated actions during an in-flight logoutApi request.
        invalidateAuthState();

        try {
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
    };

    const sendPassword = async (email: string): Promise<string> => {
        try {
            const response = await resetPasswordLinkApi(email);
            return typeof response === 'string'
                ? response
                : 'Что-то пошло не так. Попробуйте снова.';
        } catch (error) {
            // ✅ ИСПРАВЛЕНИЕ: Логируем только в dev режиме
            if (__DEV__) {
                console.error('Ошибка при сбросе пароля:', error);
            }
            return 'Произошла ошибка. Попробуйте ещё раз.';
        }
    };

    const setNewPassword = async (
        token: string,
        newPassword: string
    ): Promise<boolean> => {
        return await setNewPasswordApi(token, newPassword);
    };

    const triggerProfileRefresh = () => {
        setProfileRefreshToken((v) => v + 1);
    };

    // Отдаём контекстное значение во все дочерние компоненты
    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                username,
                isSuperuser,
                userId,
                userAvatar,
                authReady,
                profileRefreshToken,
                setIsAuthenticated,
                setUsername,
                setIsSuperuser,
                setUserId,
                setUserAvatar,
                triggerProfileRefresh,
                login,
                logout,
                sendPassword,
                setNewPassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Кастомный хук для удобного доступа к контексту
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
