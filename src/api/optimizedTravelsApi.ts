import { TravelFormData } from '@/src/types/types';
import { getSecureItem } from '@/src/utils/secureStorage';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { retry, isRetryableError } from '@/src/utils/retry';

const URLAPI: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!URLAPI) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

const SAVE_TRAVEL = `${URLAPI}/api/travels/upsert/`;
const DEFAULT_TIMEOUT = 10000;
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
 * Batch save multiple travel data items efficiently
 */
export const batchSaveFormData = async (
  items: TravelFormData[],
  options: OptimizedSaveOptions = {}
): Promise<SaveResult<TravelFormData>[]> => {
  const results: SaveResult<TravelFormData>[] = [];
  
  // Process items in parallel with concurrency limit
  const concurrencyLimit = 3;
  const batches = [];
  
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    batches.push(items.slice(i, i + concurrencyLimit));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(item => optimizedSaveFormData(item, options))
    );

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason instanceof Error ? result.reason : new Error('Batch save failed'),
        });
      }
    });
  }

  return results;
};

/**
 * Save with optimistic updates
 */
export const optimisticSaveFormData = async (
  data: TravelFormData,
  optimisticUpdate: (data: TravelFormData) => void,
  rollbackUpdate: (originalData: TravelFormData) => void,
  options: OptimizedSaveOptions = {}
): Promise<SaveResult<TravelFormData>> => {
  const originalData = { ...data };
  
  try {
    // Apply optimistic update immediately
    optimisticUpdate(data);
    
    // Attempt to save
    const result = await optimizedSaveFormData(data, options);
    
    if (!result.success) {
      // Rollback on failure
      rollbackUpdate(originalData);
    }
    
    return result;
  } catch (error) {
    // Rollback on any error
    rollbackUpdate(originalData);
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Optimistic save failed'),
    };
  }
};

/**
 * Pre-validate data before sending to server
 */
export const validateBeforeSave = (data: TravelFormData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic validation
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Название должно содержать минимум 3 символа');
  }
  
  if (!data.description || data.description.trim().length < 50) {
    errors.push('Описание должно содержать минимум 50 символов');
  }
  
  if (!data.countries || data.countries.length === 0) {
    errors.push('Выберите хотя бы одну страну');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Enhanced save with pre-validation
 */
export const validatedSaveFormData = async (
  data: TravelFormData,
  options: OptimizedSaveOptions = {}
): Promise<SaveResult<TravelFormData>> => {
  // Pre-validate
  const validation = validateBeforeSave(data);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: new Error(`Validation failed: ${validation.errors.join(', ')}`),
      statusCode: 400,
    };
  }
  
  return optimizedSaveFormData(data, options);
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

/**
 * Save with progress tracking
 */
export const saveFormDataWithProgress = async (
  data: TravelFormData,
  onProgress?: (progress: number) => void,
  options: OptimizedSaveOptions = {}
): Promise<SaveResult<TravelFormData>> => {
  // Simulate progress (in real app, this would be based on actual upload progress)
  onProgress?.(10);
  
  const result = await optimizedSaveFormData(data, options);
  
  onProgress?.(100);
  
  return result;
};
