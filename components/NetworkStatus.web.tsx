import React, { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'

interface NetworkStatusProps {
  showWhenOnline?: boolean
  position?: 'top' | 'bottom'
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showWhenOnline = false,
  position = 'top',
}) => {
  const colors = useThemedColors()
  const { isConnected } = useNetworkStatus()
  const [wasOffline, setWasOffline] = useState(false)
  const [visible, setVisible] = useState(!isConnected)

  useEffect(() => {
    if (!isConnected) {
      setWasOffline(true)
      setVisible(true)
      return () => undefined
    }

    if (wasOffline) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(() => setWasOffline(false), 300)
      }, 2000)
      return () => clearTimeout(timer)
    }

    setVisible(false)
    return () => undefined
  }, [isConnected, wasOffline])

  const translateY = visible ? 0 : -100

  if (isConnected && !wasOffline && !showWhenOnline) {
    return null
  }

  const message = isConnected ? 'Соединение восстановлено' : 'Нет подключения к интернету'
  const backgroundColor = isConnected ? colors.success : colors.danger

  return (
    <View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        { backgroundColor, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.text, { color: colors.textInverse }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    zIndex: 9999,
    transitionProperty: Platform.OS === 'web' ? ('transform' as any) : undefined,
    transitionDuration: Platform.OS === 'web' ? ('300ms' as any) : undefined,
    transitionTimingFunction: Platform.OS === 'web' ? ('ease' as any) : undefined,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        willChange: 'transform' as any,
      },
    }),
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
})
