import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

const RegistrationForm = React.lazy(() => import('@/components/auth/RegistrationForm'))

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="large" />
  </View>
)

export default function RegistrationRoute() {
  return (
    <Suspense fallback={<Fallback />}>
      <RegistrationForm />
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
