import { useMemo } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'

import { createStyles } from '../styles'
import { translate as i18nT } from '@/i18n'


export const WidgetFallback = () => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" color={colors.primaryDark} accessibilityLabel={i18nT('travel:components.travel.compactSideBar.parts.WidgetFallback.zagruzka_vidzheta_092bccd0')} />
    </View>
  )
}
