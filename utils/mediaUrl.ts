export const isPrivateOrLocalHost = (host: string): boolean => {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '127.0.0.1') return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return false;
};

const shouldUpgradeAbsoluteUrlToHttps = (parsed: URL): boolean => {
  const host = String(parsed.hostname || '').trim().toLowerCase();
  if (!host || isPrivateOrLocalHost(host)) return false;
  if (host === 'metravel.by' || host.endsWith('.metravel.by')) return true;

  try {
    if (
      typeof window !== 'undefined' &&
      window.location?.protocol === 'https:' &&
      window.location.hostname &&
      host === String(window.location.hostname).trim().toLowerCase()
    ) {
      return true;
    }
  } catch {
    // noop
  }

  try {
    const apiBase = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (!apiBase) return false;
    const apiUrl = new URL(apiBase);
    return apiUrl.protocol === 'https:' && host === String(apiUrl.hostname || '').trim().toLowerCase();
  } catch {
    return false;
  }
};

export const normalizeAbsoluteMediaUrl = (url: string): string => {
  let result = url.trim();
  const lower = result.toLowerCase();
  let didFixDoubleHost = false;

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    const secondHttp = lower.indexOf('http://', 1);
    const secondHttps = lower.indexOf('https://', 1);
    const secondProtocolIndex = [secondHttp, secondHttps]
      .filter((index) => index > 0)
      .sort((a, b) => a - b)[0];

    if (typeof secondProtocolIndex === 'number') {
      const protocolEnd = lower.indexOf('://') + 3;
      const firstSlashAfterHost = lower.indexOf('/', protocolEnd);
      if (firstSlashAfterHost === -1 || secondProtocolIndex < firstSlashAfterHost) {
        result = result.slice(secondProtocolIndex);
        didFixDoubleHost = true;
      }
    }
  }

  if (didFixDoubleHost && result.includes('.s3.amazonaws.com/') && result.includes('X-Amz-Signature=')) {
    const urlObj = new URL(result);
    urlObj.searchParams.delete('X-Amz-Algorithm');
    urlObj.searchParams.delete('X-Amz-Credential');
    urlObj.searchParams.delete('X-Amz-Date');
    urlObj.searchParams.delete('X-Amz-Expires');
    urlObj.searchParams.delete('X-Amz-SignedHeaders');
    urlObj.searchParams.delete('X-Amz-Signature');
    result = urlObj.toString();
  }

  if (/^http:\/\//i.test(result)) {
    try {
      const parsed = new URL(result);
      if (shouldUpgradeAbsoluteUrlToHttps(parsed)) {
        parsed.protocol = 'https:';
        result = parsed.toString();
      }
    } catch {
      return result;
    }
  }

  return result;
};

export const normalizeMediaUrl = (url?: string | null): string => {
  if (!url || !String(url).trim()) return '';
  const safeUrl = normalizeAbsoluteMediaUrl(String(url).trim());

  // Data/blob stay as-is
  if (/^(data:|blob:)/i.test(safeUrl)) return safeUrl;

  const baseRaw =
    process.env.EXPO_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const hostWithoutApi = baseRaw.replace(/\/+$/, '').replace(/\/api$/i, '');
  const prefix = hostWithoutApi || baseRaw.replace(/\/+$/, '');

  // Backend serializers can accidentally expose their private media origin.
  // Route those paths through the configured public/API origin instead of
  // asking the browser to reach a LAN address directly.
  if (/^https?:\/\//i.test(safeUrl)) {
    try {
      const sourceUrl = new URL(safeUrl);
      if (prefix && isPrivateOrLocalHost(sourceUrl.hostname)) {
        const targetOrigin = new URL(prefix).origin;
        if (targetOrigin && targetOrigin !== sourceUrl.origin) {
          return new URL(
            `${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`,
            `${targetOrigin}/`,
          ).toString();
        }
      }
    } catch {
      return safeUrl;
    }
    return safeUrl;
  }

  // Relative URLs: prefix with backend host (without /api)

  if (prefix) {
    return `${prefix}${safeUrl.startsWith('/') ? '' : '/'}${safeUrl}`;
  }

  return safeUrl;
};

// Legacy-ключи бакета обслуживает первопартийный `/media-resize/…`: в
// `GET /api/media/proxy-contract` (v4) это `route_behavior.legacy_upload`
// (`/media-resize/uploads/`, класс `uploads/**`) и `legacy_conversion`
// (`/media-resize/legacy/`, класс `**/conversions/**`). Оба объявлены
// `default_mode: transform`, то есть режут по той же лестнице ширин.
//
// Пока в телах статей лежат прямые ссылки на бакет, картинка приезжает мастером
// мимо лестницы (замер 2026-08-02: `uploads/1591620319350_original.jpg` — 141 354 B
// с S3 против 7 820 B на `?w=320`) и держит открытым анонимный `s3:GetObject`
// (#1176, #1172, #1187).
//
// Классы без legacy-роута сюда не попадают намеренно: `**/responsive-images/**`
// удалён целиком в #1157, а плоский корень бакета живёт под family-роутами.
const LEGACY_STORAGE_BUCKET = 'metravelprod';
const S3_VIRTUAL_HOST = /^([a-z0-9.-]+)\.s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/i;
const S3_PATH_STYLE_HOST = /^s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/i;

/** Ключ объекта в нашем бакете, если URL ведёт именно туда. */
const extractLegacyStorageKey = (parsed: URL): string | null => {
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/^\/+/, '');
  if (!path) return null;

  const virtualHost = host.match(S3_VIRTUAL_HOST);
  if (virtualHost && virtualHost[1].toLowerCase() === LEGACY_STORAGE_BUCKET) return path;

  if (S3_PATH_STYLE_HOST.test(host)) {
    const [bucket, ...rest] = path.split('/');
    if (bucket.toLowerCase() === LEGACY_STORAGE_BUCKET && rest.length) return rest.join('/');
  }

  return null;
};

/**
 * Путь нашего legacy-роута для прямой ссылки на бакет, иначе `null`.
 *
 * Возвращается именно путь, а не абсолютный URL: origin у вызывающих модулей
 * разный (`imageProxy` берёт его из `EXPO_PUBLIC_API_URL`, трансформация тела
 * статьи — из первопартийного хоста), и склеивание origin в одном месте
 * ломало бы одну из двух веток.
 */
export const toLegacyResizePath = (url: string): string | null => {
  const value = String(url || '').trim();
  if (!value || /^(data:|blob:)/i.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalizeAbsoluteMediaUrl(value));
  } catch {
    return null;
  }

  const key = extractLegacyStorageKey(parsed);
  if (!key) return null;

  // Подписанные ссылки адресуют S3, а не наш роут: подпись после переписывания
  // бессмысленна и только плодит cache-key.
  const search = new URLSearchParams(parsed.search);
  Array.from(search.keys())
    .filter((param) => /^x-amz-/i.test(param))
    .forEach((param) => search.delete(param));
  const query = search.toString();
  const suffix = query ? `?${query}` : '';

  if (/^uploads\//i.test(key)) return `/media-resize/${key}${suffix}`;
  if (/(^|\/)conversions\//i.test(key)) return `/media-resize/legacy/${key}${suffix}`;

  return null;
};

export const normalizeAvatarUrl = (url?: string | null): string => {
  const value = String(url ?? '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return '';
  return normalizeMediaUrl(value);
};
