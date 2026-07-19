import { createContext } from 'react';
// Из лист-модуля, а не из тяжёлого `authStore`: value-импорт store сюда создавал
// цикл импорта (ломал TDZ в других модулях при инициализации). (FE-ARCH P3)
import { INITIAL_AUTH_STATE, type AuthStore } from '@/stores/authState';

export type AuthContextType = AuthStore;

// Состояние берём из единого INITIAL_AUTH_STATE (новое поле AuthState автоматически
// попадает сюда — не нужно править fallback отдельно). No-op экшены перечислены явно
// и БЕЗ `as AuthStore`: если в AuthActions добавят экшен, TS упадёт здесь, а не молча
// пропустит дыру в типах. (FE-ARCH P3)
export const createAuthFallbackValue = (): AuthStore => ({
  ...INITIAL_AUTH_STATE,
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
  loginWithFacebook: async () => ({ status: 'error', message: '' }),
  startFacebookEmailCompletion: async () => ({ status: 'error', message: '' }),
  confirmFacebookEmailCompletion: async () => ({ status: 'error', message: '' }),
  logout: async () => {},
  sendPassword: async () => '',
  setNewPassword: async () => false,
});

const globalForAuthContext = globalThis as any;
export const AuthContext: ReturnType<typeof createContext<AuthContextType | undefined>> =
  globalForAuthContext.__metravelAuthContext ??
  createContext<AuthContextType | undefined>(undefined);
globalForAuthContext.__metravelAuthContext = AuthContext;
