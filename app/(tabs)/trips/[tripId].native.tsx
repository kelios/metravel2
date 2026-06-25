import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import PublicTripDetail from '@/components/trips/PublicTripDetail'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export default function TripDetailScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const params = useLocalSearchParams<{ tripId?: string }>()
  const tripId = Number(params.tripId)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        {Number.isFinite(tripId) ? <PublicTripDetail tripId={tripId} /> : null}
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760 },
  })
