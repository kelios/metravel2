import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused } from 'expo-router'

import ListTravel from '@/components/listTravel/ListTravelBase'

export default function MeTravelScreen() {
  const isFocused = useIsFocused()
  const styles = useMemo(() => createStyles(), [])

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ListTravel enabled={isFocused} />
    </SafeAreaView>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
  })
