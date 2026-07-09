import React from 'react'
import { Text, View } from 'react-native'

import { Button } from '@/ui/paper'

import type { Styles } from './styles'

export const RouteCoachmark = React.memo(function RouteCoachmark({
  styles,
  onDismiss,
}: {
  styles: Styles;
  onDismiss: () => void;
}) {
  return (
    <View
      style={styles.coachmark}
      testID="travel-wizard.step-route.coachmark"
      accessibilityLabel="Подсказка: как добавить первую точку маршрута"
    >
      <View style={styles.flexFill}>
        <Text style={styles.coachmarkTitle}>Как добавить первую точку</Text>
        <Text style={styles.coachmarkBody}>
          Найдите место, введите координаты вручную или кликните по карте ниже.
        </Text>
      </View>
      <Button
        mode="text"
        onPress={onDismiss}
        compact
        testID="travel-wizard.step-route.coachmark.dismiss"
        accessibilityLabel="Скрыть подсказку"
      >
        Понятно
      </Button>
    </View>
  )
})
