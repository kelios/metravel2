import { translate as i18nT } from '@/i18n'
import type { TranslationKey } from '@/i18n/resources'
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
      // Бэк умеет отвечать НЕ строкой, а списком объектов с указанием проблемных
      // элементов: `{coordsMeTravel: [{index, id, address, field, message}, ...]}`
      // (`_validate_coordinate_categories_for_moderation`, upsert_travel_service.py).
      // Раньше такой ответ не давал ни одной строки, и пользователь видел
      // «Ошибка запроса: Bad Request» без единой подсказки, что чинить.
      const structured = describeStructuredItems(value)
      if (structured) {
        return `${field}: ${structured}`
      }
    }
  }
  return undefined
}

const ITEM_MESSAGE_FIELDS = ['message', 'detail', 'error'] as const
const ITEM_CONTEXT_FIELDS = ['address', 'name', 'title', 'label'] as const
const STRUCTURED_ITEMS_LIMIT = 3

const readTextField = (
  item: Record<string, unknown>,
  fields: readonly string[],
): string | undefined => {
  for (const field of fields) {
    const value = item[field]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return undefined
}

/**
 * Собирает читаемый текст из списка объектов-ошибок: общее сообщение плюс
 * перечисление проблемных элементов (номер + название), не более трёх.
 */
const describeStructuredItems = (items: unknown[]): string | undefined => {
  const records = items.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item),
  )
  if (records.length === 0) return undefined

  const message = records
    .map((item) => readTextField(item, ITEM_MESSAGE_FIELDS))
    .find((text): text is string => !!text)

  const described = records.slice(0, STRUCTURED_ITEMS_LIMIT).map((item) => {
    const context = readTextField(item, ITEM_CONTEXT_FIELDS)
    const index = Number(item.index)
    // `index` у бэка 0-based, пользователю показываем человеческую нумерацию.
    const position = Number.isFinite(index) ? `#${index + 1}` : undefined
    return [position, context].filter(Boolean).join(' ')
  }).filter((text) => text.length > 0)

  const rest = records.length - described.length
  const list = described.length > 0
    ? `${described.join(', ')}${rest > 0 ? ` +${rest}` : ''}`
    : undefined

  if (message && list) return `${message} (${list})`
  return message ?? list
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

// Здесь живёт всё знание об английских текстах, которые приходят с бэкенда.
// Две функции ниже намеренно раздельные, и новое правило надо класть ровно в ту,
// чей контракт ему подходит:
//
// - mapKnownServerErrorToRu распознаёт КОНКРЕТНЫЕ бизнес-ситуации. Её не-null —
//   сигнал вызывающему, что случай особый: useTravelFormPersistence по нему
//   переписывает заголовок тоста на «Сохранено как черновик» и меняет тип на
//   info. Обычная ошибка валидации, попавшая сюда, притворилась бы успешным
//   сохранением, поэтому расширять её дефолтами DRF нельзя.
// - localizeBackendFieldError переводит РЯДОВЫЕ полевые сообщения DRF и никаких
//   решений вызывающему не сообщает.

// Маппинг известных технических серверных ошибок (англ. текст DRF-валидаторов)
// в человекочитаемые локализованные RU-сообщения. Возвращает null, если
// сообщение не распознано — вызывающий код показывает свой fallback.
export const mapKnownServerErrorToRu = (rawMessage: string): string | null => {
  const message = rawMessage.toLowerCase()

  // publish: Published travels must pass moderation before they can be published.
  // Отправка на модерацию нового ещё не одобренного маршрута: бэк требует, чтобы
  // публикация прошла модерацию. Для пользователя это ожидаемый флоу «на модерации».
  if (
    message.includes('must pass moderation') ||
    (message.includes('publish') && message.includes('moderation'))
  ) {
    return i18nT('errors:utils.errorHelpers.marshrut_sohranen_kak_chernovik_no_poka_ne_m_b7966ec1')
  }

  return null
}

// Дефолты DRF приходят только по-английски: `{"email":["Enter a valid email
// address."]}`, `{"detail":"Request was throttled..."}`. Ключ ищется по
// нормализованному тексту — точное совпадение, без эвристик по подстрокам:
// иначе своя формулировка бэкенда молча подменяется чужим смыслом.
const DRF_MESSAGE_KEYS: Record<string, TranslationKey> = {
  // rest_framework.fields.EmailField.default_error_messages
  'enter a valid email address.': 'errorsStatic:api.backendErrors.invalidEmail',
  // rest_framework.fields.Field / CharField.default_error_messages
  'this field is required.': 'errorsStatic:api.backendErrors.fieldRequired',
  'this field may not be blank.': 'errorsStatic:api.backendErrors.fieldRequired',
  'this field may not be null.': 'errorsStatic:api.backendErrors.fieldRequired',
}

// Единственное сообщение с переменной частью, которое реально доходит до
// пользователя: ScopedRateThrottle подставляет в него оставшиеся секунды
// ("Request was throttled. Expected available in 42 seconds."), поэтому точным
// совпадением его не поймать.
const THROTTLED_PREFIX = 'request was throttled'

const firstFieldMessage = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  return raw.trim() || undefined
}

/**
 * Первое сообщение полевой ошибки DRF (`{field: ["..."]}` или `{field: "..."}`)
 * в локали пользователя. Незнакомое сообщение возвращается как есть — чтобы новые
 * серверные формулировки не проглатывались в пустоту, отсутствующее/пустое —
 * `undefined`, чтобы вызывающий код пошёл дальше по своей цепочке фолбэков.
 */
export const localizeBackendFieldError = (value: unknown): string | undefined => {
  const message = firstFieldMessage(value)
  if (!message) return undefined

  const normalized = message.toLowerCase()
  if (normalized.startsWith(THROTTLED_PREFIX)) {
    return i18nT('errorsStatic:api.misc.tooManyAttempts')
  }

  const key = DRF_MESSAGE_KEYS[normalized]
  return key ? i18nT(key) : message
}
