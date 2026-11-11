import type { ComponentProps } from 'react'
import type Feather from '@expo/vector-icons/Feather'
import type { LinkPressEvent } from '@/components/ui/LinkPressable'

import type { QuickFilterParams, QuickFilterValue } from './homeHeroShared'
import { translate as i18nT } from '@/i18n'
import { buildLoginHref } from '@/utils/authNavigation'
import { DISTANCE_SORT_ID } from '@/components/listTravel/utils/catalogSort'
import { HOME_POPULAR_COMPACT_COVERS } from './homePopularCompactCovers'
import { buildTravelPath } from '@/utils/routePaths'

/**
 * #3242/#3218: адрес статьи для карточек главной строит общий построитель из
 * текущего slug. Slug, ставший `from` в `scripts/seo-redirects.json`, ловит
 * `npm run guard:travel-links`.
 */
const travelHref = (slug: string): string | undefined => buildTravelPath(slug, { encode: false }) ?? undefined


export type BookImage = {
  source: { uri: string } | number
  compactSource?: BookImage['source']
  alt: string
  title: string
  subtitle: string
  href?: string
  /**
   * Заливка полей letterbox под `contain`-кадром (#1208, docs/RULES.md).
   * Манифеста у статичных ассетов нет, поэтому средний цвет кадра посчитан
   * один раз и зафиксирован здесь.
   */
  dominantColor?: string
  /**
   * #1541: пропорция растра. Кадр слайдера один на весь набор
   * (`HOME_HERO_MEDIA_SLOT_RATIO`), поэтому долю плоского поля задаёт сам
   * снимок, и проверить её можно только по объявленной пропорции —
   * у удалённых слайдов интринсика недоступна ни тесту, ни первому кадру.
   * Поле обязательное: слайд без пропорции нельзя допустить в набор вслепую.
   */
  aspectRatio: number
}

/** Имя глифа Feather: тип, а не строка, иначе каждый консьюмер пишет `as any`. */
export type FeatherIconName = ComponentProps<typeof Feather>['name']

export type MoodCard = {
  title: string
  icon: FeatherIconName
  filters: QuickFilterParams
  route: string
  meta?: string
}

/**
 * #2901: плашка преимущества в hero — ссылка, а не декорация: у каждой есть
 * `route`, иначе она выглядит кликабельной и ничего не делает. `authIntent`
 * означает, что гостю нужен вход: клик ведёт на экран входа по намерению,
 * а `route` остаётся адресом после входа (и `href` ссылки).
 */
export type HeroHighlight = {
  id: string
  icon: FeatherIconName
  title: string
  subtitle: string
  route: string
  authIntent?: string
}

/** Событие клика по плашке: и RN-нажатие, и DOM-клик ссылки на web. */
export type HeroHighlightPressEvent = LinkPressEvent

const normalizeQuickFilterValue = (
  value: QuickFilterValue | undefined,
): string | null => {
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)

    return cleaned.length > 0 ? cleaned.join(',') : null
  }

  const scalar = String(value).trim()
  return scalar.length > 0 ? scalar : null
}

export const buildFilterPath = (base: string, params?: QuickFilterParams) => {
  if (!params) return base

  const query = Object.entries(params)
    .map(([key, value]) => {
      const normalized = normalizeQuickFilterValue(value)
      return normalized ? `${key}=${normalized}` : null
    })
    .filter((item): item is string => Boolean(item))
    .join('&')

  return query.length > 0 ? `${base}?${query}` : base
}

export const HOME_HERO_BOOK_LAYOUT_MIN_WIDTH = 1280

/**
 * #1541: пять слайдов живут в ОДНОМ кадре 3:2 с кросс-фейдом, поэтому набор
 * нормализован под ландшафт. Локальные ассеты — кадры 720×480 из обложек тех
 * же статей на проде (540/536/532) и из галереи статьи 362; портретные 2:3
 * версии давали до 29.5% плоского поля. `aspectRatio` обязателен и проверяется
 * `__tests__/components/home/homeHeroMediaLetterbox.test.ts`.
 */
