import { translate as i18nT } from '@/i18n'
/**
 * FE-2: Travelpayouts affiliate configuration.
 *
 * Travel rows have NO usable city in the data: `cityName` holds the reverse-geocoded
 * address of the first point ("Базилика Святого Стефана, 1, …, 1051, Венгрия"), so
 * travel callers pass only the country. Callers that DO know a real place name
 * (quest city, trip region) still pass `city` and it wins in the copy — but ONLY
 * when `countryCode` resolves to a COUNTRY_SLUG entry, because that is what makes
 * the link land somewhere. Pass no resolvable `countryCode` and the copy is
 * place-less no matter how good the `city` is (see `resolvePlace`).
 * The only reliable location signal for travels is the country, derived from the first
 * map point's coordinates (same approach as the Belkraj widget). So offers link to a
 * COUNTRY-level destination, built in code from the ISO country code:
 *   - Ostrovok hotels     → https://ostrovok.ru/hotel/<countrySlug>/
 *   - Tripster excursions → https://experience.tripster.ru/destinations/<countrySlug>/
 * Tripster countries live ONLY under /destinations/ (from their
 * sitemap-countries.xml); /experience/<X>/ is for CITIES and silently renders an
 * empty soft-404 shell (HTTP 200!) for non-city slugs — never link countries
 * there. Each offer falls back to the partner homepage when the country is
 * unknown/unmapped — never a dead page — and the copy then names no place at
 * all, so the text never promises a destination the click doesn't open.
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
 * ISO alpha-2 → lowercase English country slug:
 *   Ostrovok  `https://ostrovok.ru/hotel/<slug>/`
 *   Tripster  `https://experience.tripster.ru/destinations/<slug>/`
 * Обычно слаг у площадок совпадает, и запись — одна строка. Но многословные
 * страны они пишут по-разному: Ostrovok через подчёркивание (`czech_republic`,
 * `bosnia_and_herzegovina`, `united_arab_emirates`), Tripster через дефис
 * (`czech-republic`, `bosnia-and-herzegovina`). Перекрёстная проверка даёт 404 на
 * обеих (2026-08-18), поэтому такие страны записываются парой
 * `{ ostrovok, tripster }`. Раньше формат допускал только общую строку — и
 * Чехия с Боснией выпадали из таблицы не потому, что страниц нет, а потому что
 * одной строкой их не описать.
 *
 * Запись появляется, ТОЛЬКО если обе площадки отдают реальную страницу страны:
 * Tripster — присутствие в sitemap-countries.xml, Ostrovok — живая страница
 * (проверять с контролем на заведомо несуществующем слаге: 404 на мусоре у обеих
 * ~116 КБ / ~324 КБ против ~1 МБ у настоящей страницы). Незамапленная страна
 * уходит на главную партнёра и теряет место в копии (см. `resolvePlace`), так
 * что добавление слага — чисто аддитивное, а его отсутствие честно деградирует.
 * Слаги ОБЯЗАНЫ оставаться в нижнем регистре. UA отсутствует намеренно (у
 * Tripster нет destination, Ostrovok гео-редиректит). Дополнять по мере
 * появления новых стран.
 */
type CountrySlug = string | { ostrovok: string; tripster: string }

const COUNTRY_SLUG: Record<string, CountrySlug> = {
  BY: 'belarus', PL: 'poland', RU: 'russia', AM: 'armenia',
  GE: 'georgia', TR: 'turkey', DE: 'germany', FR: 'france', IT: 'italy',
  ES: 'spain', SK: 'slovakia', HU: 'hungary', LT: 'lithuania', LV: 'latvia',
  AT: 'austria', CH: 'switzerland', NL: 'netherlands', PT: 'portugal',
  HR: 'croatia', SI: 'slovenia', AL: 'albania', IN: 'india', VN: 'vietnam',
  NO: 'norway', SE: 'sweden', DK: 'denmark', EG: 'egypt', MU: 'mauritius',
  ME: 'montenegro', FI: 'finland', KG: 'kyrgyzstan', MN: 'mongolia',
  // Страны квестов, добавленные 2026-08-18 после закрытия Belkraj-виджета
  // страновым гейтом: у не-BY квестов на web место виджета занимают эти офферы.
  GR: 'greece', CY: 'cyprus', RO: 'romania', RS: 'serbia', BG: 'bulgaria',
  EE: 'estonia',
  CZ: { ostrovok: 'czech_republic', tripster: 'czech-republic' },
  BA: { ostrovok: 'bosnia_and_herzegovina', tripster: 'bosnia-and-herzegovina' },
  // KR намеренно отсутствует: у Tripster страница есть, у Ostrovok ни одного
  // рабочего слага (south-korea / korea / republic-of-korea / korea-south — 404,
  // проверено 2026-08-10 с контролем на заведомо несуществующем слаге). Правило
  // выше требует обе площадки, поэтому Южная Корея честно деградирует до
  // нейтральной ссылки, пока слаг Ostrovok не найдётся.
}

const OSTROVOK_HOME = 'https://ostrovok.ru/'
const TRIPSTER_HOME = 'https://experience.tripster.ru/'

