import React, { useCallback } from 'react'
import { Platform, Pressable, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import EdgeFadeScrollRow from '@/components/ui/EdgeFadeScrollRow'
import { useThemedColors } from '@/hooks/useTheme'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { translate as i18nT } from '@/i18n'


const TOUCH_TAP_MAX_MOVE = 12
const DUPLICATE_PRESS_GUARD_MS = 250

/**
 * Потолок системного увеличения шрифта для подписи чипа (#1947).
 *
 * Ряд чипов на телефоне — ЗАКРЕПЛЁННАЯ полоса над контентом
 * (`TravelHeroStickyNavNative` в `stickyHeaderIndices`), и её высота равна
 * 20pt внутренних отступов плюс `lineHeight` подписи. На iOS-ступенях раздела
 * «Увеличенные размеры» множитель доходит до 3.571
 * (`RCTUtils.mm` → `RCTFontSizeMultiplier`), поэтому без потолка полоса растёт
 * с ~52 до ~92pt — десятая часть экрана iPhone занята навигацией навсегда,
 * чип «Route map» раздувается примерно до 316pt, и в видимую часть ряда не
 * помещается даже один чип целиком. Туда же смотрит
 * `NATIVE_STICKY_SECTION_OFFSET = 156` (`hooks/useScrollNavigation.ts`):
 * переход к разделу считает высоту полосы константой, и неограниченный рост
 * подписи прячет заголовок раздела под полосой.
 *
 * Значение 2 — первый множитель заметно выше максимальной НЕ-accessibility
 * ступени iOS (1.353): подпись растёт с 13 до 26pt, полоса остаётся в ~64pt.
 * Потолок гасит только масштаб, а не перенос: коробка чипа по-прежнему не имеет
 * фиксированной высоты (`minHeight: 44`) и растёт под подпись.
 *
 * На Android это no-op: системный предел шкалы шрифта там 2.0. На вебе проп
 * отбрасывается — react-native-web не пробрасывает его в DOM (`forwardedProps`),
 * и браузер Dynamic Type не масштабирует.
 */
const QUICK_JUMP_LABEL_MAX_FONT_SCALE = 2

const ACTION_LABELS: Record<string, string> = {
  get map() { return i18nT('travel:components.travel.details.TravelHeroQuickJumps.action.map') },
  get description() { return i18nT('travel:components.travel.details.TravelHeroQuickJumps.action.description') },
  get points() { return i18nT('travel:components.travel.details.TravelHeroQuickJumps.action.points') },
  get comments() { return i18nT('travel:components.travel.details.TravelHeroQuickJumps.action.comments') },
  get video() { return i18nT('travel:components.travel.details.TravelHeroQuickJumps.action.video') },
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
  const colors = useThemedColors()

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
      isMobile={isMobile}
    />
  ))

  if (!isMobile) return <>{chips}</>

  return (
    <EdgeFadeScrollRow
      keyboardShouldPersistTaps="always"
      nestedScrollEnabled
      contentContainerStyle={styles.quickJumpScrollContent}
      style={styles.quickJumpScroll}
      // Ряд лежит на закреплённой полосе `colors.background` (и на вебе, и на
      // нативе), а не на карточной `surface`: в тёмной теме это #1a1a1a против
      // #2a2a2a, и затухание в `surface` рисовало бы у края светлую полосу.
      fadeColor={colors.background}
      contentKey={links.length}
      {...(Platform.OS === 'web' ? { role: 'navigation' as const } : null)}
      accessibilityLabel={i18nT('travel:components.travel.details.TravelHeroQuickJumps.bystraya_navigatsiya_po_razdelam_3bb6e8cb')}
    >
      {chips}
    </EdgeFadeScrollRow>
  )
}

const QuickJumpChip = React.memo(function QuickJumpChip({
  link,
  isPrimary,
  onQuickJump,
  isMobile,
}: {
  link: TravelSectionLink
  isPrimary: boolean
  onQuickJump: (key: string) => void
  isMobile: boolean
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
        isMobile && styles.quickJumpChipMobile,
        isPrimary && styles.quickJumpChipPrimary,
        !isPrimary && pressed && styles.quickJumpChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={i18nT('travel:components.travel.details.TravelHeroQuickJumps.pereyti_k_razdelu_value1_130009ed', { value1: link.label })}
      accessibilityHint={i18nT('travel:components.travel.details.TravelHeroQuickJumps.prokruchivaet_stranitsu_k_razdelu_f16386ae')}
    >
      <Feather
        name={link.icon as any}
        size={16}
        color={isPrimary ? colors.textOnPrimary : colors.primary}
      />
      <Text
        testID={`travel-quick-jump-label-${link.key}`}
        style={[styles.quickJumpLabel, isPrimary && styles.quickJumpLabelPrimary]}
        maxFontSizeMultiplier={QUICK_JUMP_LABEL_MAX_FONT_SCALE}
      >
        {label}
      </Text>
    </Pressable>
  )
})

export default React.memo(TravelHeroQuickJumps)
