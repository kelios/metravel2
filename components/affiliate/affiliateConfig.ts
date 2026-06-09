/**
 * FE-2: Travelpayouts affiliate configuration.
 *
 * Travel rows have NO city in the data (cityName is empty across all of them) —
 * the only reliable location signal is the country, derived from the first map
 * point's coordinates (same approach as the Belkraj widget). So offers link to a
 * COUNTRY-level destination, built in code:
 *   - Ostrovok hotels → /hotel/<countrySlug>/  (Cyrillic ?q= and free text 404;
 *     the country page works and is relevant). Homepage fallback when the country
 *     is unknown/unmapped.
 *   - Tripster excursions → homepage (Tripster has no country pages, only cities,
 *     and we have no city), so it lands on the search home.
 *
 * The owner pastes the tp.media wrapper (per-account marker + per-program
 * trs/p/campaign_id) into env with a `{url}` slot for the destination; the whole
 * feature is off and renders nothing when no marker is configured (deploy-safe).
 *
 * Env:
 *   EXPO_PUBLIC_TRAVELPAYOUTS_MARKER       — affiliate marker (master on/off switch)
 *   EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE   — excursions tp.media wrapper (Tripster)
 *   EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE  — hotels tp.media wrapper (Ostrovok)
 *
 * Template placeholders (interpolated before use):
 *   {url}    — destination URL built in code for this offer/context; URL-encoded
 *   {subid}  — per-article SubID for conversion attribution (e.g. travel123)
 *
 * Example template the owner would paste (their real ids differ):
 *   https://tp.media/r?marker=123456.{subid}&trs=987&p=4934&campaign_id=541&u={url}
 */

export type AffiliateOfferKey = 'tours' | 'hotels'

export interface AffiliateOfferContext {
  city?: string | null
  country?: string | null
  /** ISO 3166-1 alpha-2 country code (e.g. "BY", "PL"), preferred for deep links. */
  countryCode?: string | null
  travelId?: number | string | null
}

export interface AffiliateOffer {
  key: AffiliateOfferKey
  title: string
  subtitle: string
  cta: string
  url: string
}

/**
 * ISO alpha-2 → Ostrovok country path slug. Only slugs verified to return 200 on
 * `https://ostrovok.ru/hotel/<slug>/` are listed; an unmapped country falls back
 * to the Ostrovok homepage (never a 404). Extend as new countries appear.
 */
const OSTROVOK_COUNTRY_SLUG: Record<string, string> = {
  BY: 'belarus', PL: 'poland', RU: 'russia', UA: 'ukraine', AM: 'armenia',
  GE: 'georgia', TR: 'turkey', DE: 'germany', FR: 'france', IT: 'italy',
  ES: 'spain', SK: 'slovakia', HU: 'hungary', LT: 'lithuania', LV: 'latvia',
  AT: 'austria', CH: 'switzerland', NL: 'netherlands', PT: 'portugal',
  HR: 'croatia', SI: 'slovenia', AL: 'albania', IN: 'india', VN: 'vietnam',
  NO: 'norway', SE: 'sweden', DK: 'denmark', EG: 'egypt', MU: 'mauritius',
  ME: 'montenegro',
}

const OSTROVOK_HOME = 'https://ostrovok.ru/'
const TRIPSTER_HOME = 'https://experience.tripster.ru/'

const clean = (value?: string | null): string => String(value ?? '').trim()

const resolveCountryCode = (ctx: AffiliateOfferContext): string =>
  clean(ctx.countryCode).toUpperCase()

const buildOstrovokUrl = (ctx: AffiliateOfferContext): string => {
  const slug = OSTROVOK_COUNTRY_SLUG[resolveCountryCode(ctx)]
  return slug ? `https://ostrovok.ru/hotel/${slug}/` : OSTROVOK_HOME
}

interface OfferPreset {
  key: AffiliateOfferKey
  title: string
  /** Builds the subtitle from the resolved destination label. */
  subtitle: (place: string) => string
  cta: string
  templateEnv: () => string | undefined
  /** Builds the partner destination URL (encoded into `{url}`) for this context. */
  buildDestinationUrl: (ctx: AffiliateOfferContext) => string
}

const OFFER_PRESETS: OfferPreset[] = [
  {
    key: 'tours',
    title: 'Экскурсии и гиды',
    subtitle: (place) =>
      place ? `Авторские экскурсии и местные гиды — ${place}` : 'Авторские экскурсии и местные гиды',
    cta: 'Посмотреть экскурсии',
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE,
    buildDestinationUrl: () => TRIPSTER_HOME,
  },
  {
    key: 'hotels',
    title: 'Где остановиться',
    subtitle: (place) =>
      place ? `Отели и апартаменты — ${place}` : 'Отели и апартаменты рядом с маршрутом',
    cta: 'Подобрать жильё',
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE,
    buildDestinationUrl: buildOstrovokUrl,
  },
]

export const getAffiliateMarker = (): string => clean(process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER)

export const isAffiliateEnabled = (): boolean => getAffiliateMarker().length > 0

/** Destination label shown in the offer copy. */
const resolvePlace = (ctx: AffiliateOfferContext): string => clean(ctx.city) || clean(ctx.country)

const resolveSubId = (ctx: AffiliateOfferContext): string => {
  const id = clean(ctx.travelId != null ? String(ctx.travelId) : '')
  return id ? `travel${id}` : 'travel'
}

const interpolateTemplate = (
  template: string,
  ctx: AffiliateOfferContext,
  destinationUrl: string,
): string =>
  template
    .replace(/\{url\}/g, encodeURIComponent(destinationUrl))
    .replace(/\{subid\}/g, encodeURIComponent(resolveSubId(ctx)))

/**
 * Resolve the displayable offers for a given travel context. Returns only offers
 * whose tp.media wrapper is configured. Empty array → block renders nothing.
 */
export const getAffiliateOffers = (ctx: AffiliateOfferContext): AffiliateOffer[] => {
  if (!isAffiliateEnabled()) return []

  const place = resolvePlace(ctx)

  return OFFER_PRESETS.reduce<AffiliateOffer[]>((acc, preset) => {
    const template = clean(preset.templateEnv())
    if (!template) return acc
    const url = interpolateTemplate(template, ctx, preset.buildDestinationUrl(ctx))
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
