import React, {createContext, FC, ReactNode, useContext, useEffect, useState,} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loginApi, logoutApi, resetPasswordLinkApi, setNewPasswordApi,} from '@/src/api/auth';
import { setSecureItem, getSecureItem, removeSecureItems } from '@/src/utils/secureStorage';
import { getStorageBatch, setStorageBatch, removeStorageBatch } from '@/src/utils/storageBatch';

interface AuthContextType {
    isAuthenticated: boolean;
    username: string;
    isSuperuser: boolean;
    userId: string | null;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setUsername: (username: string) => void;
    setIsSuperuser: (isSuperuser: boolean) => void;
    setUserId: (id: string | null) => void;
    logout: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    sendPassword: (email: string) => Promise<string>;
    setNewPassword: (token: string, newPassword: string) => Promise<boolean>;
}

interface AuthProviderProps {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
    // Вызов хуков (useState, useEffect) строго на верхнем уровне
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [isSuperuser, setIsSuperuser] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // При первой загрузке проверяем данные аутентификации
    useEffect(() => {
        checkAuthentication();
    }, []);

    // Функции, не содержащие хуков
    const checkAuthentication = async () => {
        try {
            // ✅ FIX-001: Используем безопасное хранилище для токена
            // ✅ FIX-004: Используем батчинг для остальных данных
            const [token, storageData] = await Promise.all([
                getSecureItem('userToken'),
                getStorageBatch(['userId', 'userName', 'isSuperuser']),
            ]);

            // Если токена нет, считаем пользователя полностью разлогиненным,
            // даже если в AsyncStorage остались имя / userId.
            if (!token) {
                setIsAuthenticated(false);
                setUserId(null);
                setUsername('');
                setIsSuperuser(false);
                return;
            }

            setIsAuthenticated(true);
            setUserId(storageData.userId);
            setUsername(storageData.userName || '');
            setIsSuperuser(storageData.isSuperuser === 'true');
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
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const userData = await loginApi(email, password);
            if (userData) {
                // ✅ FIX-001: Токен сохраняем в безопасное хранилище
                // ✅ FIX-004: Используем батчинг для остальных данных
                await Promise.all([
                    setSecureItem('userToken', userData.token),
                    setStorageBatch([
                        ['userId', String(userData.id)],
                        ['userName', userData.name?.trim() || userData.email],
                        ['isSuperuser', userData.is_superuser ? 'true' : 'false'],
                    ]),
                ]);

                setIsAuthenticated(true);
                setUserId(String(userData.id));
                setUsername(userData.name?.trim() || userData.email);
                setIsSuperuser(userData.is_superuser);

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
        try {
            // Всегда удаляем локальные данные, даже если api не сработал
            await logoutApi();
        } catch (e) {
            // ✅ ИСПРАВЛЕНИЕ: Логируем только в dev режиме
            if (__DEV__) {
                console.warn('Ошибка при логауте с сервера:', e);
            }
        } finally {
            // ✅ FIX-001: Удаляем токен из безопасного хранилища
            // ✅ FIX-004: Используем батчинг для удаления остальных данных
            await Promise.all([
                removeSecureItems(['userToken', 'refreshToken']),
                removeStorageBatch(['userName', 'isSuperuser', 'userId']),
            ]);
            setIsAuthenticated(false);
            setUserId(null);
            setUsername('');
            setIsSuperuser(false);
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

    // Отдаём контекстное значение во все дочерние компоненты
    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                username,
                isSuperuser,
                userId,
                setIsAuthenticated,
                setUsername,
                setIsSuperuser,
                setUserId,
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
