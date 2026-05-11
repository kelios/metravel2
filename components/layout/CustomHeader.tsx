import React, { Suspense, useCallback, useMemo, useRef } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { usePathname } from 'expo-router'

import { useThemedColors } from '@/hooks/useTheme'
import useBreadcrumbModel from '@/hooks/useBreadcrumbModel'

import {
  CustomHeaderAccountSectionComp,
  CustomHeaderNavSectionComp,
  HeaderContextBarLazy,
} from './customHeaderLazy'
import {
  getEffectiveHeaderWidth,
  getHeaderActivePath,
  getIsHeaderMobile,
  shouldShowHeaderContextBar,
} from './customHeaderModel'
import { resolveHeaderContextBarAction } from './headerContextBarModel'
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation'
import { createCustomHeaderStyles, webStickyStyle } from './customHeaderStyles'
import Logo from './Logo'

const TOP_LEVEL_TAB_PATHS = new Set<string>(
  ['/'].concat(HEADER_NAV_ITEMS.filter((item) => !item.external).map((item) => item.path)),
)

const CONTEXT_BAR_HEIGHT_MOBILE = 52
const CONTEXT_BAR_HEIGHT_DESKTOP = 40

type CustomHeaderProps = {
  onHeightChange?: (height: number) => void
}

function CustomHeader({ onHeightChange }: CustomHeaderProps) {
  const colors = useThemedColors()
  const pathname = usePathname()
  const { width } = useWindowDimensions()

  const effectiveWebWidth = getEffectiveHeaderWidth(width)
  const isMobile = getIsHeaderMobile(width, effectiveWebWidth)
  const activePath = getHeaderActivePath(pathname)
  const showHeaderContextBar = shouldShowHeaderContextBar(pathname, isMobile)

  const breadcrumbModel = useBreadcrumbModel()

  // Predict whether the lazy HeaderContextBar will actually render visible UI
  // (mirrors HeaderContextBar conditions). When false on desktop, the bar
  // collapses to JSON-LD only — Suspense must reserve 0px to avoid CLS.
  const willRenderVisibleContextBar = useMemo(() => {
    if (!showHeaderContextBar) return false
    if (isMobile) {
      const action = resolveHeaderContextBarAction(pathname)
      const isTopLevelTab = !!pathname && TOP_LEVEL_TAB_PATHS.has(pathname)
      return !(isTopLevelTab && action === 'none')
    }
    return breadcrumbModel.showBreadcrumbs
  }, [breadcrumbModel.showBreadcrumbs, isMobile, pathname, showHeaderContextBar])

  const styles = useMemo(
    () => createCustomHeaderStyles(colors, isMobile),
    [colors, isMobile],
  )

  const contextBarFallbackStyle = useMemo(
    () => ({
      minHeight: willRenderVisibleContextBar
        ? isMobile
          ? CONTEXT_BAR_HEIGHT_MOBILE
          : CONTEXT_BAR_HEIGHT_DESKTOP
        : 0,
      width: '100%' as const,
    }),
    [isMobile, willRenderVisibleContextBar],
  )

  const lastHeightRef = useRef(0)
  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const next = Math.round(e.nativeEvent.layout.height)
      if (next > 0 && next !== lastHeightRef.current) {
        lastHeightRef.current = next
        onHeightChange?.(next)
      }
    },
    [onHeightChange],
  )

  return (
    <View
      style={[styles.container, webStickyStyle]}
      testID="main-header"
      onLayout={handleLayout}
    >
      <View style={styles.wrapper}>
        <View style={[styles.inner, isMobile && styles.innerMobile]}>
          <Logo isCompact={isMobile} showWordmark={!isMobile} />

          {!isMobile && (
            <Suspense fallback={<View style={styles.navScroll} />}>
              <CustomHeaderNavSectionComp activePath={activePath} styles={styles} />
            </Suspense>
          )}

          <Suspense fallback={isMobile ? <View style={styles.rightSection} /> : null}>
            <CustomHeaderAccountSectionComp
              activePath={activePath}
              isMobile={isMobile}
              styles={styles}
            />
          </Suspense>
        </View>

        {showHeaderContextBar && (
          <Suspense fallback={<View style={contextBarFallbackStyle} aria-hidden />}>
            <HeaderContextBarLazy />
          </Suspense>
        )}
      </View>
    </View>
  )
}

export default React.memo(CustomHeader)
