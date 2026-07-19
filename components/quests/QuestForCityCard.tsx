import React, { useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import NavigationIcon from '@/components/layout/NavigationIcon'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { getQuestAgeBadgeLabel, getQuestAgeCategory, isBikeQuest } from '@/utils/questAudience'
import type { QuestMeta } from '@/utils/questAdapters'
import {
  trackQuestCardClicked,
  trackQuestCardImpression,
} from '@/utils/growthFunnelAnalytics'
import { selectPlural, translate as i18nT } from '@/i18n'


const CARD_MEDIA_SIZE = 132

const createDifficultyLabels = (): Record<string, string> => ({
  easy: i18nT('quests:components.quests.QuestForCityCard.difficulty.easy'),
  medium: i18nT('quests:components.quests.QuestForCityCard.difficulty.medium'),
  hard: i18nT('quests:components.quests.QuestForCityCard.difficulty.hard'),
})

function formatPoints(points: number): string {
  return selectPlural(points, {
    one: i18nT('quests:components.quests.QuestForCityCard.value1_tochka_48728e6c', { value1: points }),
    few: i18nT('quests:components.quests.QuestForCityCard.value1_tochki_62e11867', { value1: points }),
    many: i18nT('quests:components.quests.QuestForCityCard.value1_tochek_eabc4aac', { value1: points }),
    other: i18nT('quests:components.quests.QuestForCityCard.value1_tochek_eabc4aac', { value1: points }),
  })
}

function formatDuration(durationMin: number): string {
  if (durationMin < 60) return i18nT('quests:components.quests.QuestForCityCard.value1_min_7d3797a3', { value1: durationMin })
  const hours = durationMin / 60
  const rounded = Number.isInteger(hours) ? hours : hours.toFixed(1)
  return i18nT('quests:components.quests.QuestForCityCard.value1_ch_b656463e', { value1: rounded })
}

type Props = {
  quest: QuestMeta
  /** Надзаголовок над названием квеста */
  eyebrow?: string
  imageLoading?: 'lazy' | 'eager'
  style?: any
  analyticsSource?: string
  analyticsContextId?: string | number | null
}

/**
 * Карточка-CTA «Пройдите квест по этому городу» — перелинковка travel/главная → квест.
 * Ведёт на /quests/{cityId}/{quest_id}.
 */
export function QuestForCityCard({
  quest,
  eyebrow = i18nT('quests:components.quests.QuestForCityCard.gorodskoy_kvest_marshrut_90737ec7'),
  imageLoading = 'eager',
  style,
  analyticsSource = 'quest_card',
  analyticsContextId,
}: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const difficultyLabels = createDifficultyLabels()

  const href = `/quests/${quest.cityId}/${quest.id}`
  const analyticsParams = useMemo(() => ({
    source: analyticsSource,
    questId: quest.id,
    cityId: quest.cityId,
    contextId: analyticsContextId,
  }), [analyticsContextId, analyticsSource, quest.cityId, quest.id])
  const impression = useTrackedImpression(
    `${analyticsSource}:${String(analyticsContextId ?? '')}:${String(quest.id)}`,
    useCallback(() => trackQuestCardImpression(analyticsParams), [analyticsParams]),
  )
  const handlePress = useCallback(() => {
    trackQuestCardClicked(analyticsParams)
    router.push(href as any)
  }, [analyticsParams, href, router])
  const chips: { key: string; icon: NavigationIconName; label: string }[] = []
  if (quest.points) chips.push({ key: 'points', icon: 'map-pin', label: formatPoints(quest.points) })
  if (quest.durationMin)
    chips.push({ key: 'duration', icon: 'clock', label: formatDuration(quest.durationMin) })
  const ageCategory = quest.ageCategory ?? getQuestAgeCategory(quest.tags)
  const ageBadgeLabel = getQuestAgeBadgeLabel(ageCategory)
  if (ageBadgeLabel) chips.push({ key: 'age', icon: 'users', label: ageBadgeLabel })
  if (isBikeQuest(quest.tags))
    chips.push({ key: 'bike', icon: 'bike', label: i18nT('quests:components.quests.QuestForCityCard.veloChip') })
  if (quest.difficulty && difficultyLabels[quest.difficulty])
    chips.push({
      key: 'difficulty',
      icon: 'bar-chart-2',
      label: difficultyLabels[quest.difficulty],
    })

  const cityLabel = quest.cityName ? i18nT('quests:components.quests.QuestForCityCard.po_gorodu_value1_2e44f93b', { value1: quest.cityName }) : i18nT('quests:components.quests.QuestForCityCard.po_etomu_gorodu_57c3bf25')
  const coverUri = typeof quest.cover === 'string' ? quest.cover.trim() : ''

  return (
    <Pressable
      ref={impression.ref}
      onLayout={impression.onLayout}
      onPress={handlePress}
      style={({ pressed, hovered }: any) => [
        styles.card,
        style,
        (pressed || hovered) && styles.cardHover,
      ]}
      accessibilityRole="link"
      accessibilityLabel={i18nT('quests:components.quests.QuestForCityCard.proyti_kvest_value1_value2_54986608', { value1: cityLabel, value2: quest.title })}
    >
      <View style={styles.media}>
        <ImageCardMedia
          source={coverUri ? { uri: coverUri } : null}
          width={CARD_MEDIA_SIZE}
          height={CARD_MEDIA_SIZE}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          revealOnLoadOnly
          blurRadius={16}
          loading={imageLoading === 'lazy' ? 'lazy' : 'eager'}
          optimizeWeb={false}
          alt={i18nT('quests:components.quests.QuestForCityCard.oblozhka_kvesta_value1_28d57a5f', { value1: quest.title })}
          style={styles.image}
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text
          style={styles.title}
          numberOfLines={2}
          accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
          aria-level={3 as any}
        >
          {quest.title}
        </Text>
        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((chip, i) => (
              // Точка-разделитель живёт внутри группы с чипом, поэтому мета не
              // переносится «осиротевшим» «• Средне» на отдельную строку.
              <View key={chip.key} style={styles.chipGroup}>
                {i > 0 && <View style={styles.dot} />}
                <View style={styles.chip}>
                  <NavigationIcon name={chip.icon} size={13} color={colors.textMuted} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.arrow}>
        <Feather name="arrow-right" size={18} color={colors.primary} />
      </View>
    </Pressable>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      gap: 14,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web'
        ? {
            cursor: 'pointer',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
          }
        : null),
    },
    cardHover: {
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
          transform: 'translateY(-2px)',
        } as any,
      }),
    },
    media: {
      width: CARD_MEDIA_SIZE,
      height: CARD_MEDIA_SIZE,
      flexShrink: 0,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    image: { width: '100%', height: '100%' },
    body: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 6,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 23,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    chipGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: colors.textMuted,
      opacity: 0.6,
    },
    arrow: {
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
  })
}

export default React.memo(QuestForCityCard)
