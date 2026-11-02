import { Platform } from 'react-native'

type BuildLoginHrefParams = {
  redirect?: string | null
  intent?: string | null
  fallbackRedirect?: string
  /**
   * #2898: что именно гость пытался сделать — название маршрута/статьи для
   * заголовка экрана («Сохраните «Гродно за 1 день» в план»). Только текст для
   * показа, в логику не идёт; чистится `sanitizeAuthSubject`.
   */
  subject?: string | null
}

const AUTH_SUBJECT_MAX_LENGTH = 80

/** Текст заголовка из query: без кавычек-ёлочек и переводов строк, не длиннее 80 символов. */
export const sanitizeAuthSubject = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  const cleaned = raw.replace(/[«»"\u201c\u201d]/g, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return undefined
  return cleaned.length > AUTH_SUBJECT_MAX_LENGTH
    ? `${cleaned.slice(0, AUTH_SUBJECT_MAX_LENGTH - 1).trimEnd()}…`
    : cleaned
}

/**
 * #2898: намерения-действия гостя («в план», «в избранное», «рассказать о
 * поездке», «книга»…). Для них по умолчанию открывается регистрация, а не
 * «С возвращением»: человек ещё не знает, что у него будет аккаунт. Вход —
 * только если на этом устройстве уже входили (`hasSignedInBefore`).
 * Страничные намерения (`profile`, `favorites`, `menu`, `settings`…) ведут на
 * вход как раньше.
 */
export const REGISTER_FIRST_INTENTS: ReadonlySet<string> = new Set([
  'calendar',
  'favorite',
  'offline',
  'share-trip',
  'create-travel',
  'add-place',
  'create-book',
  'build-pdf',
  'plan-trip',
  'save-point',
  'subscribe',
  'author',
])

const SIGNED_IN_BEFORE_KEY = 'metravel:has-signed-in'

/** Локальный признак «на этом устройстве уже входили» (web). Без хранилища — false. */
export const hasSignedInBefore = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIGNED_IN_BEFORE_KEY) === '1'
  } catch {
    return false
  }
}

export const markSignedInBefore = (): void => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIGNED_IN_BEFORE_KEY, '1')
  } catch {
    // Признак — удобство, не контракт: без хранилища гость просто увидит регистрацию.
  }
}

const RAW_WHITESPACE_PATTERN = /\s/
const SCHEME_AFTER_ROOT_PATTERN = /^\/[a-z][a-z\d+.-]*:/i
const PERCENT_ESCAPE_PATTERN = /%[\da-f]{2}/i
const MAX_DECODE_PASSES = 4

const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index)
    if (charCode <= 31 || charCode === 127) return true
  }
  return false
}

const isSafeInternalRedirect = (value: string): boolean => {
  if (!value) return false

  let layer = value
  for (let pass = 0; pass <= MAX_DECODE_PASSES; pass += 1) {
    if (
      !layer.startsWith('/') ||
      layer.startsWith('//') ||
      layer.includes('\\') ||
      hasControlCharacter(layer) ||
      SCHEME_AFTER_ROOT_PATTERN.test(layer) ||
      (pass === 0 && RAW_WHITESPACE_PATTERN.test(layer))
    ) {
      return false
    }

    if (!PERCENT_ESCAPE_PATTERN.test(layer)) {
      // A literal percent in the original value is malformed. A percent that
      // appears only after decoding (for example, `%25`) is safe URL data.
      return pass > 0 || !layer.includes('%')
    }

    let decoded: string
    try {
      decoded = decodeURIComponent(layer)
    } catch {
      // A malformed escape in the untrusted raw value is invalid. If a fully
      // valid first decode merely reveals a literal percent sequence in safe
      // internal URL data, there is no additional structural layer to inspect.
      return pass > 0
    }

    if (decoded === layer) return true
    layer = decoded
  }

  // Refuse unusually deep encoding instead of leaving another decoding layer
  // that could reveal a protocol-relative or scheme URL later.
  return false
}

export const normalizeInternalAuthRedirect = (
  value: unknown,
  fallbackRedirect: string = '/',
): string => {
  const safeFallback = isSafeInternalRedirect(fallbackRedirect) ? fallbackRedirect : '/'
  return typeof value === 'string' && isSafeInternalRedirect(value) ? value : safeFallback
}

export const resolvePostAuthPath = ({
  redirect,
  intent,
  fallbackRedirect = '/',
}: BuildLoginHrefParams = {}): string => {
  if (intent === 'create-book') return '/travel/new'
  if (intent === 'build-pdf') return '/export'
  return normalizeInternalAuthRedirect(redirect, fallbackRedirect)
}

export const getWebRedirectPath = (fallbackRedirect: string = '/') => {
  const safeFallback = normalizeInternalAuthRedirect(null, fallbackRedirect)
  if (Platform.OS !== 'web') return safeFallback
  if (typeof window === 'undefined') return safeFallback

  try {
    const { pathname, search, hash } = window.location
    const combined = `${pathname || ''}${search || ''}${hash || ''}`
    return normalizeInternalAuthRedirect(combined, safeFallback)
  } catch {
    return safeFallback
  }
}

const buildAuthQuery = ({
  redirect,
  intent,
  fallbackRedirect = '/',
  subject,
}: BuildLoginHrefParams) => {
  const resolvedRedirect =
    redirect && redirect.length > 0
      ? normalizeInternalAuthRedirect(redirect, fallbackRedirect)
      : getWebRedirectPath(fallbackRedirect)

  const params = new URLSearchParams()
  params.set('redirect', resolvedRedirect)
  if (intent) params.set('intent', String(intent))
  const safeSubject = sanitizeAuthSubject(subject)
  if (safeSubject) params.set('subject', safeSubject)
  return params.toString()
}

/**
 * Вход для гостя. Для намерения-действия (`REGISTER_FIRST_INTENTS`) на
 * устройстве, где ещё не входили, ведёт на регистрацию (#2898): у той же формы
 * есть «Уже есть аккаунт? Войти» с теми же `redirect`/`intent`.
 */
export const buildLoginHref = (params: BuildLoginHrefParams = {}) => {
  const query = buildAuthQuery(params)
  const registerFirst = Boolean(params.intent && REGISTER_FIRST_INTENTS.has(String(params.intent)))
    && !hasSignedInBefore()
  return `${registerFirst ? '/registration' : '/login'}?${query}`
}

export const buildRegistrationHref = (params: BuildLoginHrefParams = {}) =>
  `/registration?${buildAuthQuery(params)}`

/** Явный переход на вход (ссылка «Уже есть аккаунт? Войти»): без перенаправления на регистрацию. */
export const buildExplicitLoginHref = (params: BuildLoginHrefParams = {}) =>
  `/login?${buildAuthQuery(params)}`
