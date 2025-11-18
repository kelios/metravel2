const DEFAULT_BELARUS_ID = 3

export const NUMERIC_FILTER_FIELDS = [
  'countries',
  'categories',
  'transports',
  'companions',
  'complexity',
  'month',
  'over_nights_stay',
  'categoryTravelAddress',
]

export interface TravelFilterContext {
  isMeTravel?: boolean
  isExport?: boolean
  isTravelBy?: boolean
  belarusId?: number
  userId?: string | null
  routeUserId?: string
}

const isEmptyValue = (value: any) => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

export const normalizeNumericArray = (values: any): number[] => {
  if (!Array.isArray(values)) return []
  return values
    .map((item) => (typeof item === 'number' ? item : Number(String(item).trim())))
    .filter((item) => Number.isFinite(item))
}

const sanitizeFilterObject = (
  filter: Record<string, any>,
  numericFields: string[] = NUMERIC_FILTER_FIELDS,
) => {
  const sanitized: Record<string, any> = {}
  const numericSet = new Set(numericFields)

  Object.entries(filter || {}).forEach(([key, value]) => {
    if (isEmptyValue(value)) return

    if (Array.isArray(value)) {
      const isNumeric = numericSet.has(key)
      const cleanedArray = isNumeric
        ? normalizeNumericArray(value)
        : value.filter((item) => !isEmptyValue(item))

      if (cleanedArray.length > 0) {
        sanitized[key] = cleanedArray
      }
      return
    }

    sanitized[key] = value
  })

  return sanitized
}

const sortObjectKeys = (obj: Record<string, any>) => {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, any>>((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {})
}

export const buildTravelQueryParams = (
  filter: Record<string, any>,
  context: TravelFilterContext = {},
) => {
  const {
    isMeTravel,
    isExport,
    isTravelBy,
    belarusId = DEFAULT_BELARUS_ID,
    userId,
    routeUserId,
  } = context

  const normalized = sanitizeFilterObject(filter)
  const params: Record<string, any> = { ...normalized }

  // ✅ ИСПРАВЛЕНИЕ: Используем moderation напрямую из filter, не перезаписываем если он уже есть
  if (!(isMeTravel || isExport)) {
    // Устанавливаем moderation и publish только если их нет в filter
    if (!('moderation' in normalized) && !('moderation' in filter)) {
      // По умолчанию: опубликованные и прошедшие модерацию
      params.publish = 1
      params.moderation = 1
    } else if (!('publish' in normalized) && !('publish' in filter)) {
      // Если moderation есть, но publish нет, устанавливаем publish по умолчанию
      const moderationValue = normalized.moderation !== undefined ? normalized.moderation : filter.moderation
      if (moderationValue === 1) {
        params.publish = 1
      }
    }
  }

  if (isMeTravel || isExport) {
    if (userId) params.user_id = userId
  } else if (routeUserId) {
    params.user_id = routeUserId
  }

  if (isTravelBy) {
    params.countries = [belarusId]
  }

  if (isMeTravel) {
    delete params.publish
    delete params.moderation
  }

  return sortObjectKeys(params)
}

export const mapCategoryNamesToIds = (
  selectedNames: string[],
  availableCategories: { id: string | number; name: string }[] = [],
): number[] => {
  if (!selectedNames?.length || !availableCategories?.length) return []

  const lookup = new Map<string, number>()
  availableCategories.forEach((category) => {
    const nameKey = String(category?.name || '').trim().toLowerCase()
    if (!nameKey) return
    const numericId =
      typeof category.id === 'number' ? category.id : Number(String(category.id).trim())
    if (!Number.isFinite(numericId)) return
    lookup.set(nameKey, numericId)
  })

  return selectedNames
    .map((name) => lookup.get(String(name || '').trim().toLowerCase()))
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
}

