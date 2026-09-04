import type { FilterCountryOption, FilterDictionaries, TravelFormData } from '@/types/types';
import { devError } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { sanitizeInput } from '@/utils/security';
import { stripBase64Images } from '@/utils/htmlUtils';
import { countFaqDisclosureBlocks } from '@/utils/faqDisclosureMarkup';
import { validateAIMessage, validateImageFile } from '@/utils/aiValidation';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem } from '@/utils/secureStorage';
import { apiClient } from '@/api/client';
import { ApiError } from '@/api/client';
import { Platform } from 'react-native';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';
import { validateReadyForModeration } from '@/utils/travelWizardValidation';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  hasUsableAuthCredential,
  shouldUseStoredAuthToken,
} from '@/utils/authPlatform';
import { translate as i18nT } from '@/i18n';
import { normalizeFilterCountries, normalizeFilterDictionaries } from '@/api/filterDictionaries';
import { localizeBackendFieldError } from '@/utils/errorHelpers';
import { isBlankTravelContent } from '@/utils/travelFormNormalization';
import type { TravelContentSaveField } from '@/utils/travelContentSaveDelta';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
const rawApiUrl = resolveApiBaseUrl({
  platformOS: Platform.OS,
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  prodApiUrl: process.env.PROD_API_URL,
  nodeEnv: process.env.NODE_ENV,
  isLocalApi,
  isE2E,
  windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
  windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
});
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}
const URLAPI = rawApiUrl;

const DEFAULT_TIMEOUT = 10000;
const LONG_TIMEOUT = 30000;

// Сохранение статьи ждёт дольше остальных запросов, и это осознанно. Полное
// сохранение тяжёлой статьи на проде идёт 11–12 с, а верхнюю границу задаёт не
// клиент, а сам сервер: у `location ~ ^/api/travels/` в прод-конфиге nginx
// `proxy_read_timeout 60s`, то есть на 60-й секунде клиент получит 504.
// Клиентский таймаут короче серверного — худший из вариантов: мы бросаем ждать,
// пока запрос ещё выполняется, судьба записи остаётся неизвестной, а повтор
// добавляет вторую тяжёлую транзакцию по той же статье (инцидент 19.08.2026,
// travel/619). Поэтому ждём чуть дольше серверного потолка и всегда узнаём
// исход от сервера, а не гадаем по своему таймеру.
const SAVE_TRAVEL_TIMEOUT = 65000;

const GET_FILTERS = `${URLAPI}/getFiltersTravel/`;
const GET_FILTERS_COUNTRY = `${URLAPI}/countriesforsearch/`;
const GET_ALL_COUNTRY = `${URLAPI}/countries/`;
const SEND_FEEDBACK = `${URLAPI}/feedback/`;
const SUBSCRIBE_EMAIL = `${URLAPI}/subscribe/`;
const SEND_AI_QUESTION = `${URLAPI}/chat`;

const EMPTY_FILTER_DICTIONARIES: FilterDictionaries = {
  categories: [],
  categoryTravelAddress: [],
  companions: [],
  complexity: [],
  month: [],
  over_nights_stay: [],
  sortings: [],
  transports: [],
};

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';
const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0
    ? error.message
    : fallback;

const requireAuthCredential = async (): Promise<void> => {
  const token = shouldUseStoredAuthToken() ? await getSecureItem(ACCESS_TOKEN_STORAGE_KEY) : null;
  if (!hasUsableAuthCredential(token)) {
    throw new Error(i18nT('errorsStatic:api.misc.authRequired'));
  }
};

/**
 * Init для публичных (AllowAny) POST — подписка, обратная связь, AI-чат.
 * React Native отправляет cookie по умолчанию, даже когда RequestInit не содержит
 * `credentials`. Явный `omit` не даёт публичному запросу случайно попасть в
 * CookieTokenAuthentication/CSRF-ветку. Authorization здесь также не нужен:
 * stale SecureStore token превращал AllowAny endpoint в 401.
 */
const publicPostInit = (): RequestInit => ({
  method: 'POST',
  credentials: 'omit',
  headers: {
    'Content-Type': 'application/json',
  },
});

const slugifySafe = (value?: string): string => {
  if (!value) return '';
  const out = value
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    // Avoid edge cases like "-" when the original string is mostly non-\w chars (e.g., Cyrillic + " - ").
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .toLowerCase();
  return out;
};

