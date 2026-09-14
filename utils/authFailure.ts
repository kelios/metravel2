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
 * #1946: классификация отказа входа по телу ответа.
 *
 * Бэкенд (`users/views.py`, action `login`) отдаёт на ЛЮБОЙ обычный отказ
 * `401 {"error": "Данные входа не корректные"}` и на неактивированный аккаунт —
 * `401 {"error": "Аккаунт не активирован. Воспользуйтесь ссылкой активации в
 * письме"}`. Машиночитаемого `error_code` в ответе нет (проверено read-only в
 * `../metravel-backend/users/views.py`), поэтому единственный доступный маркер —
 * сама строка. Отсюда правило: строка бэкенда НИКОГДА не показывается как есть,
 * она лишь ВЫБИРАЕТ собственный локализованный ключ приложения. Иначе в EN/BE/
 * UK/PL форма входа показывает русский текст сервера (App Review видел именно
 * это).
 *
 * Локализацию строки на стороне сервера (Accept-Language) оформляем отдельной
 * `area=back` задачей; до неё распознаём причину здесь.
 */
export type AuthRejectionCode = 'account_not_activated' | 'invalid_credentials';

/**
 * Маркеры неактивированного аккаунта. Русский — текущий ответ прода; английские
 * добавлены на случай локализации/смены формулировки на бэкенде, чтобы причина
 * не деградировала молча в «неверный пароль».
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

export const authRejectionCode = (detail?: string | null): AuthRejectionCode => {
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
