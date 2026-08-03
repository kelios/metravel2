import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused } from 'expo-router'

import ListTravel from '@/components/listTravel/ListTravelBase'
import { useThemedColors } from '@/hooks/useTheme'

export default function MeTravelScreen() {
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ListTravel enabled={isFocused} />
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.mutedBackground,
    },
  })
