import React, { Suspense } from 'react'
import { View, ActivityIndicator } from 'react-native'

// Keep the route module tiny to avoid pulling heavy quest + location deps into the entry bundle.
const QuestsScreenImpl = React.lazy(() => import('@/screens/tabs/QuestsScreen'))

export default function QuestsScreen() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <QuestsScreenImpl />
    </Suspense>
  )
}
