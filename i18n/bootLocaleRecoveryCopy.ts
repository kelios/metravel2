import type { SupportedLocale } from './config'

// A tiny eager catalogue: these messages must work when the deferred locale
// chunk itself is unavailable. Do not import full locale bundles into boot.
const BOOT_RECOVERY_COPY = {
  ru: { slow: 'Загружаем язык интерфейса…', failed: 'Не удалось загрузить язык интерфейса.', retry: 'Повторить', fallback: 'Продолжить на русском' },
  be: { slow: 'Загружаем мову інтэрфейсу…', failed: 'Не ўдалося загрузіць мову інтэрфейсу.', retry: 'Паўтарыць', fallback: 'Працягнуць па-руску' },
  uk: { slow: 'Завантажуємо мову інтерфейсу…', failed: 'Не вдалося завантажити мову інтерфейсу.', retry: 'Повторити', fallback: 'Продовжити російською' },
  pl: { slow: 'Ładowanie języka interfejsu…', failed: 'Nie udało się załadować języka interfejsu.', retry: 'Spróbuj ponownie', fallback: 'Kontynuuj po rosyjsku' },
  en: { slow: 'Loading the interface language…', failed: 'The interface language could not be loaded.', retry: 'Try again', fallback: 'Continue in Russian' },
} satisfies Record<SupportedLocale, { slow: string; failed: string; retry: string; fallback: string }>

export const getBootLocaleRecoveryCopy = (locale: SupportedLocale) => BOOT_RECOVERY_COPY[locale]
