import React, { Suspense } from 'react'
import { View, ActivityIndicator } from 'react-native'

// Keep the route module tiny to avoid pulling UserPoints + location deps into the entry bundle.
const UserPointsScreenImpl = React.lazy(() => import('@/src/screens/tabs/UserPointsScreen'))

export default function UserPointsScreen() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <UserPointsScreenImpl />
    </Suspense>
  )
}
