import React from 'react'
import { Text, View } from 'react-native'

import type { Styles } from './styles'
import { translate as i18nT } from '@/i18n'


export const NativeMapPlaceholder = React.memo(function NativeMapPlaceholder({ styles }: { styles: Styles }) {
  return (
    <View style={styles.nativeMapPlaceholder}>
      <Text style={styles.nativeMapTitle}>{i18nT('travel:components.travel.stepRoute.NativeMapPlaceholder.karta_dostupna_v_brauzere_dd4d9147')}</Text>
      <Text style={styles.nativeMapBody}>
        {i18nT('travel:components.travel.stepRoute.NativeMapPlaceholder.na_mobilnom_prilozhenii_dobavte_tochki_vruch_67f3279c')}</Text>
    </View>
  )
})