const clean = (value?: string | null): string => String(value ?? '').trim()

const resolveCountrySlug = (ctx: AffiliateOfferContext): CountrySlug | undefined =>
  COUNTRY_SLUG[clean(ctx.countryCode).toUpperCase()]

const pickSlug = (
  entry: CountrySlug | undefined,
  partner: 'ostrovok' | 'tripster',
): string | undefined =>
  typeof entry === 'string' ? entry : entry?.[partner]

const buildOstrovokUrl = (ctx: AffiliateOfferContext): string => {
  const slug = pickSlug(resolveCountrySlug(ctx), 'ostrovok')
  return slug ? `https://ostrovok.ru/hotel/${slug}/` : OSTROVOK_HOME
}

const buildTripsterUrl = (ctx: AffiliateOfferContext): string => {
  const slug = pickSlug(resolveCountrySlug(ctx), 'tripster')
  return slug ? `https://experience.tripster.ru/destinations/${slug}/` : TRIPSTER_HOME
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
    get title() { return i18nT('sharedStatic:components.affiliate.affiliateConfig.ekskursii_i_gidy_f1ac831f') },
    subtitle: (place) =>
      place ? i18nT('shared:components.affiliate.affiliateConfig.avtorskie_ekskursii_i_mestnye_gidy_value1_6ed5e467', { value1: place }) : i18nT('shared:components.affiliate.affiliateConfig.avtorskie_ekskursii_i_mestnye_gidy_c72427c3'),
    get cta() { return i18nT('sharedStatic:affiliate.tours.cta') },
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE,
    buildDestinationUrl: buildTripsterUrl,
  },
  {
    key: 'hotels',
    get title() { return i18nT('sharedStatic:components.affiliate.affiliateConfig.gde_ostanovitsya_213c0ed8') },
    subtitle: (place) =>
      place ? i18nT('shared:components.affiliate.affiliateConfig.oteli_i_apartamenty_value1_98297a64', { value1: place }) : i18nT('shared:components.affiliate.affiliateConfig.oteli_i_apartamenty_ryadom_s_marshrutom_e08415da'),
    get cta() { return i18nT('sharedStatic:affiliate.hotels.cta') },
    templateEnv: () => process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE,
    buildDestinationUrl: buildOstrovokUrl,
  },
]

export const getAffiliateMarker = (): string => clean(process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER)

export const isAffiliateEnabled = (): boolean => getAffiliateMarker().length > 0

/**
 * Destination label shown in the offer copy — only when the link actually lands
 * on that place. Запись в COUNTRY_SLUG появляется только когда обе площадки
 * отдают страницу страны, поэтому её наличие — единственный признак: страна,
 * которой в таблице нет (DO) или которая исключена намеренно (UA), отправляет
 * ОБА оффера на главную партнёра; назвать место там значило продать
 * «Отели и апартаменты — Чехия» и открыть `ostrovok.ru/`. No slug → no place in
 * the copy: the offer stays, the promise shrinks to what the click delivers.
 */
const resolvePlace = (ctx: AffiliateOfferContext): string =>
  resolveCountrySlug(ctx) ? clean(ctx.city) || clean(ctx.country) : ''

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

const hasSinglePositiveIntegerParam = (params: URLSearchParams, key: string): boolean => {
  const values = params.getAll(key)
  return values.length === 1 && /^[1-9]\d*$/.test(values[0] ?? '')
}

const isValidTravelpayoutsRedirect = (
  url: string,
  expected: { marker: string; subId: string; destinationUrl: string },
): boolean => {
  try {
    const parsed = new URL(url)
    const markerValues = parsed.searchParams.getAll('marker')
    const destinationValues = parsed.searchParams.getAll('u')
    const redirectMarker = clean(markerValues[0])
    const expectedSubIdMarker = `${expected.marker}.${expected.subId}`
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'tp.media' &&
      parsed.pathname === '/r' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      markerValues.length === 1 &&
      (redirectMarker === expected.marker || redirectMarker === expectedSubIdMarker) &&
      destinationValues.length === 1 &&
      destinationValues[0] === expected.destinationUrl &&
      hasSinglePositiveIntegerParam(parsed.searchParams, 'p') &&
      hasSinglePositiveIntegerParam(parsed.searchParams, 'trs')
    )
  } catch {
    return false
  }
}

/**
 * Resolve the displayable offers for a given travel context. Returns only offers
 * whose tp.media wrapper is configured. Empty array → block renders nothing.
 */
export const getAffiliateOffers = (ctx: AffiliateOfferContext): AffiliateOffer[] => {
  if (!isAffiliateEnabled()) return []

  const place = resolvePlace(ctx)
  const marker = getAffiliateMarker()

  return OFFER_PRESETS.reduce<AffiliateOffer[]>((acc, preset) => {
    const template = clean(preset.templateEnv())
    if (!template || !template.includes('{url}')) return acc
    const destinationUrl = preset.buildDestinationUrl(ctx)
    const url = interpolateTemplate(template, ctx, destinationUrl)
    if (!isValidTravelpayoutsRedirect(url, {
      marker,
      subId: resolveSubId(ctx),
      destinationUrl,
    })) return acc
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
