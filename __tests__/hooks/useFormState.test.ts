import { act, renderHook, waitFor } from '@testing-library/react'
import { useFormState } from '@/hooks/useFormState'
import { validateTravelForm } from '@/utils/formValidation'

jest.mock('fast-deep-equal', () => ({
  __esModule: true,
  default: jest.fn((a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)),
}))

jest.mock('@/utils/formValidation', () => ({
  validateTravelForm: jest.fn(),
}))

const mockValidateTravelForm =
  validateTravelForm as jest.MockedFunction<typeof validateTravelForm>

describe('useFormState (facade)', () => {
  const initialData = {
    name: '',
    description: '',
    countries: [] as string[],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initializes with correct form state', () => {
    const { result } = renderHook(() => useFormState(initialData))

    expect(result.current.data).toEqual(initialData)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toBeInstanceOf(Set)
    expect(result.current.touched.size).toBe(0)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.isValid).toBe(true)
    expect(result.current.isSubmitting).toBe(false)

    // Validation facade exists but is disabled by default
    expect(result.current.validation.errors).toEqual([])
    expect(result.current.validation.isValid).toBe(true)
    expect(result.current.validation.isValidating).toBe(false)
    expect(result.current.validation.lastValidated).toBeNull()
  })

  it('updates field correctly', () => {
    const { result } = renderHook(() => useFormState(initialData))

    act(() => {
      result.current.updateField('name', 'Test Travel')
    })

    expect(result.current.data.name).toBe('Test Travel')
    expect(result.current.touched.has('name')).toBe(true)
    expect(result.current.isDirty).toBe(true)
  })

  it('updates multiple fields correctly', () => {
    const { result } = renderHook(() => useFormState(initialData))

    act(() => {
      result.current.updateFields({
        name: 'Test Travel',
        description: 'Test Description',
      })
    })

    expect(result.current.data.name).toBe('Test Travel')
    expect(result.current.data.description).toBe('Test Description')
    expect(result.current.touched.has('name')).toBe(true)
    expect(result.current.touched.has('description')).toBe(true)
    expect(result.current.isDirty).toBe(true)
  })

  it('handles manual save', async () => {
    const mockSave = jest.fn().mockResolvedValue({ id: 1, name: 'Saved' })

    const { result } = renderHook(() =>
      useFormState(initialData, {
        onSave: mockSave,
      })
    )

    act(() => {
      result.current.updateField('name', 'Test Travel')
    })

    await act(async () => {
      try {
        await result.current.save()
      } catch {
        // keep behavior parity with underlying hook
      }
    })

    expect(mockSave).toHaveBeenCalledWith(result.current.data)
    expect(result.current.isDirty).toBe(false)
  })

  it('handles save error', async () => {
    const mockSave = jest.fn().mockRejectedValue(new Error('Save failed'))
    const mockOnError = jest.fn()

    const { result } = renderHook(() =>
      useFormState(initialData, {
        onSave: mockSave,
        onError: mockOnError,
      })
    )

    act(() => {
      result.current.updateField('name', 'Test Travel')
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow('Save failed')
    })

    expect(mockOnError).toHaveBeenCalled()
  })

  it('resets form correctly', () => {
    const { result } = renderHook(() => useFormState(initialData))

    act(() => {
      result.current.updateField('name', 'Test Travel')
      result.current.setFieldError('name', 'Error')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toEqual(initialData)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched.size).toBe(0)
    expect(result.current.isDirty).toBe(false)
  })

  it('resets form with new data', () => {
    const { result } = renderHook(() => useFormState(initialData))

    const newData = {
      name: 'New Travel',
      description: 'New Description',
      countries: [] as string[],
    }

    act(() => {
      result.current.updateField('name', 'Test Travel')
    })

    act(() => {
      result.current.reset(newData)
    })

    expect(result.current.data).toEqual(newData)
    expect(result.current.isDirty).toBe(false)
  })

  it('manages errors correctly', () => {
    const { result } = renderHook(() => useFormState(initialData))

    act(() => {
      result.current.setFieldError('name', 'Name is required')
    })

    expect(result.current.errors.name).toBe('Name is required')
    expect(result.current.isValid).toBe(false)
    expect(result.current.getFieldError('name')).toBe('Name is required')
    expect(result.current.hasError('name')).toBe(true)

    act(() => {
      result.current.clearErrors()
    })

    expect(result.current.errors).toEqual({})
    expect(result.current.isValid).toBe(true)
  })

  it('checks touched status correctly', () => {
    const { result } = renderHook(() => useFormState(initialData))

    expect(result.current.isTouched('name')).toBe(false)

    act(() => {
      result.current.updateField('name', 'Test')
    })

    expect(result.current.isTouched('name')).toBe(true)
  })

  it('does not validate when validation is disabled (default)', async () => {
    mockValidateTravelForm.mockReturnValue({ isValid: true, errors: [] })

    const { result } = renderHook(() => useFormState(initialData))

    await act(async () => {
      await result.current.validation.forceValidate()
    })

    expect(mockValidateTravelForm).not.toHaveBeenCalled()
  })

  it('validates when enableValidation is true', async () => {
    mockValidateTravelForm.mockReturnValue({
      isValid: false,
      errors: [{ field: 'name', message: 'Name is required' }],
    })

    const { result } = renderHook(() =>
      useFormState(initialData, {
        enableValidation: true,
        validateOnChange: false,
        validationDebounce: 0,
      })
    )

    await act(async () => {
      await result.current.validation.forceValidate()
    })

    expect(mockValidateTravelForm).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(result.current.validation.isValid).toBe(false)
      expect(result.current.validation.hasErrors).toBe(true)
      expect(result.current.validation.errorCount).toBe(1)
      expect(result.current.validation.getFieldError('name')).toBe(
        'Name is required'
      )
    })
  })
})
