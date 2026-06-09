/**
 * FE-2: Travelpayouts affiliate configuration.
 *
 * Deep links are intentionally NOT hardcoded — the exact `trs`/`p`/`campaign_id`
 * of a tp.media link are per-account and per-program, so a guessed default would
 * either 404 or lose attribution. Instead the owner pastes the ready deep-link
 * template from the Travelpayouts dashboard (OWN-9) into env; each offer renders
 * only when its template is present. With no env configured the whole feature is
 * off and renders nothing — deploy-safe.
 *
 * Env:
 *   EXPO_PUBLIC_TRAVELPAYOUTS_MARKER       — affiliate marker (master on/off switch)
 *   EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE   — excursions deep-link template (e.g. Tripster)
 *   EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE  — hotels deep-link template (e.g. Ostrovok)
 *
 * Template placeholders (interpolated before use):
 *   {query}  — destination search term (city, falls back to country); URL-encoded
 *   {subid}  — per-article SubID for conversion attribution (e.g. travel123); URL-encoded
 *
 * Example template the owner would paste (their real ids differ):
 *   https://tp.media/r?marker=123456.{subid}&trs=987&p=4934&campaign_id=541&u=https%3A%2F%2Fostrovok.ru%2Fhotel%2Fsearch%2F%3Fq%3D{query}
 */

export type AffiliateOfferKey = 'tours' | 'hotels'

export interface AffiliateOfferContext {
  city?: string | null
  country?: string | null
  travelId?: number | string | null
}

export interface AffiliateOffer {
  key: AffiliateOfferKey
  title: string
  subtitle: string
  cta: string
  url: string
}

interface OfferPreset {
  key: AffiliateOfferKey
  title: string
  /** Builds the subtitle from the resolved destination label. */
  subtitle: (place: string) => string
  cta: string
  templateEnv: () => string | undefined
  /**
   * Transforms the destination label before it is encoded into `{query}`.
   * Default is identity (Cyrillic kept as-is, e.g. Ostrovok `?q=Краков`).
   * Tripster uses a Latin city slug in the PATH (`/experience/krakov/`) and
   * 404s on Cyrillic, so it transliterates RU → Latin.
   */
  queryTransform?: (place: string) => string
}

const RU_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/** RU → Latin slug for path-based partners (Tripster). Empty in → empty out. */
export const transliterate = (value: string): string =>
  value
    .toLowerCase()
    .split('')
    .map((ch) => (ch in RU_TO_LATIN ? RU_TO_LATIN[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const OFFER_PRESETS: OfferPreset[] = [
  {
    key: 'tours',
    title: 'Экскурсии и гиды',
    subtitle: (place) =>
      place ? `Авторские экскурсии и местные гиды — ${place}` : 'Авторские экскурсии и местные гиды',
    cta: 'Посмотреть экскурсии',
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE,
    queryTransform: transliterate,
  },
  {
    key: 'hotels',
    title: 'Где остановиться',
    subtitle: (place) =>
      place ? `Отели и апартаменты — ${place}` : 'Отели и апартаменты рядом с маршрутом',
    cta: 'Подобрать жильё',
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE,
  },
]

const clean = (value?: string | null): string => String(value ?? '').trim()

export const getAffiliateMarker = (): string => clean(process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER)

export const isAffiliateEnabled = (): boolean => getAffiliateMarker().length > 0

/** Destination label shown in copy and encoded into the `{query}` placeholder. */
const resolvePlace = (ctx: AffiliateOfferContext): string => clean(ctx.city) || clean(ctx.country)

const resolveSubId = (ctx: AffiliateOfferContext): string => {
  const id = clean(ctx.travelId != null ? String(ctx.travelId) : '')
  return id ? `travel${id}` : 'travel'
}

const interpolateTemplate = (
  template: string,
  ctx: AffiliateOfferContext,
  queryTerm: string,
): string =>
  template
    .replace(/\{query\}/g, encodeURIComponent(queryTerm))
    .replace(/\{subid\}/g, encodeURIComponent(resolveSubId(ctx)))

/**
 * Resolve the displayable offers for a given travel context. Returns only offers
 * whose deep-link template is configured. Empty array → block renders nothing.
 */
export const getAffiliateOffers = (ctx: AffiliateOfferContext): AffiliateOffer[] => {
  if (!isAffiliateEnabled()) return []

  const place = resolvePlace(ctx)

  return OFFER_PRESETS.reduce<AffiliateOffer[]>((acc, preset) => {
    const template = clean(preset.templateEnv())
    if (!template) return acc
    const queryTerm = preset.queryTransform ? preset.queryTransform(place) : place
    // A template with a {query} slot but no resolvable term would build a broken
    // URL (e.g. Tripster `/experience//`), so skip the offer instead.
    if (template.includes('{query}') && !queryTerm) return acc
    const url = interpolateTemplate(template, ctx, queryTerm)
    if (!url) return acc
    acc.push({
      key: preset.key,
      title: preset.title,
      subtitle: preset.subtitle(place),
      cta: preset.cta,
      url,
    })
    return acc
  }, [])
}
