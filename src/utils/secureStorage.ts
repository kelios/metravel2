// src/utils/secureStorage.ts
// ✅ Безопасное хранение токенов и чувствительных данных
// Использует SecureStore для native и зашифрованное хранилище для web

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Для web используем sessionStorage с базовым шифрованием
// Для native будем использовать expo-secure-store (требует установки)

const STORAGE_PREFIX = 'secure_';
const ENCRYPTION_KEY = 'metravel_encryption_key_v1'; // В production должен быть уникальным для каждого пользователя

/**
 * Простое шифрование для web (XOR шифрование - не для production безопасности, но лучше чем открытый текст)
 * В production рекомендуется использовать Web Crypto API или библиотеку типа crypto-js
 */
function simpleEncrypt(text: string, key: string): string {
  if (Platform.OS !== 'web') return text;
  
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
}

function simpleDecrypt(encrypted: string, key: string): string {
  if (Platform.OS !== 'web') return encrypted;
  
  try {
    const text = atob(encrypted); // Base64 decode
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
      // Для web используем localStorage с шифрованием (доступно во всех вкладках текущего домена)
      if (typeof window !== 'undefined' && window.localStorage) {
        const encrypted = simpleEncrypt(value, ENCRYPTION_KEY);
        window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, encrypted);
      } else {
        // Fallback на AsyncStorage с шифрованием
        const encrypted = simpleEncrypt(value, ENCRYPTION_KEY);
        await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, encrypted);
      }
    } else {
      // Для native используем SecureStore
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync(key, value);
      } catch (error) {
        // Если SecureStore не установлен, используем AsyncStorage с предупреждением
        if (__DEV__) {
          console.warn('expo-secure-store не установлен. Используется AsyncStorage (небезопасно для production)');
        }
        await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при сохранении в secure storage:', error);
    }
    throw error;
  }
}

/**
 * Безопасное получение значения
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const encrypted = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (!encrypted) return null;
        return simpleDecrypt(encrypted, ENCRYPTION_KEY);
      } else {
        // Fallback на AsyncStorage
        const encrypted = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (!encrypted) return null;
        return simpleDecrypt(encrypted, ENCRYPTION_KEY);
      }
    } else {
      // Для native используем SecureStore
      try {
        const SecureStore = require('expo-secure-store');
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        // Если SecureStore не установлен, используем AsyncStorage
        if (__DEV__) {
          console.warn('expo-secure-store не установлен. Используется AsyncStorage');
        }
        return await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при получении из secure storage:', error);
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
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      } else {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      }
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при удалении из secure storage:', error);
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

