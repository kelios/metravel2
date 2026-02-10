// context/AuthContext.tsx
// Тонкий фасад над stores/authStore.ts (Zustand).
// Сохраняет обратную совместимость: AuthProvider + useAuth() работают как раньше.
// Вся логика (login, logout, checkAuthentication, epoch guard) живёт в authStore.

import { createContext, FC, ReactNode, useContext, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { setAuthInvalidationHandler } from '@/api/client';
import { useAuthStore, type AuthStore } from '@/stores/authStore';
import { useShallow } from 'zustand/react/shallow';

type AuthContextType = AuthStore;

interface AuthProviderProps {
    children: ReactNode;
}

const globalForAuthContext = globalThis as any;
const AuthContext: ReturnType<typeof createContext<AuthContextType | undefined>> =
    globalForAuthContext.__metravelAuthContext ?? createContext<AuthContextType | undefined>(undefined);
globalForAuthContext.__metravelAuthContext = AuthContext;

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
    // Select only the stable action references needed for initialization.
    // State is NOT subscribed here — consumers pick their own slices via useAuth().
    const checkAuthentication = useAuthStore((s) => s.checkAuthentication);
    const invalidateAuthState = useAuthStore((s) => s.invalidateAuthState);

    // При первой загрузке проверяем данные аутентификации.
    // On web, defer to reduce TBT during initial render (AsyncStorage + API call).
    useEffect(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const id = (window as any).requestIdleCallback(() => checkAuthentication(), { timeout: 1500 });
            return () => { try { (window as any).cancelIdleCallback(id); } catch {} };
        }
        checkAuthentication();
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Регистрируем invalidation handler для api client (вызывается при 401)
    useEffect(() => {
        setAuthInvalidationHandler(invalidateAuthState);
        return () => {
            setAuthInvalidationHandler(null);
        };
    }, [invalidateAuthState]);

    // Cross-tab sync: when another tab updates/clears the token in localStorage,
    // re-check authentication so this tab doesn't use a stale or missing token.
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'secure_userToken') {
                if (!e.newValue) {
                    invalidateAuthState();
                } else {
                    checkAuthentication();
                }
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [checkAuthentication, invalidateAuthState]);

    // Provider value is a stable sentinel — useAuth reads directly from Zustand.
    const value = useMemo(() => ({} as AuthStore), []);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Кастомный хук для удобного доступа к контексту.
// Reads directly from Zustand with useShallow — only re-renders when
// the selected slice actually changes (shallow equality).
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return useAuthStore(
        useShallow((s) => s)
    );
};
