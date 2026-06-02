// api/clientTypes.ts
// ✅ Извлечено из api/client.ts (TD-012, pure-move): типы и константы
// транзиентных upload-ретраев. Поведение не меняется.

export type DownloadResponse = {
    blob: Blob;
    filename?: string;
    contentType?: string;
};

export const TRANSIENT_UPLOAD_STATUSES = new Set([502, 503, 504]);
export const UPLOAD_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 350;
