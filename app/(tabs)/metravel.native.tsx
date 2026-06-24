import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import ListTravel from '@/components/listTravel/ListTravelBase'
import { useThemedColors } from '@/hooks/useTheme'

export default function MeTravelScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ListTravel />
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
