import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
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
  style?: any
}

/**
 * Карточка-CTA «Пройдите квест по этому городу» — перелинковка travel/главная → квест.
 * Ведёт на /quests/{cityId}/{quest_id}.
 */
export function QuestForCityCard({ quest, eyebrow = 'Городской квест-маршрут', style }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const href = `/quests/${quest.cityId}/${quest.id}`
  const chips: { key: string; icon: keyof typeof Feather.glyphMap; label: string }[] = []
  if (quest.points) chips.push({ key: 'points', icon: 'map-pin', label: formatPoints(quest.points) })
  if (quest.durationMin)
    chips.push({ key: 'duration', icon: 'clock', label: formatDuration(quest.durationMin) })
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
      accessibilityLabel={`Пройти квест: ${quest.title}`}
    >
      <View style={styles.media}>
        <ImageCardMedia
          source={coverUri ? { uri: coverUri } : null}
          width={CARD_MEDIA_SIZE}
          height={CARD_MEDIA_SIZE}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          blurRadius={16}
          loading="eager"
          alt={`Обложка квеста ${quest.title}`}
          style={styles.image}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.eyebrowRow}>
          <Feather name="flag" size={12} color={colors.primary ?? '#f5842c'} />
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>
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
            {chips.map((chip) => (
              <View key={chip.key} style={styles.chip}>
                <Feather name={chip.icon} size={12} color={colors.primary ?? '#f5842c'} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.cta}>
          <Text style={styles.ctaText} numberOfLines={1}>
            {`Пройти квест ${cityLabel}`}
          </Text>
          <Feather name="arrow-right" size={15} color={colors.primaryText ?? '#fff'} />
        </View>
      </View>
    </Pressable>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: CARD_MEDIA_SIZE,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.primarySoft ?? colors.surface ?? '#fff',
      borderWidth: 1,
      borderColor: colors.primaryAlpha30 ?? colors.border ?? 'rgba(0,0,0,0.08)',
      borderLeftWidth: 4,
      borderLeftColor: colors.primary ?? '#f5842c',
      ...(Platform.OS === 'web'
        ? {
            cursor: 'pointer',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          }
        : null),
    },
    cardHover: {
      borderColor: colors.primaryAlpha40 ?? colors.primary ?? 'rgba(0,0,0,0.12)',
      ...Platform.select({
        web: { boxShadow: '0 6px 18px rgba(15, 23, 42, 0.1)' } as any,
      }),
    },
    media: {
      width: CARD_MEDIA_SIZE,
      height: CARD_MEDIA_SIZE,
      flexShrink: 0,
      backgroundColor: colors.border ?? 'rgba(0,0,0,0.06)',
    },
    image: { width: '100%', height: '100%' },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    body: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 14,
      paddingHorizontal: 16,
      justifyContent: 'center',
      gap: 4,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.primary ?? '#f5842c',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text ?? '#1a1a1a',
      lineHeight: 22,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: colors.surface ?? '#fff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primaryAlpha30 ?? colors.border ?? 'rgba(0,0,0,0.08)',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text ?? '#1a1a1a',
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: 8,
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.primary ?? '#f5842c',
    },
    ctaText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryText ?? '#fff',
    },
  })
}

export default React.memo(QuestForCityCard)
