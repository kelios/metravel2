import React, { Suspense, useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { translate as i18nT } from '@/i18n'
import { buildQuestCityAliasMap } from '@/utils/questCityAlias'
import { STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { filterQuestsByTheme, getActiveQuestThemes } from '@/utils/questThemes'
import {
  ALL_QUESTS_ID, BIKE_FILTER_ID, KIDS_FILTER_ID, NEARBY_ID, REVIEWED_FILTER_ID,
  buildQuestCityCatalog, filterBikeQuests,
  filterKidsQuests, filterReviewedQuests, toThemeSelectionId,
} from '@/screens/tabs/QuestsScreen.helpers'
import { useQuestCountrySelection } from '@/screens/tabs/useQuestCountrySelection'
import { useQuestPersonalSlices } from '@/screens/tabs/useQuestPersonalSlices'
import { QuestSectionFrame } from './QuestSectionFrame'
import { QUEST_PUBLIC_NAV_LAYOUT } from './questPageColumnsLayout'

const QuestsSidebar = React.lazy(() => import('@/screens/tabs/QuestsSidebar'))

/** Navigation for non-catalog pages, without catalog search/geo/return lifecycle. */
export default function QuestPublicPageFrame({ children, selectedCityId = null, viewMode = 'list' }: {
  children: React.ReactNode
  selectedCityId?: string | null
  viewMode?: 'list' | 'map'
}) {
  const router = useRouter()
  const colors = useThemedColors()
  const { activeSeasonalTheme } = useTheme()
  const { width, isMobile } = useBreakpoints()
  const { quests } = useQuestsList()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
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
    closeDrawer()
    if (catalog.cities.some((city) => city.id === id)) {
      router.push(`/quests/${aliases.get(id) || id}`)
      return
    }
    await AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, id).catch(() => undefined)
    router.push('/quests')
  }, [aliases, catalog.cities, closeDrawer, router])
  const showMap = useCallback((mode: 'list' | 'map') => {
    closeDrawer()
    if (mode === 'map') router.push('/quests/map')
    else void navigateToSelection(ALL_QUESTS_ID)
  }, [closeDrawer, navigateToSelection, router])

  const sidebarProps: React.ComponentProps<typeof QuestsSidebar> = {
    colors, screenWidth: width, viewMode, selectedCityId,
    activeCountryCode: countries.activeCountryCode, nearbyRequesting: false,
    nearbyId: NEARBY_ID, kidsFilterId: KIDS_FILTER_ID, bikeFilterId: BIKE_FILTER_ID,
    themes: themes.map(({ theme, selectionId }) => ({ id: theme.id, label: theme.label, icon: theme.icon, selectionId })),
    showCompletedFilter: personal.showCompletedFilter,
    showCompletedByOthersFilter: personal.showCompletedByOthersFilter,
    showUncompletedFilter: personal.showUncompletedFilter,
    areAllCountryGroupsCollapsed: countries.areAllCountryGroupsCollapsed,
    collapsedCountryCodes: countries.collapsedCountryCodes,
    citiesByCountry: countries.countryGroups, cityQuestCountById: counts,
    spacingMd: DESIGN_TOKENS.spacing.md, onSelectCity: navigateToSelection,
    onSetViewMode: showMap, onToggleCountryGroup: countries.toggleCountryGroup,
    onToggleAllCountryGroups: countries.toggleAllCountryGroups,
  }

  return (
    <QuestSectionFrame drawerOpen={drawerOpen} onCloseDrawer={closeDrawer}
      sidebar={!isMobile ? <Suspense fallback={null}><QuestsSidebar {...sidebarProps} testID="quests-desktop-sidebar" /></Suspense> : null}
      drawerSidebar={<Suspense fallback={null}><QuestsSidebar {...sidebarProps} onCloseDrawer={closeDrawer} /></Suspense>}>
      <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <View {...breakpointLayoutProps(QUEST_PUBLIC_NAV_LAYOUT, 'toolbar')}
          style={[{ backgroundColor: colors.surface, paddingHorizontal: DESIGN_TOKENS.spacing.md,
            borderBottomWidth: 1, borderBottomColor: colors.borderLight },
          breakpointStyle(QUEST_PUBLIC_NAV_LAYOUT, 'toolbar', !isMobile)]}>
          <Pressable onPress={() => setDrawerOpen(true)} accessibilityRole="button"
            accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.vybrat_gorod_0bc4253e')}
            style={{ minHeight: DESIGN_TOKENS.touchTarget.minHeight, flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm }}>
            <Feather name="menu" size={18} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontWeight: '700' }}>{i18nT('quests:screens.tabs.QuestsContentPanel.vybrat_gorod_0bc4253e')}</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </QuestSectionFrame>
  )
}
