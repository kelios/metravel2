import React, { useCallback, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet from '@/components/ui/ActionListSheet'
import CardActionPressable from '@/components/ui/CardActionPressable'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import type { ActionChip } from './PlaceListCard.types'

/** Сторона квадратной миниатюры строки (#3142: 64–72 px по постановке). */
export const PLACE_LIST_ROW_THUMB_SIZE = 72
/** Вертикальный отступ строки: миниатюра + 2 × xs = 88 px — 6 строк на экране 844 px. */
const ROW_PADDING_Y = DESIGN_TOKENS.spacing.xs
/** Высота строки (без внешнего отступа) — общая для строки и её каркаса загрузки. */
export const PLACE_LIST_ROW_HEIGHT = PLACE_LIST_ROW_THUMB_SIZE + ROW_PADDING_Y * 2

export type PlaceListRowProps = {
  title: string
  /** Короткая строка под названием: адрес, время в пути. */
  subtitle?: string | null
  categoryLabel?: string | null
  imageUrl?: string | null
  /** Нажатие на строку (показать на карте; в режиме выбора — отметить). */
  onPress?: () => void
  /** Действия строки: все в листе «⋯» (#2101 — удаление последним, `destructive`). */
  actions?: ActionChip[]
  /** Режим выбора: вместо «⋯» — отметка на миниатюре, нажатие переключает выбор. */
  selectionMode?: boolean
  selected?: boolean
  active?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Компактная строка места для списков на телефоне (#3142): миниатюра слева,
 * справа категория, название в две строки и одна строка подзаголовка; все
 * действия — в листе «⋯». На экране 844 px помещается шесть строк против двух
 * карточек `PlaceListCard`. Миниатюра — `contain` с заливкой полей доминантным
 * цветом, как у всех медиа сайта (docs/RULES.md → Images; решение владельца
 * 09.11.2026). Строка и «⋯» — соседние нажимаемые области, а не вложенные:
 * на web кнопка внутри кнопки ломает клавиатуру и скринридер.
 */
export const PlaceListRow = React.memo(function PlaceListRow({
  title,
  subtitle,
  categoryLabel,
  imageUrl,
  onPress,
  actions = [],
  selectionMode = false,
  selected = false,
  active = false,
  testID,
  style,
}: PlaceListRowProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [sheetVisible, setSheetVisible] = useState(false)
  const openSheet = useCallback(() => setSheetVisible(true), [])
  const closeSheet = useCallback(() => setSheetVisible(false), [])
  const sheetTitle = i18nT('map:components.places.PlaceListCard.navigatsiya_i_deystviya_777daf07')
  const showMenu = !selectionMode && actions.length > 0

  const accessibilityLabel = [categoryLabel, title, subtitle].filter(Boolean).join(', ')

  return (
    <View
      style={[styles.row, active && styles.rowActive, selected && styles.rowSelected, style]}
      testID={testID}
    >
      <CardActionPressable
        accessibilityRole={selectionMode ? 'checkbox' : 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selectionMode ? { checked: selected } : undefined}
        onPress={onPress}
        title={title}
        style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
        testID={testID ? `${testID}-main` : undefined}
      >
        <View style={styles.thumb}>
          <ImageCardMedia
            src={imageUrl ?? null}
            alt={title}
            width={PLACE_LIST_ROW_THUMB_SIZE}
            height={PLACE_LIST_ROW_THUMB_SIZE}
            borderRadius={DESIGN_TOKENS.radii.sm}
            fit="contain"
            loading="lazy"
            testID={testID ? `${testID}-thumb` : undefined}
          />
          {selectionMode ? (
            <View style={[styles.checkBadge, selected && styles.checkBadgeSelected]} testID={testID ? `${testID}-check` : undefined}>
              <Feather
                name={selected ? 'check' : 'circle'}
                size={16}
                color={selected ? colors.textOnPrimary : colors.textMuted}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {categoryLabel ? (
            <Text style={styles.category} numberOfLines={1}>
              {categoryLabel}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </CardActionPressable>

      {showMenu ? (
        <>
          <CardActionPressable
            accessibilityRole="button"
            accessibilityLabel={sheetTitle}
            accessibilityState={{ expanded: sheetVisible }}
            onPress={openSheet}
            title={sheetTitle}
            style={({ pressed }) => [styles.menuButton, pressed && styles.mainPressed]}
            testID={testID ? `${testID}-menu` : undefined}
          >
            <Feather name="more-vertical" size={20} color={colors.textMuted} />
          </CardActionPressable>
          <ActionListSheet actions={actions} onClose={closeSheet} title={sheetTitle} visible={sheetVisible} />
        </>
      ) : null}
    </View>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: PLACE_LIST_ROW_HEIGHT,
      paddingVertical: ROW_PADDING_Y,
      paddingLeft: ROW_PADDING_Y,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    rowActive: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: colors.primarySoft,
      ...(Platform.OS === 'web' ? ({ boxShadow: `0 0 0 3px ${colors.primaryAlpha30}` } as ViewStyle) : null),
    },
    rowSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    main: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      minHeight: PLACE_LIST_ROW_THUMB_SIZE,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    mainPressed: {
      opacity: 0.85,
    },
    thumb: {
      width: PLACE_LIST_ROW_THUMB_SIZE,
      height: PLACE_LIST_ROW_THUMB_SIZE,
      borderRadius: DESIGN_TOKENS.radii.sm,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    checkBadge: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.xxs,
      left: DESIGN_TOKENS.spacing.xxs,
      width: 24,
      height: 24,
      borderRadius: DESIGN_TOKENS.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
    },
    checkBadgeSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    // Без gap: категория 14 + название 2×20 + подзаголовок 18 = 72 = миниатюра,
    // иначе строка с длинным названием выше PLACE_LIST_ROW_HEIGHT и её каркаса.
    body: {
      flex: 1,
      minWidth: 0,
    },
    category: {
      ...DESIGN_TOKENS.typography.scale.label,
      color: colors.primaryDark,
      textTransform: 'uppercase',
    },
    title: {
      ...DESIGN_TOKENS.typography.scale.bodyStrong,
      lineHeight: 20,
      color: colors.text,
    },
    subtitle: {
      ...DESIGN_TOKENS.typography.scale.bodySmall,
      color: colors.textMuted,
    },
    menuButton: {
      width: DESIGN_TOKENS.touchTarget.minWidth,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
  })

export default PlaceListRow
