import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatDate } from '@/i18n/format'
import { useTranslation } from '@/i18n/LocaleProvider'
import { isoDateToLocalMidnight } from '@/constants/advent'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { KIND_ICONS, STATE_ICONS, stateLabel } from './adventDoorVisuals'

type Props = {
  door: AdventDoorView
  /** Экран ждёт auth — плитки не нажимаются, чтобы не писать прогресс «никому». */
  disabled?: boolean
  onPress: (door: AdventDoorView) => void
}

export const formatDoorDate = (iso: string): string =>
  formatDate(isoDateToLocalMidnight(iso), { day: 'numeric', month: 'long' })

function AdventDoorTile({ door, disabled = false, onPress }: Props) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const locked = door.state === 'locked'
  // У бонуса дата уже стоит заголовком плитки: в подписи только состояние, без повтора даты
  // (в узкой док-панели «Откроется 25 декабря» обрезалось до «Откроется 25 …»).
  const caption = locked && !door.bonus
    ? t('adventStatic:tile.locked', { value1: formatDoorDate(door.date) })
    : stateLabel(door.state)
  const icon = door.state === 'available' || door.state === 'opened' ? KIND_ICONS[door.kind] : STATE_ICONS[door.state]
  const iconColor =
    door.state === 'done' ? colors.success : door.state === 'locked' ? colors.textMuted : colors.primaryDark

  return (
    <Pressable
      testID={`advent-door-${door.day}`}
      accessibilityRole="button"
      accessibilityLabel={t('adventStatic:tile.windowA11y', { value1: door.day, value2: formatDoorDate(door.date), value3: stateLabel(door.state) })}
      accessibilityState={{ disabled: locked || disabled }}
      disabled={locked || disabled}
      onPress={() => onPress(door)}
      style={({ pressed }) => [
        styles.tile,
        styles[door.state],
        pressed && !locked && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.day, door.bonus && styles.bonusDate, locked && styles.dayLocked]}>{door.bonus ? formatDoorDate(door.date) : door.day}</Text>
        {door.bonus ? (
          <View style={styles.bonus}>
            <Text style={styles.bonusText}>{t('adventStatic:tile.bonus')}</Text>
          </View>
        ) : null}
      </View>
      <Feather name={icon} size={22} color={iconColor} />
      <Text style={[styles.caption, locked && styles.captionLocked]} numberOfLines={2}>
        {caption}
      </Text>
    </Pressable>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    tile: {
      width: '100%',
      minHeight: 112,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      padding: DESIGN_TOKENS.spacing.sm,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    locked: { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
    available: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    opened: { backgroundColor: colors.surface, borderColor: colors.border },
    done: { backgroundColor: colors.successSoft, borderColor: colors.success },
    pressed: { opacity: 0.85 },
    topRow: { width: '100%', alignItems: 'flex-start', gap: DESIGN_TOKENS.spacing.xxs },
    day: { fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 26 },
    bonusDate: { fontSize: 17, lineHeight: 22 },
    dayLocked: { color: colors.textMuted },
    bonus: {
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.warningSoft,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 2,
    },
    bonusText: { fontSize: 10, fontWeight: '700', color: colors.text, textTransform: 'uppercase' },
    caption: { fontSize: 12, lineHeight: 16, color: colors.textSecondary, width: '100%' },
    captionLocked: { color: colors.textMuted },
  })

export default memo(AdventDoorTile)
