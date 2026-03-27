import type { Travel } from '@/types/types'

const WATERMARK_DOMAINS = [
  'shutterstock',
  'istockphoto',
  'gettyimages',
  'depositphotos',
  'dreamstime',
  'alamy',
]

export const isLikelyWatermarked = (url: string | null | undefined): boolean => {
  if (!url) return false
  const lower = url.toLowerCase()
  return WATERMARK_DOMAINS.some((domain) => lower.includes(domain))
}

export const normalizeOwnerIds = (raw: unknown): string[] => {
  if (raw == null) return []

  if (Array.isArray(raw)) {
    return raw
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  }

  const normalized = String(raw).trim()
  if (!normalized) return []

  if (!normalized.includes(',')) {
    return [normalized]
  }

  return normalized
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export const resolveTravelAuthorName = (travel: Travel, userName: unknown): string => {
  const userObj = travel.user
  if (userObj) {
    const firstName = userObj.first_name || userObj.name
    const lastName = userObj.last_name

    if (firstName && typeof firstName === 'string' && firstName.trim()) {
      const cleanFirstName = firstName.trim()
      if (lastName && typeof lastName === 'string' && lastName.trim()) {
        return `${cleanFirstName} ${lastName.trim()}`.trim()
      }
      return cleanFirstName
    }
  }

  const directName =
    (travel as any).author_name ||
    (travel as any).authorName ||
    (travel as any).owner_name ||
    (travel as any).ownerName
  if (directName && typeof directName === 'string' && directName.trim()) {
    const clean = directName.trim()
    if (!/^[.\s\u00B7\u2022]+$|^Автор|^Пользователь|^User/i.test(clean)) {
      return clean
    }
  }

  if (typeof userName === 'string' && userName.trim()) {
    const clean = userName.trim()
    if (!/^[.\s\u00B7\u2022]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i.test(clean)) {
      return clean
    }
  }

  return ''
}

export const resolveTravelAuthorDisplayName = (authorName: string): string => {
  const value = String(authorName || '').trim()
  if (!value) return ''
  if (/^[.\s\u00B7\u2022_-]+$/.test(value)) return ''
  return value
}
