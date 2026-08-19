import type { Travel } from '@/types/types'
import { translate as i18nT } from '@/i18n'

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

const getPetCompanionTokens = () =>
  i18nT('travel:components.listTravel.travelListItemHelpers.petCompanionTokens')
    .split('|')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)

const isPlaceholderAuthorName = (value: string): boolean => {
  if (/^[.\s\u00B7\u2022_-]+$/.test(value)) return true
  const normalized = value.toLocaleLowerCase()
  return i18nT('travel:components.listTravel.travelListItemHelpers.placeholderAuthorPrefixes')
    .split('|')
    .map((prefix) => prefix.trim().toLocaleLowerCase())
    .filter(Boolean)
    .some((prefix) => normalized.startsWith(prefix))
}

export const hasPetCompanion = (companions: unknown): boolean => {
  if (!companions) return false
  const items = Array.isArray(companions) ? companions : [companions]
  for (const item of items) {
    if (!item) continue
    const value =
      typeof item === 'string'
        ? item
        : typeof item === 'object' && item !== null
          ? String((item as any).name ?? '')
          : ''
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) continue
    if (getPetCompanionTokens().some((token) => trimmed.includes(token))) return true
  }
  return false
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
    if (!isPlaceholderAuthorName(clean)) {
      return clean
    }
  }

  if (typeof userName === 'string' && userName.trim()) {
    const clean = userName.trim()
    if (!isPlaceholderAuthorName(clean)) {
      return clean
    }
  }

  return ''
}

export const resolveDisplayTravelYear = (
  year: Travel['year'] | number | null | undefined,
): string | null => {
  if (year == null) return null
  const parsed = Number(String(year).trim())
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null
  return String(parsed)
}

export const resolveTravelAuthorDisplayName = (authorName: string): string => {
  const value = String(authorName || '').trim()
  if (!value) return ''
  if (/^[.\s\u00B7\u2022_-]+$/.test(value)) return ''
  return value
}

/**
 * \u041F\u043E\u0442\u043E\u043B\u043E\u043A DPR \u0434\u043B\u044F \u0432\u0435\u0431\u0430 \u2014 \u0442\u043E\u0442 \u0436\u0435, \u0447\u0442\u043E \u0443 `getOptimalImageWidth`: \u0432\u044B\u0448\u0435 \u0434\u0432\u0443\u0445 \u043F\u0440\u0438\u0440\u043E\u0441\u0442
 * \u0440\u0435\u0437\u043A\u043E\u0441\u0442\u0438 \u043D\u0435 \u0432\u0438\u0434\u0435\u043D, \u0430 \u0431\u0430\u0439\u0442\u044B \u0440\u0430\u0441\u0442\u0443\u0442 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u0438\u0447\u043D\u043E. \u041D\u0430 DPR 3 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u043E\u043B\u0443\u0447\u0438\u0442
 * \u0432\u0435\u0440\u0445\u043D\u044E\u044E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0443\u044E \u0441\u0442\u0443\u043F\u0435\u043D\u044C, \u0430 \u043D\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0432\u0442\u0440\u043E\u0435 \u0442\u044F\u0436\u0435\u043B\u0435\u0435.
 */
const COVER_DPR_CEILING = 2

/**
 * \u0421\u0442\u0443\u043F\u0435\u043D\u0438 `variants` \u0431\u044D\u043A\u0435\u043D\u0434-\u043C\u0430\u043D\u0438\u0444\u0435\u0441\u0442\u0430 \u043E\u0431\u043B\u043E\u0436\u043A\u0438. `maxWidth` \u0432
 * `buildResponsiveImagePropsFromMedia` \u0432\u043B\u0438\u044F\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 fallback `src`, \u0430
 * \u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u044B srcSet \u0431\u0435\u0440\u0443\u0442\u0441\u044F \u0438\u0437 `widths` \u043A\u0430\u043A \u0435\u0441\u0442\u044C \u2014 \u043E\u0431\u0440\u0435\u0437\u0430\u0442\u044C \u043B\u0435\u0441\u0442\u043D\u0438\u0446\u0443 \u043F\u043E\u0434 \u0441\u043B\u043E\u0442
 * \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C.
 */
export const COVER_WIDTH_LADDER = [160, 320, 480, 640, 720, 960] as const

/**
 * \u041B\u0435\u0441\u0442\u043D\u0438\u0446\u0430 \u043E\u0431\u044F\u0437\u0430\u043D\u0430 \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u0441\u043B\u043E\u0442 (\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0441\u0442\u0443\u043F\u0435\u043D\u044C >= maxWidth), \u043D\u043E \u043D\u0435 \u0443\u0445\u043E\u0434\u0438\u0442\u044C
 * \u0432\u044B\u0448\u0435 \u043F\u0435\u0440\u0432\u043E\u0439 \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u044E\u0449\u0435\u0439: \u0432\u0441\u0451, \u0447\u0442\u043E \u0434\u0430\u043B\u044C\u0448\u0435, \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0430 DPR 2 \u0432\u044B\u0431\u0435\u0440\u0435\u0442 \u00AB\u043F\u043E\u0436\u0438\u0440\u043D\u0435\u0435\u00BB,
 * \u0445\u043E\u0442\u044F \u0432 \u0431\u043E\u043A\u0441 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u044D\u0442\u043E \u0443\u0436\u0435 \u043D\u0435 \u043D\u0443\u0436\u043D\u043E.
 */
