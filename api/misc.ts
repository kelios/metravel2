import { Filters, TravelFormData } from '@/types/types';
import { devError } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { sanitizeInput } from '@/utils/security';
import { stripBase64Images } from '@/utils/htmlUtils';
import { validateAIMessage, validateImageFile } from '@/utils/aiValidation';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem } from '@/utils/secureStorage';
import { apiClient } from '@/api/client';
import { ApiError } from '@/api/client';
import { Platform } from 'react-native';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const envApiUrl = process.env.EXPO_PUBLIC_API_URL || '';
const isWebLocalHost =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.location?.hostname === 'string' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const webOriginApi =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/api`
    : '';

const rawApiUrl: string =
  (process.env.NODE_ENV === 'test'
    ? 'https://example.test/api'
    : (Platform.OS === 'web' && isWebLocalHost && webOriginApi
        ? webOriginApi
        : (envApiUrl
        ? envApiUrl
        : (Platform.OS === 'web' && isLocalApi && webOriginApi
            ? webOriginApi
            : ''))));
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
  const trimmed = rawApiUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const DEFAULT_TIMEOUT = 10000;
const LONG_TIMEOUT = 30000;

const GET_FILTERS = `${URLAPI}/getFiltersTravel/`;
const GET_FILTERS_COUNTRY = `${URLAPI}/countriesforsearch/`;
const GET_ALL_COUNTRY = `${URLAPI}/countries/`;
const SEND_FEEDBACK = `${URLAPI}/feedback/`;
const SEND_AI_QUESTION = `${URLAPI}/chat`;

const EMPTY_FILTERS: Filters = {
  countries: [],
  categories: [],
  categoryTravelAddress: [],
  companions: [],
  complexity: [],
  month: [],
  over_nights_stay: [],
  sortings: [],
  transports: [],
  year: '',
};

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';
const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0
    ? error.message
    : fallback;

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

export const saveFormData = async (
  data: TravelFormData,
  signal?: AbortSignal,
  options?: { autosave?: boolean }
): Promise<TravelFormData> => {
  try {
    const token = await getSecureItem('userToken');
    if (!token) {
      throw new Error('Пользователь не авторизован');
    }

    const isDraft = !data?.publish && !data?.moderation;
    const isAutosaveDraft = options?.autosave === true && isDraft;

    // ✅ FIX: Валидация критичных полей перед отправкой
    const trimmedName = typeof data.name === 'string' ? data.name.trim() : '';
    if (!isAutosaveDraft && trimmedName.length === 0) {
      throw new Error('Название обязательно для заполнения');
    }
    if (!isAutosaveDraft && trimmedName.length < 3) {
      throw new Error('Название должно содержать минимум 3 символа');
    }
    if (trimmedName.length > 200) {
      throw new Error('Название слишком длинное (максимум 200 символов)');
    }

    // ✅ FIX: Валидация массивов (предотвращение отправки невалидных данных)
    const dataRecord = data as unknown as Record<string, unknown>;
    const arrayFields = ['countries', 'categories', 'transports', 'companions',
                         'complexity', 'month', 'over_nights_stay'];
    arrayFields.forEach(field => {
      const value = dataRecord[field];
      if (value && !Array.isArray(value)) {
        throw new Error(`Поле ${field} должно быть массивом`);
      }
    });

    const sanitizeStringField = (value: unknown, maxLen: number) => {
      if (typeof value !== 'string') return value;
      const sanitized = sanitizeInput(value);
      return typeof sanitized === 'string' ? sanitized.substring(0, maxLen) : value;
    };

    // ✅ FIX: Санитизация данных перед отправкой
    const sanitizedData = {
      ...data,
      name: sanitizeStringField(data.name, 200),
      description: typeof data.description === 'string' ? sanitizeInput(stripBase64Images(data.description)) : data.description,
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

    return await apiClient.request<TravelFormData>(
      '/travels/upsert/',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        signal,
      },
      LONG_TIMEOUT
    );
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при создании формы:', error);
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

  // Фильтруем события/функции/символы/бигинты
  if (typeof value === 'function' || value instanceof Event) {
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
  const token = await getSecureItem('userToken');
  if (!token) {
    throw new Error('Пользователь не авторизован');
  }

  const normalizedId = String(travelId);
  if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
    throw new Error('Некорректный id путешествия');
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
  const token = await getSecureItem('userToken');
  if (!token) {
    throw new Error('Пользователь не авторизован');
  }

  if (typeof File !== 'undefined' && data instanceof FormData) {
    const file = data.get('file');
    if (file instanceof File) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Ошибка валидации файла');
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

export const deleteImage = async (imageId: string) => {
  const token = await getSecureItem('userToken');
  if (!token) {
    throw new Error('Пользователь не авторизован');
  }

  try {
    return await apiClient.delete<unknown>(`/gallery/${imageId}/`, DEFAULT_TIMEOUT);
  } catch (error) {
    // Preserve previous behavior: non-204 is treated as "Ошибка удаления изображения"
    if (typeof ApiError === 'function' && error instanceof ApiError) {
      throw error;
    }
    throw new Error('Ошибка удаления изображения');
  }
};

export const fetchFilters = async (options?: { signal?: AbortSignal; throwOnError?: boolean }): Promise<Filters> => {
  try {
    const res = await fetchWithTimeout(GET_FILTERS, { signal: options?.signal }, DEFAULT_TIMEOUT);
    const parsed = await safeJsonParse<Filters>(res, EMPTY_FILTERS);
    return parsed;
  } catch (e: unknown) {
    devError('Error fetching filters:', e);
    if (isAbortError(e)) {
      throw e;
    }
    if (options?.throwOnError) throw e;
    return EMPTY_FILTERS;
  }
};

export const fetchFiltersCountry = async (
  options?: { signal?: AbortSignal; throwOnError?: boolean }
): Promise<unknown[]> => {
  try {
    const res = await fetchWithTimeout(GET_FILTERS_COUNTRY, { signal: options?.signal }, DEFAULT_TIMEOUT);
    return await safeJsonParse<unknown[]>(res, []);
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
): Promise<unknown[]> => {
  try {
    const res = await fetchWithTimeout(GET_ALL_COUNTRY, { signal: options?.signal }, DEFAULT_TIMEOUT);
    const parsed = await safeJsonParse<unknown[]>(res, []);
    return parsed;
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
    throw new Error('Все поля должны быть заполнены');
  }

  try {
    const res = await fetchWithTimeout(SEND_FEEDBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: sanitizedName, 
        email: sanitizedEmail, 
        message: sanitizedMessage 
      }),
    }, DEFAULT_TIMEOUT);

    const json = await safeJsonParse<{ 
      email?: string[]; 
      name?: string[]; 
      message?: string[] | string; 
      detail?: string 
    }>(res, {});

    if (!res.ok) {
      const firstError =
        (Array.isArray(json?.email) ? json.email[0] : undefined) ||
        (Array.isArray(json?.name) ? json.name[0] : undefined) ||
        (Array.isArray(json?.message) ? json.message[0] : undefined) ||
        (typeof json?.message === 'string' ? json.message : undefined) ||
        json?.detail ||
        'Ошибка при отправке.';
      throw new Error(firstError);
    }

    return typeof json === 'string'
      ? json
      : (typeof json?.message === 'string' ? json.message : 'Сообщение успешно отправлено');
  } catch (e: unknown) {
    if (__DEV__) {
      console.error('Ошибка при отправке обратной связи:', e);
    }
    throw new Error(getErrorMessage(e, 'Не удалось отправить сообщение'));
  }
};

export const sendAIMessage = async (inputText: string) => {
  const validation = validateAIMessage(inputText);
  if (!validation.valid) {
    throw new Error(validation.error || 'Некорректное сообщение');
  }

  try {
    const response = await fetchWithTimeout(SEND_AI_QUESTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
