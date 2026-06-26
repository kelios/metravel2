import React, { useCallback } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'

const TOUCH_TAP_MAX_MOVE = 12
const DUPLICATE_PRESS_GUARD_MS = 250

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
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        contentContainerStyle={styles.quickJumpScrollContent}
        style={styles.quickJumpScroll}
        {...(Platform.OS === 'web' ? { role: 'navigation' as const } : null)}
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
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const lastTriggerAtRef = React.useRef(0)

  const triggerQuickJump = useCallback(() => {
    const now = Date.now()
    if (now - lastTriggerAtRef.current < DUPLICATE_PRESS_GUARD_MS) return
    lastTriggerAtRef.current = now
    onQuickJump(link.key)
  }, [link.key, onQuickJump])

  const readTouchPoint = useCallback((event: any) => {
    const nativeEvent = event?.nativeEvent
    const x = Number(nativeEvent?.pageX ?? nativeEvent?.locationX)
    const y = Number(nativeEvent?.pageY ?? nativeEvent?.locationY)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x, y }
  }, [])

  const handlePress = useCallback(() => {
    triggerQuickJump()
  }, [triggerQuickJump])

  const handleTouchStart = useCallback((event: any) => {
    touchStartRef.current = readTouchPoint(event)
  }, [readTouchPoint])

  const handleTouchEnd = useCallback((event: any) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return

    const end = readTouchPoint(event)
    if (!end) return

    const dx = Math.abs(end.x - start.x)
    const dy = Math.abs(end.y - start.y)
    if (dx > TOUCH_TAP_MAX_MOVE || dy > TOUCH_TAP_MAX_MOVE) return

    triggerQuickJump()
  }, [readTouchPoint, triggerQuickJump])

  return (
    <Pressable
      onPress={handlePress}
      onTouchStart={Platform.OS === 'web' ? undefined : handleTouchStart}
      onTouchEnd={Platform.OS === 'web' ? undefined : handleTouchEnd}
      testID={`travel-quick-jump-${link.key}`}
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
