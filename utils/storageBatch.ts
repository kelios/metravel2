// src/utils/storageBatch.ts
// ✅ FIX-004: Утилиты для батчинга операций AsyncStorage
// Оптимизирует производительность за счет группировки операций

import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const values = await AsyncStorage.multiGet(keys);
    const result: Record<string, string | null> = {};
    
    values.forEach(([key, value]) => {
      result[key] = value;
    });
    
    return result;
  } catch (error) {
    if (__DEV__) {
      console.error('Error in getStorageBatch:', error);
    }
    // Fallback: возвращаем null для всех ключей при ошибке
    const result: Record<string, string | null> = {};
    keys.forEach(key => {
      result[key] = null;
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
  } catch (error) {
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
