import { FeedbackData, Filters, TravelFormData } from '@/src/types/types';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { sanitizeInput } from '@/src/utils/security';
import { validateAIMessage, validateImageFile } from '@/src/utils/validation';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { getUserFriendlyError } from '@/src/utils/userFriendlyErrors';
import { getSecureItem } from '@/src/utils/secureStorage';

const URLAPI: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!URLAPI) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

const DEFAULT_TIMEOUT = 10000;
const LONG_TIMEOUT = 30000;

const SAVE_TRAVEL = `${URLAPI}/api/travels/upsert/`;
const UPLOAD_IMAGE = `${URLAPI}/api/upload`;
const GALLERY = `${URLAPI}/api/gallery`;
const GET_FILTERS = `${URLAPI}/api/getFiltersTravel`;
const GET_FILTERS_COUNTRY = `${URLAPI}/api/countriesforsearch`;
const GET_ALL_COUNTRY = `${URLAPI}/api/countries/`;
const SEND_FEEDBACK = `${URLAPI}/api/feedback/`;
const SEND_AI_QUESTION = `${URLAPI}/api/chat`;

export const saveFormData = async (data: TravelFormData): Promise<TravelFormData> => {
  try {
    const token = await getSecureItem('userToken');
    if (!token) {
      throw new Error('Пользователь не авторизован');
    }

    const response = await fetchWithTimeout(SAVE_TRAVEL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(data),
    }, LONG_TIMEOUT);

    if (!response.ok) {
      throw new Error('Ошибка при создании записи на сервере');
    }

    const responseData = await safeJsonParse<TravelFormData>(response);
    return responseData;
  } catch (error) {
    if (__DEV__) {
      console.error('Ошибка при создании формы:', error);
    }
    throw error;
  }
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

  const response = await fetchWithTimeout(UPLOAD_IMAGE, {
    method: 'POST',
    headers: { Authorization: `Token ${token}` },
    body: data,
  }, LONG_TIMEOUT);

  // Бэкенд может возвращать 201/200 — считаем любой 2xx успехом
  if (response.ok) {
    // Ответ может быть JSON или просто URL строкой
    const rawText = await response.text().catch(() => '');
    if (!rawText) return {};
    try {
      return JSON.parse(rawText);
    } catch {
      return { url: rawText.trim() };
    }
  }

  const errorText = await response.text().catch(() => 'Upload failed');
  throw new Error(errorText || 'Upload failed.');
};

export const deleteImage = async (imageId: string) => {
  const token = await getSecureItem('userToken');
  if (!token) {
    throw new Error('Пользователь не авторизован');
  }

  const response = await fetchWithTimeout(`${GALLERY}/${imageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Token ${token}` },
  }, DEFAULT_TIMEOUT);

  if (response.status === 204) {
    return response;
  } else {
    throw new Error('Ошибка удаления изображения');
  }
};

export const fetchFilters = async (): Promise<Filters> => {
  try {
    const res = await fetchWithTimeout(GET_FILTERS, {}, DEFAULT_TIMEOUT);
    const parsed = await safeJsonParse<Filters>(res, [] as unknown as Filters);
    return parsed;
  } catch (e: any) {
    devError('Error fetching filters:', e);
    return [] as unknown as Filters;
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
