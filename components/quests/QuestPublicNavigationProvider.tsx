import { useCallback, useMemo } from 'react'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import { useQuestsList } from '@/hooks/useQuestsApi'
import QuestsSidebar from '@/screens/tabs/QuestsSidebar'
import {
  ALL_QUESTS_ID, BIKE_FILTER_ID, KIDS_FILTER_ID, NEARBY_ID, REVIEWED_FILTER_ID,
  buildQuestCityCatalog, filterBikeQuests,
  filterKidsQuests, filterReviewedQuests, toThemeSelectionId,
} from '@/screens/tabs/QuestsScreen.helpers'
import { useQuestCountrySelection } from '@/screens/tabs/useQuestCountrySelection'
import { useQuestPersonalSlices } from '@/screens/tabs/useQuestPersonalSlices'
import { buildQuestCityAliasMap } from '@/utils/questCityAlias'
import { STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'
import { filterQuestsByTheme, getActiveQuestThemes } from '@/utils/questThemes'

export type QuestPublicNavigationProviderProps = {
  selectedCityId: string | null
  viewMode: 'list' | 'map'
  onCloseDrawer: () => void
  testID?: string
}

/** Load the catalog model together with its only visible sidebar. */
export default function QuestPublicNavigationProvider({ selectedCityId, viewMode, onCloseDrawer, testID }: QuestPublicNavigationProviderProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const { activeSeasonalTheme } = useTheme()
  const { width, isMobile } = useBreakpoints()
  const { quests } = useQuestsList()
  const catalog = useMemo(() => buildQuestCityCatalog(quests), [quests])
  const aliases = useMemo(() => buildQuestCityAliasMap(quests), [quests])
  const personal = useQuestPersonalSlices(quests)
  const countries = useQuestCountrySelection(selectedCityId, catalog.cities, catalog.questsByCityId)
  const themes = useMemo(() => getActiveQuestThemes(new Date(), activeSeasonalTheme)
    .map((theme) => ({ theme, selectionId: toThemeSelectionId(theme.id), quests: filterQuestsByTheme(quests, theme) }))
    .filter((entry) => entry.quests.length > 0), [quests, activeSeasonalTheme])
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const city of catalog.cities) result[city.id] = catalog.questsByCityId[city.id]?.length ?? 0
    result[KIDS_FILTER_ID] = filterKidsQuests(quests).length
    result[BIKE_FILTER_ID] = filterBikeQuests(quests).length
    result[REVIEWED_FILTER_ID] = filterReviewedQuests(quests).length
    for (const entry of themes) result[entry.selectionId] = entry.quests.length
    return { ...result, ...personal.counts }
  }, [catalog, personal.counts, quests, themes])

  const navigateToSelection = useCallback(async (id: string) => {
    onCloseDrawer()
    if (catalog.cities.some((city) => city.id === id)) {
      router.push(`/quests/${aliases.get(id) || id}`)
      return
    }
    await AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, id).catch(() => undefined)
    router.push('/quests')
  }, [aliases, catalog.cities, onCloseDrawer, router])
  const showMap = useCallback((mode: 'list' | 'map') => {
    onCloseDrawer()
    if (mode === 'map') router.push('/quests/map')
    else void navigateToSelection(ALL_QUESTS_ID)
  }, [onCloseDrawer, navigateToSelection, router])

  return <QuestsSidebar
    colors={colors} screenWidth={width} viewMode={viewMode} selectedCityId={selectedCityId}
    activeCountryCode={countries.activeCountryCode} nearbyRequesting={false}
    nearbyId={NEARBY_ID} kidsFilterId={KIDS_FILTER_ID} bikeFilterId={BIKE_FILTER_ID}
    themes={themes.map(({ theme, selectionId }) => ({ id: theme.id, label: theme.label, icon: theme.icon, selectionId }))}
    showCompletedFilter={personal.showCompletedFilter}
    showCompletedByOthersFilter={personal.showCompletedByOthersFilter}
    showUncompletedFilter={personal.showUncompletedFilter}
    areAllCountryGroupsCollapsed={countries.areAllCountryGroupsCollapsed}
    collapsedCountryCodes={countries.collapsedCountryCodes}
    citiesByCountry={countries.countryGroups} cityQuestCountById={counts}
    spacingMd={DESIGN_TOKENS.spacing.md} onSelectCity={navigateToSelection}
    onSetViewMode={showMap} onToggleCountryGroup={countries.toggleCountryGroup}
    onToggleAllCountryGroups={countries.toggleAllCountryGroups}
    onCloseDrawer={isMobile ? onCloseDrawer : undefined} testID={testID}
  />
}
