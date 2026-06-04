import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import isEqual from 'fast-deep-equal';

interface UseOptimizedFormStateOptions<T> {
  debounce?: number;
  onSave?: (data: T) => Promise<T>;
  onSuccess?: (savedData: T) => void;
  onError?: (error: unknown) => void;
  onStart?: () => void;
  validateOnChange?: boolean;
  validationDebounce?: number;
}

interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  touched: Set<string>;
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
}

export function useOptimizedFormState<T extends object>(
  initialData: T,
  options: UseOptimizedFormStateOptions<T> = {}
) {
  const {
    debounce = 5000,
    onSave,
    onSuccess,
    onError,
    onStart,
    validateOnChange = true,
    validationDebounce = 300,
  } = options;

  // State management with minimal re-renders
  const [state, setState] = useState<FormState<T>>({
    data: initialData,
    errors: {},
    touched: new Set(),
    isDirty: false,
    isValid: true,
    isSubmitting: false,
  });

  // Refs for performance optimization
  const originalDataRef = useRef<T>(initialData);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const isSavingRef = useRef(false);
  const initialDataRef = useRef<T>(initialData);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    };
  }, []);

  // Re-sync baseline when the caller provides a new initialData identity
  useEffect(() => {
    if (initialData === initialDataRef.current) return;
    initialDataRef.current = initialData;
    originalDataRef.current = initialData;
    setState(prev => ({
      ...prev,
      isDirty: !isEqual(prev.data, initialData),
    }));
  }, [initialData]);

  // Validation functions are declared before usage to avoid TDZ issues.
  // Real validation is provided by useOptimizedValidation; these are no-ops
  // so they never clobber errors set via setFieldError.
  const validateField = useCallback((_field: string) => {}, []);

  const validateAll = useCallback(() => {}, []);

  // Optimized field update with minimal re-renders
  const updateField = useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setState(prevState => {
      const newData = { ...prevState.data, [field]: value };
      const isDirty = !isEqual(newData, originalDataRef.current);
      
      return {
        ...prevState,
        data: newData,
        touched: new Set(prevState.touched).add(field as string),
        isDirty,
      };
    });

    // Debounced validation
    if (validateOnChange && validationDebounce > 0) {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      
      validationTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          validateField(field as string);
        }
      }, validationDebounce);
    }
  }, [validateOnChange, validationDebounce, validateField]);

  // Batch update for multiple fields
  const updateFields = useCallback((updates: Partial<T>) => {
    setState(prevState => {
      const newData = { ...prevState.data, ...updates };
      const isDirty = !isEqual(newData, originalDataRef.current);
      const newTouched = new Set(prevState.touched);
      
      Object.keys(updates).forEach(key => newTouched.add(key));
      
      return {
        ...prevState,
        data: newData,
        touched: newTouched,
        isDirty,
      };
    });
  }, []);

  // Autosave functionality
  useEffect(() => {
    if (!onSave || !state.isDirty) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const id = setTimeout(async () => {
      if (!mountedRef.current) return;

      onStart?.();
      isSavingRef.current = true;

      try {
        setState(prev => ({ ...prev, isSubmitting: true }));
        const savedData = await onSave(state.data);

        if (mountedRef.current) {
          originalDataRef.current = savedData;
          setState(prev => ({
            ...prev,
            isDirty: false,
            isSubmitting: false,
          }));
          onSuccess?.(savedData);
        }
      } catch (error) {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, isSubmitting: false }));
          onError?.(error);
        }
      } finally {
        isSavingRef.current = false;
        timeoutRef.current = null;
      }
    }, debounce);

    timeoutRef.current = id;

    return () => clearTimeout(id);
  }, [state.data, state.isDirty, debounce, onSave, onSuccess, onError, onStart]);

  // Manual save
  const save = useCallback(async (): Promise<T> => {
    if (!onSave) {
      throw new Error('No onSave function provided');
    }

    // Cancel any scheduled autosave so we don't double-save.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isSavingRef.current) {
      throw new Error('Save already in flight');
    }
    isSavingRef.current = true;

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const savedData = await onSave(state.data);
      
      if (mountedRef.current) {
        originalDataRef.current = savedData;
        setState(prev => ({
          ...prev,
          isDirty: false,
          isSubmitting: false,
        }));
        onSuccess?.(savedData);
      }
      
      return savedData;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isSubmitting: false }));
        onError?.(error);
      }
      throw error;
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, state.data, onSuccess, onError]);

  // Reset form
  const reset = useCallback((newData?: T) => {
    const dataToReset = newData || initialData;
    originalDataRef.current = dataToReset;
    setState({
      data: dataToReset,
      errors: {},
      touched: new Set(),
      isDirty: false,
      isValid: true,
      isSubmitting: false,
    });
  }, [initialData]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: {}, isValid: true }));
  }, []);

  // Set field error
  const setFieldError = useCallback((field: string, error: string) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: error },
      isValid: false,
    }));
  }, []);

  const getFieldError = useCallback((field: string) => state.errors[field] || '', [state.errors]);
  const isTouched = useCallback((field: string) => state.touched.has(field), [state.touched]);
  const hasError = useCallback((field: string) => !!state.errors[field], [state.errors]);

  return useMemo(() => ({
    // State
    data: state.data,
    errors: state.errors,
    touched: state.touched,
    isDirty: state.isDirty,
    isValid: state.isValid,
    isSubmitting: state.isSubmitting,
    
    // Actions
    updateField,
    updateFields,
    validateField,
    validateAll,
    save,
    reset,
    clearErrors,
    setFieldError,
    
    // Utilities
    getFieldError,
    isTouched,
    hasError,
  }), [
    state.data,
    state.errors,
    state.touched,
    state.isDirty,
    state.isValid,
    state.isSubmitting,
    updateField,
    updateFields,
    validateField,
    validateAll,
    save,
    reset,
    clearErrors,
    setFieldError,
    getFieldError,
    isTouched,
    hasError,
  ]);
}
