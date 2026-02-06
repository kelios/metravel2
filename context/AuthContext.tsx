// context/AuthContext.tsx
// Тонкий фасад над stores/authStore.ts (Zustand).
// Сохраняет обратную совместимость: AuthProvider + useAuth() работают как раньше.
// Вся логика (login, logout, checkAuthentication, epoch guard) живёт в authStore.

import { createContext, FC, ReactNode, useContext, useEffect } from 'react';
import { setAuthInvalidationHandler } from '@/api/client';
import { useAuthStore, type AuthStore } from '@/stores/authStore';

type AuthContextType = AuthStore;

interface AuthProviderProps {
    children: ReactNode;
}

const globalForAuthContext = globalThis as any;
const AuthContext: ReturnType<typeof createContext<AuthContextType | undefined>> =
    globalForAuthContext.__metravelAuthContext ?? createContext<AuthContextType | undefined>(undefined);
globalForAuthContext.__metravelAuthContext = AuthContext;

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
    const store = useAuthStore();

    // При первой загрузке проверяем данные аутентификации
    useEffect(() => {
        store.checkAuthentication();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Регистрируем invalidation handler для api client (вызывается при 401)
    useEffect(() => {
        setAuthInvalidationHandler(store.invalidateAuthState);
        return () => {
            setAuthInvalidationHandler(null);
        };
    }, [store.invalidateAuthState]);

    return (
        <AuthContext.Provider value={store}>
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
