// Floating "Back" button for travel details on native.
// Android already has the hardware Back (useAndroidBackHandler), but iOS has no
// visible affordance to leave the details screen when reached from the dock/list —
// this gives both platforms one consistent, visible back control. Web ships its own
// header/back chrome, so this file is native-only (.native.tsx, never in web bundle).

import React, { useCallback } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemedColors } from '@/hooks/useTheme'

function TravelDetailsBackButton() {
  const router = useRouter()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()

  const onPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [router])

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Назад"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surfaceElevated },
          pressed && Platform.OS === 'ios' ? styles.pressed : null,
        ]}
      >
        <Feather name="arrow-left" size={22} color={colors.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    zIndex: 50,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.7,
  },
})

export default React.memo(TravelDetailsBackButton)
