import { localizeBackendFieldError } from '@/utils/errorHelpers'
import { i18n } from '@/i18n'

describe('localizeBackendFieldError', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('translates the default DRF email error instead of showing English', () => {
    // Реальный ответ прода: POST /api/subscribe/ {"email":"a@b..c"} -> 400.
    expect(localizeBackendFieldError(['Enter a valid email address.'])).toBe(
      'Введите корректный email',
    )
    expect(localizeBackendFieldError('Enter a valid email address.')).toBe(
      'Введите корректный email',
    )
  })

  it('translates DRF required/blank/null field errors', () => {
    expect(localizeBackendFieldError(['This field is required.'])).toBe('Заполните это поле')
    expect(localizeBackendFieldError(['This field may not be blank.'])).toBe('Заполните это поле')
    expect(localizeBackendFieldError(['This field may not be null.'])).toBe('Заполните это поле')
  })

  it('translates the throttle detail despite its variable seconds part', () => {
    expect(
      localizeBackendFieldError('Request was throttled. Expected available in 42 seconds.'),
    ).toBe('Слишком много попыток. Попробуйте позже.')
  })

  it('passes unknown backend messages through instead of swallowing them', () => {
    const custom = 'Use letters, numbers, dots, colons, underscores, or hyphens.'
    expect(localizeBackendFieldError([custom])).toBe(custom)
    expect(localizeBackendFieldError('Сообщение от бэкенда')).toBe('Сообщение от бэкенда')
  })

  it('returns undefined for empty or non-string payloads so the caller falls through', () => {
    expect(localizeBackendFieldError(undefined)).toBeUndefined()
    expect(localizeBackendFieldError(null)).toBeUndefined()
    expect(localizeBackendFieldError([])).toBeUndefined()
    expect(localizeBackendFieldError(['   '])).toBeUndefined()
    expect(localizeBackendFieldError({ email: 'x' })).toBeUndefined()
    expect(localizeBackendFieldError(42)).toBeUndefined()
  })

  it('matches case- and whitespace-insensitively', () => {
    expect(localizeBackendFieldError([' Enter a valid email address. '])).toBe(
      'Введите корректный email',
    )
  })

  it.each([
    ['be', 'Увядзіце карэктны email'],
    ['uk', 'Введіть коректний email'],
    ['pl', 'Wpisz poprawny adres e-mail'],
    ['en', 'Enter a correct email'],
  ] as const)('renders the email error in %s', async (locale, expected) => {
    // Локаль пользователя, а не English DRF default — суть тикета #1505.
    await i18n.changeLanguage(locale)
    expect(localizeBackendFieldError(['Enter a valid email address.'])).toBe(expected)
  })
})
