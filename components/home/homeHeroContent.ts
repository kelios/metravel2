import type { QuickFilterParams, QuickFilterValue } from './homeHeroShared'

export type BookImage = {
  source: { uri?: string } | number
  alt: string
  title: string
  subtitle: string
  href?: string
}

export type MoodCard = {
  title: string
  icon: string
  filters: QuickFilterParams
  route: string
  meta?: string
}

export type HeroHighlight = {
  icon: string
  title: string
  subtitle: string
}

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

export const BOOK_IMAGES: readonly BookImage[] = [
  {
    source: {
      uri: 'https://metravel.by/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp',
    },
    alt: 'Тропа ведьм — Германия',
    title: 'Тропа ведьм',
    subtitle: 'Хайкинг • Горный маршрут • Германия',
    href: 'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele',
  },
  {
    source: {
      uri: 'https://metravel.by/gallery/540/gallery/79641dcc63dc476bb89dd66a9faa8527.JPG',
    },
    alt: 'Озеро Сорапис — Доломиты',
    title: 'Озеро Сорапис',
    subtitle: 'Поход по Доломитам • Озеро • Италия',
    href: 'https://metravel.by/travels/ozero-sorapis-pokhod-po-marshrutam-215-i-217-v-dolomitakh',
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/536/conversions/b254498810ab43fcb7749c3a51ecf3ee.JPG',
    },
    alt: 'Tre Cime di Lavaredo — Доломиты',
    title: 'Tre Cime di Lavaredo',
    subtitle: 'Круговой маршрут 10 км • Горы • Италия',
    href: 'https://metravel.by/travels/tre-cime-di-lavaredo-krugovoi-marshrut-10-km-opisanie-i-vidy',
  },
  {
    source: {
      uri: 'https://metravel.by/gallery/532/gallery/ce0f0221a2ac42e08bc274c0f059dfc9.JPG',
    },
    alt: 'Озеро Блед — Словения',
    title: 'Озеро Блед',
    subtitle: 'Что посмотреть за 1 день • Озеро • Словения',
    href: 'https://metravel.by/travels/vintgarskoe-ushchele-i-ozero-bled-chto-posmotret-v-slovenii-za-1-den',
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/362/conversions/28160874221349509d697c8016c48464.webp',
    },
    alt: 'Морское око в мае — Польша',
    title: 'Морское око в мае',
    subtitle: 'Поход • Озеро • Польша',
    href: 'https://metravel.by/travels/morskoe-oko-v-mae',
  },
] as const

export const MOOD_CARDS: readonly MoodCard[] = [
  {
    title: 'У воды',
    icon: 'wind',
    filters: { categoryTravelAddress: [84, 110, 113, 193] },
    route: '/search',
  },
  {
    title: 'Замки',
    icon: 'bookmark',
    filters: { categoryTravelAddress: [33, 43] },
    route: '/search',
  },
  {
    title: 'Руины',
    icon: 'file-text',
    filters: { categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120] },
    route: '/search',
  },
  {
    title: 'Хайкинг',
    icon: 'feather',
    filters: { categories: [21, 22, 2] },
    route: '/search',
  },
  {
    title: 'Карта до 60 км',
    meta: 'Рядом с вами',
    icon: 'map-pin',
    filters: { radius: 60 },
    route: '/map',
  },
] as const

export const HERO_HIGHLIGHTS: readonly HeroHighlight[] = [
  { icon: 'pen-tool', title: 'За 2 минуты', subtitle: 'подборка под ваш ритм' },
  { icon: 'book-open', title: 'Личная книга', subtitle: 'фото, заметки и PDF' },
  {
    icon: 'compass',
    title: 'Маршруты рядом',
    subtitle: 'фильтры по дистанции и формату',
  },
  {
    icon: 'download',
    title: 'GPS-треки',
    subtitle: 'скачай и следуй маршруту',
  },
] as const
