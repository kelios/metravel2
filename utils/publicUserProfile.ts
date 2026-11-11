// #3237: публичный профиль автора для серверного HTML — страница /user/<id> и
// `author.sameAs` в разметке статьи. Источник — анонимный GET
// /api/user/<id>/profile/ (контракт #3240). Берём только перечисленные поля;
// биографии в API нет, ничего сверх ответа не выдумываем.

import { normalizeExternalUrl } from '@/utils/externalLinks'

export const PUBLIC_PROFILE_SOCIAL_KEYS = ['youtube', 'instagram', 'facebook', 'telegram', 'twitter', 'vk'] as const

export type PublicUserProfile = {
  userId: number
  name: string
  avatar: string | null
  isVerified: boolean
  /** Абсолютные http(s)-адреса соцсетей; пустые и не-URL значения (`@handle`) отброшены. */
  sameAs: string[]
}

const SITE_URL = 'https://metravel.by'

// Только то, что автор сам ввёл как абсолютный адрес: `@handle` или `t.me/x` в
// URL не достраиваем — это было бы догадкой о профиле.
const absoluteUrl = (value: unknown): string =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? normalizeExternalUrl(value.trim()) : ''

const text = (value: unknown, limit = 200): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

/** Положительный целый id из сегмента пути `/user/<id>`; иначе `null`. */
export function parsePublicUserId(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !/^[1-9]\d{0,9}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

/** Белый список полей ответа профиля; `null`, если ответ не про этого пользователя. */
export function projectPublicUserProfile(raw: unknown, userId: number): PublicUserProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (record.user != null && Number(record.user) !== userId) return null
  const name = [text(record.first_name), text(record.last_name)].filter(Boolean).join(' ')
  if (!name) return null
  const avatar = [record.avatar, record.external_avatar].map(absoluteUrl).find(Boolean) || null
  const sameAs = PUBLIC_PROFILE_SOCIAL_KEYS
    .map((key) => absoluteUrl(record[key]))
    .filter((url, index, all) => Boolean(url) && all.indexOf(url) === index)
  return { userId, name, avatar, isVerified: record.is_verified === true, sameAs }
}

export const publicUserProfilePath = (userId: number) => `/user/${userId}`

/** schema.org Person страницы автора. */
export function buildPublicUserPersonJsonLd(profile: PublicUserProfile) {
  const url = `${SITE_URL}${publicUserProfilePath(profile.userId)}`
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name: profile.name,
      url,
      ...(profile.avatar ? { image: profile.avatar } : {}),
      ...(profile.sameAs.length ? { sameAs: profile.sameAs } : {}),
    },
  }
}