const makeUniqueSlug = (value?: string): string => {
  const base = slugifySafe(value);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `travel-${suffix}`;
};

/**
 * Тело статьи, готовое к записи — или ошибка, если санитайзер снял с него
 * FAQ-разметку (#1764).
 *
 * `sanitizeRichText` — render-time allowlist, но стоит он на пути ЗАПИСИ (оба
 * контракта ниже), поэтому всё, чего в allowlist нет, он вычёркивает не из
 * кадра, а из ХРАНИМОГО тела — необратимо и молча. До ad2fdc9eb (26.07.2026)
 * `details`/`summary` в allowlist не было: `disallowedTagsMode: 'discard'`
 * оставлял текст вопросов и выбрасывал сами теги, и блок «Частые вопросы»
 * превращался в плоские `<strong>`. Так статьи 554 и 134 потеряли FAQPage между
 * 05.07 и 25.07.2026 — сохранённое тело в `scripts/.seo-backups/554-2026-07-25*`
 * совпадает с выходом тогдашнего санитайзера по этому же исходнику.
 *
 * Убрать санитайзер с записи нельзя: своей очистки rich-text у бэкенда нет, и
 * тогда в базу поедет сырой HTML из редактора. Поэтому инвариант обратный —
 * запись, которая теряет структуру FAQ, не уходит на сервер вообще. Гейт
 * симметричен рендеру (`utils/serverSafeHtml.ts`) и пользуется тем же счётом.
 */
const sanitizeTravelBodyForWrite = async (html: string): Promise<string> => {
  const { sanitizeRichText } = await import('@/utils/sanitizeRichText');
  const source = stripBase64Images(html);
  const sanitized = sanitizeRichText(source);
  if (countFaqDisclosureBlocks(sanitized) < countFaqDisclosureBlocks(source)) {
    throw new Error(i18nT('errorsStatic:api.misc.faqMarkupWouldBeLost'));
  }
  return sanitized;
};

export type SaveFormDataIntent = 'autosave' | 'save' | 'publish';

