import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform, Pressable, View } from 'react-native'

import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
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
  const { width, isMobile } = useBreakpoints()
  const colors = useThemedColors()
  const styles = useMemo(() => getQuestSectionStyles(colors, width), [colors, width])
  const showDrawer = isMobile && drawerOpen
  const isWeb = Platform.OS === 'web'
  const [sidebarMounted, setSidebarMounted] = useState(!isMobile || drawerOpen)
  const mountSidebar = sidebarMounted || !isMobile || showDrawer

  useEffect(() => {
    if (isWeb && (!isMobile || showDrawer)) setSidebarMounted(true)
  }, [isMobile, isWeb, showDrawer])

  useEffect(() => {
    if (Platform.OS !== 'web' || !showDrawer) return undefined
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyTouchAction = body.style.touchAction
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
    <View style={styles.root} testID="quests-root">
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
        <View style={showDrawer ? styles.sidebarMobile : styles.desktopSidebarSlot}
          testID={showDrawer ? 'quests-mobile-sidebar' : 'quests-desktop-sidebar-slot'}>
          {mountSidebar ? (isMobile ? drawerSidebar : sidebar) : null}
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
