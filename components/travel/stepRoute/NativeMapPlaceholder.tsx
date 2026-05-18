import React from 'react'
import { Text, View } from 'react-native'

import type { Styles } from './styles'

export const NativeMapPlaceholder = React.memo(function NativeMapPlaceholder({ styles }: { styles: Styles }) {
  return (
    <View style={styles.nativeMapPlaceholder}>
      <Text style={styles.nativeMapTitle}>Карта доступна в браузере</Text>
      <Text style={styles.nativeMapBody}>
        На мобильном приложении добавьте точки вручную (кнопка выше) и сохраните маршрут.
      </Text>
    </View>
  )
})
