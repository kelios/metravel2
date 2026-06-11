import React, { useCallback } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
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
  activeKey,
}: {
  links: TravelSectionLink[]
  isMobile: boolean
  onQuickJump: (key: string) => void
  activeKey?: string
}) {
  const styles = useTravelDetailsHeroStyles()

  // Подсвечиваем активную секцию (scroll-spy); если её нет среди чипов —
  // подсвечиваем первый чип, чтобы навигация всегда имела явный акцент.
  const activeOrDefault = links.some((l) => l.key === activeKey)
    ? activeKey
    : links[0]?.key

  const chips = links.map((link) => (
    <QuickJumpChip
      key={link.key}
      link={link}
      isPrimary={link.key === activeOrDefault}
      onQuickJump={onQuickJump}
    />
  ))

  if (!isMobile) return <>{chips}</>

  return (
    <View style={styles.quickJumpScrollWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickJumpScrollContent}
        style={styles.quickJumpScroll}
        role="navigation"
        accessibilityLabel="Быстрая навигация по разделам"
      >
        {chips}
      </ScrollView>
      {Platform.OS === 'web' ? (
        <View style={styles.quickJumpScrollFade} pointerEvents="none" />
      ) : null}
    </View>
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
      accessibilityHint="Прокручивает страницу к разделу"
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
