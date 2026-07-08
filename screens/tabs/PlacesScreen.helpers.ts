import type React from 'react'
import type Feather from '@expo/vector-icons/Feather'

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
const FEATURED_CATEGORY_LABEL = 'Замки, дворцы, экотропы и вода'

export type CategoryCollection = {
  id: string
  title: string
  hint: string
  icon: React.ComponentProps<typeof Feather>['name']
  categories: readonly string[]
}

export const INTERESTING_CATEGORY_COLLECTIONS: readonly CategoryCollection[] = [
  {
    id: 'featured',
    title: FEATURED_CATEGORY_LABEL,
    hint: 'для первой поездки',
    icon: 'star',
    categories: DEFAULT_CATEGORY_SELECTION,
  },
  {
    id: 'history',
    title: 'История и руины',
    hint: 'замки, форты, усадьбы',
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
    title: 'Природа и вода',
    hint: 'озера, реки, тропы',
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
    title: 'Для прогулки с семьей',
    hint: 'парки, зоопарки, обзорные',
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

const getMatchingCollection = (categories: string[]): CategoryCollection | null =>
  INTERESTING_CATEGORY_COLLECTIONS.find((collection) =>
    isSameCategorySet(categories, collection.categories),
  ) ?? null

export const getActiveCategoryTitle = (categories: string[]): string => {
  if (categories.length === 0) return 'Все места'
  const collection = getMatchingCollection(categories)
  if (collection) return collection.title
  if (categories.length <= 2) return categories.join(', ')
  return `${categories.length} категорий`
}

export function getPlacesCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'место'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места'
  return 'мест'
}
