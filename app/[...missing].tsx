import { Stack, router } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'
import { useMemo } from 'react'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import Button from '@/components/ui/Button'
import { Text, View } from '@/components/ui/Themed'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { buildCanonicalUrl } from '@/utils/seo'
import { translate as i18nT } from '@/i18n'


export default function NotFoundScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <>
      <Stack.Screen options={{ title: i18nT('shared:app.missing.oops_a237d9cd') }} />
      <InstantSEO
        headKey="not-found"
        title={i18nT('shared:app.missing.stranitsa_ne_naydena_metravel_a9673114')}
        description={i18nT('shared:app.missing.stranitsa_ne_naydena_pereydite_na_glavnuyu_i_0cfdec3b')}
        canonical={buildCanonicalUrl('/')}
        robots="noindex, nofollow"
      />
      <View style={styles.container}>
        <Text style={styles.title}>{i18nT('shared:app.missing.stranitsa_ne_naydena_8663ccb9')}</Text>

        <Text style={styles.subtitle}>
          {i18nT('shared:app.missing.pohozhe_vy_pereshli_po_nevernoy_ssylke_ili_s_3d66babf')}</Text>

        <Button
          variant="primary"
          label={i18nT('shared:app.missing.na_glavnuyu_58d8ad67')}
          style={styles.ctaButton}
          onPress={() => router.replace('/')}
        />

        <Button
          variant="ghost"
          label={i18nT('shared:app.missing.nazad_50acffff')}
          style={styles.ctaButtonSecondary}
          onPress={() => {
            if (Platform.OS === 'web') {
              router.replace('/')
              return
            }
            router.back()
          }}
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
    maxWidth: 420,
  },
  ctaButton: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    minWidth: 200,
  },
  ctaButtonSecondary: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    minWidth: 200,
  },
})
