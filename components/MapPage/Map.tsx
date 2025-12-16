import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'

type AnyComponent = React.ComponentType<any>

export default function Map(props: any) {
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined'
  const [Component, setComponent] = useState<AnyComponent | null>(null)

  useEffect(() => {
    let mounted = true
    if (!isWeb) return

    ;(async () => {
      try {
        const mod = await import('./OptimizedMap.web')
        const Comp = (mod as any).default ?? (mod as any)
        if (mounted) setComponent(() => Comp)
      } catch {
        if (mounted) setComponent(null)
      }
    })()

    return () => {
      mounted = false
    }
  }, [isWeb])

  if (!isWeb) return null

  if (!Component) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {Platform.OS === 'web' ? (
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          />
        ) : (
          <ActivityIndicator size="large" />
        )}
        <Text style={{ marginTop: 12 }}>Загружаем карту…</Text>
      </View>
    )
  }

  return <Component {...props} />
}