export const saveFormData = async (
  data: TravelFormData,
  signal?: AbortSignal,
  options?: { autosave?: boolean; intent?: SaveFormDataIntent }
): Promise<TravelFormData> => {
  try {
    await requireAuthCredential();

    const intent: SaveFormDataIntent =
      options?.intent ?? (options?.autosave === true ? 'autosave' : 'save');
    const isDraft = !data?.publish && !data?.moderation;
    const isAutosaveDraft = intent === 'autosave' && isDraft;

    // ✅ FIX: Валидация критичных полей перед отправкой
    const trimmedName = typeof data.name === 'string' ? data.name.trim() : '';
    if (!isAutosaveDraft && trimmedName.length === 0) {
      throw new Error(i18nT('errorsStatic:api.misc.titleRequired'));
    }
    if (!isAutosaveDraft && trimmedName.length < 3) {
      throw new Error(i18nT('errorsStatic:api.misc.titleTooShort'));
    }
    if (trimmedName.length > 200) {
      throw new Error(i18nT('errorsStatic:api.misc.titleTooLong'));
    }

    // 🛡 Анти-обнуление: `PUT /travels/upsert/` — full-replace, поэтому пустой payload
    // у СУЩЕСТВУЮЩЕЙ записи стирает текст, точки и все m2m (инцидент 2026-07-21,
    // travel 641: автосейв ушёл с непрогидратированной формой, у которой уже был id).
    // Такой запрос не несёт данных ни в одном сценарии — блокируем до отправки.
    // Создание нового travel (id отсутствует) продолжает автосейвиться пустым черновиком.
    if (data?.id != null && String(data.id).trim() !== '' && isBlankTravelContent(data)) {
      const blankPayloadError = new Error(i18nT('errorsStatic:api.misc.blankPayloadBlocked'));
      console.error('[saveFormData] Blank payload blocked for existing travel', {
        travelId: String(data.id),
        intent,
      });
      throw blankPayloadError;
    }

    // ✅ FIX: Валидация массивов (предотвращение отправки невалидных данных)
    const dataRecord = data as unknown as Record<string, unknown>;
    const arrayFields = ['countries', 'categories', 'transports', 'companions',
                         'complexity', 'month', 'over_nights_stay'];
    arrayFields.forEach(field => {
      const value = dataRecord[field];
      if (value && !Array.isArray(value)) {
        throw new Error(i18nT('errorsStatic:api.misc.fieldMustBeArray', { field }));
      }
    });

    // Модерационная валидация обязательных полей выполняется только при ЯВНОЙ
    // публикации/отправке на модерацию (intent === 'publish'). Фоновые сейвы
    // (autosave, инкрементальное сохранение точки маршрута) лишь персистят
    // текущее состояние уже опубликованной/сохранённой поездки и не должны
    // блокироваться требованием полноты (тикет #505). Статус publish/moderation
    // при этом не меняется — сохраняем как есть.
    if (intent === 'publish') {
      const moderationValidation = validateReadyForModeration(data);
      if (!moderationValidation.isValid) {
        throw new Error(
          i18nT('errorsStatic:api.misc.moderationFieldsRequired', { fields: moderationValidation.missingFields.join(', ') })
        );
      }
    }

    const sanitizeStringField = (value: unknown, maxLen: number) => {
      if (typeof value !== 'string') return value;
      const sanitized = sanitizeInput(value);
      return typeof sanitized === 'string' ? sanitized.substring(0, maxLen) : value;
    };

    let sanitizedDescription: unknown = data.description;
    if (typeof data.description === 'string') {
      sanitizedDescription = await sanitizeTravelBodyForWrite(data.description);
    }

    // ✅ FIX: Санитизация данных перед отправкой
    const sanitizedData = {
      ...data,
      name: sanitizeStringField(data.name, 200),
      description: sanitizedDescription,
      minus: sanitizeStringField(data.minus, 5000),
      plus: sanitizeStringField(data.plus, 5000),
      recommendation: sanitizeStringField(data.recommendation, 5000),
    };

    // Генерируем уникальный slug для новых путешествий, чтобы избежать конфликтов unique constraint
    const payload: TravelFormData = sanitizeForJson({ ...sanitizedData }) as TravelFormData;
    if (!payload.id) {
      const existing = (payload.slug || '').trim();
      payload.slug = existing || makeUniqueSlug(payload.name || 'travel');
    }

    // Контракт FE↔BE: бэк должен запускать модерационную валидацию полноты
    // (categories у каждой точки и т.п.) ТОЛЬКО при явной публикации/отправке на
    // модерацию, а не на каждом content-save опубликованного маршрута — иначе
    // инкрементальный автосейв точки падает с 400. Флаг сообщает бэку «это submit
    // на модерацию», а не «сохрани контент». Поле инертно, пока бэк его не читает
    // (DRF игнорирует неизвестные ключи) — см. тикет на пер-точечную валидацию.
    const body = { ...payload, enforce_moderation_validation: intent === 'publish' };

    return await apiClient.request<TravelFormData>(
      '/travels/upsert/',
      {
        method: 'PUT',
        body: JSON.stringify(body),
        signal,
      },
      SAVE_TRAVEL_TIMEOUT
    );
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при создании формы:', error);
    }
    throw error;
  }
};

/**
 * Ответ узкого сохранения контента: подтверждённые значения текстовых полей.
 * Точки маршрута, галерея, обложка, справочники и статус публикации в него не
 * входят — узкий путь их не трогает.
 */
export type TravelContentSaveResponse = {
  id: number;
  slug: string;
  name: string | null;
  description: string | null;
  plus: string | null;
  minus: string | null;
  recommendation: string | null;
  changed_fields: string[];
  updated_at: string | null;
};

/**
 * Узкое сохранение текстовых полей статьи — `PATCH /travels/{id}/content/` (#1513).
 *
 * Отправляет ТОЛЬКО переданные поля, поэтому структура статьи остаётся нетронутой
 * и правка одного абзаца не стоит полной пересборки графа (#1516). Санитизация
 * здесь ровно та же, что у полного `saveFormData`: у бэкенда своей очистки
 * rich-text нет, и узкий путь не имеет права быть слабее полного.
 */
