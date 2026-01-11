import { Filters, TravelFormData } from '@/src/types/types';
import { devError } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { sanitizeInput } from '@/src/utils/security';
import { validateAIMessage, validateImageFile } from '@/src/utils/validation';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { getSecureItem } from '@/src/utils/secureStorage';
import { apiClient } from '@/src/api/client';
import { ApiError } from '@/src/api/client';
import { Platform } from 'react-native';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';

const rawApiUrl: string =
  (Platform.OS === 'web' && !isLocalApi && typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/api`
    : process.env.EXPO_PUBLIC_API_URL) ||
  (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
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
  transports: [],
  year: '',
};

const slugifySafe = (value?: string): string => {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
};

const makeUniqueSlug = (value?: string): string => {
  const base = slugifySafe(value);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `travel-${suffix}`;
};

export const saveFormData = async (data: TravelFormData, signal?: AbortSignal): Promise<TravelFormData> => {
  try {
    const token = await getSecureItem('userToken');
    if (!token) {
      throw new Error('Пользователь не авторизован');
    }

    // ✅ FIX: Валидация критичных полей перед отправкой
    if (data.name) {
      const trimmedName = data.name.trim();
      if (trimmedName.length > 0 && trimmedName.length < 3) {
        throw new Error('Название должно содержать минимум 3 символа');
      }
      if (trimmedName.length > 200) {
        throw new Error('Название слишком длинное (максимум 200 символов)');
      }
    }

    // ✅ FIX: Валидация массивов (предотвращение отправки невалидных данных)
    const arrayFields = ['countries', 'categories', 'transports', 'companions',
                         'complexity', 'month', 'over_nights_stay'];
    arrayFields.forEach(field => {
      const value = (data as any)[field];
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
      description: typeof data.description === 'string' ? (sanitizeInput(data.description) as any) : data.description,
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
function sanitizeForJson<T>(value: T, seen = new WeakSet()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Пропускаем повторно встреченные объекты, чтобы разорвать циклы
  if (seen.has(value as any)) {
    return undefined as any;
  }
  seen.add(value as any);

  // Фильтруем DOM-узлы и React-элементы
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return undefined as any;
  }
  if (typeof Node !== 'undefined' && value instanceof Node) {
    return undefined as any;
  }

  // Фильтруем события/функции/символы/бигинты
  if (
    typeof value === 'function' ||
    value instanceof Event ||
    typeof (value as any) === 'symbol' ||
    typeof (value as any) === 'bigint'
  ) {
    return undefined as any;
  }

  // Даты сериализуем в строку
  if (value instanceof Date) {
    return value.toISOString() as any;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeForJson(item, seen))
      .filter(item => item !== undefined) as any;
  }

  const result: Record<string, any> = {};
  Object.entries(value as Record<string, any>).forEach(([key, val]) => {
    const sanitized = sanitizeForJson(val, seen);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  });
  return result as any;
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

export const uploadImage = async (data: FormData): Promise<any> => {
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
  // Response may be JSON or plain string. apiClient.parseSuccessResponse handles both.
  const result = await apiClient.uploadFormData<any>('/upload', data, 'POST', LONG_TIMEOUT);
  if (typeof result === 'string') {
    const rawText = result.trim();
    if (!rawText) return { ok: true };
    try {
      const parsed = JSON.parse(rawText);
      return parsed && typeof parsed === 'object' ? { ok: true, ...parsed } : { ok: true };
    } catch {
      return { ok: true, url: rawText };
    }
  }
  return result && typeof result === 'object' ? { ok: true, ...result } : { ok: true };
};

export const deleteImage = async (imageId: string) => {
  const token = await getSecureItem('userToken');
  if (!token) {
    throw new Error('Пользователь не авторизован');
  }

  try {
    return await apiClient.delete<any>(`/gallery/${imageId}/`, DEFAULT_TIMEOUT);
  } catch (error) {
    // Preserve previous behavior: non-204 is treated as "Ошибка удаления изображения"
    if (typeof ApiError === 'function' && error instanceof ApiError) {
      throw error;
    }
    throw new Error('Ошибка удаления изображения');
  }
};

export const fetchFilters = async (): Promise<Filters> => {
  try {
    const res = await fetchWithTimeout(GET_FILTERS, {}, DEFAULT_TIMEOUT);
    const parsed = await safeJsonParse<Filters>(res, EMPTY_FILTERS);
    return parsed;
  } catch (e: any) {
    devError('Error fetching filters:', e);
    return EMPTY_FILTERS;
  }
};

export const fetchFiltersCountry = async () => {
  try {
    const res = await fetchWithTimeout(GET_FILTERS_COUNTRY, {}, DEFAULT_TIMEOUT);
    return await safeJsonParse<any[]>(res, []);
  } catch (e: any) {
    devError('Error fetching filters country:', e);
    return [];
  }
};

export const fetchAllCountries = async () => {
  try {
    const res = await fetchWithTimeout(GET_ALL_COUNTRY, {}, DEFAULT_TIMEOUT);
    const parsed = await safeJsonParse<any[]>(res, []);
    return parsed;
  } catch (e: any) {
    devError('Error fetching all countries:', e);
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
  } catch (e: any) {
    if (__DEV__) {
      console.error('Ошибка при отправке обратной связи:', e);
    }
    throw new Error(e?.message || 'Не удалось отправить сообщение');
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
    
    const responseData = await safeJsonParse<any>(response);
    return responseData;
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка:', error);
    }
    throw error;
  }
};
