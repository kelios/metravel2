export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getErrorMessage = (error: unknown, fallback = ''): string => {
  if (error instanceof Error && typeof error.message === 'string') return error.message
  if (isRecord(error) && typeof error.message === 'string') return error.message
  return fallback
}

export const getErrorName = (error: unknown): string | null => {
  if (error instanceof Error && typeof error.name === 'string') return error.name
  if (isRecord(error) && typeof error.name === 'string') return error.name
  return null
}

export const getErrorTextField = (
  data: unknown,
  field: 'message' | 'detail',
): string | undefined => {
  if (!data || typeof data !== 'object') return undefined
  const value = (data as Record<string, unknown>)[field]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export const getFirstValidationErrorMessage = (
  data: unknown,
): string | undefined => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const entries = Object.entries(data as Record<string, unknown>)
  for (const [field, value] of entries) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return `${field}: ${value.trim()}`
    }
    if (Array.isArray(value)) {
      const firstString = value.find(
        (item) => typeof item === 'string' && item.trim().length > 0,
      )
      if (typeof firstString === 'string') {
        return `${field}: ${firstString.trim()}`
      }
    }
  }
  return undefined
}

export const hasToastBeenShown = (error: unknown): boolean =>
  error instanceof Error &&
  (error as Error & { toastShown?: boolean }).toastShown === true

export const getApiErrorMessage = (
  data: unknown,
  fallbackStatusText: string,
): string => {
  return (
    getErrorTextField(data, 'message') ||
    getErrorTextField(data, 'detail') ||
    getFirstValidationErrorMessage(data) ||
    `Ошибка запроса: ${fallbackStatusText}`
  )
}
