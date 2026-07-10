import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import IconButton from '@/components/ui/IconButton'
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
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Мои поездки</Text>
          <IconButton
            icon={<Feather name="plus" size={20} color={colors.text} />}
            label="Организовать поездку"
            onPress={() => router.push('/trips/plan/create')}
            size="md"
            testID="my-trips-plan-cta"
            style={styles.planIconButton}
          />
        </View>

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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 12,
    },
    h1: { flexShrink: 1, fontSize: 26, fontWeight: '800', color: colors.text },
    planIconButton: { flexShrink: 0, marginHorizontal: 0 },
    section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  })
