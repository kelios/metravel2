import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'expo-router'

import type { ProfileTabKey } from '@/components/profile/ProfileTabs'
import type { ProfileTravelEngagementMetricKey } from '@/components/profile/ProfileTravelEngagementSection'
import { isTravelListItem, normalizeToTravel } from '@/components/profile/travelNormalize'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'
import { selectPlural, translate as i18nT } from '@/i18n'
import { computeTravelEngagementSummary, type TravelEngagementStats } from '@/utils/travelEngagementStats'
import { isTravelDraft } from '@/utils/travelPublicationStatus'

import { withVisibleEngagementStats } from './profileScreen.helpers'

type UseProfileTravelSectionsInput = {
  activeTab: ProfileTabKey
  setActiveTab: Dispatch<SetStateAction<ProfileTabKey>>
  activeTravelMetric: ProfileTravelEngagementMetricKey | null
  setActiveTravelMetric: Dispatch<SetStateAction<ProfileTravelEngagementMetricKey | null>>
  favorites: unknown[]
  viewHistory: unknown[]
  myTravels: Travel[]
  engagementSummary: TravelEngagementStats | null
  travelsCount: number
  travelsLoading: boolean
  travelsLoadingMore: boolean
  travelsHasMore: boolean
  loadMoreTravels: () => Promise<void>
  personalTravelStatusEntries: TravelStatusEntry[]
}

