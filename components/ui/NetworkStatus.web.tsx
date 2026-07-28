import React, { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { translate as i18nT } from '@/i18n'
import { webViewStyle } from '@/utils/webProps'


interface NetworkStatusProps {
  showWhenOnline?: boolean
  position?: 'top' | 'bottom'
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showWhenOnline = false,
  position = 'top',
}) => {
  const router = useRouter()
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

  const message = isConnected ? i18nT('shared:components.ui.NetworkStatus.soedinenie_vosstanovleno_25419314') : i18nT('shared:components.ui.NetworkStatus.net_podklyucheniya_k_internetu_71e8692e')
  const backgroundColor = isConnected ? colors.success : colors.danger

  return (
    <View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        { backgroundColor, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.text, { color: colors.textInverse }]}>{message}</Text>
        {!isConnected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nT('offline:openSaved')}
            onPress={() => router.push('/offline')}
            style={[styles.action, { borderColor: colors.textInverse }]}
          >
            <Text style={[styles.actionText, { color: colors.textInverse }]}>{i18nT('offline:openSaved')}</Text>
          </Pressable>
        ) : null}
      </View>
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
    ...Platform.select({
      web: webViewStyle({
        position: 'fixed',
        transitionDuration: '300ms',
        transitionProperty: 'transform',
        transitionTimingFunction: 'ease',
        willChange: 'transform',
      }),
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
})
