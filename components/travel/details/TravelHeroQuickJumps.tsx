import React from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'

const ACTION_LABELS: Record<string, string> = {
  map: 'Открыть карту',
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
  const colors = useThemedColors()

  const chips = links.map((link, index) => {
    const isPrimary = link.key === 'map' || index === 0
    const label = ACTION_LABELS[link.key] ?? link.label

    return (
      <Pressable
        key={link.key}
        onPress={() => onQuickJump(link.key)}
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

export default React.memo(TravelHeroQuickJumps)