export function useProfileTravelSections({
  activeTab,
  setActiveTab,
  activeTravelMetric,
  setActiveTravelMetric,
  favorites,
  viewHistory,
  myTravels,
  engagementSummary,
  travelsCount,
  travelsLoading,
  travelsLoadingMore,
  travelsHasMore,
  loadMoreTravels,
  personalTravelStatusEntries,
}: UseProfileTravelSectionsInput) {
  const router = useRouter()
  const normalizedFavorites = useMemo<Travel[]>(() => favorites
    .filter(isTravelListItem)
    .map((item) => normalizeToTravel({
      id: item.id,
      name: item.title,
      title: item.title,
      url: item.url,
      imageUrl: item.imageUrl,
      countryName: item.country,
      cityName: item.city,
    })), [favorites])
  const normalizedHistory = useMemo<Travel[]>(() => viewHistory
    .filter(isTravelListItem)
    .map((item) => normalizeToTravel({
      id: item.id,
      name: item.title,
      title: item.title,
      url: item.url,
      imageUrl: item.imageUrl,
      countryName: item.country,
      cityName: item.city,
    })), [viewHistory])
  const profileTravels = useMemo(
    () => myTravels.map(withVisibleEngagementStats),
    [myTravels],
  )
  const draftTravels = useMemo(() => profileTravels.filter(isTravelDraft), [profileTravels])
  const publishedTravels = useMemo(
    () => profileTravels.filter((travel) => !isTravelDraft(travel)),
    [profileTravels],
  )

  useEffect(() => {
    const requiresCompleteTravelList =
      activeTab === 'countries' ||
      activeTab === 'worldmap' ||
      activeTab === 'publishedTravels' ||
      activeTab === 'draftTravels'
    if (!requiresCompleteTravelList || travelsLoading || travelsLoadingMore || !travelsHasMore) return
    if (profileTravels.length === 0) return
    void loadMoreTravels()
  }, [
    activeTab,
    loadMoreTravels,
    profileTravels.length,
    travelsHasMore,
    travelsLoading,
    travelsLoadingMore,
  ])

  const authoredMetricTravels = useMemo(
    () => activeTravelMetric
      ? profileTravels.filter((travel) => (travel.engagementStats?.[activeTravelMetric] ?? 0) > 0)
      : [],
    [activeTravelMetric, profileTravels],
  )
  const authoredTravelEngagementScope = useMemo<'all' | 'loaded'>(() => {
    if (engagementSummary || profileTravels.length === 0) return 'all'
    return profileTravels.length >= travelsCount || !travelsHasMore ? 'all' : 'loaded'
  }, [engagementSummary, profileTravels.length, travelsCount, travelsHasMore])
  const authoredTravelEngagementSummary = useMemo(() => {
    if (engagementSummary) return engagementSummary
    if (!travelsLoading && travelsCount === 0) {
      return { favoritesCount: 0, wishlistCount: 0, visitedCount: 0, plannedCount: 0 }
    }
    return profileTravels.length > 0 ? computeTravelEngagementSummary(profileTravels) : null
  }, [engagementSummary, profileTravels, travelsCount, travelsLoading])
  const personalTravelStatusSummary = useMemo(() => personalTravelStatusEntries.reduce(
    (summary, entry) => {
      if (entry.status === 'visited') summary.visited += 1
      if (entry.status === 'wishlist') summary.wishlist += 1
      if (entry.status === 'planned') summary.planned += 1
      return summary
    },
    { visited: 0, wishlist: 0, planned: 0 },
  ), [personalTravelStatusEntries])
  const currentData = useMemo<Travel[]>(() => {
    if (activeTravelMetric) return authoredMetricTravels
    if (activeTab === 'travels') return profileTravels
    if (activeTab === 'publishedTravels') return publishedTravels
    if (activeTab === 'draftTravels') return draftTravels
    if (activeTab === 'favorites') return normalizedFavorites.map(withVisibleEngagementStats)
    if (activeTab === 'history') return normalizedHistory.map(withVisibleEngagementStats)
    return []
  }, [
    activeTab,
    activeTravelMetric,
    authoredMetricTravels,
    draftTravels,
    normalizedFavorites,
    normalizedHistory,
    profileTravels,
    publishedTravels,
  ])
  const emptyStateProps = useMemo(() => {
    if (activeTravelMetric) {
      return {
        icon: activeTravelMetric === 'visitedCount'
          ? 'check-circle'
          : activeTravelMetric === 'plannedCount'
            ? 'calendar'
            : 'heart',
        title: i18nT('profile:app.tabs.profile.net_marshrutov_s_etoy_metrikoy_a6210bd9'),
        description: i18nT('profile:app.tabs.profile.kogda_polzovateli_nachnut_sohranyat_posescha_64459d4c'),
        variant: 'empty' as const,
        action: {
          label: i18nT('profile:app.tabs.profile.pokazat_vse_marshruty_d3347795'),
          onPress: () => setActiveTravelMetric(null),
        },
      }
    }

    switch (activeTab) {
      case 'travels':
        return {
          icon: 'map',
          title: i18nT('profile:app.tabs.profile.vashi_marshruty_poyavyatsya_zdes_fdaf6317'),
          description: i18nT('profile:app.tabs.profile.dobavte_pervoe_puteshestvie_podelites_marshr_ac301777'),
          variant: 'inspire' as const,
          action: { label: i18nT('profile:app.tabs.profile.sozdat_marshrut_23a41ea7'), onPress: () => router.push('/travel/new') },
          secondaryAction: { label: i18nT('profile:app.tabs.profile.nachat_kvest_09e026a6'), onPress: () => router.push('/quests') },
        }
      case 'publishedTravels':
        return {
          icon: 'check-circle',
          title: i18nT('profile:app.tabs.profile.opublikovannyh_marshrutov_poka_net_e2858d6e'),
          description: i18nT('profile:app.tabs.profile.kogda_chernovik_budet_opublikovan_on_poyavit_56258bdd'),
          variant: 'empty' as const,
          action: { label: i18nT('profile:app.tabs.profile.sozdat_marshrut_23a41ea7'), onPress: () => router.push('/travel/new') },
          secondaryAction: draftTravels.length > 0
            ? { label: i18nT('profile:app.tabs.profile.otkryt_chernoviki_6355de2b'), onPress: () => setActiveTab('draftTravels') }
            : undefined,
        }
      case 'draftTravels':
        return {
          icon: 'edit-3',
          title: i18nT('profile:app.tabs.profile.chernovikov_poka_net_13a56af6'),
          description: i18nT('profile:app.tabs.profile.sohranennye_bez_publikatsii_puteshestviya_bu_2d0b0535'),
          variant: 'empty' as const,
          action: { label: i18nT('profile:app.tabs.profile.sozdat_marshrut_23a41ea7'), onPress: () => router.push('/travel/new') },
          secondaryAction: publishedTravels.length > 0
            ? { label: i18nT('profile:app.tabs.profile.otkryt_opublikovannye_32af0ce3'), onPress: () => setActiveTab('publishedTravels') }
            : undefined,
        }
      case 'favorites':
        return {
          icon: 'heart',
          title: i18nT('profile:app.tabs.profile.v_hochu_poehat_poka_pusto_9b04d80c'),
          description: i18nT('profile:app.tabs.profile.dobavlyayte_syuda_marshruty_kuda_hotite_poeh_59d81d81'),
          variant: 'empty' as const,
          action: { label: i18nT('profile:app.tabs.profile.nayti_marshruty_7792711b'), onPress: () => router.push('/travelsby') },
        }
      case 'history':
        return {
          icon: 'clock',
          title: i18nT('profile:app.tabs.profile.istoriya_prosmotrov_pusta_083a8250'),
          description: i18nT('profile:app.tabs.profile.otkrytye_marshruty_budut_sohranyatsya_zdes_a_4da32978'),
          variant: 'empty' as const,
          action: { label: i18nT('profile:app.tabs.profile.smotret_marshruty_01fd6a7c'), onPress: () => router.push('/travelsby') },
        }
      default:
        return { icon: 'layers', title: i18nT('profile:app.tabs.profile.pusto_7e81f6e3'), description: '' }
    }
  }, [activeTab, activeTravelMetric, draftTravels.length, publishedTravels.length, router, setActiveTab, setActiveTravelMetric])
  const formatTripsCount = useCallback((count: number) => count === 0
    ? i18nT('profile:app.tabs.profile.poka_pusto_bfb75bfd')
    : selectPlural(count, {
        one: i18nT('profile:app.tabs.profile.value1_poezdka_d109ae10', { value1: count }),
        few: i18nT('profile:app.tabs.profile.value1_poezdki_dfb10844', { value1: count }),
        many: i18nT('profile:app.tabs.profile.value1_poezdok_8d356025', { value1: count }),
        other: i18nT('profile:app.tabs.profile.value1_poezdok_8d356025', { value1: count }),
      }), [])

  return {
    authoredTravelEngagementScope,
    authoredTravelEngagementSummary,
    currentData,
    draftTravels,
    emptyStateProps,
    formatTripsCount,
    personalTravelStatusSummary,
    profileTravels,
    publishedTravels,
  }
}
