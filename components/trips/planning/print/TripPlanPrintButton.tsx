// components/trips/planning/print/TripPlanPrintButton.tsx
// #2068: «Распечатать план» во вкладке «Экспорт». Только web: печатная версия —
// HTML-документ в новом окне браузера, у приложений печати нет.
import React, { useCallback, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { PlannedTrip } from '@/api/plannedTripsTypes'
import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { trackRouteExported } from '@/utils/tripAnalytics'
import { printTripPlan } from './printTripPlan'

interface Props {
  /** Поездка с разрешённой геометрией — та же, что у кнопок GPX/KML. */
  trip: PlannedTrip
}

function TripPlanPrintButton({ trip }: Props) {
  const colors = useThemedColors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePress = useCallback(() => {
    if (busy) return
    setBusy(true)
    setError(null)
    // printTripPlan открывает окно до первого await — вызов обязан остаться
    // синхронным продолжением клика.
    printTripPlan(trip)
      .then((opened) => {
        if (opened) trackRouteExported(trip.id, 'print')
        else setError(i18nT('trips:components.trips.planning.print.button.error'))
      })
      .catch(() => setError(i18nT('trips:components.trips.planning.print.button.error')))
      .finally(() => setBusy(false))
  }, [busy, trip])

  if (Platform.OS !== 'web') return null

  return (
    <View style={styles.wrap} testID="trip-plan-print">
      <Text style={[styles.label, { color: colors.text }]}>{i18nT('trips:components.trips.planning.print.section.title')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{i18nT('trips:components.trips.planning.print.button.hint')}</Text>
      <View style={styles.row}>
        <Button
          label={busy ? i18nT('trips:components.trips.planning.print.button.preparing') : i18nT('trips:components.trips.planning.print.button.label')}
          onPress={handlePress}
          variant="outline"
          loading={busy}
          disabled={busy}
          icon={<Feather name="printer" size={16} color={colors.primaryDark} />}
          testID="trip-plan-print-button"
        />
      </View>
      {error ? (
        <Text style={[styles.hint, { color: colors.danger }]} testID="trip-plan-print-error">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})

export default React.memo(TripPlanPrintButton)
