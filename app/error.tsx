import { Stack, router } from 'expo-router'
import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet } from 'react-native'

import { Text, View } from '@/components/Themed'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

type ErrorScreenProps = {
  error: Error
  retry: () => void
}

export default function ErrorScreen({ error, retry }: ErrorScreenProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const message = useMemo(() => {
    if (__DEV__) return error?.message || 'Неизвестная ошибка'
    return 'Произошла непредвиденная ошибка'
  }, [error])

  return (
    <>
      <Stack.Screen options={{ title: 'Ошибка' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Что-то пошло не так</Text>

        <Text style={styles.subtitle}>{message}</Text>

        <Pressable style={styles.primaryButton} accessibilityRole="button" onPress={retry}>
          <Text style={styles.primaryButtonText}>Попробовать снова</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          accessibilityRole="button"
          onPress={() => router.replace('/')}
        >
          <Text style={styles.secondaryButtonText}>На главную</Text>
        </Pressable>

        {Platform.OS === 'web' && (
          <Pressable
            style={styles.tertiaryButton}
            accessibilityRole="button"
            onPress={() => window.location.reload()}
          >
            <Text style={styles.tertiaryButtonText}>Перезагрузить страницу</Text>
          </Pressable>
        )}
      </View>
    </>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DESIGN_TOKENS.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 520,
  },
  primaryButton: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    minWidth: 220,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    minWidth: 220,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    minWidth: 220,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tertiaryButtonText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
})
