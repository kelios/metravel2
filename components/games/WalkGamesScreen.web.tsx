import { ScrollView, StyleSheet, View } from 'react-native'

import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import ResponsiveContainer from '@/components/layout/ResponsiveContainer'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import Button from '@/components/ui/Button'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import ColoringPdfButton from './ColoringPdfButton'
import { useGamesMediaManifest } from './gamesMedia'

const { radii, spacing } = DESIGN_TOKENS

export default function WalkGamesScreen() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const title = t('gamesStatic:title')
  useScreenHeader({ title })
  const bottom = useScrollBottomPadding(spacing.lg)
  const { data, isError, isPending, refetch } = useGamesMediaManifest()

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: asBottomDimension(bottom) }}>
      <ResponsiveContainer maxWidth="lg" style={styles.content}>
        <View style={styles.group}>
          <Heading level={1}>{title}</Heading>
          <Body variant="large">{t('gamesStatic:description')}</Body>
        </View>

        <View style={styles.group}>
          <Heading level={2}>{t('gamesStatic:coloringTitle')}</Heading>
          <Body muted>{t('gamesStatic:note')}</Body>
          {isPending && <Body aria-live="polite">{t('gamesStatic:loading')}</Body>}
          {!data && isError && (
            <View style={styles.group}>
              <Body accessibilityRole="alert">{t('gamesStatic:loadError')}</Body>
              <View style={styles.action}>
                <Button label={t('gamesStatic:retry')} variant="outline" onPress={() => { void refetch() }} />
              </View>
            </View>
          )}
          {data?.collections.length === 0 && <Body>{t('gamesStatic:empty')}</Body>}
          {data?.collections.map(book => (
            <View key={book.id} style={[styles.book, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Heading level={3} lang="ru">{book.title}</Heading>
              <Body muted>{t('gamesStatic:bookFormat', { count: formatInteger(book.sheetCount) })}</Body>
              <View style={styles.action}>
                <ColoringPdfButton url={book.pdfUrl} collection />
              </View>
            </View>
          ))}
        </View>
      </ResponsiveContainer>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  group: { gap: spacing.sm },
  book: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radii.lg },
  action: { alignSelf: 'flex-start' },
})
