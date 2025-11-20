// src/utils/security.ts
// ✅ Утилиты для проверки безопасности

/**
 * Проверяет, является ли строка потенциально опасной (XSS)
 */
export function isPotentiallyDangerous(input: string): boolean {
    if (!input || typeof input !== 'string') {
        return false;
    }

    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick=, onerror= и т.д.
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /data:text\/html/i,
        /vbscript:/i,
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Санитизирует строку, удаляя потенциально опасные символы
 */
export function sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Удаляем опасные паттерны
    return input
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>.*?<\/object>/gi, '')
        .replace(/<embed[^>]*>/gi, '')
        .trim();
}

/**
 * Проверяет, является ли URL безопасным
 */
export function isSafeUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        const parsed = new URL(url);
        
        // Разрешаем только http и https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }

        // Проверяем на опасные протоколы в пути
        if (isPotentiallyDangerous(url)) {
            return false;
        }

        return true;
    } catch {
        // Если не удалось распарсить URL, считаем небезопасным
        return false;
    }
}

/**
 * Валидирует токен (базовая проверка формата)
 */
export function isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
        return false;
    }

    // Токен не должен быть пустым и не должен содержать опасные символы
    if (token.trim().length === 0) {
        return false;
    }

    if (isPotentiallyDangerous(token)) {
        return false;
    }

    // Базовая проверка длины (обычно токены достаточно длинные)
    if (token.length < 10) {
        return false;
    }

    return true;
}

/**
 * Проверяет, не истек ли токен (по времени, если есть информация)
 */
export function isTokenExpired(tokenData?: { expiresAt?: number | string }): boolean {
    if (!tokenData?.expiresAt) {
        return false; // Если нет информации о сроке, считаем валидным
    }

    const expiresAt = typeof tokenData.expiresAt === 'string'
        ? new Date(tokenData.expiresAt).getTime()
        : tokenData.expiresAt;

    return Date.now() >= expiresAt;
}

