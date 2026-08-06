import React, { Suspense, useCallback, useMemo, useRef } from 'react'
import { Platform, View } from 'react-native'
import { usePathname } from 'expo-router'

import { useResponsive } from '@/hooks/useResponsive'
import { useHydrationReady } from '@/hooks/useHydrationReady'
import { useThemedColors } from '@/hooks/useTheme'
import useBreadcrumbModel from '@/hooks/useBreadcrumbModel'

import {
  CustomHeaderAccountSectionComp,
  CustomHeaderNavSectionComp,
  HeaderContextBarLazy,
} from './customHeaderLazy'
import {
  getHeaderActivePath,
  getIsHeaderMobile,
  isQuestDetailHeaderPath,
  shouldShowHeaderContextBar,
} from './customHeaderModel'
import { resolveHeaderContextBarAction } from './headerContextBarModel'
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation'
import { createCustomHeaderStyles, webStickyStyle } from './customHeaderStyles'
import { webDataSetProps } from '@/utils/webProps'
import Logo from './Logo'
import LanguageSwitcher from './LanguageSwitcher'

const TOP_LEVEL_TAB_PATHS = new Set<string>(
  ['/'].concat(HEADER_NAV_ITEMS.filter((item) => !item.external).map((item) => item.path)),
)

const CONTEXT_BAR_HEIGHT_MOBILE = 52
const CONTEXT_BAR_HEIGHT_DESKTOP = 40

// Хуки для media-query-раскладки шапки в критическом CSS (#1298). RNW отдаёт
// `dataSet` как data-атрибуты, поэтому это единственный стабильный селектор:
// атомарные классы RNW генерируются сборкой и на них опираться нельзя.
const webSlotProps = (slot: 'nav' | 'account' | 'inner') =>
  Platform.OS === 'web'
    ? webDataSetProps(slot === 'inner' ? { headerInner: 'true' } : { headerSlot: slot })
    : null

type CustomHeaderProps = {
  onHeightChange?: (height: number) => void
  isNavigationTarget?: boolean
}

function CustomHeader({ onHeightChange, isNavigationTarget = true }: CustomHeaderProps) {
  const colors = useThemedColors()
  const pathname = usePathname()
  // useResponsive returns width=0 during SSR and first client render,
  // matching the server snapshot → prevents hydration mismatch in Suspense fallback.
  // After hydration it switches to real window.innerWidth via useSyncExternalStore.
  const responsive = useResponsive()
  const hydrationReady = useHydrationReady()
  const isHydrated = hydrationReady && responsive.isHydrated
  const width = isHydrated ? responsive.width : 0
  const isMobile = getIsHeaderMobile(width, width)
  // #1298: до гидратации ширина неизвестна (SSR-снимок даёт width=0), и верхняя
  // строка шапки рисовалась мобильной, а после гидратации перекладывалась в
  // desktop — логотип 44x44 -> 115x44, переключатель языка 624 -> 1167. Первый
  // кадр на web теперь всегда несёт desktop-геометрию строки, а узкие экраны
  // приводит к мобильному виду media-query критического CSS (блок
  // `max-width:1279.98px` в utils/criticalCSSBuilder.ts). После гидратации DOM
  // совпадает с тем, что уже нарисовал браузер, поэтому сдвига нет.
  // Семантику контекст-бара (`isMobile`) это не трогает: у него своя ветка.
  const rowIsMobile = Platform.OS === 'web' && !isHydrated ? false : isMobile
  const activePath = getHeaderActivePath(pathname)
  const showHeaderContextBar =
    shouldShowHeaderContextBar(pathname, isMobile) &&
    !(Platform.OS === 'web' && !isHydrated && isQuestDetailHeaderPath(pathname))

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
    () => createCustomHeaderStyles(colors, rowIsMobile),
    [colors, rowIsMobile],
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
      nativeID={isNavigationTarget ? 'main-navigation' : undefined}
      onLayout={handleLayout}
      {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : null)}
    >
      <View style={styles.wrapper}>
        <View style={[styles.inner, rowIsMobile && styles.innerMobile]} {...webSlotProps('inner')}>
          <Logo isCompact={rowIsMobile} showWordmark={!rowIsMobile} />

          {!rowIsMobile &&
            (isHydrated ? (
              <Suspense fallback={<View style={styles.navScroll} />}>
                <CustomHeaderNavSectionComp activePath={activePath} styles={styles} />
              </Suspense>
            ) : (
              // До гидратации держим только бокс навигации (`flex:1`, как у самой
              // ScrollView): так ширина строки уже финальная, но ленивый чанк не
              // качается на узких экранах, где навигации не будет вовсе.
              <View style={styles.navScroll} {...webSlotProps('nav')} aria-hidden />
            ))}

          <LanguageSwitcher compact={rowIsMobile} />

          {/* Account section is auth-specific (no SSR/SEO value). Render only the
              empty placeholder during prerender + first client render — mounting the
              lazy section on the server emits an errored Suspense boundary (<!--$!-->)
              that throws React #419 on hydration. isHydrated is false on the server and
              first client render, true after hydration (and always true on native).
              Плейсхолдер обязан занимать тот же бокс, что и смонтированная секция,
              иначе её появление уводит переключатель языка влево (#1298): на web
              это `rightSection` с зарезервированной шириной, а ниже 1280px CSS
              превращает его в мобильный `flex:1`. */}
          {isHydrated ? (
            <Suspense fallback={<View style={rowIsMobile ? styles.rightSectionMobile : styles.rightSection} />}>
              <CustomHeaderAccountSectionComp
                activePath={activePath}
                isMobile={rowIsMobile}
                styles={styles}
              />
            </Suspense>
          ) : (
            <View
              style={rowIsMobile ? styles.rightSectionMobile : styles.rightSection}
              {...webSlotProps('account')}
              aria-hidden
            />
          )}
        </View>

        {showHeaderContextBar ? (
          isHydrated ? (
            <Suspense fallback={<View style={contextBarFallbackStyle} aria-hidden />}>
              <HeaderContextBarLazy />
            </Suspense>
          ) : (
            <View style={contextBarFallbackStyle} aria-hidden />
          )
        ) : null}
      </View>
    </View>
  )
}

export default React.memo(CustomHeader)
