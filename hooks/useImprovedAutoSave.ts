import { useCallback, useEffect, useRef, useState } from 'react';
import _isEqual from 'lodash/isEqual';

interface UseImprovedAutoSaveOptions<T> {
  debounce?: number;
  onSave: (data: T) => Promise<T>;
  onSuccess?: (savedData: T) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  maxRetries?: number;
  retryDelay?: number;
  enableRetry?: boolean;
  enabled?: boolean;
}

type AutosaveStatus = 'idle' | 'debouncing' | 'saving' | 'saved' | 'error';

interface AutosaveState {
  status: AutosaveStatus;
  lastSaved: Date | null;
  error: Error | null;
  retryCount: number;
  isOnline: boolean;
}

export function useImprovedAutoSave<T>(
  data: T,
  originalData: T,
  options: UseImprovedAutoSaveOptions<T>
) {
  const {
    debounce = 5000,
    onSave,
    onSuccess,
    onError,
    onStart,
    maxRetries = 3,
    retryDelay = 1000,
    enableRetry = true,
    enabled = true,
  } = options;

  const [state, setState] = useState<AutosaveState>({
    status: 'idle',
    lastSaved: null,
    error: null,
    retryCount: 0,
    isOnline: true,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const lastSavedDataRef = useRef<T>(originalData);
  const latestDataRef = useRef<T>(data);
  const isOnlineRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      setState(prev => ({ ...prev, isOnline: true }));
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
      setState(prev => ({ ...prev, isOnline: false }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Main cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Check if data has changed - inline function, not in dependencies
  const hasDataChanged = (): boolean => {
    return !_isEqual(data, lastSavedDataRef.current);
  };

  // Save function with retry logic
  const performSave = useCallback(async (dataToSave: T, retryAttempt = 0): Promise<T> => {
    if (!enabled) {
      return dataToSave;
    }
    // Create new abort controller for this save attempt
    abortControllerRef.current = new AbortController();
    
    try {
      setState(prev => ({
        ...prev,
        status: 'saving',
        error: null,
      }));

      const result = await onSave(dataToSave);
      
      if (!mountedRef.current) {
        // Component is gone (e.g. user navigated away). Do not update state or
        // fire callbacks; just resolve to avoid surfacing a spurious error.
        return result;
      }

      // Update refs and state on success
      lastSavedDataRef.current = result;
      latestDataRef.current = result;
      setState(prev => ({
        ...prev,
        status: 'saved',
        lastSaved: new Date(),
        error: null,
        retryCount: 0,
      }));

      onSuccess?.(result);
      return result;

    } catch (error) {
      if (!mountedRef.current) {
        // Component is gone; avoid propagating errors that would otherwise show
        // up as console noise or user-facing toasts during navigation.
        return dataToSave;
      }

      const saveError = error instanceof Error ? error : new Error('Save failed');
      
      // Retry logic (сохранён, но используется только при необходимости,
      // чтобы не усложнять основную логику автосейва)
      if (enableRetry && retryAttempt < maxRetries && isOnlineRef.current) {
        setState(prev => ({
          ...prev,
          error: saveError,
          retryCount: retryAttempt + 1,
        }));

        // Schedule retry
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            performSave(dataToSave, retryAttempt + 1).catch(() => {
              // Error handled in recursive call
            });
          }
        }, retryDelay * Math.pow(2, retryAttempt)); // Exponential backoff

        throw saveError;
      }

      // Final error state
      setState(prev => ({
        ...prev,
        status: 'error',
        error: saveError,
        retryCount: 0,
      }));

      onError?.(saveError);
      throw saveError;
    }
  }, [onSave, onSuccess, onError, enableRetry, maxRetries, retryDelay, enabled]);

  // Упрощённый безопасный автосейв:
  // срабатывает, только если данные реально отличаются от последнего успешно сохранённого
  // и только один раз после дебаунса.
  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    // Нет изменений относительно последнего успешного сохранения — ничего не планируем.
    const isEqual = _isEqual(data, lastSavedDataRef.current);

    if (isEqual) {
      return;
    }

    // Запоминаем последние наблюдаемые данные.
    latestDataRef.current = data;

    // Сбрасываем предыдущий таймер, если он был.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Обновляем статус на debouncing только если он не уже debouncing
    setState(prev => {
      if (prev.status === 'debouncing') {
        return prev; // Не вызываем setState если статус уже debouncing
      }
      return {
        ...prev,
        status: 'debouncing',
        error: null,
      };
    });

    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      // Если к моменту срабатывания таймера данные уже совпадают с последним сохранённым,
      // то сохранять нечего.
      const current = latestDataRef.current;
      if (_isEqual(current, lastSavedDataRef.current)) {
        return;
      }

      // Не сохраняем, если оффлайн.
      if (!isOnlineRef.current) {
        return;
      }

      // Опциональный коллбек начала сохранения.
      onStart?.();

      // Запускаем сохранение. Ошибку обрабатываем внутри performSave.
      performSave(current).catch(() => {
        // Ошибка уже отражена в состоянии через performSave.
      });
    }, debounce);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [data, debounce, performSave, onStart, enabled, cleanup]); // Removed hasDataChanged from dependencies

  // Manual save function
  const saveNow = useCallback(async (): Promise<T> => {
    if (!enabled) {
      return data;
    }

    if (!state.isOnline) {
      throw new Error('Cannot save while offline');
    }

    cleanup();
    return performSave(data);
  }, [data, performSave, cleanup, state.isOnline, enabled]);

  // Reset to original data
  const resetToOriginal = useCallback(() => {
    cleanup();
    lastSavedDataRef.current = originalData;
    setState({
      status: 'idle',
      lastSaved: null,
      error: null,
      retryCount: 0,
      isOnline: state.isOnline,
    });
  }, [originalData, cleanup, state.isOnline, enabled]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, status: 'idle' }));
  }, []);

  // Retry failed save
  const retrySave = useCallback((): Promise<T> => {
    if (!enabled) {
      return Promise.resolve(data);
    }
    if (state.status !== 'error' || !state.error) {
      throw new Error('No failed save to retry');
    }
    return performSave(data);
  }, [state.status, state.error, data, performSave, enabled]);

  // Update baseline data (e.g., after loading from server)
  const updateBaseline = useCallback((newBaseline: T) => {
    lastSavedDataRef.current = newBaseline;
    latestDataRef.current = newBaseline;
  }, []);

  return {
    // State
    status: state.status,
    lastSaved: state.lastSaved,
    error: state.error,
    retryCount: state.retryCount,
    isOnline: state.isOnline,
    hasUnsavedChanges: hasDataChanged(),

    // Actions
    saveNow,
    resetToOriginal,
    clearError,
    retrySave,
    updateBaseline,

    // Utilities
    canSave: state.isOnline && state.status !== 'saving',
    isSaving: state.status === 'saving',
    hasError: state.status === 'error',
    timeSinceLastSave: state.lastSaved 
      ? Date.now() - state.lastSaved.getTime() 
      : null,
  };
}
