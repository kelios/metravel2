import { StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'
import {
  PANEL_RADIUS,
  CONTROL_RADIUS,
  MENU_RADIUS,
  PILL_RADIUS,
  type StylesCtx,
} from './modernFiltersStyles/tokens'
import { createContainerHeaderStyles } from './modernFiltersStyles/containerHeaderStyles'
import { createToolbarStyles } from './modernFiltersStyles/toolbarStyles'
import { createSortStyles } from './modernFiltersStyles/sortStyles'
import { createExtraFiltersStyles } from './modernFiltersStyles/extraFiltersStyles'
import { createGroupStyles } from './modernFiltersStyles/groupStyles'
import { createOptionStyles } from './modernFiltersStyles/optionStyles'
import { createFooterStyles } from './modernFiltersStyles/footerStyles'

export const createModernFiltersStyles = (colors: ReturnType<typeof useThemedColors>) => {
  const { spacing, typography, radii } = DESIGN_TOKENS
  const mobileWebTopReserve = (LAYOUT?.headerHeight ?? 56) * 2

  const ctx: StylesCtx = {
    colors,
    spacing,
    typography,
    radii,
    mobileWebTopReserve,
    PANEL_RADIUS,
    CONTROL_RADIUS,
    MENU_RADIUS,
    PILL_RADIUS,
  }

  return StyleSheet.create({
    ...createContainerHeaderStyles(ctx),
    ...createToolbarStyles(ctx),
    ...createSortStyles(ctx),
    ...createExtraFiltersStyles(ctx),
    ...createGroupStyles(ctx),
    ...createOptionStyles(ctx),
    ...createFooterStyles(ctx),
  })
}