export function buildCoverWidths(maxWidth: number): number[] {
  const widths = COVER_WIDTH_LADDER.filter((width) => width <= maxWidth)
  const covering = COVER_WIDTH_LADDER.find((width) => width >= maxWidth)
  if (covering != null && !widths.includes(covering)) widths.push(covering)
  return widths.length ? widths : [...COVER_WIDTH_LADDER]
}

/**
 * \u0421\u0442\u0443\u043F\u0435\u043D\u044C, \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u0445\u0432\u0430\u0442\u0430\u043B\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0435 \u0434\u043E #1285, \u043A\u043E\u0433\u0434\u0430 \u043F\u0440\u043E\u043F\u043E\u0440\u0446\u0438\u0438 \u043A\u0430\u0434\u0440\u0430 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B.
 * \u041E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u043E\u043B\u043E\u043C \u043E\u043D\u0430 \u0434\u0435\u0440\u0436\u0430\u043B\u0430 retina-\u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0434\u043B\u044F \u0442\u0438\u043F\u043E\u0432\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 ~320 CSS px.
 */
const COVER_LEGACY_WIDTH_FLOOR = 640

/**
 * \u0413\u0435\u043E\u043C\u0435\u0442\u0440\u0438\u044F \u043E\u0431\u043B\u043E\u0436\u043A\u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0434\u043B\u044F \u0432\u044B\u0431\u043E\u0440\u0430 \u0441\u0442\u0443\u043F\u0435\u043D\u0438 (#1285).
 *
 * \u041C\u0435\u0434\u0438\u0430-\u0431\u043E\u043A\u0441 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043B\u0430\u043D\u0434\u0448\u0430\u0444\u0442\u043D\u044B\u0439, \u0430 \u043A\u0430\u0434\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043E\u043D `contain` \u2014 \u0437\u043D\u0430\u0447\u0438\u0442 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0439
 * \u0438\u043B\u0438 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u0430\u0434\u0440 \u0432\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u041F\u041E \u0412\u042B\u0421\u041E\u0422\u0415 \u0438 \u0434\u043E \u043A\u0440\u0430\u0451\u0432 \u043F\u043E \u0448\u0438\u0440\u0438\u043D\u0435 \u043D\u0435 \u0434\u043E\u0441\u0442\u0430\u0451\u0442.
 * \u0417\u0430\u043C\u0435\u0440 \u043F\u0440\u043E\u0434\u0430 2026-08-06, mobile 412 / DPR 1.75: \u0431\u043E\u043A\u0441 318\u00D7200 \u0441 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u043C \u043A\u0430\u0434\u0440\u043E\u043C
 * \u0440\u0438\u0441\u0443\u0435\u0442 200\u00D7200, \u0441 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043D\u044B\u043C 640\u00D7853 \u2014 \u0432\u0441\u0435\u0433\u043E 150\u00D7200.
 *
 * `sizes` \u043F\u0440\u0438 \u044D\u0442\u043E\u043C \u043E\u0431\u044A\u044F\u0432\u043B\u044F\u043B \u0448\u0438\u0440\u0438\u043D\u0443 \u0411\u041E\u041A\u0421\u0410 (`320px`, \u0430 \u0431\u0435\u0437 `cardWidth` \u0432\u043E\u043E\u0431\u0449\u0435
 * `100vw`), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0441\u0447\u0438\u0442\u0430\u043B \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C \u0432 560\u2013721 device px \u0438 \u0431\u0440\u0430\u043B \u0432\u0435\u0440\u0445\u043D\u044E\u044E
 * \u0441\u0442\u0443\u043F\u0435\u043D\u044C 640w: 162 242 B \u0442\u0430\u043C, \u0433\u0434\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 320w (43 992 B). \u041E\u0442\u0441\u044E\u0434\u0430 \u0436\u0435 \u0438
 * Lighthouse `uses-responsive-images` \u22121 165 \u041A\u0411 \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u043E\u0439.
 *
 * \u0428\u0438\u0440\u0438\u043D\u0430 \u0431\u043E\u043A\u0441\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432\u0442\u043E\u0440\u044B\u043C \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0442\u0435\u043B\u0435\u043C: \u043B\u0430\u043D\u0434\u0448\u0430\u0444\u0442\u043D\u044B\u0439 \u043A\u0430\u0434\u0440 \u0443\u043F\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0438\u043C\u0435\u043D\u043D\u043E \u0432
 * \u043D\u0435\u0451, \u0438 `slotWidth` \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043E\u0431\u044F\u0437\u0430\u043D \u0431\u044B\u0442\u044C \u043E\u0446\u0435\u043D\u043A\u043E\u0439 \u0421\u0412\u0415\u0420\u0425\u0423. \u0417\u0430\u043C\u0435\u0440 \u043F\u0440\u043E\u0434\u0430
 * 2026-08-06 \u043D\u0430 `/travels`, desktop 1280: \u0431\u043E\u043A\u0441 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 396\u00D7270, \u0442\u043E \u0435\u0441\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043D\u043E
 * \u0448\u0438\u0440\u0435 320 px \u0438\u0437 \u043F\u0440\u0435\u0436\u043D\u0435\u0439 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 `sizes`. \u0417\u0430\u043D\u0438\u0437\u0438\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 \u043D\u0435\u043B\u044C\u0437\u044F \u2014 \u0442\u043E\u0433\u0434\u0430
 * \u043B\u0430\u043D\u0434\u0448\u0430\u0444\u0442\u043D\u0430\u044F \u043E\u0431\u043B\u043E\u0436\u043A\u0430 \u043F\u043E\u043B\u0443\u0447\u0438\u0442 \u0441\u0442\u0443\u043F\u0435\u043D\u044C \u043C\u0435\u043B\u044C\u0447\u0435 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u043E\u0442\u0440\u0438\u0441\u043E\u0432\u043A\u0438 \u0438 \u0441\u0442\u0430\u043D\u0435\u0442
 * \u043C\u044B\u043B\u043E\u043C; \u0437\u0430\u0432\u044B\u0448\u0435\u043D\u0438\u0435 \u0441\u0442\u043E\u0438\u0442 \u043E\u0434\u043D\u043E\u0439 \u043B\u0438\u0448\u043D\u0435\u0439 \u0441\u0442\u0443\u043F\u0435\u043D\u0438 \u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u043B\u0430\u043D\u0434\u0448\u0430\u0444\u0442\u043D\u044B\u0445 \u043A\u0430\u0434\u0440\u043E\u0432.
 *
 * \u0411\u0435\u0437 \u043F\u0440\u043E\u043F\u043E\u0440\u0446\u0438\u0439 (\u0441\u0442\u0430\u0440\u044B\u0435 payload'\u044B \u0438 \u043D\u043E\u0440\u043C\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0435 \u043E\u0442\u0434\u0430\u044E\u0442 `width`/
 * `height`) \u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E: `renderedWidth` \u0442\u043E\u0433\u0434\u0430 `null`, \u0432\u044B\u0437\u044B\u0432\u0430\u044E\u0449\u0438\u0439 \u043A\u043E\u0434 \u043E\u0431\u044F\u0437\u0430\u043D
 * \u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0435\u0436\u043D\u0438\u0435 `sizes` \u0438 \u043F\u0440\u0435\u0436\u043D\u0438\u0439 \u043F\u043E\u0442\u043E\u043B\u043E\u043A \u043B\u0435\u0441\u0442\u043D\u0438\u0446\u044B. \u0423\u043C\u043D\u043E\u0436\u0430\u0442\u044C \u0432 \u044D\u0442\u043E\u043C \u0441\u043B\u0443\u0447\u0430\u0435
 * \u043E\u0446\u0435\u043D\u043A\u0443 \u0448\u0438\u0440\u0438\u043D\u044B \u043D\u0430 DPR \u043D\u0435\u043B\u044C\u0437\u044F \u2014 \u043E\u043D\u0430 \u0443\u0448\u043B\u0430 \u0431\u044B \u0432 1440, \u0438 `src` \u043F\u043E\u0435\u0445\u0430\u043B \u0431\u044B \u043D\u0430 \u0441\u0442\u0443\u043F\u0435\u043D\u044C
 * \u041A\u0420\u0423\u041F\u041D\u0415\u0415 \u043F\u0440\u0435\u0436\u043D\u0435\u0439.
 */
export const resolveCoverSlotGeometry = ({
  slotWidth,
  slotHeight,
  aspectRatio,
}: {
  slotWidth: number
  slotHeight: number
  aspectRatio: number | null
}): { renderedWidth: number | null; maxCoverWidth: number } => {
  const boundedWidth = Number.isFinite(slotWidth) && slotWidth > 0 ? slotWidth : 0
  const usableHeight = Number.isFinite(slotHeight) && slotHeight > 0 ? slotHeight : 0
  const hasAspect = aspectRatio != null && Number.isFinite(aspectRatio) && aspectRatio > 0

  if (!hasAspect || usableHeight <= 0) {
    return {
      renderedWidth: null,
      maxCoverWidth: Math.max(COVER_LEGACY_WIDTH_FLOOR, Math.round(boundedWidth)),
    }
  }

  const renderedWidth = Math.min(boundedWidth, usableHeight * aspectRatio)
  return {
    renderedWidth: Math.max(1, Math.round(renderedWidth)),
    maxCoverWidth: Math.max(1, Math.round(renderedWidth * COVER_DPR_CEILING)),
  }
}
