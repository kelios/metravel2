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
}

const OFFER_PRESETS: OfferPreset[] = [
  {
    key: 'tours',
    title: 'Экскурсии и гиды',
    subtitle: (place) =>
      place ? `Авторские экскурсии и местные гиды — ${place}` : 'Авторские экскурсии и местные гиды',
    cta: 'Посмотреть экскурсии',
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE,
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

const interpolateTemplate = (template: string, ctx: AffiliateOfferContext): string =>
  template
    .replace(/\{query\}/g, encodeURIComponent(resolvePlace(ctx)))
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
    const url = interpolateTemplate(template, ctx)
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
