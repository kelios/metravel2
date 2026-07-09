import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import MyCreatedTripsList from '@/components/trips/MyCreatedTripsList'
import MyApplicationsList from '@/components/trips/MyApplicationsList'
import TripNotificationsList from '@/components/trips/TripNotificationsList'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export default function MyTripsScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <Text style={styles.h1}>Мои поездки</Text>

        <Button
          label="Организовать поездку"
          onPress={() => router.push('/trips/plan/create')}
          fullWidth
          testID="my-trips-plan-cta"
        />

        <Text style={styles.section}>Созданные поездки</Text>
        <MyCreatedTripsList />

        <Text style={styles.section}>Уведомления</Text>
        <TripNotificationsList />

        <Text style={styles.section}>Мои заявки</Text>
        <MyApplicationsList />
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760, gap: 12 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  })
