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
