import { Platform, StyleSheet } from 'react-native'
import { LAYOUT } from '@/constants/layout'
import type { ThemedColors } from '@/hooks/useTheme'
import type { FiltersPanelStyleContext } from './filtersPanelStyles/context'
import { getCardStyles } from './filtersPanelStyles/cardStyles'
import { getStatusStyles } from './filtersPanelStyles/statusStyles'
import { getChipsStyles } from './filtersPanelStyles/chipsStyles'
import { getRouteStyles } from './filtersPanelStyles/routeStyles'
import { getMapControlsStyles } from './filtersPanelStyles/mapControlsStyles'
import { getFooterStyles } from './filtersPanelStyles/footerStyles'
import { getLightRouteStyles } from './filtersPanelStyles/lightRouteStyles'

export const getFiltersPanelStyles = (colors: ThemedColors, isMobile: boolean, windowWidth: number) => {
  const panelWidth = isMobile ? '100%' : Math.max(Math.min(windowWidth - 40, 404), 292)
  const bottomDockReserve = Platform.OS === 'web' && isMobile ? (LAYOUT?.tabBarHeight ?? 56) : 0

  const ctx: FiltersPanelStyleContext = { colors, isMobile, panelWidth, bottomDockReserve }

  return StyleSheet.create({
    ...getCardStyles(ctx),
    ...getStatusStyles(ctx),
    ...getChipsStyles(ctx),
    ...getRouteStyles(ctx),
    ...getMapControlsStyles(ctx),
    ...getFooterStyles(ctx),
    ...getLightRouteStyles(ctx),
  })
}

export default getFiltersPanelStyles
