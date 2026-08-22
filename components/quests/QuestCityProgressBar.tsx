import React, { useCallback, useMemo } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import type { QuestCityCollection } from '@/utils/questCityCollection'
import { trackCityCollectionView, type CityCollectionSource } from '@/utils/questRetentionAnalytics'
import { translate as i18nT, translatePlural } from '@/i18n'
import { formatInteger } from '@/i18n/format'

type Props = {
  collection: QuestCityCollection
  /** Где показана полоса — попадает в `city_collection_view`. */
  source: CityCollectionSource
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Полоса коллекции города: «Пройдено 2 из 6 квестов» (#1484).
 * Один и тот же блок стоит на экране финала и в профиле — там и там он
 * отвечает на вопрос «что ещё можно закрыть», поэтому компонент общий.
 *
 * Строки живут в namespace `quests`: на web ключи инлайнит babel-плагин
 * `i18n/babel-inline-plugin.js`, и ключа, которого нет во всех пяти локалях,
 * он не подставит — вместо текста появится «Перевод недоступен».
 */
export function QuestCityProgressBar({ collection, source, style, testID }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const { cityId, cityName, completedCount, totalCount, ratio } = collection

  const impression = useTrackedImpression(
    `city_collection:${source}:${cityId}`,
    useCallback(
      () => trackCityCollectionView({ cityId, source, completedCount, totalCount }),
      [cityId, source, completedCount, totalCount],
    ),
  )

  const title = cityName
    ? i18nT('quests:components.quests.QuestCityProgressBar.collectionLabel', { value1: cityName })
    : i18nT('quests:components.quests.QuestCityProgressBar.collectionLabelNoCity')

  // Форму слова выбираем через `translatePlural`, а не через i18next: у Hermes
  // на Android нет `Intl.PluralRules`, и плюрал схлопывается в `_other` (#1335).
  const progressText = translatePlural(
    'quests:components.quests.QuestCityProgressBar.progress',
    totalCount,
    { value1: formatInteger(completedCount), count: totalCount },
  )

  const percent = Math.round(Math.max(0, Math.min(1, ratio)) * 100)

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      collapsable={false}
      style={[styles.wrap, style]}
      testID={testID ?? `quest-city-collection-${cityId}`}
    >
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.counter} numberOfLines={1}>
          {progressText}
        </Text>
      </View>
      <View
        style={styles.track}
        role={Platform.OS === 'web' ? 'progressbar' : undefined}
        accessibilityValue={{ now: completedCount, min: 0, max: totalCount }}
        accessibilityLabel={`${title}. ${progressText}`}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      {completedCount >= totalCount && totalCount > 0 ? (
        <Text style={styles.done}>
          {i18nT('quests:components.quests.QuestCityProgressBar.allDone')}
        </Text>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    wrap: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    title: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    counter: {
      flexShrink: 0,
      fontSize: 13,
      color: colors.textMuted,
    },
    track: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: colors.backgroundTertiary,
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.brand,
    },
    done: {
      fontSize: 12,
      color: colors.textMuted,
    },
  })
}

export default QuestCityProgressBar
