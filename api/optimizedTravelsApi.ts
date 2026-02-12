import { TravelFormData } from '@/types/types';
import { getSecureItem } from '@/utils/secureStorage';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { retry, isRetryableError } from '@/utils/retry';
import { Platform } from 'react-native';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
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
  (Platform.OS === 'web' && isWebLocalHost && webOriginApi
    ? webOriginApi
    : (Platform.OS === 'web' && isLocalApi && webOriginApi
        ? webOriginApi
        : process.env.EXPO_PUBLIC_API_URL)) ||
  (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
  const trimmed = rawApiUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const SAVE_TRAVEL = `${URLAPI}/travels/upsert/`;
const LONG_TIMEOUT = 30000;

interface OptimizedSaveOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

interface SaveResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  statusCode?: number;
  retryCount?: number;
}

/**
 * Optimized saveFormData with better error handling, retries, and cancellation support
 */
export const optimizedSaveFormData = async (
  data: TravelFormData,
  options: OptimizedSaveOptions = {}
): Promise<SaveResult<TravelFormData>> => {
  const {
    timeout = LONG_TIMEOUT,
    retries = 2,
    retryDelay = 1000,
    signal,
  } = options;

  let retryCount = 0;

  try {
    // Get auth token
    const token = await getSecureItem('userToken');
    if (!token) {
      return {
        success: false,
        error: new Error('Пользователь не авторизован'),
        statusCode: 401,
      };
    }

    // Clean data before sending
    const cleanedData = cleanEmptyFields({ ...data, id: data.id || null });

    // Retry logic
    const response = await retry(
      async () => {
        const controller = new AbortController();
        
        // Handle external signal cancellation
        if (signal) {
          signal.addEventListener('abort', () => {
            controller.abort();
          });
        }

        try {
          const response = await fetchWithTimeout(SAVE_TRAVEL, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Token ${token}`,
            },
            body: JSON.stringify(cleanedData),
            signal: controller.signal,
          }, timeout);

          retryCount++;
          return response;
        } catch (error) {
          // Don't retry if aborted
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          throw error;
        }
      },
      {
        maxAttempts: retries + 1,
        delay: retryDelay,
        shouldRetry: (error: any) => {
          // Don't retry auth errors or client errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return isRetryableError(error);
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      const error = new Error(errorText || 'Ошибка при создании записи на сервере');
      
      return {
        success: false,
        error,
        statusCode: response.status,
        retryCount,
      };
    }

    const responseData = await safeJsonParse<TravelFormData>(response);
    
    return {
      success: true,
      data: responseData,
      statusCode: response.status,
      retryCount,
    };
  } catch (error) {
    const saveError = error instanceof Error ? error : new Error('Unknown error occurred');
    
    if (__DEV__) {
      console.error('Ошибка при создании формы:', saveError);
    }

    return {
      success: false,
      error: saveError,
      retryCount,
    };
  }
};

/**
 * Helper function to clean empty fields
 */
function cleanEmptyFields(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (value === '') return [key, null];
      if (value === false) return [key, false];
      return [key, value];
    }),
  );
}
