import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'

type Colors = ReturnType<typeof useThemedColors>

interface QuestGuestGateProps {
  /** Сколько точек гость уже прошёл — показываем в тексте «сохраним прогресс». */
  passedCount: number
  onLogin: () => void
  onRegister: () => void
  /** Мягкий гейт: гость может закрыть и вернуться к пройденным точкам. */
  onDismiss: () => void
  testID?: string
}

/**
 * Мягкий гейт после N бесплатных точек гостя. Не форсит закрытие квеста:
 * «Сохраним прогресс — войди или зарегистрируйся». Кнопки ведут на /login
 * и /registration с redirect обратно на текущий квест.
 */
export default function QuestGuestGate({
  passedCount,
  onLogin,
  onRegister,
  onDismiss,
  testID,
}: QuestGuestGateProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>Сохраним твой прогресс</Text>
      <Text style={styles.lead}>
        Ты прошёл {passedCount} {pluralPoints(passedCount)} — здорово! Чтобы продолжить квест,
        сохранить результат и открыть финал, войди или зарегистрируйся. Пройденное не потеряется.
      </Text>

      <Pressable
        onPress={onLogin}
        style={styles.primaryButton}
        testID="quest-guest-gate-login"
        accessibilityRole="button"
        accessibilityLabel="Войти, чтобы сохранить прогресс квеста"
      >
        <Text style={styles.primaryButtonText}>Войти</Text>
      </Pressable>

      <Pressable
        onPress={onRegister}
        style={styles.secondaryButton}
        testID="quest-guest-gate-register"
        accessibilityRole="button"
        accessibilityLabel="Зарегистрироваться, чтобы сохранить прогресс квеста"
      >
        <Text style={styles.secondaryButtonText}>Зарегистрироваться</Text>
      </Pressable>

      <Pressable
        onPress={onDismiss}
        style={styles.dismissButton}
        testID="quest-guest-gate-dismiss"
        accessibilityRole="button"
        accessibilityLabel="Вернуться к пройденным точкам квеста"
      >
        <Text style={styles.dismissButtonText}>Вернуться к пройденным точкам</Text>
      </Pressable>
    </View>
  )
}

const pluralPoints = (count: number): string => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'точку'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'точки'
  return 'точек'
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      gap: 12,
      margin: 16,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    lead: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    primaryButton: {
      marginTop: 4,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primaryText,
      fontWeight: '800',
      fontSize: 15,
    },
    dismissButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    dismissButtonText: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 13,
    },
  })
