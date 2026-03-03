// hooks/useBiometricAuth.ts
// AND-17: Biometric authentication hook for Android/iOS.
// Provides fingerprint/face unlock after first successful login.
// On web — all methods are no-op.

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getSecureItem, setSecureItem, removeSecureItem } from '@/utils/secureStorage';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

interface BiometricAuthState {
  /** Whether biometric hardware is available on this device */
  isAvailable: boolean;
  /** Whether biometrics are enrolled (user has registered fingerprint/face) */
  isEnrolled: boolean;
  /** Whether the user has opted in to biometric login */
  isEnabled: boolean;
  /** Loading state during initial check */
  isChecking: boolean;
  /** Supported authentication types (fingerprint, face, iris) */
  supportedTypes: number[];
}

interface UseBiometricAuthReturn extends BiometricAuthState {
  /** Enable biometric auth for this device */
  enable: () => Promise<void>;
  /** Disable biometric auth */
  disable: () => Promise<void>;
  /** Prompt the user for biometric verification. Returns true if successful. */
  authenticate: (promptMessage?: string) => Promise<boolean>;
}

let LocalAuth: any = null;

if (Platform.OS !== 'web') {
  try {
    LocalAuth = require('expo-local-authentication');
  } catch {
    // expo-local-authentication not installed
  }
}

/**
 * AND-17: Hook for biometric authentication.
 *
 * Usage:
 * 1. After first login: check `isAvailable && isEnrolled && !isEnabled` → offer to enable
 * 2. On app launch with saved token: call `authenticate()` → if true, proceed; else show login
 * 3. In settings: toggle via `enable()` / `disable()`
 */
export function useBiometricAuth(): UseBiometricAuthReturn {
  const [state, setState] = useState<BiometricAuthState>({
    isAvailable: false,
    isEnrolled: false,
    isEnabled: false,
    isChecking: true,
    supportedTypes: [],
  });

  // Initial check — hardware + enrollment + saved preference
  useEffect(() => {
    if (Platform.OS === 'web' || !LocalAuth) {
      setState((prev) => ({ ...prev, isChecking: false }));
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const [hasHardware, isEnrolled, supportedTypes, enabledRaw] = await Promise.all([
          LocalAuth.hasHardwareAsync(),
          LocalAuth.isEnrolledAsync(),
          LocalAuth.supportedAuthenticationTypesAsync(),
          getSecureItem(BIOMETRIC_ENABLED_KEY),
        ]);

        if (cancelled) return;

        setState({
          isAvailable: Boolean(hasHardware),
          isEnrolled: Boolean(isEnrolled),
          isEnabled: enabledRaw === 'true',
          isChecking: false,
          supportedTypes: supportedTypes || [],
        });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isChecking: false }));
        }
      }
    };

    void check();
    return () => { cancelled = true; };
  }, []);

  const enable = useCallback(async () => {
    if (Platform.OS === 'web' || !LocalAuth) return;

    try {
      // Verify biometric before enabling (ensure user can actually use it)
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Подтвердите для включения биометрии',
        cancelLabel: 'Отмена',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await setSecureItem(BIOMETRIC_ENABLED_KEY, 'true');
        setState((prev) => ({ ...prev, isEnabled: true }));
      }
    } catch {
      // Authentication failed or cancelled
    }
  }, []);

  const disable = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      await removeSecureItem(BIOMETRIC_ENABLED_KEY);
      setState((prev) => ({ ...prev, isEnabled: false }));
    } catch {
      // noop
    }
  }, []);

  const authenticate = useCallback(async (
    promptMessage = 'Войдите с помощью биометрии',
  ): Promise<boolean> => {
    if (Platform.OS === 'web' || !LocalAuth) return false;

    try {
      const result = await LocalAuth.authenticateAsync({
        promptMessage,
        cancelLabel: 'Использовать пароль',
        disableDeviceFallback: false, // Allow PIN/pattern fallback
      });

      return Boolean(result.success);
    } catch {
      return false;
    }
  }, []);

  return {
    ...state,
    enable,
    disable,
    authenticate,
  };
}

