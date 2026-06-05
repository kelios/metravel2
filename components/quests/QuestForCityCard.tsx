import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
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
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const href = `/quests/${quest.cityId}/${quest.id}`
  const meta: string[] = []
  if (quest.points) meta.push(`${quest.points} точек`)
  if (quest.durationMin) meta.push(`~${Math.round(quest.durationMin / 60)} ч`)
  if (quest.difficulty && DIFFICULTY_LABEL[quest.difficulty]) meta.push(DIFFICULTY_LABEL[quest.difficulty])

  const cityLabel = quest.cityName ? `по городу ${quest.cityName}` : 'по этому городу'
  const cardStyle = StyleSheet.flatten([styles.card, style])
  const coverUri = typeof quest.cover === 'string' ? quest.cover.trim() : ''

  return (
    <Link
      href={href as any}
      style={cardStyle}
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
        {meta.length > 0 && <Text style={styles.meta}>{meta.join('  ·  ')}</Text>}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{`Пройти квест ${cityLabel} →`}</Text>
        </View>
      </View>
    </Link>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface ?? '#fff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border ?? 'rgba(0,0,0,0.08)',
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
    },
    media: {
      width: CARD_MEDIA_SIZE,
      height: CARD_MEDIA_SIZE,
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
    meta: {
      fontSize: 13,
      color: colors.textMuted ?? '#6b7280',
    },
    cta: {
      marginTop: 6,
    },
    ctaText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary ?? '#f5842c',
    },
  })
}

export default React.memo(QuestForCityCard)
