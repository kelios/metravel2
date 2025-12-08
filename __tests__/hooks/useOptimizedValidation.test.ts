import { renderHook, act, waitFor } from '@testing-library/react';
import { useOptimizedValidation } from '@/hooks/useOptimizedValidation';
import { validateTravelForm } from '@/utils/formValidation';

// Mock validateTravelForm
jest.mock('@/utils/formValidation', () => ({
  validateTravelForm: jest.fn(),
}));

const mockValidateTravelForm = validateTravelForm as jest.MockedFunction<typeof validateTravelForm>;

describe('useOptimizedValidation', () => {
  const testData = {
    name: 'Test Travel',
    description: 'Test Description',
    countries: ['US'],
    categories: ['adventure'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct state', () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData)
    );

    expect(result.current.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.lastValidated).toBeNull();
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.errorCount).toBe(0);
  });

  it('validates data on mount when validateOnChange is true', async () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: true,
        debounce: 100,
      })
    );

    await waitFor(() => {
      expect(mockValidateTravelForm).toHaveBeenCalledWith(testData);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.lastValidated).toBeInstanceOf(Date);
  });

  it('handles validation errors', async () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: false,
      errors: [
        { field: 'name', message: 'Name is required' },
        { field: 'description', message: 'Description is too short' },
      ],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: true,
        debounce: 100,
      })
    );

    await waitFor(() => {
      expect(result.current.isValid).toBe(false);
      expect(result.current.hasErrors).toBe(true);
      expect(result.current.errorCount).toBe(2);
    });

    expect(result.current.getFieldError('name')).toBe('Name is required');
    expect(result.current.getFieldError('description')).toBe('Description is too short');
    expect(result.current.hasFieldError('name')).toBe(true);
    expect(result.current.hasFieldError('nonexistent')).toBe(false);
  });

  it('validates specific field', () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: false,
      errors: [{ field: 'name', message: 'Name is required' }],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    const error = result.current.validateField('name');
    expect(error).toEqual({ field: 'name', message: 'Name is required' });
  });

  it('validates multiple fields', () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: false,
      errors: [
        { field: 'name', message: 'Name is required' },
        { field: 'description', message: 'Description is too short' },
      ],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    const errors = result.current.validateFields(['name', 'description']);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({ field: 'name', message: 'Name is required' });
    expect(errors[1]).toEqual({ field: 'description', message: 'Description is too short' });
  });

  it('clears field errors', () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: false,
      errors: [
        { field: 'name', message: 'Name is required' },
        { field: 'description', message: 'Description is too short' },
      ],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    // Simulate having errors
    act(() => {
      result.current.setFieldError('name', 'Name is required');
      result.current.setFieldError('description', 'Description is too short');
    });

    act(() => {
      result.current.clearFieldErrors(['name']);
    });

    expect(result.current.hasFieldError('name')).toBe(false);
    expect(result.current.hasFieldError('description')).toBe(true);
    expect(result.current.errorCount).toBe(1);
  });

  it('clears all errors', () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: false,
      errors: [
        { field: 'name', message: 'Name is required' },
        { field: 'description', message: 'Description is too short' },
      ],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    // Simulate having errors
    act(() => {
      result.current.setFieldError('name', 'Name is required');
      result.current.setFieldError('description', 'Description is too short');
    });

    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.errorCount).toBe(0);
  });

  it('sets field errors manually', () => {
    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    act(() => {
      result.current.setFieldError('name', 'Custom error message');
    });

    expect(result.current.errors).toEqual([
      { field: 'name', message: 'Custom error message' }
    ]);
    expect(result.current.isValid).toBe(false);
    expect(result.current.hasFieldError('name')).toBe(true);
  });

  it('updates existing field error', () => {
    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    act(() => {
      result.current.setFieldError('name', 'Original error');
    });

    act(() => {
      result.current.setFieldError('name', 'Updated error');
    });

    expect(result.current.errors).toEqual([
      { field: 'name', message: 'Updated error' }
    ]);
    expect(result.current.errorCount).toBe(1);
  });

  it('provides error summary', () => {
    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    act(() => {
      result.current.setFieldError('name', 'Name error');
      result.current.setFieldError('description', 'Description error');
    });

    const summary = result.current.getErrorSummary();
    expect(summary).toBe('name: Name error; description: Description error');
  });

  it('forces validation', async () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: false,
      })
    );

    const validationResult = await result.current.forceValidate();

    expect(mockValidateTravelForm).toHaveBeenCalledWith(testData);
    expect(validationResult.isValid).toBe(true);
    expect(result.current.lastValidated).toBeInstanceOf(Date);
  });

  it('handles validation exceptions', async () => {
    mockValidateTravelForm.mockImplementation(() => {
      throw new Error('Validation failed');
    });

    const { result } = renderHook(() => 
      useOptimizedValidation(testData, {
        validateOnChange: true,
        debounce: 100,
      })
    );

    await waitFor(() => {
      expect(result.current.isValid).toBe(false);
      expect(result.current.errors).toEqual([
        { field: 'general', message: 'Validation error occurred' }
      ]);
    });
  });

  it('debounces validation correctly', async () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result, rerender } = renderHook(
      ({ data }) => useOptimizedValidation(data, { debounce: 100 }),
      {
        initialProps: { data: testData }
      }
    );

    // Rapidly change data
    rerender({ data: { ...testData, name: 'Changed 1' } });
    rerender({ data: { ...testData, name: 'Changed 2' } });
    rerender({ data: { ...testData, name: 'Changed 3' } });

    await waitFor(() => {
      expect(mockValidateTravelForm).toHaveBeenCalledTimes(1);
    }, { timeout: 200 });

    expect(result.current.lastValidated).toBeInstanceOf(Date);
  });
});
