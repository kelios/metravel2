import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, View, type ViewInstance } from 'react-native'

import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { getQuestCatalogSidebarGeometry } from '@/screens/tabs/QuestsStyleMetrics'
import { breakpointLayoutProps } from '@/utils/breakpointLayout'
import { webAccessibilityProps } from '@/utils/webProps'
import { QUEST_FILTER_FRAME_LAYOUT } from './questPageColumnsLayout'
import { getQuestSectionStyles } from './questSectionStyles'

export type QuestSectionFrameProps = {
  sidebar: ReactNode
  drawerSidebar: ReactNode
  drawerOpen: boolean
  onCloseDrawer: () => void
  children: ReactNode
}

/** Navigation chrome only: the page keeps its existing scroll host. */
export function QuestSectionFrame({ sidebar, drawerSidebar, drawerOpen, onCloseDrawer, children }: QuestSectionFrameProps) {
  const { width } = useBreakpoints()
  const { overlay } = getQuestCatalogSidebarGeometry(width)
  const colors = useThemedColors()
  const styles = useMemo(() => getQuestSectionStyles(colors, width), [colors, width])
  const showDrawer = overlay && drawerOpen
  const isWeb = Platform.OS === 'web'
  const drawerRef = useRef<(ViewInstance & HTMLElement) | null>(null)
  useFocusTrap(drawerRef, { enabled: isWeb && showDrawer })
  const [sidebarMounted, setSidebarMounted] = useState(!overlay || drawerOpen)
  const mountSidebar = sidebarMounted || !overlay || showDrawer

  useEffect(() => {
    if (isWeb && (!overlay || showDrawer)) setSidebarMounted(true)
  }, [overlay, isWeb, showDrawer])

  useEffect(() => {
    if (Platform.OS !== 'web' || !showDrawer) return undefined
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyTouchAction = body.style.touchAction
    // The lazy navigation may still be suspended when the shared focus trap opens.
    const drawer = drawerRef.current
    if (drawer instanceof HTMLElement && !drawer.contains(document.activeElement)) {
      drawer.focus({ preventScroll: true })
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        onCloseDrawer()
      }
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.touchAction = previousBodyTouchAction
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCloseDrawer, showDrawer])

  return (
    <View {...breakpointLayoutProps(QUEST_FILTER_FRAME_LAYOUT, 'root')} style={styles.root} testID="quests-root">
      {showDrawer ? (
        <Pressable
          style={styles.sidebarOverlay}
          onPress={onCloseDrawer}
          accessibilityRole="button"
          accessibilityLabel={i18nT('quests:screens.tabs.QuestsScreen.zakryt_menyu_fbe0ff41')}
          testID="quests-sidebar-overlay"
        />
      ) : null}
      {isWeb ? (
        // One web host preserves navigation state through drawer close and resize.
        <View ref={drawerRef} style={showDrawer ? styles.sidebarMobile : styles.desktopSidebarSlot}
          {...(showDrawer
            ? webAccessibilityProps({
              role: 'dialog',
              'aria-modal': true,
              'aria-label': i18nT('quests:screens.tabs.QuestsSidebar.priklyucheniya_32619ed3'),
              tabIndex: -1,
            })
            : breakpointLayoutProps(QUEST_FILTER_FRAME_LAYOUT, 'aside'))}
          testID={showDrawer ? 'quests-mobile-sidebar' : 'quests-desktop-sidebar-slot'}>
          {mountSidebar ? (overlay ? drawerSidebar : sidebar) : null}
        </View>
      ) : (
        // Native keeps conditional mounts: hidden live Yoga trees are unsafe (#1563).
        <>
          {showDrawer ? <View style={styles.sidebarMobile} testID="quests-mobile-sidebar">{drawerSidebar}</View> : null}
          <View style={styles.desktopSidebarSlot} testID="quests-desktop-sidebar-slot">{sidebar}</View>
        </>
      )}
      {children}
    </View>
  )
}
