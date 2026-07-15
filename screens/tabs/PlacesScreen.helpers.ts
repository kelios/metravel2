import type React from 'react'
import type Feather from '@expo/vector-icons/Feather'
import { selectPlural, translate as i18nT, type TranslationKey } from '@/i18n'


export const MAP_FOCUS_RADIUS_KM = '5'
export const PLACES_PAGE_SIZE = 20
export const LOAD_MORE_SCROLL_THRESHOLD = 420
export const PRESSED_OPACITY = { opacity: 0.72 } as const

const DEFAULT_CATEGORY_SELECTION = [
  'Замок',
  'Руины замка',
  'Дворец',
  'Руины дворца',
  'Экологическая тропа',
  'Колесо обозрения',
  'Водохранилище',
  'Озеро',
  'Река',
  'Ручей',
] as const
export type CategoryCollection = {
  id: string
  title: string
  hint: string
  icon: React.ComponentProps<typeof Feather>['name']
  categories: readonly string[]
}

type CategoryCollectionDefinition = Omit<CategoryCollection, 'title' | 'hint'> & {
  titleKey: TranslationKey
  hintKey: TranslationKey
}

const INTERESTING_CATEGORY_COLLECTION_DEFINITIONS: readonly CategoryCollectionDefinition[] = [
  {
    id: 'featured',
    titleKey: 'map:screens.tabs.PlacesScreen_helpers.zamki_dvortsy_ekotropy_i_voda_c7838ce4',
    hintKey: 'map:screens.tabs.PlacesScreen_helpers.dlya_pervoy_poezdki_d662bb10',
    icon: 'star',
    categories: DEFAULT_CATEGORY_SELECTION,
  },
  {
    id: 'history',
    titleKey: 'map:screens.tabs.PlacesScreen_helpers.istoriya_i_ruiny_5fd385ee',
    hintKey: 'map:screens.tabs.PlacesScreen_helpers.zamki_forty_usadby_87966db5',
    icon: 'archive',
    categories: [
      'Замок',
      'Руины замка',
      'Дворец',
      'Руины дворца',
      'Усадьба',
      'Руины усадьбы',
      'Форт',
      'Крепость',
      'Башня',
      'Брама',
    ],
  },
  {
    id: 'nature',
    titleKey: 'map:screens.tabs.PlacesScreen_helpers.priroda_i_voda_06ce145c',
    hintKey: 'map:screens.tabs.PlacesScreen_helpers.ozera_reki_tropy_ed469009',
    icon: 'droplet',
    categories: [
      'Озеро',
      'Водохранилище',
      'Река',
      'Ручей',
      'Водопад',
      'Родник',
      'Экологическая тропа',
      'Заповедник',
      'Национальный парк',
      'Гора',
      'Скала',
    ],
  },
  {
    id: 'family',
    titleKey: 'map:screens.tabs.PlacesScreen_helpers.dlya_progulki_s_semey_fa28da7c',
    hintKey: 'map:screens.tabs.PlacesScreen_helpers.parki_zooparki_obzornye_a127add5',
    icon: 'users',
    categories: [
      'Парк',
      'Детский парк',
      'Зоопарк',
      'Парк развлечений',
      'Обзорная точка',
      'Колесо обозрения',
      'Музей',
      'Площадь',
      'Место отдыха',
    ],
  },
] as const

export const getInterestingCategoryCollections = (): readonly CategoryCollection[] =>
  INTERESTING_CATEGORY_COLLECTION_DEFINITIONS.map(({ titleKey, hintKey, ...collection }) => ({
    ...collection,
    title: i18nT(titleKey),
    hint: i18nT(hintKey),
  }))

export const parseCategoryParam = (value: unknown): string[] => {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((item) => decodeURIComponent(item).trim())
    .filter(Boolean)
}

export const isSameCategorySet = (left: string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

const getMatchingCollection = (categories: string[]): CategoryCollectionDefinition | null =>
  INTERESTING_CATEGORY_COLLECTION_DEFINITIONS.find((collection) =>
    isSameCategorySet(categories, collection.categories),
  ) ?? null

export const getActiveCategoryTitle = (categories: string[]): string => {
  if (categories.length === 0) return i18nT('map:screens.tabs.PlacesScreen_helpers.vse_mesta_353b6d51')
  const collection = getMatchingCollection(categories)
  if (collection) return i18nT(collection.titleKey)
  if (categories.length <= 2) return categories.join(', ')
  return i18nT('map:screens.tabs.PlacesScreen_helpers.value1_kategoriy_57a6c780', { value1: categories.length })
}

export function getPlacesCountLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('map:screens.tabs.PlacesScreen_helpers.mesto_d355b0e5'),
    few: i18nT('map:screens.tabs.PlacesScreen_helpers.mesta_bd09fde1'),
    many: i18nT('map:screens.tabs.PlacesScreen_helpers.mest_cad64ed8'),
    other: i18nT('map:screens.tabs.PlacesScreen_helpers.mest_cad64ed8'),
  })
}