export const saveTravelContent = async (
  travelId: number,
  fields: Partial<Record<TravelContentSaveField, string>>,
  signal?: AbortSignal
): Promise<TravelContentSaveResponse> => {
  try {
    await requireAuthCredential();

    if (!Number.isFinite(travelId)) {
      throw new Error(i18nT('errorsStatic:api.misc.blankPayloadBlocked'));
    }

    const payload: Record<string, string> = {};

    if (typeof fields.name === 'string') {
      if (fields.name.trim().length > 200) {
        throw new Error(i18nT('errorsStatic:api.misc.titleTooLong'));
      }
      payload.name = String(sanitizeInput(fields.name)).substring(0, 200);
    }

    if (typeof fields.description === 'string') {
      payload.description = await sanitizeTravelBodyForWrite(fields.description);
    }

    (['plus', 'minus', 'recommendation'] as const).forEach((field) => {
      const value = fields[field];
      if (typeof value !== 'string') return;
      payload[field] = String(sanitizeInput(value)).substring(0, 5000);
    });

    // Пустой payload узкий эндпоинт отклоняет (`At least one content field is
    // required`), и отправлять его незачем: сохранять нечего.
    if (Object.keys(payload).length === 0) {
      throw new Error(i18nT('errorsStatic:api.misc.blankPayloadBlocked'));
    }

    return await apiClient.request<TravelContentSaveResponse>(
      `/travels/${travelId}/content/`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
        signal,
      },
      SAVE_TRAVEL_TIMEOUT
    );
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при сохранении текста статьи:', error);
    }
    throw error;
  }
};

/**
 * Удаляет из объекта несериализуемые сущности (DOM-узлы, функции, React элементы)
 * и разрывает возможные циклические ссылки перед JSON.stringify.
 */
type SanitizeState = {
  memo: WeakMap<object, unknown>;
  visiting: WeakSet<object>;
};

function sanitizeForJson(value: unknown, state?: SanitizeState): unknown {
  const currentState: SanitizeState = state ?? {
    memo: new WeakMap<object, unknown>(),
    visiting: new WeakSet<object>(),
  };

  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Reuse sanitized result for repeated references instead of dropping fields.
  if (currentState.memo.has(value)) {
    return currentState.memo.get(value as object);
  }

  // Break real cycles only for currently traversed branch.
  if (currentState.visiting.has(value)) {
    return undefined;
  }
  currentState.visiting.add(value);

  // Фильтруем DOM-узлы и React-элементы
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    currentState.visiting.delete(value);
    return undefined;
  }
  if (typeof Node !== 'undefined' && value instanceof Node) {
    currentState.visiting.delete(value);
    return undefined;
  }

  // Фильтруем события/функции/символы/бигинты.
  // `Event` — web-only глобал: на React Native он не определён, поэтому без
  // typeof-гварда `value instanceof Event` бросает ReferenceError и роняет
  // сохранение формы путешествия (см. HTMLElement/Node выше).
  if (
    typeof value === 'function' ||
    (typeof Event !== 'undefined' && value instanceof Event)
  ) {
    currentState.visiting.delete(value);
    return undefined;
  }

  // Даты сериализуем в строку
  if (value instanceof Date) {
    currentState.visiting.delete(value);
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    currentState.memo.set(value, result);

    value.forEach(item => {
      const sanitized = sanitizeForJson(item, currentState);
      if (sanitized !== undefined) {
        result.push(sanitized);
      }
    });

    currentState.visiting.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  currentState.memo.set(value, result);

  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    const sanitized = sanitizeForJson(val, currentState);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  });

  currentState.visiting.delete(value);
  return result;
}

export const deleteTravelMainImage = async (travelId: string | number) => {
  await requireAuthCredential();

  const normalizedId = String(travelId);
  if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
    throw new Error(i18nT('errorsStatic:api.misc.invalidTravelId'));
  }

  // Preserve previous behavior: return the raw Response so callers can inspect status (e.g. 204).
  // apiClient already includes Authorization and handles refresh on 401.
  return await apiClient.request<Response>(
    `/travels/${encodeURIComponent(normalizedId)}/main-image/`,
    { method: 'DELETE' },
    DEFAULT_TIMEOUT,
  );
};

