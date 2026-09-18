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

// Common NSURLError codes from NSURLError.h. Kept as a closed map so the
// technical line stays English and stable for App Review screenshots (#1943).
const NSURL_ERROR_NAME_BY_CODE: Record<number, string> = {
    [-998]: 'unknown',
    [-999]: 'cancelled',
    [-1000]: 'badURL',
    [-1001]: 'timedOut',
    [-1003]: 'cannotFindHost',
    [-1004]: 'cannotConnectToHost',
    [-1005]: 'networkConnectionLost',
    [-1009]: 'notConnectedToInternet',
    [-1018]: 'internationalRoamingOff',
    [-1020]: 'dataNotAllowed',
    [-1200]: 'secureConnectionFailed',
    [-1202]: 'serverCertificateUntrusted',
};

const NSURL_ERROR_CODE_BY_NAME: Record<string, number> = Object.fromEntries(
    Object.entries(NSURL_ERROR_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), Number(code)]),
) as Record<string, number>;

const REQUEST_ID_HEADER_KEYS = [
    'x-request-id',
    'x-correlation-id',
    'x-amzn-requestid',
    'request-id',
    'requestid',
] as const;

const readNumericCode = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
    return null;
};

const isNsUrlErrorCode = (code: number): boolean =>
    (code <= -1000 && code >= -2000) || code === -998 || code === -999;

const readHeaderValue = (headers: unknown, key: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as { get?: unknown }).get === 'function') {
        const value = (headers as { get: (name: string) => unknown }).get(key);
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    }
    if (typeof headers !== 'object') return null;
    const record = headers as Record<string, unknown>;
    const direct = record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const matched = Object.entries(record).find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (matched && typeof matched[1] === 'string' && matched[1].trim()) return matched[1].trim();
    return null;
};

const extractRequestId = (error: unknown): string | null => {
    const seen = new Set<unknown>();
    const visit = (value: unknown, depth: number): string | null => {
        if (value == null || depth > 4 || seen.has(value)) return null;
        if (typeof value !== 'object') return null;
        seen.add(value);
        const record = value as Record<string, unknown>;
        for (const key of ['requestId', 'request_id', 'correlationId']) {
            const candidate = record[key];
            if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
        }
        for (const headers of [record.headers, record.header, record.responseHeaders]) {
            for (const headerKey of REQUEST_ID_HEADER_KEYS) {
                const fromHeader = readHeaderValue(headers, headerKey);
                if (fromHeader) return fromHeader;
            }
        }
        const responseHeaders = (record.response as { headers?: unknown } | undefined)?.headers;
        for (const headerKey of REQUEST_ID_HEADER_KEYS) {
            const fromResponse = readHeaderValue(responseHeaders, headerKey);
            if (fromResponse) return fromResponse;
        }
        for (const nestedKey of ['cause', 'data', 'userInfo', 'nativeEvent', 'error', 'response']) {
            const nested = visit(record[nestedKey], depth + 1);
            if (nested) return nested;
        }
        return null;
    };
    return visit(error, 0);
};

const extractNsUrlErrorCode = (error: unknown): number | null => {
    const seen = new Set<unknown>();
    const visit = (value: unknown, depth: number): number | null => {
        if (value == null || depth > 4 || seen.has(value)) return null;
        if (typeof value === 'string') {
            const named = value.match(/NSURLError(?:Domain)?[^\d-]*(-?\d{3,5})/i);
            if (named) {
                const code = Number(named[1]);
                if (isNsUrlErrorCode(code)) return code;
            }
            const codeEquals = value.match(/\b(?:code|NSErrorCode)\s*[:=]\s*(-?\d{3,5})\b/i);
            if (codeEquals) {
                const code = Number(codeEquals[1]);
                if (isNsUrlErrorCode(code)) return code;
            }
            const byName = value.match(/NSURLError([A-Z][A-Za-z]+)/);
            if (byName) {
                const mapped = NSURL_ERROR_CODE_BY_NAME[byName[1].replace(/^URLError/i, '').toLowerCase()];
                if (typeof mapped === 'number') return mapped;
            }
            return null;
        }
        if (typeof value !== 'object') return null;
        seen.add(value);
        const record = value as Record<string, unknown>;
        const domain = String(record.domain ?? record.NSErrorDomain ?? record.errorDomain ?? '');
        for (const key of ['code', 'nativeCode', 'errorCode', 'NSErrorCode', 'nsurlErrorCode']) {
            const code = readNumericCode(record[key]);
            if (code == null) continue;
            if (isNsUrlErrorCode(code) || /nsurlerror/i.test(domain)) return code;
        }
        const symbolic = record.code ?? record.name ?? record.NSLocalizedFailureReason;
        if (typeof symbolic === 'string') {
            const normalized = symbolic.replace(/^NSURLError/i, '').replace(/^kCFURLError/i, '').toLowerCase();
            const mapped = NSURL_ERROR_CODE_BY_NAME[normalized];
            if (typeof mapped === 'number') return mapped;
        }
        if (record.message) {
            const fromMessage = visit(record.message, depth + 1);
            if (fromMessage != null) return fromMessage;
        }
        for (const nestedKey of ['cause', 'userInfo', 'nativeEvent', 'error', 'data', 'underlyingError', 'NSUnderlyingError']) {
            const nested = visit(record[nestedKey], depth + 1);
            if (nested != null) return nested;
        }
        return null;
    };
    return visit(error, 0);
};

