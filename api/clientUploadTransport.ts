import { ApiError } from '@/api/clientErrors';
import {
    TRANSIENT_UPLOAD_STATUSES,
    UPLOAD_IDLE_TIMEOUT_MS,
    UPLOAD_RETRY_DELAY_MS,
    UPLOAD_TRANSIENT_RETRIES,
} from '@/api/clientTypes';
import { translate as i18nT } from '@/i18n';
import { getApiRequestCredentials } from '@/utils/authPlatform';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

export const isTransientUploadStatus = (status: number): boolean =>
    TRANSIENT_UPLOAD_STATUSES.has(status);

const wait = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

export const fetchUploadWithTransientRetry = async (
    baseURL: string,
    endpoint: string,
    init: RequestInit,
    timeout: number,
    retries: number = UPLOAD_TRANSIENT_RETRIES
): Promise<Response> => {
    let attempt = 0;

    while (true) {
        const response = await fetchWithTimeout(
            `${baseURL}${endpoint}`,
            { ...init, ...getApiRequestCredentials() },
            timeout,
        );
        const shouldRetry =
            attempt < retries && !response.ok && isTransientUploadStatus(response.status);

        if (!shouldRetry) {
            return response;
        }

        attempt += 1;
        if (UPLOAD_RETRY_DELAY_MS > 0) {
            await wait(UPLOAD_RETRY_DELAY_MS);
        }
    }
};

/**
 * #2150: почему загрузка не состоялась — для интерфейса («Повторить») и для
 * аналитики (`quest_photo_upload_failed`), чтобы причина была видна без
 * серверных логов.
 * - `idle_timeout` — тело уходило, но число отправленных байт перестало расти;
 * - `response_timeout` — тело ушло целиком, ответа нет дольше серверного потолка;
 * - `network` — соединение оборвалось.
 */
export type UploadTransportFailure = 'idle_timeout' | 'response_timeout' | 'network';

export class UploadTransportError extends ApiError {
    constructor(public reason: UploadTransportFailure) {
        super(
            0,
            reason === 'network'
                ? i18nT('errorsStatic:api.client.uploadNetworkError')
                : i18nT('errorsStatic:api.client.uploadTimeout'),
        );
        this.name = 'UploadTransportError';
    }
}

export type XhrUploadRequest = {
    url: string;
    method: string;
    formData: FormData;
    headers: HeadersInit;
    withCredentials: boolean;
    /**
     * Потолок ожидания ОТВЕТА после того, как тело ушло целиком: сервер режет
     * кадр и пишет в S3 синхронно, nginx держит `/api/` 60 с.
     */
    responseTimeoutMs: number;
    idleTimeoutMs?: number;
    /** Доля отправленного тела, 0–1 (не проценты). */
    onProgress?: (fraction: number) => void;
};

export type XhrUploadResponse = {
    status: number;
    statusText: string;
    responseText: string;
};

/**
 * Одна XHR-попытка загрузки со сторожем простоя вместо таймаута на всю попытку.
 *
 * Таймаут на попытку целиком (`xhr.timeout`) при любом значении плох: либо рвёт
 * медленную, но живую загрузку, либо минутами ждёт мёртвую (#2150). Здесь три фазы:
 * 1. до первого события прогресса — общий потолок `responseTimeoutMs`: платформа,
 *    которая вовсе не шлёт `upload.onprogress`, не должна терять живые загрузки;
 * 2. пока тело уходит — сторож простоя: нет прироста байт за `idleTimeoutMs` → обрыв;
 * 3. тело ушло — ждём ответ до `responseTimeoutMs`.
 * Таймеры iOS Safari в фоновой вкладке стоят, но срабатывают при возврате — то
 * есть зависшая во сне загрузка превращается в «Не загрузилось» с повтором, а не
 * в бесконечное «Загружаем…».
 */
export const sendXhrUpload = (request: XhrUploadRequest): Promise<XhrUploadResponse> =>
    new Promise<XhrUploadResponse>((resolve, reject) => {
        const idleTimeoutMs = request.idleTimeoutMs ?? UPLOAD_IDLE_TIMEOUT_MS;
        const xhr = new XMLHttpRequest();
        let timer: ReturnType<typeof setTimeout> | null = null;
        let settled = false;
        let bodySent = false;
        let lastLoaded = -1;

        const clearTimer = () => {
            if (timer !== null) clearTimeout(timer);
            timer = null;
        };
        const fail = (reason: UploadTransportFailure) => {
            if (settled) return;
            settled = true;
            clearTimer();
            try {
                xhr.abort();
            } catch {
                // abort уже завершённого запроса не важен: исход зафиксирован.
            }
            reject(new UploadTransportError(reason));
        };
        const arm = (ms: number, reason: UploadTransportFailure) => {
            clearTimer();
            timer = setTimeout(() => fail(reason), ms);
        };
        const markBodySent = () => {
            if (bodySent || settled) return;
            bodySent = true;
            request.onProgress?.(1);
            arm(request.responseTimeoutMs, 'response_timeout');
        };

        xhr.open(request.method, request.url);
        xhr.withCredentials = request.withCredentials;
        for (const [headerKey, headerValue] of Object.entries(request.headers)) {
            if (typeof headerValue === 'string') xhr.setRequestHeader(headerKey, headerValue);
        }

        // Слушатель на `upload` вешается всегда, а не только при `onProgress`:
        // без него нет и сторожа простоя.
        xhr.upload.onprogress = (event) => {
            if (bodySent || settled) return;
            // Без известного размера тела нельзя узнать, что оно ушло целиком, —
            // сторож простоя тогда сработал бы во время серверной обработки.
            // Такая загрузка остаётся под общим потолком фазы 1.
            if (!event.lengthComputable || event.total <= 0) return;
            if (event.loaded > lastLoaded) {
                lastLoaded = event.loaded;
                arm(idleTimeoutMs, 'idle_timeout');
            }
            if (event.loaded >= event.total) {
                markBodySent();
            } else {
                request.onProgress?.(event.loaded / event.total);
            }
        };
        xhr.upload.onload = markBodySent;

        xhr.onload = () => {
            if (settled) return;
            settled = true;
            clearTimer();
            resolve({ status: xhr.status, statusText: xhr.statusText, responseText: xhr.responseText });
        };
        xhr.onerror = () => fail('network');
        xhr.onabort = () => fail('network');

        arm(request.responseTimeoutMs, 'response_timeout');
        xhr.send(request.formData);
    });

/** XHR-попытка с одним повтором на 502/503/504 — как у fetch-ветки. */
export const sendXhrUploadWithTransientRetry = async (
    request: XhrUploadRequest,
    retries: number = UPLOAD_TRANSIENT_RETRIES,
): Promise<XhrUploadResponse> => {
    let attempt = 0;
    while (true) {
        const response = await sendXhrUpload(request);
        if (attempt >= retries || !isTransientUploadStatus(response.status)) return response;
        attempt += 1;
        if (UPLOAD_RETRY_DELAY_MS > 0) await wait(UPLOAD_RETRY_DELAY_MS);
    }
};
