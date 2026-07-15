// utils/validation.ts
// ✅ АРХИТЕКТУРА: Единая система валидации форм
//
// yup-зависимость загружается через dynamic import только при первом
// обращении к схеме (на auth-страницах). Это держит ~30 KB gz yup вне
// initial-чанка __common.

import type { AnyObject, ObjectSchema } from 'yup'
import { getActiveLocale, translate as i18nT } from '@/i18n'


type YupModule = typeof import('yup')

let yupPromise: Promise<YupModule> | null = null
const getYup = (): Promise<YupModule> => {
    if (!yupPromise) {
        yupPromise = Promise.resolve(import('yup'))
    }
    return yupPromise
}

const memoize = <T extends AnyObject>(
    builder: (yup: YupModule) => ObjectSchema<T>,
): (() => Promise<ObjectSchema<T>>) => {
    let cached: ObjectSchema<T> | null = null
    let cachedLocale: string | null = null
    return async () => {
        const locale = getActiveLocale()
        if (cached && cachedLocale === locale) return cached
        const yup = await getYup()
        cached = builder(yup)
        cachedLocale = locale
        return cached
    }
}

/**
 * Схема валидации для регистрации
 */
export const registrationSchema = memoize((yup) =>
    yup.object({
        username: yup
            .string()
            .required(i18nT('errors:utils.validation.imya_polzovatelya_obyazatelno_b4a1a42e'))
            .min(3, i18nT('errors:utils.validation.imya_polzovatelya_dolzhno_soderzhat_minimum__889167f2'))
            .max(50, i18nT('errors:utils.validation.imya_polzovatelya_ne_dolzhno_prevyshat_50_si_3db6d059'))
            .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/, i18nT('errors:utils.validation.imya_polzovatelya_mozhet_soderzhat_tolko_buk_d945c53f')),
        email: yup
            .string()
            .required(i18nT('errors:utils.validation.email_obyazatelen_97bfc28f'))
            .email(i18nT('errors:utils.validation.vvedite_korrektnyy_email_adres_5fccc4cc'))
            .max(255, i18nT('errors:utils.validation.email_ne_dolzhen_prevyshat_255_simvolov_10b65efb')),
        password: yup
            .string()
            .required(i18nT('errors:utils.validation.parol_obyazatelen_77a3e968'))
            .min(8, i18nT('errors:utils.validation.parol_dolzhen_soderzhat_minimum_8_simvolov_bef147ab'))
            .matches(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                i18nT('errors:utils.validation.parol_dolzhen_soderzhat_hotya_by_odnu_zaglav_97ae916f'),
            ),
        confirmPassword: yup
            .string()
            .required(i18nT('errors:utils.validation.podtverzhdenie_parolya_obyazatelno_255d5bce'))
            .oneOf([yup.ref('password')], i18nT('errors:utils.validation.paroli_ne_sovpadayut_bb033315')),
    }),
)

/**
 * Схема валидации для входа
 */
export const loginSchema = memoize((yup) =>
    yup.object({
        email: yup
            .string()
            .trim()
            .required(i18nT('errors:utils.validation.email_obyazatelen_97bfc28f'))
            .email(i18nT('errors:utils.validation.vvedite_korrektnyy_email_adres_5fccc4cc')),
        password: yup
            .string()
            .trim()
            .required(i18nT('errors:utils.validation.parol_obyazatelen_77a3e968')),
    }),
)

/**
 * Схема валидации для восстановления пароля
 */
export const resetPasswordSchema = memoize((yup) =>
    yup.object({
        email: yup
            .string()
            .required(i18nT('errors:utils.validation.email_obyazatelen_97bfc28f'))
            .email(i18nT('errors:utils.validation.vvedite_korrektnyy_email_adres_5fccc4cc')),
    }),
)

/**
 * Схема валидации для установки нового пароля
 */
export const setNewPasswordSchema = memoize((yup) =>
    yup.object({
        password: yup
            .string()
            .required(i18nT('errors:utils.validation.parol_obyazatelen_77a3e968'))
            .min(8, i18nT('errors:utils.validation.parol_dolzhen_soderzhat_minimum_8_simvolov_bef147ab'))
            .matches(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                i18nT('errors:utils.validation.parol_dolzhen_soderzhat_hotya_by_odnu_zaglav_97ae916f'),
            ),
        confirmPassword: yup
            .string()
            .required(i18nT('errors:utils.validation.podtverzhdenie_parolya_obyazatelno_255d5bce'))
            .oneOf([yup.ref('password')], i18nT('errors:utils.validation.paroli_ne_sovpadayut_bb033315')),
    }),
)

/**
 * Схема валидации для путешествия
 */
