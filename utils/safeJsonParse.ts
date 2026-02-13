// src/utils/safeJsonParse.ts
// ✅ Утилита для безопасного парсинга JSON из Response

import { devError } from './logger';

/**
 * Безопасно парсит JSON из Response
 * @param response - Response объект
 * @param fallback - Значение по умолчанию при ошибке парсинга
 * @returns Распарсенный JSON или fallback
 */
export async function safeJsonParse<T = any>(
    response: Response,
    fallback?: T
): Promise<T> {
    try {
        const text = await response.text();
        
        // Проверяем, что ответ не пустой
        if (!text || text.trim() === '') {
            if (fallback !== undefined) {
                return fallback;
            }
            throw new Error('Пустой ответ от сервера');
        }

        try {
            const parsed = JSON.parse(text);
            // JSON.parse("null") returns null without throwing.
            // Return fallback so callers never receive null when they expect an array/object.
            if (parsed == null && fallback !== undefined) {
                return fallback;
            }
            return parsed as T;
        } catch (parseError) {
            if (__DEV__) {
                devError('Ошибка парсинга JSON:', {
                    status: response.status,
                    statusText: response.statusText,
                    text: text.substring(0, 200), // Первые 200 символов для отладки
                    error: parseError,
                });
            }
            
            if (fallback !== undefined) {
                return fallback;
            }
            
            throw new Error(`Не удалось прочитать ответ сервера. Статус: ${response.status}`);
        }
    } catch (error) {
        if (fallback !== undefined) {
            return fallback;
        }
        throw error;
    }
}

/**
 * Безопасно парсит JSON из строки
 * @param text - JSON строка
 * @param fallback - Значение по умолчанию при ошибке парсинга
 * @returns Распарсенный JSON или fallback
 */
export function safeJsonParseString<T = any>(
    text: string,
    fallback?: T
): T {
    try {
        if (!text || text.trim() === '') {
            if (fallback !== undefined) {
                return fallback;
            }
            throw new Error('Пустая строка для парсинга');
        }

        const parsed = JSON.parse(text);
        // JSON.parse("null") returns null without throwing.
        // Return fallback so callers never receive null when they expect an array/object.
        if (parsed == null && fallback !== undefined) {
            return fallback;
        }
        return parsed as T;
    } catch (error) {
        if (__DEV__) {
            devError('Ошибка парсинга JSON строки:', {
                text: text.substring(0, 200),
                error,
            });
        }
        
        if (fallback !== undefined) {
            return fallback;
        }
        
        throw new Error('Не удалось распарсить JSON строку');
    }
}

