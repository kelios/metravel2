// src/utils/storageBatch.ts
// ✅ FIX-004: Утилиты для батчинга операций AsyncStorage
// Оптимизирует производительность за счет группировки операций

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// On web AsyncStorage is backed by localStorage, which throws in iOS Safari
// Private mode. These values (userName/userId/avatar) are non-critical UI
// metadata, but setStorageBatch is awaited inside the login flow — letting it
// throw would fail an otherwise successful login. Keep a per-session in-memory
// fallback so writes never throw on web and reads still return the values.
const isWeb = (): boolean => Platform.OS === 'web';
const webMemoryBatch = new Map<string, string>();

/**
 * Получает несколько значений из AsyncStorage за один запрос
 * @param keys - Массив ключей для получения
 * @returns Объект с парами ключ-значение
 */
export async function getStorageBatch(keys: string[]): Promise<Record<string, string | null>> {
  if (!keys || keys.length === 0) {
    return {};
  }

  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, string | null> = {};
    pairs.forEach(([key, value]) => {
      result[key] = value ?? (isWeb() ? webMemoryBatch.get(key) ?? null : null);
    });
    return result;
  } catch (error) {
    if (__DEV__) {
      console.error('Error in getStorageBatch:', error);
    }
    // Fallback: in-memory values on web (private mode), null elsewhere.
    const result: Record<string, string | null> = {};
    keys.forEach(key => {
      result[key] = isWeb() ? webMemoryBatch.get(key) ?? null : null;
    });
    return result;
  }
}

/**
 * Сохраняет несколько значений в AsyncStorage за один запрос
 * @param items - Массив пар [ключ, значение]
 */
export async function setStorageBatch(items: Array<[string, string]>): Promise<void> {
  if (!items || items.length === 0) {
    return;
  }

  try {
    await AsyncStorage.multiSet(items);
    if (isWeb()) {
      items.forEach(([key]) => webMemoryBatch.delete(key));
    }
  } catch (error) {
    if (isWeb()) {
      // iOS Safari Private mode: persistent write blocked. Keep the values in
      // memory for this session rather than failing the caller (e.g. login).
      items.forEach(([key, value]) => webMemoryBatch.set(key, value));
      return;
    }
    if (__DEV__) {
      console.error('Error in setStorageBatch:', error);
    }
    throw error;
  }
}

/**
 * Удаляет несколько значений из AsyncStorage за один запрос
 * @param keys - Массив ключей для удаления
 */
export async function removeStorageBatch(keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) {
    return;
  }

  if (isWeb()) {
    keys.forEach(key => webMemoryBatch.delete(key));
  }
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    if (__DEV__) {
      console.error('Error in removeStorageBatch:', error);
    }
    // Не пробрасываем ошибку, так как удаление не критично
  }
}

/**
 * Получает все ключи из AsyncStorage
 * @returns Массив ключей
 */
export async function getAllStorageKeys(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return Array.isArray(keys) ? [...keys] : [];
  } catch (error) {
    if (__DEV__) {
      console.error('Error in getAllStorageKeys:', error);
    }
    return [];
  }
}

/**
 * Очищает все данные из AsyncStorage
 */
export async function clearAllStorage(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    if (__DEV__) {
      console.error('Error in clearAllStorage:', error);
    }
    throw error;
  }
}
