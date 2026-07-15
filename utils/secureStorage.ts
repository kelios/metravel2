// src/utils/secureStorage.ts
// ✅ Безопасное хранение токенов и чувствительных данных
// Использует SecureStore для native и зашифрованное хранилище для web

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthTokenStorageKey } from '@/utils/authPlatform';
import { translate as i18nT } from '@/i18n'


// Web auth credentials are intentionally never stored here: web uses the
// backend-managed HttpOnly cookie. Other web-only sensitive preferences keep
// the legacy encrypted localStorage path until their own migration.

const STORAGE_PREFIX = 'secure_';
const ENCRYPTION_KEY = 'metravel_encryption_key_v1'; // В production должен быть уникальным для каждого пользователя

// Prefix marker to distinguish encrypted values from legacy plaintext.
// Without this, simpleDecrypt could accidentally XOR-decode a plaintext
// token that happens to be valid base64, producing a corrupted token
// that silently fails authentication on the backend.
const ENCRYPTED_PREFIX = 'enc1:';

// In-memory fallback for web environments where localStorage is unavailable:
// iOS Safari Private mode throws QuotaExceededError on setItem, and "Block All
// Cookies" makes even accessing window.localStorage throw a SecurityError.
// Without this, a storage-write failure turns a successful backend login into a
// "wrong password" error (login() catches the throw and returns false). The token
// must stay readable for the session so authenticated requests keep working —
// it just won't survive a page reload, which is acceptable in private mode.
const webMemoryStore = new Map<string, string>();

// Accessing window.localStorage can itself throw (SecurityError) when cookies are
// blocked, so the property read must be guarded — not just the setItem call.
function getWebLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function purgeLegacyWebAuthCredential(key: string): void {
  const fullKey = `${STORAGE_PREFIX}${key}`;
  webMemoryStore.delete(fullKey);
  const storage = getWebLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(fullKey);
  } catch {
    // Best-effort migration for privacy modes where storage access is blocked.
  }
}

/**
 * Простое шифрование для web (XOR шифрование - не для production безопасности, но лучше чем открытый текст)
 * В production рекомендуется использовать Web Crypto API или библиотеку типа crypto-js
 */
function simpleEncrypt(text: string, key: string): string {
  if (Platform.OS !== 'web') return text;
  
  // SSR/web-worker safety: btoa может отсутствовать
  if (typeof btoa !== 'function') {
    return text;
  }

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return ENCRYPTED_PREFIX + btoa(result); // Prefix + Base64 encode
}

function simpleDecrypt(encrypted: string, key: string): string {
  if (Platform.OS !== 'web') return encrypted;
  
  if (typeof atob !== 'function') {
    return '';
  }

  // Only attempt decryption if the value was encrypted by us (has prefix).
  // Legacy plaintext values (from older builds or SSR fallback) are returned as-is.
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    return encrypted;
  }

  try {
    const payload = encrypted.slice(ENCRYPTED_PREFIX.length);
    const text = atob(payload); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
}

/**
 * Безопасное сохранение значения
 * Для native: использует SecureStore (требует установки expo-secure-store)
 * Для web: использует sessionStorage с шифрованием
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (isAuthTokenStorageKey(key)) {
        purgeLegacyWebAuthCredential(key);
        return;
      }
      const fullKey = `${STORAGE_PREFIX}${key}`;
      const encrypted = simpleEncrypt(value, ENCRYPTION_KEY);
      const ls = getWebLocalStorage();
      if (ls) {
        try {
          ls.setItem(fullKey, encrypted);
          // Persisted successfully — drop any stale memory copy.
          webMemoryStore.delete(fullKey);
          return;
        } catch {
          // iOS Safari Private mode: localStorage write blocked. Fall through to
          // the in-memory store instead of failing the auth flow.
        }
      }
      webMemoryStore.set(fullKey, encrypted);
    } else {
      // Для native используем SecureStore
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync(key, value);
      } catch {
        if (!__DEV__) {
          throw new Error('SecureStore unavailable for production credential storage');
        }
        console.warn('expo-secure-store не установлен. Используется dev-only AsyncStorage fallback');
        await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
      }
    }
  } catch {
    if (__DEV__) {
      console.error('Ошибка при сохранении в secure storage:');
    }
    throw new Error(i18nT('shared:utils.secureStorage.oshibka_pri_sohranenii_v_secure_storage_d1fc71d2'));
  }
}

/**
 * Безопасное получение значения
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (isAuthTokenStorageKey(key)) {
        purgeLegacyWebAuthCredential(key);
        return null;
      }
      const fullKey = `${STORAGE_PREFIX}${key}`;
      const ls = getWebLocalStorage();
      let encrypted: string | null = null;
      if (ls) {
        try {
          encrypted = ls.getItem(fullKey);
        } catch {
          encrypted = null;
        }
      }
      // Fall back to the in-memory store for values written while persistent
      // storage was unavailable (iOS private mode).
      if (encrypted == null) {
        encrypted = webMemoryStore.get(fullKey) ?? null;
      }
      if (!encrypted) return null;
      const decrypted = simpleDecrypt(encrypted, ENCRYPTION_KEY);
      if (!decrypted) return null;
      // Re-encrypt legacy plaintext values so future reads use the safe path.
      if (ls && !encrypted.startsWith(ENCRYPTED_PREFIX) && typeof btoa === 'function') {
        try {
          const reEncrypted = simpleEncrypt(decrypted, ENCRYPTION_KEY);
          ls.setItem(fullKey, reEncrypted);
        } catch { /* best-effort migration */ }
      }
      return decrypted;
    } else {
      // Для native используем SecureStore
      try {
        const SecureStore = require('expo-secure-store');
        return await SecureStore.getItemAsync(key);
      } catch {
        if (!__DEV__) return null;
        console.warn('expo-secure-store не установлен. Используется dev-only AsyncStorage fallback');
        return await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
      }
    }
  } catch {
    if (__DEV__) {
      console.error('Ошибка при получении из secure storage:');
    }
    return null;
  }
}

/**
 * Удаление значения из безопасного хранилища
 */
export async function removeSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const fullKey = `${STORAGE_PREFIX}${key}`;
      webMemoryStore.delete(fullKey);
      const ls = getWebLocalStorage();
      if (ls) {
        try {
          ls.removeItem(fullKey);
        } catch { /* private mode: nothing persisted to remove */ }
      }
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.deleteItemAsync(key);
      } catch {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      }
    }
  } catch {
    if (__DEV__) {
      console.error('Ошибка при удалении из secure storage:');
    }
  }
}

/**
 * Удаление нескольких значений
 */
export async function removeSecureItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => removeSecureItem(key)));
}

/**
 * Проверка доступности безопасного хранилища
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        return SecureStore.isAvailableAsync ? await SecureStore.isAvailableAsync() : true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}
