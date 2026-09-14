// utils/networkFailureTag.ts
// #1943: единственный источник диагностического тега сетевого сбоя.
// Лист-модуль: зависит только от `@/api/clientErrors` (класс ошибки) и
// `@/api/apiConfig` (хост API). Отдельный файл нужен потому, что тег обязан быть
// доступен обоим текстовым слоям — `utils/networkErrorHandler.ts` и
// `utils/userFriendlyErrors.ts` (через него говорят все три метода входа,
// `api/auth.ts` и `api/appleAuth.ts`), а тянуть в последний тяжёлый
// `@/api/client`/toast-граф ради одной строки нельзя.

import { ApiError } from '@/api/clientErrors';
import { API_BASE_URL } from '@/api/apiConfig';

export const hasOfflineFlag = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && (value as { offline?: unknown }).offline === true;

const readErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    const message = (error as { message?: unknown } | null)?.message;
    return typeof message === 'string' ? message : '';
};

const extractFailureHost = (error: unknown): string => {
    const inMessage = readErrorMessage(error).match(/https?:\/\/([^/\s'"]+)/);
    if (inMessage) return inMessage[1];
    try {
        return API_BASE_URL ? new URL(API_BASE_URL).host : 'api';
    } catch {
        return 'api';
    }
};

// Единственное правило «это транспортный сбой, а не ответ сервера».
// #1944: по нему выбирают и текст (`utils/userFriendlyErrors.ts`), и причину
// отказа входа (`utils/authFailure.ts`), поэтому оно обязано быть ОДНО: две
// копии регулярки разошлись бы, и пользователь получил бы текст про связь с
// причиной `rejected` (или наоборот — «неверный пароль» при обрыве сети).
// Набор слов — ровно тот, по которому `getUserFriendlyError` и раньше выбирал
// ветку «нет связи»; «превышено время» сюда НЕ входит, у него свой текст ниже.
const CONNECTION_MESSAGE_PATTERN = /network|fetch|connection|timeout/i;

export const isConnectionFailure = (error: unknown): boolean => {
    if (!error) return false;
    if (error instanceof ApiError && (error.status === 0 || hasOfflineFlag(error.data))) return true;
    return CONNECTION_MESSAGE_PATTERN.test(readErrorMessage(error));
};

/**
 * Короткий технический тег для сетевой ошибки: host · вид сбоя · время UTC.
 * #1943: отказ App Review 14.09.2026 «connection error» нельзя было разобрать —
 * в логах сервера не было ни одного запроса, а на скриншоте рецензента только
 * общий текст. Тег не переводится: это диагностический код, а не UI-копирайт.
 */
export const describeNetworkFailure = (error: unknown): string => {
    const message = readErrorMessage(error).toLowerCase();
    const name = String((error as { name?: unknown } | null)?.name ?? '').toLowerCase();
    let kind = 'network';
    if (name === 'timeouterror' || /timeout|timed out|превышено время/.test(message)) {
        const seconds = message.match(/(\d+)\s*ms/);
        kind = seconds ? `timeout-${Math.round(Number(seconds[1]) / 1000)}s` : 'timeout';
    } else if (name === 'aborterror') {
        kind = 'aborted';
    } else if (error instanceof ApiError && (error.status === 0 || hasOfflineFlag(error.data))) {
        kind = 'offline';
    } else if (/failed to fetch|network request failed|network error|прервано/.test(message) || name === 'typeerror') {
        kind = 'unreachable';
    }
    const time = new Date().toISOString().slice(11, 19) + 'Z';
    return `[${extractFailureHost(error)} · ${kind} · ${time}]`;
};

export const withFailureTag = (text: string, error: unknown): string =>
    `${text} ${describeNetworkFailure(error)}`;
