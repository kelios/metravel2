import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { getQuestAgeCategory } from '@/utils/questAudience'
import type { QuestMeta } from '@/utils/questAdapters'

const CARD_MEDIA_SIZE = 132

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
}

function formatPoints(points: number): string {
  const mod10 = points % 10
  const mod100 = points % 100
  if (mod10 === 1 && mod100 !== 11) return `${points} точка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${points} точки`
  return `${points} точек`
}

function formatDuration(durationMin: number): string {
  if (durationMin < 60) return `~${durationMin} мин`
  const hours = durationMin / 60
  const rounded = Number.isInteger(hours) ? hours : hours.toFixed(1)
  return `~${rounded} ч`
}

type Props = {
  quest: QuestMeta
  /** Надзаголовок над названием квеста */
  eyebrow?: string
  imageLoading?: 'lazy' | 'eager'
  style?: any
}

/**
 * Карточка-CTA «Пройдите квест по этому городу» — перелинковка travel/главная → квест.
 * Ведёт на /quests/{cityId}/{quest_id}.
 */
export function QuestForCityCard({
  quest,
  eyebrow = 'Городской квест-маршрут',
  imageLoading = 'eager',
  style,
}: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const href = `/quests/${quest.cityId}/${quest.id}`
  const chips: { key: string; icon: keyof typeof Feather.glyphMap; label: string }[] = []
  if (quest.points) chips.push({ key: 'points', icon: 'map-pin', label: formatPoints(quest.points) })
  if (quest.durationMin)
    chips.push({ key: 'duration', icon: 'clock', label: formatDuration(quest.durationMin) })
  const ageCategory = quest.ageCategory ?? getQuestAgeCategory(quest.tags)
  if (ageCategory) chips.push({ key: 'age', icon: 'users', label: ageCategory.label })
  if (quest.difficulty && DIFFICULTY_LABEL[quest.difficulty])
    chips.push({
      key: 'difficulty',
      icon: 'bar-chart-2',
      label: DIFFICULTY_LABEL[quest.difficulty],
    })

  const cityLabel = quest.cityName ? `по городу ${quest.cityName}` : 'по этому городу'
  const coverUri = typeof quest.cover === 'string' ? quest.cover.trim() : ''

  return (
    <Pressable
      onPress={() => router.push(href as any)}
      style={({ pressed, hovered }: any) => [
        styles.card,
        style,
        (pressed || hovered) && styles.cardHover,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Пройти квест ${cityLabel}: ${quest.title}`}
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
          alt={`Обложка квеста ${quest.title}`}
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
              <React.Fragment key={chip.key}>
                {i > 0 && <View style={styles.dot} />}
                <View style={styles.chip}>
                  <Feather name={chip.icon} size={13} color={colors.textMuted} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </View>
              </React.Fragment>
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
