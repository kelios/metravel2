import { useOptimizedFormState } from './useOptimizedFormState'
import { useOptimizedValidation } from './useOptimizedValidation'

export * from './useOptimizedFormState'
export * from './useOptimizedValidation'

type FormStateOptions<T extends object> = Parameters<
  typeof useOptimizedFormState<T>
>[1] & {
  enableValidation?: boolean
}

export function useFormState<T extends object>(
  initialData: T,
  options: FormStateOptions<T> = {}
) {
  const form = useOptimizedFormState(initialData, options)

  const validation = useOptimizedValidation(form.data, {
    enabled: Boolean(options?.enableValidation),
    debounce: options?.validationDebounce,
    validateOnChange: options?.validateOnChange,
  })

  return {
    ...form,
    validation,
  }
}
