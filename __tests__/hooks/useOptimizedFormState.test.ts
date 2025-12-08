import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOptimizedFormState } from '@/hooks/useOptimizedFormState';

// Mock lodash isEqual
jest.mock('lodash/isEqual', () => ({
  __esModule: true,
  default: jest.fn((a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)),
}));

describe('useOptimizedFormState', () => {
  const initialData = {
    name: '',
    description: '',
    countries: [],
  };

  it('initializes with correct state', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    expect(result.current.data).toEqual(initialData);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toBeInstanceOf(Set);
    expect(result.current.touched.size).toBe(0);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('updates field correctly', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    act(() => {
      result.current.updateField('name', 'Test Travel');
    });

    expect(result.current.data.name).toBe('Test Travel');
    expect(result.current.touched.has('name')).toBe(true);
    expect(result.current.isDirty).toBe(true);
  });

  it('updates multiple fields correctly', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    act(() => {
      result.current.updateFields({
        name: 'Test Travel',
        description: 'Test Description',
      });
    });

    expect(result.current.data.name).toBe('Test Travel');
    expect(result.current.data.description).toBe('Test Description');
    expect(result.current.touched.has('name')).toBe(true);
    expect(result.current.touched.has('description')).toBe(true);
    expect(result.current.isDirty).toBe(true);
  });

  it('validates field on change when enabled', async () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData, {
        validateOnChange: true,
        validationDebounce: 100,
      })
    );

    act(() => {
      result.current.updateField('name', '');
    });

    await waitFor(() => {
      expect(result.current.errors).toEqual({});
    });
  });

  it('handles manual save', async () => {
    const mockSave = jest.fn().mockResolvedValue({ id: 1, name: 'Saved' });
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData, {
        onSave: mockSave,
      })
    );

    act(() => {
      result.current.updateField('name', 'Test Travel');
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockSave).toHaveBeenCalledWith(result.current.data);
    expect(result.current.isDirty).toBe(false);
  });

  it('handles save error', async () => {
    const mockSave = jest.fn().mockRejectedValue(new Error('Save failed'));
    const mockOnError = jest.fn();
    
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData, {
        onSave: mockSave,
        onError: mockOnError,
      })
    );

    act(() => {
      result.current.updateField('name', 'Test Travel');
    });

    await act(async () => {
      try {
        await result.current.save();
      } catch (error) {
        // Expected to throw
      }
    });

    expect(mockOnError).toHaveBeenCalled();
  });

  it('resets form correctly', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    act(() => {
      result.current.updateField('name', 'Test Travel');
      result.current.setFieldError('name', 'Error');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toEqual(initialData);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched.size).toBe(0);
    expect(result.current.isDirty).toBe(false);
  });

  it('resets form with new data', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    const newData = { name: 'New Travel', description: 'New Description', countries: [] };

    act(() => {
      result.current.updateField('name', 'Test Travel');
    });

    act(() => {
      result.current.reset(newData);
    });

    expect(result.current.data).toEqual(newData);
    expect(result.current.isDirty).toBe(false);
  });

  it('manages errors correctly', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    act(() => {
      result.current.setFieldError('name', 'Name is required');
    });

    expect(result.current.errors.name).toBe('Name is required');
    expect(result.current.isValid).toBe(false);
    expect(result.current.getFieldError('name')).toBe('Name is required');
    expect(result.current.hasError('name')).toBe(true);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it('checks touched status correctly', () => {
    const { result } = renderHook(() => 
      useOptimizedFormState(initialData)
    );

    expect(result.current.isTouched('name')).toBe(false);

    act(() => {
      result.current.updateField('name', 'Test');
    });

    expect(result.current.isTouched('name')).toBe(true);
  });
});
