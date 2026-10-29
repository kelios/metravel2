import React, { Suspense, useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { QuestSectionFrame } from './QuestSectionFrame'
import { QUEST_PUBLIC_NAV_LAYOUT } from './questPageColumnsLayout'

const QuestPublicNavigationProvider = React.lazy(() => import('./QuestPublicNavigationProvider'))

/** Navigation for non-catalog pages, without catalog search/geo/return lifecycle. */
export default function QuestPublicPageFrame({ children, selectedCityId = null, viewMode = 'list' }: {
  children: React.ReactNode
  selectedCityId?: string | null
  viewMode?: 'list' | 'map'
}) {
  const colors = useThemedColors()
  const { isMobile } = useBreakpoints()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const navigation = useMemo(() => (
    <Suspense fallback={null}>
      <QuestPublicNavigationProvider selectedCityId={selectedCityId} viewMode={viewMode}
        onCloseDrawer={closeDrawer} testID={!isMobile ? 'quests-desktop-sidebar' : undefined} />
    </Suspense>
  ), [closeDrawer, isMobile, selectedCityId, viewMode])

  return (
    <QuestSectionFrame drawerOpen={drawerOpen} onCloseDrawer={closeDrawer}
      sidebar={!isMobile ? navigation : null}
      drawerSidebar={navigation}>
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
