// utils/validation.ts
// ✅ АРХИТЕКТУРА: Единая система валидации форм

import * as yup from 'yup';

/**
 * Схема валидации для регистрации
 */
export const registrationSchema = yup.object({
    username: yup
        .string()
        .required('Имя пользователя обязательно')
        .min(3, 'Имя пользователя должно содержать минимум 3 символа')
        .max(50, 'Имя пользователя не должно превышать 50 символов')
        .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/, 'Имя пользователя может содержать только буквы, цифры и подчеркивание'),
    email: yup
        .string()
        .required('Email обязателен')
        .email('Введите корректный email адрес')
        .max(255, 'Email не должен превышать 255 символов'),
    password: yup
        .string()
        .required('Пароль обязателен')
        .min(8, 'Пароль должен содержать минимум 8 символов')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру'
        ),
    confirmPassword: yup
        .string()
        .required('Подтверждение пароля обязательно')
        .oneOf([yup.ref('password')], 'Пароли не совпадают'),
});

/**
 * Схема валидации для входа
 */
export const loginSchema = yup.object({
    email: yup
        .string()
        .trim()
        .required('Email обязателен')
        .email('Введите корректный email адрес'),
    password: yup
        .string()
        .trim()
        .required('Пароль обязателен'),
});

/**
 * Схема валидации для восстановления пароля
 */
export const resetPasswordSchema = yup.object({
    email: yup
        .string()
        .required('Email обязателен')
        .email('Введите корректный email адрес'),
});

/**
 * Схема валидации для установки нового пароля
 */
export const setNewPasswordSchema = yup.object({
    password: yup
        .string()
        .required('Пароль обязателен')
        .min(8, 'Пароль должен содержать минимум 8 символов')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру'
        ),
    confirmPassword: yup
        .string()
        .required('Подтверждение пароля обязательно')
        .oneOf([yup.ref('password')], 'Пароли не совпадают'),
});

/**
 * Схема валидации для путешествия
 */
export const travelSchema = yup.object({
    name: yup
        .string()
        .required('Название путешествия обязательно')
        .min(3, 'Название должно содержать минимум 3 символа')
        .max(200, 'Название не должно превышать 200 символов'),
    description: yup
        .string()
        .nullable()
        .max(10000, 'Описание не должно превышать 10000 символов'),
    recommendation: yup
        .string()
        .nullable()
        .max(5000, 'Рекомендации не должны превышать 5000 символов'),
    plus: yup
        .string()
        .nullable()
        .max(2000, 'Плюсы не должны превышать 2000 символов'),
    minus: yup
        .string()
        .nullable()
        .max(2000, 'Минусы не должны превышать 2000 символов'),
    year: yup
        .string()
        .nullable()
        .matches(/^\d{4}$/, 'Год должен быть 4 цифры (например, 2024)')
        .test('year-range', 'Год должен быть между 1900 и текущим годом', (value) => {
            if (!value) return true;
            const year = parseInt(value, 10);
            const currentYear = new Date().getFullYear();
            return year >= 1900 && year <= currentYear;
        }),
    number_days: yup
        .number()
        .nullable()
        .positive('Количество дней должно быть положительным числом')
        .integer('Количество дней должно быть целым числом')
        .max(365, 'Количество дней не должно превышать 365'),
    countries: yup
        .array()
        .of(yup.string().required())
        .min(1, 'Выберите хотя бы одну страну'),
    categories: yup
        .array()
        .of(yup.string().required())
        .min(1, 'Выберите хотя бы одну категорию'),
    youtube_link: yup
        .string()
        .nullable()
        .url('Введите корректную ссылку на YouTube')
        .test('youtube-url', 'Ссылка должна быть на YouTube', (value) => {
            if (!value) return true;
            return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(value);
        }),
});

/**
 * Схема валидации для обратной связи
 */
export const feedbackSchema = yup.object({
    name: yup
        .string()
        .required('Имя обязательно')
        .min(2, 'Имя должно содержать минимум 2 символа')
        .max(100, 'Имя не должно превышать 100 символов'),
    email: yup
        .string()
        .required('Email обязателен')
        .email('Введите корректный email адрес'),
    message: yup
        .string()
        .required('Сообщение обязательно')
        .min(10, 'Сообщение должно содержать минимум 10 символов')
        .max(2000, 'Сообщение не должно превышать 2000 символов'),
});

/**
 * Вспомогательная функция для валидации email
 */
export const isValidEmail = async (email: string): Promise<boolean> => {
    try {
        await loginSchema.validateAt('email', { email });
        return true;
    } catch {
        return false;
    }
};

/**
 * Вспомогательная функция для валидации пароля
 */
export const isValidPassword = async (password: string): Promise<boolean> => {
    try {
        await registrationSchema.validateAt('password', { password });
        return true;
    } catch {
        return false;
    }
};

/**
 * Проверяет, соответствует ли пароль минимальным требованиям безопасности
 * (минимум 8 символов, хотя бы одна заглавная, одна строчная буква и одна цифра)
 */
export const meetsPasswordRequirements = (password: string): { valid: boolean; error?: string } => {
    if (!password || password.length === 0) {
        return { valid: false, error: 'Пароль обязателен' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Пароль должен содержать минимум 8 символов' };
    }

    if (!/[a-zа-яё]/.test(password)) {
        return { valid: false, error: 'Пароль должен содержать хотя бы одну строчную букву' };
    }

    if (!/[A-ZА-ЯЁ]/.test(password)) {
        return { valid: false, error: 'Пароль должен содержать хотя бы одну заглавную букву' };
    }

    if (!/\d/.test(password)) {
        return { valid: false, error: 'Пароль должен содержать хотя бы одну цифру' };
    }

    return { valid: true };
};