export const uploadImage = async (
  data: FormData,
  onProgress?: (percent: number) => void,
): Promise<{
  data?: { url?: string };
  url?: string;
  [key: string]: unknown;
}> => {
  await requireAuthCredential();

  if (typeof File !== 'undefined' && data instanceof FormData) {
    const file = data.get('file');
    if (file instanceof File) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || i18nT('errorsStatic:api.misc.fileValidationFailed'));
      }
    }
  }

  // Use apiClient upload helper so 401 triggers refresh+retry.
  // AND-15: Pass onProgress for XHR-based progress tracking.
  const result = await apiClient.uploadFormDataWithProgress<unknown>('/upload', data, onProgress, 'POST', LONG_TIMEOUT);
  if (typeof result === 'string') {
    const rawText = result.trim();
    if (!rawText) return { ok: true };
    try {
      const parsed = JSON.parse(rawText) as unknown;
      return parsed && typeof parsed === 'object'
        ? { ok: true, ...(parsed as Record<string, unknown>) }
        : { ok: true };
    } catch {
      return { ok: true, url: rawText };
    }
  }
  return result && typeof result === 'object'
    ? { ok: true, ...(result as Record<string, unknown>) }
    : { ok: true };
};

export interface GalleryReorderImage {
  id: number;
  url: string;
  order: number;
  caption?: string;
}

export interface GalleryCaptionResponse {
  id: number;
  caption: string;
  url?: string;
  order?: number;
}

