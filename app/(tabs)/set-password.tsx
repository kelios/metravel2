import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

const SetPasswordForm = React.lazy(() => import('@/components/auth/SetPasswordForm'))

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="large" />
  </View>
)

export default function SetPasswordRoute() {
  return (
    <Suspense fallback={<Fallback />}>
      <SetPasswordForm />
    </Suspense>
  )
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
