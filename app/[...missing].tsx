import { Link, Stack, router } from 'expo-router'
import { Platform, Pressable, StyleSheet } from 'react-native'

import { Text, View } from '@/components/Themed'
import { DESIGN_TOKENS } from '@/constants/designSystem'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Страница не найдена</Text>

        <Text style={styles.subtitle}>
          Похоже, вы перешли по неверной ссылке или страница была перемещена.
        </Text>

        <Link href="/" asChild>
          <Pressable style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>На главную</Text>
          </Pressable>
        </Link>

        <Pressable
          style={styles.secondaryButton}
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS === 'web') {
              router.replace('/')
              return
            }
            router.back()
          }}
        >
          <Text style={styles.secondaryButtonText}>Назад</Text>
        </Pressable>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DESIGN_TOKENS.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    fontSize: 14,
    lineHeight: 20,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
    maxWidth: 420,
  },
  primaryButton: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    minWidth: 200,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: DESIGN_TOKENS.colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    minWidth: 200,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: DESIGN_TOKENS.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
})