export const describeNativeNetworkFailure = (error: unknown): string => {
    const host = extractFailureHost(error);
    const code = extractNsUrlErrorCode(error);
    const requestId = extractRequestId(error);
    const parts: string[] = [];
    if (code != null) {
        const name = NSURL_ERROR_NAME_BY_CODE[code] ?? `code${code}`;
        parts.push(`NSURLError ${code} (${name}) @ ${host}`);
    }
    if (requestId) {
        parts.push(`X-Request-ID ${requestId}`);
    }
    return parts.join(' · ');
};

// Единственное правило «это транспортный сбой, а не ответ сервера».
// #1944: по нему выбирают и текст (`utils/userFriendlyErrors.ts`), и причину
// отказа входа (`utils/authFailure.ts`), поэтому оно обязано быть ОДНО: две
// копии регулярки разошлись бы, и пользователь получил бы текст про связь с
// причиной `rejected` (или наоборот — «неверный пароль» при обрыве сети).
// Набор слов — ровно тот, по которому `getUserFriendlyError` и раньше выбирал
// ветку «нет связи»; «превышено время» сюда НЕ входит, у него свой текст ниже —
// причина отказа входа берёт таймаут через `isTransportFailure`.
const CONNECTION_MESSAGE_PATTERN = /network|fetch|connection|timeout/i;

// WebKit (Safari и любой iOS-браузер, то есть весь mobile web на iPhone) на
// офлайн-fetch бросает `TypeError: Load failed` — в нём нет ни одного слова из
// набора выше, поэтому обрыв связи молча уезжал в `unknown` и пользователь
// видел общий «Не удалось войти» вместо текста про подключение и тега (#1944).
// Проверяем ПАРУ «имя + текст»: голое имя `TypeError` дают и обычные баги кода,
// выдавать их за проблемы с интернетом нельзя.
const WEBKIT_OFFLINE_PATTERN = /load failed/i;

const readErrorName = (error: unknown): string =>
    String((error as { name?: unknown } | null)?.name ?? '').toLowerCase();

export const isConnectionFailure = (error: unknown): boolean => {
    if (!error) return false;
    if (error instanceof ApiError && (error.status === 0 || hasOfflineFlag(error.data))) return true;
    const message = readErrorMessage(error);
    if (CONNECTION_MESSAGE_PATTERN.test(message)) return true;
    return readErrorName(error) === 'typeerror' && WEBKIT_OFFLINE_PATTERN.test(message);
};

/**
 * Таймаут запроса. Отдельно от `isConnectionFailure`, потому что у таймаута свой
 * текст в `getUserFriendlyError`, и общий предикат менял бы копирайт всему
 * приложению. Опознаём по ИМЕНИ ошибки `fetchWithTimeout`, а не только по тексту:
 * текст локализован, и по нему таймаут считался транспортным сбоем лишь в EN,
 * а в RU/BE/UK/PL — «неизвестной ошибкой» (#1944).
 */
export const isTimeoutFailure = (error: unknown): boolean => {
    if (!error) return false;
    if (readErrorName(error) === 'timeouterror') return true;
    return /timeout|timed out|превышено время/i.test(readErrorMessage(error));
};

/** Любой сбой доставки запроса: связь не установлена ИЛИ ответ не пришёл вовремя. */
export const isTransportFailure = (error: unknown): boolean =>
    isConnectionFailure(error) || isTimeoutFailure(error);

/**
 * Короткий технический тег для сетевой ошибки: host · вид сбоя · время UTC.
 * #1943: отказ App Review 14.09.2026 «connection error» нельзя было разобрать —
 * в логах сервера не было ни одного запроса, а на скриншоте рецензента только
 * общий текст. Тег не переводится: это диагностический код, а не UI-копирайт.
 */
export const describeNetworkFailure = (error: unknown): string => {
    const message = readErrorMessage(error).toLowerCase();
    const name = readErrorName(error);
    let kind = 'network';
    if (isTimeoutFailure(error)) {
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

export const withFailureTag = (text: string, error: unknown): string => {
    const tagged = `${text} ${describeNetworkFailure(error)}`;
    const native = describeNativeNetworkFailure(error);
    return native ? `${tagged}\n${native}` : tagged;
};
