import React, { Suspense } from 'react'
import { View, ActivityIndicator } from 'react-native'

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/src/screens/tabs/MapScreen'))

export default function MapScreen() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <MapScreenImpl />
    </Suspense>
  )
}
