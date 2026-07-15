import { translate as i18nT } from '@/i18n'
// src/utils/validation.ts
// ✅ Утилиты для валидации входных данных

/**
 * Валидирует длину сообщения для AI
 */
export function validateAIMessage(message: string): { valid: boolean; error?: string } {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: i18nT('errors:utils.aiValidation.soobschenie_ne_mozhet_byt_pustym_a0680076') };
    }

    const trimmed = message.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.soobschenie_ne_mozhet_byt_pustym_a0680076') };
    }

    if (trimmed.length > 5000) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.soobschenie_slishkom_dlinnoe_maksimum_5000_s_909bc09b') };
    }

    if (trimmed.length < 2) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.soobschenie_slishkom_korotkoe_minimum_2_simv_f0f3520c') };
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
        return { valid: false, error: i18nT('errors:utils.aiValidation.fayl_ne_vybran_384776df') };
    }

    if (file.size > MAX_SIZE_BYTES) {
        return { 
            valid: false, 
            error: i18nT('errors:utils.aiValidation.razmer_fayla_prevyshaet_value1_mb_vyberite_f_20cb5ac9', { value1: MAX_SIZE_MB })
        };
    }

    if (file.size === 0) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.fayl_pustoy_379d5164') };
    }

    // Проверяем тип файла
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (file.type && !validTypes.includes(file.type.toLowerCase())) {
        return { 
            valid: false, 
            error: i18nT('errors:utils.aiValidation.nepodderzhivaemyy_format_fayla_ispolzuyte_jp_dcbd69f2')
        };
    }

    return { valid: true };
}

/**
 * Валидирует email
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: i18nT('errors:utils.aiValidation.email_ne_mozhet_byt_pustym_5dcbc961') };
    }

    const trimmed = email.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.email_ne_mozhet_byt_pustym_5dcbc961') };
    }

    // Простая проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.nekorrektnyy_format_email_003922ee') };
    }

    if (trimmed.length > 254) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.email_slishkom_dlinnyy_def454c1') };
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
    fieldName: string = i18nT('errors:utils.aiValidation.pole_1bcb61d0')
): { valid: boolean; error?: string } {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: i18nT('errors:utils.aiValidation.value1_ne_mozhet_byt_pustym_dc157cff', { value1: fieldName }) };
    }

    const trimmed = text.trim();
    
    if (trimmed.length < minLength) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.value1_slishkom_korotkoe_minimum_value2_simv_888d2b30', { value1: fieldName, value2: minLength }) };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.value1_slishkom_dlinnoe_maksimum_value2_simv_c8402beb', { value1: fieldName, value2: maxLength }) };
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
            error: i18nT('errors:utils.aiValidation.fayl_slishkom_bolshoy_maksimalnyy_razmer_val_58c2ec47', { value1: maxSizeMB })
        };
    }
    if (fileSize === 0) {
        return {
            valid: false,
            error: i18nT('errors:utils.aiValidation.fayl_ne_mozhet_byt_pustym_708e02f0')
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
            error: i18nT('errors:utils.aiValidation.fayl_dolzhen_byt_izobrazheniem_bae34017')
        };
    }
    if (!allowedTypes.includes(mimeType)) {
        return {
            valid: false,
            error: i18nT('errors:utils.aiValidation.nepodderzhivaemyy_format_razresheny_value1_da4de07a', { value1: allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ') })
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
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_ne_mozhet_byt_pustym_96cd08c3') };
    }

    const trimmed = password.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_ne_mozhet_byt_pustym_96cd08c3') };
    }

    if (trimmed.length < 8) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_dolzhen_soderzhat_minimum_8_simvolov_0779f6c6') };
    }

    if (trimmed.length > 128) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_slishkom_dlinnyy_maksimum_128_simvolov_46169e7c') };
    }

    if (!/[a-zа-яё]/.test(trimmed)) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_dolzhen_soderzhat_hotya_by_odnu_stroch_601b6164') };
    }

    if (!/[A-ZА-ЯЁ]/.test(trimmed)) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_dolzhen_soderzhat_hotya_by_odnu_zaglav_91e76d1c') };
    }

    if (!/\d/.test(trimmed)) {
        return { valid: false, error: i18nT('errors:utils.aiValidation.parol_dolzhen_soderzhat_hotya_by_odnu_tsifru_d687db58') };
    }

    // Опционально: проверка на специальные символы (можно включить для большей безопасности)
    // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(trimmed)) {
    //     return { valid: false, error: 'Пароль должен содержать хотя бы один специальный символ' };
    // }

    return { valid: true };
}
