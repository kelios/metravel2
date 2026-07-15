import React from 'react'
import { Text, View } from 'react-native'

import { Button } from '@/ui/paper'

import type { Styles } from './styles'
import { translate as i18nT } from '@/i18n'


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
      accessibilityLabel={i18nT('travel:components.travel.stepRoute.RouteCoachmark.podskazka_kak_dobavit_pervuyu_tochku_marshru_9e725c1d')}
    >
      <View style={styles.flexFill}>
        <Text style={styles.coachmarkTitle}>{i18nT('travel:components.travel.stepRoute.RouteCoachmark.kak_dobavit_pervuyu_tochku_5e74ae08')}</Text>
        <Text style={styles.coachmarkBody}>
          {i18nT('travel:components.travel.stepRoute.RouteCoachmark.naydite_mesto_vvedite_koordinaty_vruchnuyu_i_980cd298')}</Text>
      </View>
      <Button
        mode="text"
        onPress={onDismiss}
        compact
        testID="travel-wizard.step-route.coachmark.dismiss"
        accessibilityLabel={i18nT('travel:components.travel.stepRoute.RouteCoachmark.skryt_podskazku_1fdecf5a')}
      >
        {i18nT('travel:components.travel.stepRoute.RouteCoachmark.ponyatno_c8de9938')}</Button>
    </View>
  )
})