export const travelSchema = memoize((yup) =>
    yup.object({
        name: yup
            .string()
            .required(i18nT('errors:utils.validation.nazvanie_puteshestviya_obyazatelno_1681d370'))
            .min(3, i18nT('errors:utils.validation.nazvanie_dolzhno_soderzhat_minimum_3_simvola_f0730182'))
            .max(200, i18nT('errors:utils.validation.nazvanie_ne_dolzhno_prevyshat_200_simvolov_14743d8d')),
        description: yup
            .string()
            .nullable()
            .max(10000, i18nT('errors:utils.validation.opisanie_ne_dolzhno_prevyshat_10000_simvolov_22c208f0')),
        recommendation: yup
            .string()
            .nullable()
            .max(5000, i18nT('errors:utils.validation.rekomendatsii_ne_dolzhny_prevyshat_5000_simv_08b1cd6b')),
        plus: yup
            .string()
            .nullable()
            .max(2000, i18nT('errors:utils.validation.plyusy_ne_dolzhny_prevyshat_2000_simvolov_8d780bfa')),
        minus: yup
            .string()
            .nullable()
            .max(2000, i18nT('errors:utils.validation.minusy_ne_dolzhny_prevyshat_2000_simvolov_73adc414')),
        year: yup
            .string()
            .nullable()
            .matches(/^\d{4}$/, i18nT('errors:utils.validation.god_dolzhen_byt_4_tsifry_naprimer_2024_b1171563'))
            .test('year-range', i18nT('errorsStatic:utils.validation.yearRange'), (value) => {
                if (!value) return true
                const year = parseInt(value, 10)
                const currentYear = new Date().getFullYear()
                return year >= 1900 && year <= currentYear
            }),
        number_days: yup
            .number()
            .nullable()
            .positive(i18nT('errors:utils.validation.kolichestvo_dney_dolzhno_byt_polozhitelnym_c_8d2e1b8b'))
            .integer(i18nT('errors:utils.validation.kolichestvo_dney_dolzhno_byt_tselym_chislom_12740644'))
            .max(365, i18nT('errors:utils.validation.kolichestvo_dney_ne_dolzhno_prevyshat_365_1380447b')),
        countries: yup
            .array()
            .of(yup.string().required())
            .min(1, i18nT('errors:utils.validation.vyberite_hotya_by_odnu_stranu_00f785b2')),
        categories: yup
            .array()
            .of(yup.string().required())
            .min(1, i18nT('errors:utils.validation.vyberite_hotya_by_odnu_kategoriyu_ff8a1918')),
        youtube_link: yup
            .string()
            .nullable()
            .url(i18nT('errors:utils.validation.vvedite_korrektnuyu_ssylku_na_youtube_84466a94'))
            .test('youtube-url', i18nT('errorsStatic:utils.validation.youtubeUrl'), (value) => {
                if (!value) return true
                return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(value)
            }),
    }),
)

/**
 * Схема валидации для обратной связи
 */
export const feedbackSchema = memoize((yup) =>
    yup.object({
        name: yup
            .string()
            .required(i18nT('errors:utils.validation.imya_obyazatelno_72603be5'))
            .min(2, i18nT('errors:utils.validation.imya_dolzhno_soderzhat_minimum_2_simvola_d6f55966'))
            .max(100, i18nT('errors:utils.validation.imya_ne_dolzhno_prevyshat_100_simvolov_307300d4')),
        email: yup
            .string()
            .required(i18nT('errors:utils.validation.email_obyazatelen_97bfc28f'))
            .email(i18nT('errors:utils.validation.vvedite_korrektnyy_email_adres_5fccc4cc')),
        message: yup
            .string()
            .required(i18nT('errors:utils.validation.soobschenie_obyazatelno_ab828924'))
            .min(10, i18nT('errors:utils.validation.soobschenie_dolzhno_soderzhat_minimum_10_sim_a3536a09'))
            .max(2000, i18nT('errors:utils.validation.soobschenie_ne_dolzhno_prevyshat_2000_simvol_11a2d111')),
    }),
)

/**
 * Вспомогательная функция для валидации email
 */
export const isValidEmail = async (email: string): Promise<boolean> => {
    try {
        const schema = await loginSchema()
        await schema.validateAt('email', { email })
        return true
    } catch {
        return false
    }
}

/**
 * Вспомогательная функция для валидации пароля
 */
export const isValidPassword = async (password: string): Promise<boolean> => {
    try {
        const schema = await registrationSchema()
        await schema.validateAt('password', { password })
        return true
    } catch {
        return false
    }
}

/**
 * Проверяет, соответствует ли пароль минимальным требованиям безопасности
 * (минимум 8 символов, хотя бы одна заглавная, одна строчная буква и одна цифра)
 */
export const meetsPasswordRequirements = (password: string): { valid: boolean; error?: string } => {
    if (!password || password.length === 0) {
        return { valid: false, error: i18nT('errors:utils.validation.parol_obyazatelen_77a3e968') }
    }

    if (password.length < 8) {
        return { valid: false, error: i18nT('errors:utils.validation.parol_dolzhen_soderzhat_minimum_8_simvolov_bef147ab') }
    }

    if (!/[a-zа-яё]/.test(password)) {
        return { valid: false, error: i18nT('errors:utils.validation.parol_dolzhen_soderzhat_hotya_by_odnu_stroch_3532d18f') }
    }

    if (!/[A-ZА-ЯЁ]/.test(password)) {
        return { valid: false, error: i18nT('errors:utils.validation.parol_dolzhen_soderzhat_hotya_by_odnu_zaglav_f7e2fb40') }
    }

    if (!/\d/.test(password)) {
        return { valid: false, error: i18nT('errors:utils.validation.parol_dolzhen_soderzhat_hotya_by_odnu_tsifru_654270f3') }
    }

    return { valid: true }
}
