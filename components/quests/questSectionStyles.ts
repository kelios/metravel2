import { Platform, StyleSheet } from 'react-native'

import { asBottomDimension } from '@/components/layout/bottomChromeInset'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import type { ThemedColors } from '@/hooks/useTheme'
import { getQuestCatalogSidebarWidth } from '@/screens/tabs/QuestsStyleMetrics'
import { webStyle, webViewStyle } from '@/utils/webProps'

const { spacing, radii } = DESIGN_TOKENS

/** Shared geometry for catalogue, landing and map navigation. */
export function getQuestSectionStyles(colors: ThemedColors, screenWidth: number) {
  const isMobile = screenWidth < 768
  const sidebarWidth = getQuestCatalogSidebarWidth(screenWidth)
  const drawerTop = LAYOUT.headerHeight + spacing.sm

  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      backgroundColor: colors.background,
      flexDirection: isMobile ? 'column' : 'row',
    },
    desktopSidebarSlot: {
      display: isMobile ? 'none' : 'flex',
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: isMobile ? 0 : sidebarWidth,
      width: isMobile ? 0 : sidebarWidth,
      minHeight: 0,
      flexDirection: 'row',
    },
    sidebarOverlay: {
      ...Platform.select({
        web: {
          ...webStyle({
            position: 'fixed',
            top: drawerTop,
            left: 0,
            right: 0,
            bottom: asBottomDimension('var(--mt-dock-h, 0px)'),
            backgroundColor: colors.overlay,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 999,
            touchAction: 'none',
            overscrollBehavior: 'none',
          }),
          ...webViewStyle({
            animationKeyframes: 'fadeIn',
            animationDuration: '0.2s',
            animationTimingFunction: 'ease',
          }),
        },
        default: {
          ...StyleSheet.absoluteFill,
          backgroundColor: colors.overlay,
          zIndex: 999,
          elevation: 8,
        },
      }),
    },
    sidebarMobile: {
      ...Platform.select({
        web: {
          ...webStyle({
            position: 'fixed',
            top: drawerTop,
            left: 0,
            bottom: asBottomDimension('var(--mt-dock-h, 0px)'),
            width: 340,
            maxWidth: asBottomDimension('88vw'),
            height: 'auto',
            maxHeight: asBottomDimension(`calc(100dvh - ${drawerTop}px - var(--mt-dock-h, 0px))`),
            paddingTop: asBottomDimension('env(safe-area-inset-top, 0px)'),
            paddingBottom: asBottomDimension('env(safe-area-inset-bottom, 0px)'),
            zIndex: 1000,
            borderTopRightRadius: radii.lg,
            borderBottomRightRadius: radii.lg,
            overflow: 'hidden',
            boxShadow: colors.boxShadows.modal ?? DESIGN_TOKENS.shadows.modal,
          }),
          ...webViewStyle({
            animationKeyframes: 'slideInLeft',
            animationDuration: '0.25s',
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }),
        },
        default: {
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: Math.min(340, Math.round(screenWidth * 0.88)),
          zIndex: 1000,
          elevation: 12,
          borderTopRightRadius: radii.lg,
          borderBottomRightRadius: radii.lg,
          overflow: 'hidden',
        },
      }),
    },
  })
}
