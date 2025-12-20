import { useCallback, useRef, useEffect, useState } from 'react';
import { validateTravelForm, ValidationError, ValidationResult } from '@/utils/formValidation';

interface UseOptimizedValidationOptions {
  debounce?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

interface ValidationState {
  errors: ValidationError[];
  isValid: boolean;
  isValidating: boolean;
  lastValidated: Date | null;
}

export function useOptimizedValidation<T extends Record<string, any>>(
  data: T,
  options: UseOptimizedValidationOptions = {}
) {
  const {
    debounce = 300,
    validateOnChange = true,
    validateOnBlur: _validateOnBlur = true,
  } = options;

  const [state, setState] = useState<ValidationState>({
    errors: [],
    isValid: true,
    isValidating: false,
    lastValidated: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const lastValidatedDataRef = useRef<T>(data);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Optimized validation with debouncing
  const validate = useCallback((force = false): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      // Skip validation if data hasn't changed and не форсируем проверку
      if (!force && _isEqual(data, lastValidatedDataRef.current)) {
        resolve({ isValid: state.isValid, errors: state.errors });
        return;
      }

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set validating state
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isValidating: true }));
      }

      // Debounced validation
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;

        try {
          const result = validateTravelForm(data as any);
          lastValidatedDataRef.current = { ...data };

          setState({
            errors: result.errors,
            isValid: result.isValid,
            isValidating: false,
            lastValidated: new Date(),
          });

          resolve(result);
        } catch (error) {
          console.error('Validation error:', error);
          
          if (mountedRef.current) {
            setState(prev => ({
              ...prev,
              isValidating: false,
              errors: [{ field: 'general', message: 'Validation error occurred' }],
              isValid: false,
            }));
          }
          
          resolve({ isValid: false, errors: [{ field: 'general', message: 'Validation error occurred' }] });
        }
      }, debounce);
    });
  }, [data, debounce, state.errors, state.isValid]);

  // Auto-validate on data change
  useEffect(() => {
    if (validateOnChange) {
      validate();
    }
  }, [data, validateOnChange, validate]);

  // Immediate validation for specific field
  const validateField = useCallback((fieldName: string): ValidationError | null => {
    try {
      // Create a partial validation result for the specific field
      const result = validateTravelForm(data as any);
      return result.errors.find(error => error.field === fieldName) || null;
    } catch (error) {
      console.error(`Field validation error for ${fieldName}:`, error);
      return { field: fieldName, message: 'Validation error' };
    }
  }, [data]);

  // Validate specific fields
  const validateFields = useCallback((fieldNames: string[]): ValidationError[] => {
    try {
      const result = validateTravelForm(data as any);
      return result.errors.filter(error => fieldNames.includes(error.field));
    } catch (error) {
      console.error('Fields validation error:', error);
      return fieldNames.map(field => ({ field, message: 'Validation error' }));
    }
  }, [data]);

  // Get error for specific field
  const getFieldError = useCallback((fieldName: string): string => {
    const error = state.errors.find(err => err.field === fieldName);
    return error?.message || '';
  }, [state.errors]);

  // Check if field has error
  const hasFieldError = useCallback((fieldName: string): boolean => {
    return state.errors.some(err => err.field === fieldName);
  }, [state.errors]);

  // Clear errors for specific fields
  const clearFieldErrors = useCallback((fieldNames: string[]) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(error => !fieldNames.includes(error.field)),
      isValid: prev.errors.filter(error => !fieldNames.includes(error.field)).length === 0,
    }));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setState({
      errors: [],
      isValid: true,
      isValidating: false,
      lastValidated: new Date(),
    });
  }, []);

  // Set manual error (for server-side validation errors)
  const setFieldError = useCallback((fieldName: string, message: string) => {
    setState(prev => {
      const existingErrorIndex = prev.errors.findIndex(err => err.field === fieldName);
      const newError = { field: fieldName, message };
      
      let newErrors;
      if (existingErrorIndex >= 0) {
        newErrors = [...prev.errors];
        newErrors[existingErrorIndex] = newError;
      } else {
        newErrors = [...prev.errors, newError];
      }

      return {
        ...prev,
        errors: newErrors,
        isValid: false,
      };
    });
  }, []);

  // Force validation
  const forceValidate = useCallback((): Promise<ValidationResult> => {
    return validate(true);
  }, [validate]);

  return {
    // State
    errors: state.errors,
    isValid: state.isValid,
    isValidating: state.isValidating,
    lastValidated: state.lastValidated,

    // Methods
    validate,
    validateField,
    validateFields,
    getFieldError,
    hasFieldError,
    clearFieldErrors,
    clearAllErrors,
    setFieldError,
    forceValidate,

    // Utilities
    hasErrors: state.errors.length > 0,
    errorCount: state.errors.length,
    getErrorSummary: (): string => {
      return state.errors.map(err => `${err.field}: ${err.message}`).join('; ');
    },
  };
}

// Helper function for deep equality check
function _isEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
