import React, { useCallback } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import { buildRegistrationHref } from '@/utils/authNavigation'
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'

const HEADING = 'Сохраняй маршруты и любимые места'
const SUBTITLE =
  'Бесплатный аккаунт: собирай избранное, планируй поездки и синхронизируй их на всех устройствах.'
const CTA_LABEL = 'Создать бесплатный аккаунт'

type TravelRegisterCtaSectionProps = {
  redirect?: string
}

export const TravelRegisterCtaSection: React.FC<TravelRegisterCtaSectionProps> = ({ redirect }) => {
  const { isAuthenticated } = useAuth()
  const colors = useThemedColors()
  const router = useRouter()

  const handlePress = useCallback(() => {
    trackRegisterCtaClicked({ source: 'travel_article', intent: 'favorite', authState: 'guest' })
    router.push(buildRegistrationHref({ redirect, intent: 'favorite' }) as never)
  }, [redirect, router])

  if (isAuthenticated) return null

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityLabel={HEADING}
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
    >
      <Text
        style={[styles.heading, { color: colors.text }]}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >
        {HEADING}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{SUBTITLE}</Text>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={CTA_LABEL}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.buttonText}>{CTA_LABEL}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 24,
    marginBottom: 12,
    padding: 18,
    borderWidth: 1,
    borderRadius: 8,
  },
  heading: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
})

export default React.memo(TravelRegisterCtaSection)
