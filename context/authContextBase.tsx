import { createContext } from 'react';
import type { AuthStore } from '@/stores/authStore';

export type AuthContextType = AuthStore;

export const createAuthFallbackValue = (): AuthStore =>
  ({
    isAuthenticated: false,
    username: '',
    isSuperuser: false,
    userId: null,
    userAvatar: null,
    authReady: false,
    profileRefreshToken: 0,
    isPremium: false,
    setIsAuthenticated: () => {},
    setUsername: () => {},
    setIsSuperuser: () => {},
    setUserId: () => {},
    setUserAvatar: () => {},
    triggerProfileRefresh: () => {},
    invalidateAuthState: () => {},
    checkAuthentication: async () => {},
    login: async () => false,
    loginWithGoogle: async () => false,
    loginWithFacebook: async () => ({
      status: 'error',
      message: '',
    }),
    startFacebookEmailCompletion: async () => ({
      status: 'error',
      message: '',
    }),
    confirmFacebookEmailCompletion: async () => ({
      status: 'error',
      message: '',
    }),
    logout: async () => {},
    sendPassword: async () => '',
    setNewPassword: async () => false,
  }) as AuthStore;

const globalForAuthContext = globalThis as any;
export const AuthContext: ReturnType<typeof createContext<AuthContextType | undefined>> =
  globalForAuthContext.__metravelAuthContext ??
  createContext<AuthContextType | undefined>(undefined);
globalForAuthContext.__metravelAuthContext = AuthContext;
