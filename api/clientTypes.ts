// api/clientTypes.ts
// ✅ Извлечено из api/client.ts (TD-012, pure-move): типы и константы
// транзиентных upload-ретраев. Поведение не меняется.

export type DownloadResponse = {
    blob: Blob;
    /** Native сохраняет бинарный ответ без промежуточного UTF-8 decode/encode. */
    bytes?: ArrayBuffer;
    filename?: string;
    contentType?: string;
};

export const TRANSIENT_UPLOAD_STATUSES = new Set([502, 503, 504]);
export const UPLOAD_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 350;

// #2150: повтор загрузки на 502/503/504 — ровно один. XHR-ветка раньше повторяла
// рекурсивно без счётчика, и стойкий 503 превращался в бесконечную серию.
export const UPLOAD_TRANSIENT_RETRIES = 1;

// #2150: сторож простоя загрузки. Прод 03.10.2026: полный цикл одного фото отзыва
// (отправка тела + обработка сервером) занял не больше 8,4 с, а на Fast 3G события
// прогресса приходят чаще раза в секунду. 20 с без единого нового отправленного
// байта — мёртвое соединение (или вкладку усыпил iOS Safari) с запасом больше
// чем вдвое. Живую, но медленную загрузку этот сторож не рвёт: он считает простой,
// а не длительность попытки.
export const UPLOAD_IDLE_TIMEOUT_MS = 20_000;

export const parseDownloadFilename = (
    contentDisposition: string | null
): string | undefined => {
    if (!contentDisposition) return undefined;
    const v = String(contentDisposition);
    const utf8 = v.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8?.[1]) {
        try {
            return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
        } catch {
            return utf8[1].trim().replace(/^"|"$/g, '');
        }
    }
    const plain = v.match(/filename=([^;]+)/i);
    if (plain?.[1]) {
        return plain[1].trim().replace(/^"|"$/g, '');
    }
    return undefined;
};
