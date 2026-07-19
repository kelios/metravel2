import { Stack, router } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'

import Button from '@/components/ui/Button'
import { Text, View } from '@/components/ui/Themed'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


type ErrorScreenProps = {
  error: Error
  retry: () => void
}

export default function ErrorScreen({ error, retry }: ErrorScreenProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const message = useMemo(() => {
    if (__DEV__) return error?.message || i18nT('errorsStatic:unknownError')
    return i18nT('errors:app.error.proizoshla_nepredvidennaya_oshibka_8b5c0ea7')
  }, [error])

  return (
    <>
      <Stack.Screen options={{ title: i18nT('errors:app.error.oshibka_cecac702') }} />
      <View style={styles.container}>
        <Text style={styles.title}>{i18nT('errors:app.error.chto_to_poshlo_ne_tak_2bd9c3e0')}</Text>

        <Text style={styles.subtitle}>{message}</Text>

        <Button
          variant="primary"
          label={i18nT('errors:app.error.poprobovat_snova_86f28e83')}
          onPress={retry}
          style={styles.ctaButton}
        />

        <Button
          variant="ghost"
          label={i18nT('errors:app.error.na_glavnuyu_cdb90635')}
          onPress={() => router.replace('/')}
          style={styles.ctaButtonSecondary}
        />

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
  ctaButton: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    minWidth: 220,
  },
  ctaButtonSecondary: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    minWidth: 220,
  },
})
