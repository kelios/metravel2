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
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

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

  // Check if data has changed
  const hasDataChanged = useCallback((): boolean => {
    return !_isEqual(data, lastSavedDataRef.current);
  }, [data]);

  // Save function with retry logic
  const performSave = useCallback(async (dataToSave: T, retryAttempt = 0): Promise<T> => {
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
        throw new Error('Component unmounted during save');
      }

      // Update refs and state on success
      lastSavedDataRef.current = result;
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
        throw error;
      }

      const saveError = error instanceof Error ? error : new Error('Save failed');
      
      // Retry logic
      if (enableRetry && retryAttempt < maxRetries && state.isOnline) {
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
  }, [onSave, onSuccess, onError, enableRetry, maxRetries, retryDelay, state.isOnline]);

  // Trigger autosave when data changes
  useEffect(() => {
    if (!hasDataChanged() || !state.isOnline) {
      return;
    }

    // Clear existing timeouts
    cleanup();

    // Set debouncing status
    setState(prev => ({ ...prev, status: 'debouncing' }));
    onStart?.();

    // Debounced save
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && hasDataChanged()) {
        performSave(data).catch(() => {
          // Error handled in performSave
        });
      }
    }, debounce);

    return cleanup;
  }, [data, debounce, hasDataChanged, performSave, onStart, cleanup, state.isOnline]);

  // Manual save function
  const saveNow = useCallback(async (): Promise<T> => {
    if (!state.isOnline) {
      throw new Error('Cannot save while offline');
    }

    cleanup();
    return performSave(data);
  }, [data, performSave, cleanup, state.isOnline]);

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
  }, [originalData, cleanup, state.isOnline]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, status: 'idle' }));
  }, []);

  // Retry failed save
  const retrySave = useCallback((): Promise<T> => {
    if (state.status !== 'error' || !state.error) {
      throw new Error('No failed save to retry');
    }
    return performSave(data);
  }, [state.status, state.error, data, performSave]);

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

    // Utilities
    canSave: state.isOnline && state.status !== 'saving',
    isSaving: state.status === 'saving',
    hasError: state.status === 'error',
    timeSinceLastSave: state.lastSaved 
      ? Date.now() - state.lastSaved.getTime() 
      : null,
  };
}
