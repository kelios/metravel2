import { StyleSheet, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import ColoringPdfButton from './ColoringPdfButton'
import { useColoringSheets } from './gamesMedia'

const { radii, spacing } = DESIGN_TOKENS

export default function TravelColoringSheets({ travelId }: { travelId: number }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const { data } = useColoringSheets()
  const sheets = data?.filter(sheet => sheet.travelId === travelId)
  if (!sheets?.length) return null

  return (
    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Heading level={3}>{t('gamesStatic:articleTitle')}</Heading>
      {sheets.map(sheet => (
        <View key={sheet.id} style={styles.sheet}>
          <View style={styles.preview}>
            <ImageCardMedia src={sheet.previewUrl} alt={sheet.placeTitle} height={168} fit="contain" loading="lazy" />
          </View>
          <View style={styles.info}>
            <Heading level={4} lang="ru">{sheet.placeTitle}</Heading>
            <View style={styles.action}>
              <ColoringPdfButton url={sheet.pdfUrl} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginVertical: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: radii.lg },
  sheet: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  preview: { width: 168, maxWidth: '100%' },
  info: { gap: spacing.sm, flexGrow: 1, flexBasis: 170, minWidth: 0 },
  action: { alignSelf: 'flex-start' },
})
