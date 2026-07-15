import { translate as i18nT } from '@/i18n'
type TabType = 'recommendations' | 'highlights' | 'favorites' | 'history'

type CollectionItem = {
  country?: string | null
  countryName?: string | null
  city?: string | null
  id: string | number
  imageUrl?: string | null
  title: string
  type?: string
  url: string
  viewedAt?: string | number
}

export function getRecommendationsTabsConfig(params: {
  favoritesCount: number
  historyCount: number
  isAuthenticated: boolean
}) {
  return [
    { id: 'highlights' as const, label: i18nT('travel:components.listTravel.recommendationsTabsModel.podborka_mesyatsa_cd082d45'), shortLabel: i18nT('travel:components.listTravel.recommendationsTabsModel.podborka_47829a4a'), icon: 'zap' },
    { id: 'recommendations' as const, label: i18nT('travel:components.listTravel.recommendationsTabsModel.rekomendatsii_e3222d33'), shortLabel: i18nT('travel:components.listTravel.recommendationsTabsModel.dlya_vas_133f8fe9'), icon: 'star' },
    {
      id: 'favorites' as const,
      label: i18nT('travel:components.listTravel.recommendationsTabsModel.hochu_poehat_cac2b1d3'),
      shortLabel: i18nT('travel:components.listTravel.recommendationsTabsModel.hochu_4ca0afac'),
      icon: 'heart',
      count: params.isAuthenticated ? params.favoritesCount : 0,
    },
    {
      id: 'history' as const,
      label: i18nT('travel:components.listTravel.recommendationsTabsModel.istoriya_cba7c560'),
      shortLabel: i18nT('travel:components.listTravel.recommendationsTabsModel.istoriya_cba7c560'),
      icon: 'clock',
      count: params.isAuthenticated ? params.historyCount : 0,
    },
  ]
}

export function getRecommendationsEnsureServerDataKey(activeTab: TabType) {
  if (activeTab === 'favorites') return 'favorites'
  if (activeTab === 'history') return 'history'
  if (activeTab === 'recommendations') return 'recommendations'
  return null
}

export function getRecommendationsCardLayout(isMobile: boolean, isMobileWeb: boolean) {
  return isMobile && !isMobileWeb ? 'grid' : isMobileWeb ? 'grid' : 'horizontal'
}

export function mapRecommendationsCardItem(item: CollectionItem) {
  return {
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    city: item.city ?? null,
    country: item.country ?? item.countryName ?? null,
  }
}

export function getRecommendationsCollectionKey(item: CollectionItem, kind: 'favorites' | 'history') {
  if (kind === 'history') return `history-${item.id}-${item.viewedAt}`
  return `${item.type || 'item'}-${item.id}`
}

export type { CollectionItem, TabType }
