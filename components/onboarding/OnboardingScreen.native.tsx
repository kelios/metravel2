// First-run onboarding (native only). Explains the three core values of MeTravel:
// real routes ("travel book"), city quests, and the nearby map.
// Shown once over the home tab; the "seen" flag lives in AsyncStorage.
// Web has a no-op sibling (OnboardingScreen.tsx) — web uses its own WelcomeBanner.

import { useCallback, useEffect, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { hapticImpact } from '@/utils/haptics'

const ONBOARDING_STORAGE_KEY = 'metravel.onboarding.v1'

type Slide = {
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: 'book-open',
    title: 'Книга путешествий',
    body: 'Реальные маршруты с фото, заметками и GPS-точками. Сохраняйте поездки и собирайте личную книгу путешествий.',
  },
  {
    icon: 'map-pin',
    title: 'Городские квесты',
    body: 'Проходите квесты прямо на месте: загадки, точки на карте и истории, которые открываются по мере движения по маршруту.',
  },
  {
    icon: 'compass',
    title: 'Карта и места рядом',
    body: 'Смотрите маршруты и интересные места на карте, находите идеи поблизости и стройте свой следующий выезд.',
  },
]

export default function OnboardingScreen() {
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const [checked, setChecked] = useState(false)
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
        if (!cancelled) setVisible(seen == null)
      } catch {
        // Storage unavailable → don't block the app, just skip onboarding.
        if (!cancelled) setVisible(false)
      } finally {
        if (!cancelled) setChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1').catch(() => {})
  }, [])

  const onSkip = useCallback(() => {
    hapticImpact('light')
    dismiss()
  }, [dismiss])

  const onNext = useCallback(() => {
    hapticImpact('light')
    setIndex((prev) => {
      if (prev >= SLIDES.length - 1) {
        dismiss()
        return prev
      }
      return prev + 1
    })
  }, [dismiss])

  if (!checked || !visible) return null

  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]
  const styles = createStyles(colors)
  const cardMaxWidth = Math.min(width - DESIGN_TOKENS.spacing.lg * 2, 420)

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
        <View style={styles.iconBadge}>
          <Feather name={slide.icon} size={36} color={colors.primaryDark} />
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Начать' : 'Далее'}
        >
          <Text style={styles.primaryButtonText}>
            {isLast ? 'Начать' : 'Далее'}
          </Text>
          <Feather
            name={isLast ? 'check' : 'arrow-right'}
            size={18}
            color={colors.textOnPrimary}
          />
        </Pressable>

        {!isLast ? (
          <Pressable
            style={styles.skipButton}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Пропустить онбординг"
            hitSlop={8}
          >
            <Text style={styles.skipText}>Пропустить</Text>
          </Pressable>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9998,
      elevation: 9998,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.overlay,
    },
    card: {
      width: '100%',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xl,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      ...DESIGN_TOKENS.elevation[4],
    },
    iconBadge: {
      width: 72,
      height: 72,
      borderRadius: DESIGN_TOKENS.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      ...DESIGN_TOKENS.typography.scale.h1,
      color: colors.text,
      textAlign: 'center',
    },
    body: {
      ...DESIGN_TOKENS.typography.scale.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    dots: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
      marginVertical: DESIGN_TOKENS.spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.primary,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      alignSelf: 'stretch',
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primary,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    },
    primaryButtonText: {
      ...DESIGN_TOKENS.typography.scale.bodyStrong,
      color: colors.textOnPrimary,
    },
    skipButton: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      justifyContent: 'center',
    },
    skipText: {
      ...DESIGN_TOKENS.typography.scale.body,
      color: colors.textMuted,
    },
    skipSpacer: {
      height: DESIGN_TOKENS.touchTarget.minHeight + DESIGN_TOKENS.spacing.xs,
    },
  })
