import { useMemo, type MouseEvent } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { webViewStyle } from '@/utils/webProps'
import { getTabA11yProps, getTabListA11yProps } from '@/utils/a11yTabRoles'
import NavigationIcon from './NavigationIcon'
import { BOTTOM_DOCK_HEIGHT, BOTTOM_DOCK_ITEM_DEFS, normalizeBottomDockActivePath, OPEN_WEB_DOCK_MORE_EVENT } from './bottomDockItemDefs'
import { WEB_MOBILE_DOCK_LAYOUT, WEB_MOBILE_DOCK_LABEL_LAYOUT, WEB_MOBILE_DOCK_SIDE_PADDING } from './webMobileDockLayout'

// No auth, sheet, map store or complete menu model in this eager row.
export default function WebMobileDockShell() {
  const colors = useThemedColors()
  const router = useRouter()
  const pathname = usePathname() || '/'
  const activePath = normalizeBottomDockActivePath(pathname)
  // Web reserves the dock through CSS --mt-dock-h. Avoid an eager root/context
  // state update while route Suspense boundaries may still be hydrating.
  const styles = useMemo(() => createStyles(colors), [colors])
  const onClick = (event: MouseEvent<HTMLAnchorElement>, route: (typeof BOTTOM_DOCK_ITEM_DEFS)[number]['route'], isMore?: boolean) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (isMore && !document.dispatchEvent(new Event(OPEN_WEB_DOCK_MORE_EVENT, { cancelable: true }))) { event.preventDefault(); return }
    event.preventDefault()
    router.navigate(route)
  }
  return (
    <View testID="web-mobile-dock-shell" style={[styles.shell, breakpointStyle(WEB_MOBILE_DOCK_LAYOUT, 'shell', false)]} {...breakpointLayoutProps(WEB_MOBILE_DOCK_LAYOUT, 'shell')}>
      <View testID="footer-dock-wrapper" style={styles.wrapper}>
        <View testID="footer-dock-measure" style={styles.measure}>
          <View testID="footer-dock-row" style={styles.row} {...getTabListA11yProps()} accessibilityLabel={i18nT('navigation:components.layout.BottomDock.navigatsiya_24d0f434')}>
            {BOTTOM_DOCK_ITEM_DEFS.map(item => {
              const active = activePath === String(item.route)
              const tabProps = getTabA11yProps(active)
              return <View key={item.key} style={styles.slot}>
                <a href={String(item.route)} data-testid={`footer-item-${item.key}`} role={tabProps.accessibilityRole} aria-selected={tabProps['aria-selected']} aria-label={item.accessibilityLabel} aria-current={active ? 'page' : undefined} onClick={e => onClick(e, item.route, item.isMore)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: '100%', minHeight: 44, minWidth: 0, paddingLeft: 1, paddingRight: 1, borderRadius: active ? DESIGN_TOKENS.radii.sm : 8, background: active ? colors.primarySoft : 'transparent' }}>
                  <View style={styles.inner}>
                    <View style={styles.iconBox}><NavigationIcon name={item.iconName} size={22} color={active ? colors.primary : colors.textMuted} /></View>
                    <Text numberOfLines={1} style={[styles.label, breakpointStyle(WEB_MOBILE_DOCK_LABEL_LAYOUT, 'text', false), active && styles.activeLabel]} {...breakpointLayoutProps(WEB_MOBILE_DOCK_LABEL_LAYOUT, 'text')}>{item.label}</Text>
                    {active && <View style={styles.marker} />}
                  </View>
                </a>
              </View>
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

export function WebHeaderMoreFallback({ color }: { color: string }) {
  return <a href="/more" data-testid="header-more-fallback" aria-label={i18nT('navigation:components.layout.CustomHeaderMobileAccountSection.otkryt_menyu_e43b6ae3')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', display: 'flex', flexShrink: 0, color }}><Feather name="menu" size={24} color={color} /></a>
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  shell: webViewStyle({ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', height: BOTTOM_DOCK_HEIGHT, zIndex: 890, backgroundColor: colors.background }),
  wrapper: webViewStyle({ width: '100%', height: BOTTOM_DOCK_HEIGHT, maxHeight: 64, paddingTop: 2, paddingBottom: 2, paddingHorizontal: WEB_MOBILE_DOCK_SIDE_PADDING.compact, backgroundColor: colors.surfaceMuted, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight, overflow: 'hidden', boxShadow: DESIGN_TOKENS.shadows.medium, userSelect: 'none' }),
  measure: { width: '100%' }, row: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, slot: { flex: 1, minWidth: 0 },
  inner: { width: '100%', minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }, iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.textMuted, width: '100%', maxWidth: '100%', marginTop: 1, textAlign: 'center' }, activeLabel: { color: colors.primaryText, fontWeight: '600' }, marker: { width: 4, height: 4, borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.primary, marginTop: 2 },
})
