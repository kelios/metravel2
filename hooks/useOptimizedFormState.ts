import { useCallback, useRef, useEffect, useState } from 'react';
import _isEqual from 'lodash/isEqual';

interface UseOptimizedFormStateOptions<T> {
  debounce?: number;
  onSave?: (data: T) => Promise<T>;
  onSuccess?: (savedData: T) => void;
  onError?: (error: any) => void;
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

export function useOptimizedFormState<T extends Record<string, any>>(
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    };
  }, []);

  // Optimized field update with minimal re-renders
  const updateField = useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setState(prevState => {
      const newData = { ...prevState.data, [field]: value };
      const isDirty = !_isEqual(newData, originalDataRef.current);
      
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
          validateField(field as string, value);
        }
      }, validationDebounce);
    }
  }, [validateOnChange, validationDebounce, validateField]);

  // Batch update for multiple fields
  const updateFields = useCallback((updates: Partial<T>) => {
    setState(prevState => {
      const newData = { ...prevState.data, ...updates };
      const isDirty = !_isEqual(newData, originalDataRef.current);
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

  // Validation functions
  const validateField = useCallback((field: string, _value: any) => {
    // This would be injected with validation rules
    // For now, just clear errors for the field
    setState(prevState => ({
      ...prevState,
      errors: { ...prevState.errors, [field]: '' },
    }));
  }, []);

  const validateAll = useCallback(() => {
    // Validate all fields and update errors
    setState(prevState => ({
      ...prevState,
      errors: {}, // Reset errors
      isValid: true, // Would be calculated based on validation
    }));
  }, []);

  // Autosave functionality
  useEffect(() => {
    if (!onSave || !state.isDirty) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    onStart?.();

    timeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

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
      }
    }, debounce);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state.data, state.isDirty, debounce, onSave, onSuccess, onError, onStart]);

  // Manual save
  const save = useCallback(async (): Promise<T> => {
    if (!onSave) {
      throw new Error('No onSave function provided');
    }

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

  return {
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
    getFieldError: (field: string) => state.errors[field] || '',
    isTouched: (field: string) => state.touched.has(field),
    hasError: (field: string) => !!state.errors[field],
  };
}
