import { useMemo } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'

import { createStyles } from '../styles'

export const WidgetFallback = () => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Загрузка виджета" />
    </View>
  )
}