export const updateGalleryCaption = async (
  imageId: string | number,
  caption: string,
  signal?: AbortSignal,
): Promise<GalleryCaptionResponse> => {
  await requireAuthCredential();

  const numericImageId = Number(imageId);
  if (!Number.isInteger(numericImageId) || numericImageId <= 0) {
    throw new Error(i18nT('errorsStatic:api.misc.invalidImageId'));
  }

  const normalizedCaption = String(caption ?? '').trim();
  if (normalizedCaption.length > 500) {
    throw new Error(i18nT('errorsStatic:api.misc.captionTooLong'));
  }

  return await apiClient.request<GalleryCaptionResponse>(
    `/gallery/${numericImageId}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({ caption: normalizedCaption }),
      signal,
    },
    DEFAULT_TIMEOUT,
  );
};

export const reorderGallery = async (
  travelId: string | number,
  imageIds: Array<string | number>,
  signal?: AbortSignal,
): Promise<{ gallery: GalleryReorderImage[] }> => {
  await requireAuthCredential();

  const numericTravelId = Number(travelId);
  if (!Number.isInteger(numericTravelId) || numericTravelId <= 0) {
    throw new Error(i18nT('errorsStatic:api.misc.invalidTravelId'));
  }

  const numericImageIds = Array.from(
    new Set(
      imageIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
  if (numericImageIds.length === 0) {
    return { gallery: [] };
  }

  return await apiClient.request<{ gallery: GalleryReorderImage[] }>(
    '/gallery/reorder/',
    {
      method: 'PATCH',
      body: JSON.stringify({ travel_id: numericTravelId, image_ids: numericImageIds }),
      signal,
    },
    DEFAULT_TIMEOUT,
  );
};

export const deleteImage = async (imageId: string) => {
  await requireAuthCredential();

  try {
    return await apiClient.delete<unknown>(`/gallery/${encodeURIComponent(imageId)}/`, DEFAULT_TIMEOUT);
  } catch (error) {
    // Preserve previous behavior: non-204 is treated as "Ошибка удаления изображения"
    if (typeof ApiError === 'function' && error instanceof ApiError) {
      throw error;
    }
    throw new Error(i18nT('errorsStatic:api.misc.imageDeleteFailed'));
  }
};

export interface CreatedPointCategory {
  id: number;
  name: string;
}

/**
 * Создание пользовательской категории точки маршрута (TravelCategoryAddress).
 *
 * Используется только под фиче-флагом EXPO_PUBLIC_POINT_CATEGORY_CREATE
 * (см. config/featureFlags.ts) — бэкенд-эндпоинт заведён тикетом #633 и пока
 * может отсутствовать. Контракт: POST { name } -> { id, name }. Числовой id
 * обязателен — точка сохраняется через categories.set([id]) на апсерте travel.
 */
export const createPointCategory = async (
  rawName: string,
  signal?: AbortSignal,
): Promise<CreatedPointCategory> => {
  await requireAuthCredential();

  const sanitized = sanitizeInput(String(rawName ?? ''));
  const name = (typeof sanitized === 'string' ? sanitized : String(rawName ?? '')).trim().slice(0, 255);
  if (name.length < 2) {
    throw new Error(i18nT('errorsStatic:api.misc.categoryNameTooShort'));
  }

  const result = await apiClient.request<{ id?: number | string; name?: string }>(
    '/categoryTravelAddress/',
    { method: 'POST', body: JSON.stringify({ name }), signal },
    DEFAULT_TIMEOUT,
  );

  const id = Number(result?.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(i18nT('errorsStatic:api.misc.invalidCategoryResponse'));
  }

  return { id, name: typeof result?.name === 'string' && result.name.trim() ? result.name : name };
};

/**
 * Уникальный query-параметр для запроса «мимо клиентского кэша».
 *
 * `cache: 'reload'` — опция Web Fetch, React Native её игнорирует, а OkHttp
 * (Android) и NSURLCache (iOS) продолжают уважать тот же `max-age`. Серверной
 * нагрузки параметр не добавляет: прод кэширует этот роут ключом без query
 * (источник правды — `deploy/prod/nginx/nginx.conf` в бэкенд-репо, `master`;
 * снаружи видно по заголовку `x-cache-status` на `/api/getFiltersTravel/`).
 */
const withCacheBuster = (url: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}_fresh=${Date.now()}`;

export const fetchFilters = async (
  options?: { signal?: AbortSignal; throwOnError?: boolean; forceRefresh?: boolean },
): Promise<FilterDictionaries> => {
  try {
    const res = await fetchWithTimeout(
      options?.forceRefresh ? withCacheBuster(GET_FILTERS) : GET_FILTERS,
      {
        signal: options?.signal,
        // Словарь редактируется в админке прямо во время работы автора (новая
        // категория точки), а прод отдаёт на этот роут ДВА Cache-Control:
        // Django `max-age=1800` и nginx `max-age=60`. Браузер берёт первый,
        // поэтому обычный запрос до 30 минут читается из HTTP-кэша и новую
        // категорию не видит (BE-задача #1436). `forceRefresh` идёт мимо кэша
        // на всех платформах: `cache: 'reload'` на web, busting-параметр везде.
        ...(options?.forceRefresh ? { cache: 'reload' as RequestCache } : null),
      },
      DEFAULT_TIMEOUT,
    );
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return EMPTY_FILTER_DICTIONARIES;
    }
    const parsed = await safeJsonParse<unknown>(res);
    return normalizeFilterDictionaries(parsed);
  } catch (e: unknown) {
    devError('Error fetching filters:', e);
    if (isAbortError(e)) {
      throw e;
    }
    if (options?.throwOnError) throw e;
    return EMPTY_FILTER_DICTIONARIES;
  }
};

export const fetchFiltersCountry = async (
  options?: { signal?: AbortSignal; throwOnError?: boolean }
): Promise<FilterCountryOption[]> => {
  try {
    const res = await fetchWithTimeout(GET_FILTERS_COUNTRY, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return [];
    }
    const parsed = await safeJsonParse<unknown>(res);
    return normalizeFilterCountries(parsed);
  } catch (e: unknown) {
    devError('Error fetching filters country:', e);
    if (isAbortError(e)) {
      throw e;
    }
    if (options?.throwOnError) throw e;
    return [];
  }
};

export const fetchAllCountries = async (
  options?: { signal?: AbortSignal; throwOnError?: boolean }
): Promise<FilterCountryOption[]> => {
  try {
    const res = await fetchWithTimeout(GET_ALL_COUNTRY, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return [];
    }
    const parsed = await safeJsonParse<unknown>(res);
    return normalizeFilterCountries(parsed);
  } catch (e: unknown) {
    devError('Error fetching all countries:', e);
    if (isAbortError(e)) {
      throw e;
    }
    if (options?.throwOnError) throw e;
    return [];
  }
};

export const sendFeedback = async (
  name: string,
  email: string,
  message: string
): Promise<string> => {
  const sanitizedName = sanitizeInput(name.trim());
  const sanitizedEmail = sanitizeInput(email.trim());
  const sanitizedMessage = sanitizeInput(message.trim());

  if (!sanitizedName || !sanitizedEmail || !sanitizedMessage) {
    throw new Error(i18nT('errorsStatic:api.misc.allFieldsRequired'));
  }

  try {
    const res = await fetchWithTimeout(SEND_FEEDBACK, {
      ...publicPostInit(),
      body: JSON.stringify({
        name: sanitizedName,
        email: sanitizedEmail,
        message: sanitizedMessage
      }),
    }, DEFAULT_TIMEOUT);

    const json = await safeJsonParse<
      | string
      | {
          email?: string[];
          name?: string[];
          message?: string[] | string;
          detail?: string;
        }
    >(res, {});

    if (!res.ok) {
      const payload = typeof json === 'string' ? null : json;
      const firstError = res.status === 451
        ? i18nT('errorsStatic:api.misc.feedbackUnavailable')
        : localizeBackendFieldError(payload?.email) ||
          localizeBackendFieldError(payload?.name) ||
          localizeBackendFieldError(payload?.message) ||
          localizeBackendFieldError(payload?.detail) ||
          localizeBackendFieldError(json) ||
          i18nT('errorsStatic:api.misc.sendFailed');
      throw new Error(firstError);
    }

    return typeof json === 'string'
      ? json
      : (typeof json?.message === 'string' ? json.message : i18nT('errorsStatic:api.misc.messageSent'));
  } catch (e: unknown) {
    if (__DEV__) {
      console.error('Ошибка при отправке обратной связи:', e);
    }
    throw new Error(getErrorMessage(e, i18nT('errorsStatic:api.misc.messageSendFailed')));
  }
};

export type SubscribeSource = 'home' | 'article' | 'footer' | 'quest' | 'scenario' | string;

export interface SubscribeResult {
  ok: boolean;
  status: 'created' | 'exists';
}

export interface SubscribeEmailConsent {
  granted: true;
  version: string;
}

// Public email lead subscription (growth forms on home/articles). Backend BE-3:
// POST /api/subscribe/ -> 201 {ok,status:"created"} | 200 {ok,status:"exists"}
// | 400 {email:[...]} | 429 (scoped throttle). No auth required.
export const subscribeEmail = async (
  email: string,
  source: SubscribeSource,
  pageUrl?: string,
  consent?: SubscribeEmailConsent,
): Promise<SubscribeResult> => {
  const sanitizedEmail = sanitizeInput(email.trim());
  const consentVersion = typeof consent?.version === 'string' ? consent.version.trim() : '';
  const hasExplicitConsent = consent?.granted === true && consentVersion.length > 0;

  if (!sanitizedEmail) {
    throw new Error(i18nT('errorsStatic:api.misc.emailRequired'));
  }

  try {
    const res = await fetchWithTimeout(
      SUBSCRIBE_EMAIL,
      {
        ...publicPostInit(),
        body: JSON.stringify({
          email: sanitizedEmail,
          source,
          ...(pageUrl ? { page_url: pageUrl } : {}),
          ...(hasExplicitConsent
            ? { consent: true, consent_version: consentVersion }
            : {}),
        }),
      },
      DEFAULT_TIMEOUT
    );

    const json = await safeJsonParse<{
      ok?: boolean;
      status?: string;
      email?: string[];
      source?: string[];
      detail?: string;
    }>(res, {});

    if (!res.ok) {
      const firstError =
        localizeBackendFieldError(json?.email) ||
        localizeBackendFieldError(json?.source) ||
        localizeBackendFieldError(json?.detail) ||
        (res.status === 429
          ? i18nT('errorsStatic:api.misc.tooManyAttempts')
          : i18nT('errorsStatic:api.misc.subscriptionFailed'));
      throw new Error(firstError);
    }

    return {
      ok: Boolean(json?.ok ?? true),
      status: json?.status === 'exists' ? 'exists' : 'created',
    };
  } catch (e: unknown) {
    if (__DEV__) {
      console.error('Ошибка при оформлении подписки:', e);
    }
    throw new Error(getErrorMessage(e, i18nT('errorsStatic:api.misc.subscriptionFailedShort')));
  }
};

export const sendAIMessage = async (inputText: string) => {
  const validation = validateAIMessage(inputText);
  if (!validation.valid) {
    throw new Error(validation.error || i18nT('errorsStatic:api.misc.invalidMessage'));
  }

  try {
    const response = await fetchWithTimeout(SEND_AI_QUESTION, {
      ...publicPostInit(),
      body: JSON.stringify({ message: inputText.trim() }),
    }, LONG_TIMEOUT);
    
    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }
    
    const responseData = await safeJsonParse<unknown>(response);
    return responseData;
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка:', error);
    }
    throw error;
  }
};
