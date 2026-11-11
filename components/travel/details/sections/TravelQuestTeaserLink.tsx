import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import LinkPressable from '@/components/ui/LinkPressable'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT, translatePlural } from '@/i18n'
import { trackQuestCardClicked } from '@/utils/growthFunnelAnalytics'
import { TRAVEL_QUEST_TEASER_SOURCE, type TravelQuestTeaser } from './travelQuestTeaser'

const ROW_MIN_HEIGHT = 44
const ROW_MARGIN_BOTTOM = DESIGN_TOKENS.spacing.sm

/**
 * #3221: строка-ссылка «<Город>: N бесплатных квестов-прогулок». Вид один на
 * сайте и в приложении; откуда пришёл подбор, решает `TravelQuestTeaserLine`.
 */
function TravelQuestTeaserLink({ teaser, contextId }: { teaser: TravelQuestTeaser; contextId: unknown }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const handlePress = useCallback(() => {
    trackQuestCardClicked({
      source: TRAVEL_QUEST_TEASER_SOURCE,
      questId: teaser.questId,
      cityId: teaser.cityId,
      contextId,
    })
  }, [contextId, teaser])

  const label = teaser.exact
    ? translatePlural('travel:components.travel.details.sections.TravelQuestTeaserLine.cityQuestsCount', teaser.count, {
      city: teaser.cityName,
      count: teaser.count,
    })
    : i18nT('travel:components.travel.details.sections.TravelQuestTeaserLine.cityQuests', { city: teaser.cityName })

  return (
    <LinkPressable
      href={teaser.href as Href}
      onPress={handlePress}
      style={styles.link}
      accessibilityLabel={label}
      testID="travel-quest-teaser"
    >
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.rowPressed]} testID="travel-quest-teaser-row">
          <Feather name="compass" size={18} color={colors.primaryDark} aria-hidden />
          <Text style={styles.label} numberOfLines={2}>{label}</Text>
          <Feather name="arrow-right" size={16} color={colors.primaryDark} aria-hidden />
        </View>
      )}
    </LinkPressable>
  )
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  link: {
    alignSelf: 'stretch',
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  // Рамка и отклик нажатия живут на внутренней строке: стиль ссылки-ребёнка
  // `Link asChild` не может зависеть от состояния нажатия.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  rowPressed: {
    opacity: 0.75,
  },
  label: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
})

export default memo(TravelQuestTeaserLink)