export const BOOK_IMAGES: readonly BookImage[] = [
  {
    source: require('../../assets/images/cover_sorapiso.webp'),
    dominantColor: '#536659',
    aspectRatio: 3 / 2,
    get alt() { return i18nT('homeStatic:components.home.homeHeroContent.ozero_sorapis_dolomity_5feebc2d') },
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.ozero_sorapis_2fd0cc8f') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.pohod_po_dolomitam_ozero_italiya_fa42c033') },
    href: travelHref('ozero-sorapis-krugovoi-marshrut-v-dolomitakh'),
  },
  {
    source: require('../../assets/images/cover_trecime.webp'),
    compactSource: HOME_POPULAR_COMPACT_COVERS.treCime,
    dominantColor: '#989ea5',
    aspectRatio: 3 / 2,
    get alt() { return i18nT('homeStatic:components.home.homeHeroContent.tre_cime_di_lavaredo_dolomity_0341abf3') },
    title: 'Tre Cime di Lavaredo',
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.krugovoy_marshrut_10_km_gory_italiya_3b3bdd6b') },
    href: travelHref('tre-cime-di-lavaredo-krugovoi-marshrut-10-km'),
  },
  {
    source: require('../../assets/images/cover_bled.webp'),
    compactSource: HOME_POPULAR_COMPACT_COVERS.bled,
    dominantColor: '#516571',
    aspectRatio: 3 / 2,
    get alt() { return i18nT('homeStatic:components.home.homeHeroContent.ozero_bled_sloveniya_a6de1598') },
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.ozero_bled_4b95af32') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.chto_posmotret_za_1_den_ozero_sloveniya_337402ef') },
    href: travelHref('ushchele-vintgar-i-ozero-bled-marshrut-na-den'),
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp',
    },
    dominantColor: '#94948a',
    // Обложка статьи на проде — 1024×768; единственный слайд набора, чью
    // пропорцию фронт не выбирает. 4:3 в кадре 3:2 даёт 5.6% поля.
    aspectRatio: 4 / 3,
    get alt() { return i18nT('homeStatic:components.home.homeHeroContent.tropa_vedm_germaniya_08d65a9a') },
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.tropa_vedm_0ac8dba6') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.hayking_gornyy_marshrut_germaniya_cc4d0990') },
    href: travelHref('tropa-vedm-v-gartse-kak-proiti-hexenstieg'),
  },
  {
    // Обложка статьи 362 на проде портретная (768×1024), вся её галерея —
    // квадраты 1080×1080, а image-прокси `w/h/fit` игнорирует (проверено
    // 2026-08-25). Ландшафтного кадра с прода взять негде, поэтому слайд
    // стал локальным ассетом: 3:2 из галерейного кадра 1947. Побочно это
    // ещё и легче — 76 КБ против 257 КБ у прежней удалённой обложки.
    source: require('../../assets/images/cover_morskoe_oko.webp'),
    compactSource: HOME_POPULAR_COMPACT_COVERS.morskoeOko,
    dominantColor: '#5e676a',
    aspectRatio: 3 / 2,
    get alt() { return i18nT('homeStatic:components.home.homeHeroContent.morskoe_oko_v_mae_polsha_e9d180a7') },
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.morskoe_oko_v_mae_458dda47') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.pohod_ozero_polsha_daa096f6') },
    href: travelHref('morskoe-oko-v-mae-ozero-v-tatrakh-polsha'),
  },
] as const

// #2903: «Куда поехать в эти выходные?» — ближние маршруты первыми. Порядок
// считает сервер (`sort=distance`, точка — геопозиция с уже выданным доступом,
// иначе Минск): далёкие маршруты остаются в выдаче, но ниже.
export const MOOD_CARDS: readonly MoodCard[] = [
  {
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.u_vody_7c603574') },
    icon: 'droplet',
    filters: { categoryTravelAddress: [84, 110, 113, 193], sort: DISTANCE_SORT_ID },
    route: '/search',
  },
  {
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.zamki_aec014c6') },
    icon: 'flag',
    filters: { categoryTravelAddress: [33, 43], sort: DISTANCE_SORT_ID },
    route: '/search',
  },
  {
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.ruiny_f6673a79') },
    icon: 'layers',
    filters: { categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120], sort: DISTANCE_SORT_ID },
    route: '/search',
  },
  {
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.hayking_3faa621d') },
    icon: 'trending-up',
    filters: { categories: [21, 22, 2], sort: DISTANCE_SORT_ID },
    route: '/search',
  },
  {
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.karta_do_60_km_23bb7996') },
    get meta() { return i18nT('homeStatic:homeHero.nearYou') },
    icon: 'map-pin',
    filters: { radius: 60 },
    route: '/map',
  },
] as const

// Макет `docs/features/ux-audit-2026-11-mocks.md` §2. «GPS-треки» вернутся вместе
// с GPX на странице маршрута (#2902): до неё карточке некуда вести.
export const HERO_HIGHLIGHTS: readonly HeroHighlight[] = [
  {
    id: 'quick-pick',
    icon: 'pen-tool',
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.za_2_minuty_5ec01639') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.podborka_pod_vash_ritm_d6d4d06a') },
    route: '/search',
  },
  {
    id: 'book',
    icon: 'book-open',
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.lichnaya_kniga_b2f6da42') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.foto_zametki_i_pdf_f208ab13') },
    route: '/export',
    // `build-pdf`, а не `create-book`: тот же экран входа «книга», но после входа
    // `resolvePostAuthPath` ведёт на `/export`, а `create-book` — на `/travel/new`.
    authIntent: 'build-pdf',
  },
  {
    id: 'nearby',
    icon: 'compass',
    get title() { return i18nT('homeStatic:components.home.homeHeroContent.marshruty_ryadom_bc58acf0') },
    get subtitle() { return i18nT('homeStatic:components.home.homeHeroContent.filtry_po_distantsii_i_formatu_640c3871') },
    route: buildFilterPath('/map', { radius: 60 }),
  },
] as const

/** #2901: куда увести гостя с плашки, требующей входа; `null` — работает обычная ссылка. */
export const resolveHeroHighlightGuestHref = (
  item: HeroHighlight,
  isAuthenticated: boolean,
): string | null =>
  item.authIntent && !isAuthenticated
    ? buildLoginHref({ redirect: item.route, intent: item.authIntent })
    : null
