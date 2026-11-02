import { translate as i18nT } from '@/i18n'
import { sanitizeAuthSubject } from '@/utils/authNavigation'

/**
 * #2898: заголовок и выгода экрана входа/регистрации по намерению гостя
 * (`docs/features/ux-audit-2026-11-mocks.md` §1). Экран говорит, зачем
 * аккаунт именно сейчас, а не «С возвращением» на всё.
 */
export type AuthIntentGroup = 'calendar' | 'favorite' | 'offline' | 'author' | 'book' | 'quest'

const INTENT_GROUPS: Record<string, AuthIntentGroup> = {
  calendar: 'calendar',
  'plan-trip': 'calendar',
  favorite: 'favorite',
  'save-point': 'favorite',
  offline: 'offline',
  'share-trip': 'author',
  'create-travel': 'author',
  'add-place': 'author',
  'edit-travel': 'author',
  author: 'author',
  'create-book': 'book',
  'build-pdf': 'book',
  quest: 'quest',
}

// Ключи — литералами: веб-компиляция переводов не принимает ключи из шаблонных строк.
// `titleWithSubject` есть только там, где название осмысленно (план, избранное, офлайн).
const INTENT_KEYS: Record<AuthIntentGroup, { title: string; titleWithSubject?: string; subtitle: string }> = {
  calendar: {
    title: 'authStatic:authScreen.intent.calendar.title',
    titleWithSubject: 'authStatic:authScreen.intent.calendar.titleWithSubject',
    subtitle: 'authStatic:authScreen.intent.calendar.subtitle',
  },
  favorite: {
    title: 'authStatic:authScreen.intent.favorite.title',
    titleWithSubject: 'authStatic:authScreen.intent.favorite.titleWithSubject',
    subtitle: 'authStatic:authScreen.intent.favorite.subtitle',
  },
  offline: {
    title: 'authStatic:authScreen.intent.offline.title',
    titleWithSubject: 'authStatic:authScreen.intent.offline.titleWithSubject',
    subtitle: 'authStatic:authScreen.intent.offline.subtitle',
  },
  author: {
    title: 'authStatic:authScreen.intent.author.title',
    subtitle: 'authStatic:authScreen.intent.author.subtitle',
  },
  book: {
    title: 'authStatic:authScreen.intent.book.title',
    subtitle: 'authStatic:authScreen.intent.book.subtitle',
  },
  quest: {
    title: 'authStatic:authScreen.intent.quest.title',
    subtitle: 'authStatic:authScreen.intent.quest.subtitle',
  },
}

export const resolveAuthIntentGroup = (intent: unknown): AuthIntentGroup | null => {
  const raw = Array.isArray(intent) ? intent[0] : intent
  if (typeof raw !== 'string') return null
  return INTENT_GROUPS[raw.trim()] ?? null
}

export type AuthIntentCopy = { title: string; subtitle: string; group: AuthIntentGroup }

/**
 * Копия под намерение или `null` — тогда форма показывает свой общий заголовок.
 * Название (`subject`) подставляется только у групп, где оно осмысленно
 * (план, избранное, офлайн); без него — общая формулировка той же группы.
 */
export const resolveAuthIntentCopy = (intent: unknown, subject?: unknown): AuthIntentCopy | null => {
  const group = resolveAuthIntentGroup(intent)
  if (!group) return null
  const safeSubject = sanitizeAuthSubject(subject)
  const withSubject = Boolean(safeSubject)
  const keys = INTENT_KEYS[group]
  return {
    group,
    title: withSubject && keys.titleWithSubject
      ? i18nT(keys.titleWithSubject, { subject: safeSubject })
      : i18nT(keys.title),
    subtitle: i18nT(keys.subtitle),
  }
}
