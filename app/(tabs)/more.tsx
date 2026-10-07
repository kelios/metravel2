import { Link, type Href } from 'expo-router'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import { BOTTOM_DOCK_ITEM_DEFS } from '@/components/layout/bottomDockItemDefs'
import { webAccessibilityProps } from '@/utils/webProps'

// Real prerendered destination for More before the optional sheet controller loads.
// Only ordinary existing public routes/labels; no role-specific actions/auth/menu model.
export default function MoreScreen() {
  const colors = useThemedColors()
  const title = BOTTOM_DOCK_ITEM_DEFS.find(item => item.isMore)!.label
  useScreenHeader({ title })
  const bottom = useScrollBottomPadding(DESIGN_TOKENS.spacing.lg)
  const links: { route: Href; label: string }[] = [
    ...BOTTOM_DOCK_ITEM_DEFS.filter(item => !item.isMore).map(item => ({ route: item.route, label: item.label })),
    { route: '/places', label: i18nT('navigationStatic:components.layout.bottomDockModel.mesta_9ad589a8') },
    { route: '/travelsby', label: i18nT('navigationStatic:components.layout.bottomDockModel.belarus_8e52cdc9') },
    { route: '/history', label: i18nT('navigationStatic:components.layout.bottomDockModel.vy_smotreli_b91d245f') },
    { route: '/contact', label: i18nT('navigationStatic:components.layout.bottomDockModel.svyazatsya_s_nami_657cb895') },
  ]
  return <ScrollView testID="more-navigation-page" contentContainerStyle={[styles.content, { paddingBottom: asBottomDimension(bottom) }]}>
    <View {...(Platform.OS === 'web' ? webAccessibilityProps({ role: 'navigation' }) : null)} accessibilityLabel={title} style={styles.links}>
      {links.map(item => <Link key={String(item.route)} href={item.route} style={[styles.link, { borderColor: colors.borderLight, color: colors.text }]}><Text>{item.label}</Text></Link>)}
    </View>
  </ScrollView>
}
const styles = StyleSheet.create({
  content: { padding: DESIGN_TOKENS.spacing.lg }, links: { gap: DESIGN_TOKENS.spacing.sm },
  link: { padding: DESIGN_TOKENS.spacing.md, minHeight: DESIGN_TOKENS.touchTarget.minHeight, borderWidth: StyleSheet.hairlineWidth, borderRadius: DESIGN_TOKENS.radii.sm },
})
