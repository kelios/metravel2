// src/utils/validation.ts
// ✅ Утилиты для валидации входных данных

/**
 * Валидирует длину сообщения для AI
 */
export function validateAIMessage(message: string): { valid: boolean; error?: string } {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: 'Сообщение не может быть пустым' };
    }

    const trimmed = message.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, error: 'Сообщение не может быть пустым' };
    }

    if (trimmed.length > 5000) {
        return { valid: false, error: 'Сообщение слишком длинное (максимум 5000 символов)' };
    }

    if (trimmed.length < 2) {
        return { valid: false, error: 'Сообщение слишком короткое (минимум 2 символа)' };
    }

    return { valid: true };
}

/**
 * Валидирует размер файла изображения
 */
export function validateImageFile(file: File | Blob): { valid: boolean; error?: string } {
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (!file) {
        return { valid: false, error: 'Файл не выбран' };
    }

    if (file.size > MAX_SIZE_BYTES) {
        return { 
            valid: false, 
            error: `Размер файла превышает ${MAX_SIZE_MB} МБ. Выберите файл меньшего размера.` 
        };
    }

    if (file.size === 0) {
        return { valid: false, error: 'Файл пустой' };
    }

    // Проверяем тип файла
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (file.type && !validTypes.includes(file.type.toLowerCase())) {
        return { 
            valid: false, 
            error: 'Неподдерживаемый формат файла. Используйте JPEG, PNG, WebP, GIF или HEIC.' 
        };
    }

    return { valid: true };
}

/**
 * Валидирует email
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email не может быть пустым' };
    }

    const trimmed = email.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, error: 'Email не может быть пустым' };
    }

    // Простая проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Некорректный формат email' };
    }

    if (trimmed.length > 254) {
        return { valid: false, error: 'Email слишком длинный' };
    }

    return { valid: true };
}

/**
 * Валидирует длину текстового поля
 */
export function validateTextLength(
    text: string, 
    minLength: number = 1, 
    maxLength: number = 10000,
    fieldName: string = 'Поле'
): { valid: boolean; error?: string } {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: `${fieldName} не может быть пустым` };
    }

    const trimmed = text.trim();
    
    if (trimmed.length < minLength) {
        return { valid: false, error: `${fieldName} слишком короткое (минимум ${minLength} символов)` };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, error: `${fieldName} слишком длинное (максимум ${maxLength} символов)` };
    }

    return { valid: true };
}

/**
 * Валидирует размер файла
 * @param fileSize - Размер файла в байтах
 * @param maxSizeMB - Максимальный размер в мегабайтах (по умолчанию 10MB)
 * @returns Объект с результатом валидации
 */
export function validateFileSize(fileSize: number, maxSizeMB: number = 10): { valid: boolean; error?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
        return {
            valid: false,
            error: `Файл слишком большой. Максимальный размер: ${maxSizeMB}MB`
        };
    }
    if (fileSize === 0) {
        return {
            valid: false,
            error: 'Файл не может быть пустым'
        };
    }
    return { valid: true };
}

/**
 * Валидирует тип файла изображения
 * @param mimeType - MIME тип файла
 * @param allowedTypes - Массив разрешенных типов (по умолчанию: image/jpeg, image/png, image/gif, image/webp)
 * @returns Объект с результатом валидации
 */
export function validateImageType(mimeType: string, allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']): { valid: boolean; error?: string } {
    if (!mimeType || !mimeType.startsWith('image/')) {
        return {
            valid: false,
            error: 'Файл должен быть изображением'
        };
    }
    if (!allowedTypes.includes(mimeType)) {
        return {
            valid: false,
            error: `Неподдерживаемый формат. Разрешены: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`
        };
    }
    return { valid: true };
}

/**
 * Валидирует пароль на соответствие требованиям безопасности
 * @param password - Пароль для валидации
 * @returns Объект с результатом валидации
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Пароль не может быть пустым' };
    }

    const trimmed = password.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, error: 'Пароль не может быть пустым' };
    }

    if (trimmed.length < 8) {
        return { valid: false, error: 'Пароль должен содержать минимум 8 символов' };
    }

    if (trimmed.length > 128) {
        return { valid: false, error: 'Пароль слишком длинный (максимум 128 символов)' };
    }

    if (!/[a-zа-яё]/.test(trimmed)) {
        return { valid: false, error: 'Пароль должен содержать хотя бы одну строчную букву' };
    }

    if (!/[A-ZА-ЯЁ]/.test(trimmed)) {
        return { valid: false, error: 'Пароль должен содержать хотя бы одну заглавную букву' };
    }

    if (!/\d/.test(trimmed)) {
        return { valid: false, error: 'Пароль должен содержать хотя бы одну цифру' };
    }

    // Опционально: проверка на специальные символы (можно включить для большей безопасности)
    // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(trimmed)) {
    //     return { valid: false, error: 'Пароль должен содержать хотя бы один специальный символ' };
    // }

    return { valid: true };
}

