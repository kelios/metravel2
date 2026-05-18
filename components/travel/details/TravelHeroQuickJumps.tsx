import React, { useCallback } from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'

const ACTION_LABELS: Record<string, string> = {
  map: 'Карта маршрута',
  description: 'Описание',
  points: 'Точки маршрута',
  comments: 'Комментарии',
  video: 'Видео',
}

export function TravelHeroQuickJumps({
  links,
  isMobile,
  onQuickJump,
}: {
  links: TravelSectionLink[]
  isMobile: boolean
  onQuickJump: (key: string) => void
}) {
  const styles = useTravelDetailsHeroStyles()

  const chips = links.map((link) => (
    <QuickJumpChip
      key={link.key}
      link={link}
      isPrimary={link.key === 'map'}
      onQuickJump={onQuickJump}
    />
  ))

  if (!isMobile) return <>{chips}</>

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickJumpScrollContent}
      style={styles.quickJumpScroll}
    >
      {chips}
    </ScrollView>
  )
}

const QuickJumpChip = React.memo(function QuickJumpChip({
  link,
  isPrimary,
  onQuickJump,
}: {
  link: TravelSectionLink
  isPrimary: boolean
  onQuickJump: (key: string) => void
}) {
  const styles = useTravelDetailsHeroStyles()
  const colors = useThemedColors()
  const label = ACTION_LABELS[link.key] ?? link.label
  const handlePress = useCallback(() => onQuickJump(link.key), [link.key, onQuickJump])

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.quickJumpChip,
        isPrimary && styles.quickJumpChipPrimary,
        !isPrimary && pressed && styles.quickJumpChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Перейти к разделу ${link.label}`}
    >
      <Feather
        name={link.icon as any}
        size={16}
        color={isPrimary ? colors.textOnPrimary : colors.primary}
      />
      <Text style={[styles.quickJumpLabel, isPrimary && styles.quickJumpLabelPrimary]}>
        {label}
      </Text>
    </Pressable>
  )
})

export default React.memo(TravelHeroQuickJumps)
