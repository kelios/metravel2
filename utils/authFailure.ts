// utils/authFailure.ts
// #1944: единая таксономия отказа входа. До неё каждый метод входа терял причину:
// `api/auth.ts` показывал `Alert` и возвращал `null`, стор маппил `null` → `false`,
// а форма на любой `false` писала «Неверный email или пароль». При обрыве связи
// пользователь получал сразу два противоречивых сообщения (App Review 1.0.4).
//
// Лист-модуль: зависит только от текстовых утилит (`userFriendlyErrors`,
// `networkFailureTag`), поэтому его одинаково импортируют слой api, стор и формы.

import { isTransportFailure } from '@/utils/networkFailureTag';
import { getUserFriendlyError } from '@/utils/userFriendlyErrors';

/**
 * `network` — запрос до сервера не дошёл (нет связи, таймаут, отказ транспорта);
 * `rejected` — сервер ответил и отказал по сути запроса (401/403/400, пустое поле);
 * `server`   — сервер ответил ошибкой своей стороны (5xx/429);
 * `unknown`  — отказ без диагностики (гонка сессий, неожиданное исключение).
 */
export type AuthFailureReason = 'network' | 'rejected' | 'server' | 'unknown';

export type AuthFailure = {
    ok: false;
    reason: AuthFailureReason;
    message: string;
};

/** Результат метода входа в слое api: сессия либо причина отказа. */
export type AuthAttempt<TUser> = { ok: true; user: TUser } | AuthFailure;

/** Результат входа в сторе: успех без полезной нагрузки либо причина отказа. */
export type AuthOutcome = { ok: true } | AuthFailure;

/**
 * #2042: результат запроса ссылки сброса пароля. Успех и ошибку решает статус
 * ответа в слое api, а не текст: форма раньше угадывала ошибку регуляркой по
 * русским словам и в EN/BE/UK/PL красила отказ как успех.
 */
export type PasswordResetOutcome = { ok: true; message: string } | AuthFailure;

export const authFailure = (reason: AuthFailureReason, message: string): AuthFailure => ({
    ok: false,
    reason,
    message,
});

/**
 * Причина по HTTP-статусу ответа. Сервер ответил, значит связь есть: это либо
 * его собственная ошибка (5xx, 429 — можно повторить позже), либо отказ по сути.
 */
export const authFailureReasonFromStatus = (status: number): AuthFailureReason =>
    status >= 500 || status === 429 ? 'server' : 'rejected';

/**
 * Причина по пойманному исключению. Транспортный сбой получает дружелюбный текст
 * с диагностическим тегом (#1943), всё остальное — переданный fallback: сырой
 * технический текст исключения в форму входа не выводим.
 *
 * Транспорт — это и обрыв связи, и таймаут: запрос до ответа сервера не дошёл ни
 * в том, ни в другом случае, а раньше таймаут падал в `unknown` (и терял свой
 * текст «сервер не отвечает») на всех локалях, кроме английской.
 */
export const authFailureFromError = (error: unknown, fallbackMessage: string): AuthFailure =>
    isTransportFailure(error)
        ? authFailure('network', getUserFriendlyError(error))
        : authFailure('unknown', fallbackMessage);

/**
 * Текст отказа для формы входа/регистрации.
 *
 * #1944: единственный источник копирайта — слой api. Он уже различил случаи:
 * `network` несёт дружелюбный текст с диагностическим тегом (#1943), `server` —
 * текст про недоступность сервиса, `rejected` — текст про учётные данные.
 * Форма НЕ дописывает к ним ничего от себя: именно собственный текст формы
 * «Неверный email или пароль» поверх сетевого Alert и давал два противоречивых
 * сообщения сразу.
 *
 * `reason` выбирает запасной текст на случай пустого `message` (гонка сессий,
 * неожиданное исключение): про пароль можно писать ТОЛЬКО при `rejected`.
 */
export const authFailureText = (
    failure: AuthFailure,
    texts: { rejected: string; failed: string },
): string => failure.message.trim() || (failure.reason === 'rejected' ? texts.rejected : texts.failed);

/**
 * #1946 → #2042: классификация отказа входа по телу ответа.
 *
 * Бэкенд (`users/views.py`, action `login`, #1993) отвечает на отказ
 * `401 {"code": "invalid_credentials", "error": "Неверная почта или пароль"}`,
 * а на неактивированный аккаунт — только ПОСЛЕ проверки пароля —
 * `401 {"code": "account_not_activated", "error": "Аккаунт не активирован…"}`.
 * Причину выбирает машиночитаемый `code`; строка `error` рядом с ним в выборе не
 * участвует, даже если ей противоречит. Разбор текста — переходный fallback для
 * старого бэкенда без `code`.
 *
 * Правило #1946 не меняется: строка бэкенда НИКОГДА не показывается как есть,
 * она лишь ВЫБИРАЕТ собственный локализованный ключ приложения. Иначе в EN/BE/
 * UK/PL форма входа показывает русский текст сервера (App Review видел именно
 * это).
 */
export type AuthRejectionCode = 'account_not_activated' | 'invalid_credentials';

/**
 * Маркеры неактивированного аккаунта для ответа без `code`. Русский — прежний
 * ответ прода; английские добавлены на случай локализации/смены формулировки,
 * чтобы причина не деградировала молча в «неверный пароль».
 */
const ACCOUNT_NOT_ACTIVATED_MARKERS = [
    'не активирован',
    'не актываваны',
    'не активован',
    'nie jest aktywne',
    'not activated',
    'not active',
    'inactive',
];

export const authRejectionCode = ({
    code,
    detail,
}: {
    code?: string | null;
    detail?: string | null;
}): AuthRejectionCode => {
    const explicitCode = String(code ?? '').trim();
    if (explicitCode) {
        // Любой другой код (в том числе будущий) — обычный отказ: подсказку
        // активации даёт только явный `account_not_activated`.
        return explicitCode === 'account_not_activated' ? 'account_not_activated' : 'invalid_credentials';
    }
    const normalized = String(detail ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return 'invalid_credentials';
    return ACCOUNT_NOT_ACTIVATED_MARKERS.some((marker) => normalized.includes(marker))
        ? 'account_not_activated'
        : 'invalid_credentials';
};
