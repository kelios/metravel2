import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

const LoginForm = React.lazy(() => import('@/components/auth/LoginForm'))

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="large" />
  </View>
)

export default function LoginRoute() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginForm />
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
