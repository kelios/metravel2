import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet from '@/components/ui/ActionListSheet'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { formatInteger } from '@/i18n/format'

import type { QuestRouteModel, QuestRouteRow } from './questRouteModel'
import { QUEST_NAV_FINALE_TEST_ID, QuestStepMarker } from './questWizardNavigation'

/** Высота строки полосы и строки листа — минимальная цель касания (§11 макета). */
export const QUEST_ROUTE_ROW_MIN_HEIGHT = 44

type Props = {
  model: QuestRouteModel
  onGoToStep: (stepIndex: number) => void
  onShowFinale: () => void
  /** Пассивная пометка языка, отдельный сосед кнопки маршрута в строке 44 px. */
  contentLocaleSlot?: React.ReactNode
}

/**
 * #2149: полоса маршрута на телефоне (< 600 px) вместо полосы прогресса и ряда
 * кружков. Одна кнопка: «Точка 12 из 14 · Задания 10/11» и шкала из сегментов,
 * по нажатию — лист «Маршрут» со всеми точками. Вид и подписи — `buildQuestRouteModel`.
 */
export default function QuestRouteStrip({ model, onGoToStep, onShowFinale, contentLocaleSlot }: Props) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [sheetOpen, setSheetOpen] = useState(false)
  const close = useCallback(() => setSheetOpen(false), [])
  const sheetScrollRef = useRef<ScrollView>(null)
  // Лист открывается на текущей точке, а не на старте: на 12-й из 14 её строка
  // иначе ниже края листа (≈ 11 строк на 390×844, ≈ 8 на 320×640). Строки
  // монтируются при каждом открытии, поэтому onLayout приходит каждый раз.
  const onCurrentRowLayout = useCallback((y: number) => {
    sheetScrollRef.current?.scrollTo({ y: Math.max(0, y - QUEST_ROUTE_ROW_MIN_HEIGHT * 2), animated: false })
  }, [])
  const openRow = useCallback(
    (row: QuestRouteRow) => {
      // Закрытая точка не открывается, даже если платформа доставила нажатие.
      if (row.disabled) return
      setSheetOpen(false)
      if (row.kind === 'finale') onShowFinale()
      else onGoToStep(row.stepIndex)
    },
    [onGoToStep, onShowFinale],
  )

  const hasLocaleSlot = Boolean(contentLocaleSlot)
  const positionText = !hasLocaleSlot ? '' : model.position.kind === 'point'
    ? `${formatInteger(model.position.index)}/${formatInteger(model.position.total)}`
    : model.position.kind === 'intro'
      ? t('quests:components.quests.questWizardShell.start_225f7a82')
      : t('quests:components.quests.questStepState.finale')

  const routeButton = (
    <Pressable
        testID="quest-route-strip"
        accessibilityRole="button"
        accessibilityLabel={model.stripAccessibilityLabel}
        accessibilityHint={t('quests:components.quests.questRoute.stripHint')}
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [styles.strip, hasLocaleSlot && styles.stripWithLocale, pressed && styles.pressed]}
      >
        <View style={styles.stripTextRow}>
          {hasLocaleSlot ? (
            <View style={styles.compactMetrics}>
              <View style={styles.compactMetric}>
                <Feather name={model.position.kind === 'point' ? 'map-pin' : model.position.kind === 'intro' ? 'play' : 'flag'} size={12} color={colors.textMuted} />
                <Text style={styles.compactMetricText} numberOfLines={1}>{positionText}</Text>
              </View>
              {model.tasks ? (
                <View style={styles.compactMetric}>
                  <Feather name="check-square" size={12} color={colors.textMuted} />
                  <Text style={styles.compactMetricText} numberOfLines={1}>
                    {`${formatInteger(model.tasks.completed)}/${formatInteger(model.tasks.total)}`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.stripText} numberOfLines={1}>
              {model.stripText}
            </Text>
          )}
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </View>
        <View style={styles.segments} testID="quest-route-segments">
          {model.segments.map((segment) => (
            <React.Fragment key={segment.key}>
              <View
                style={[
                  styles.segment,
                  segment.role === 'optional' ? styles.segmentOptional : null,
                  // Тот же вид, что у маркера (§10): сплошная заливка у пройденной и
                  // текущей, контур у остальных — состояние читается формой.
                  {
                    backgroundColor: segment.visual.backgroundColor,
                    borderColor: segment.visual.borderColor,
                    borderWidth: Math.min(segment.visual.borderWidth, segment.role === 'optional' ? 1 : 1.5),
                  },
                ]}
              />
              {segment.role === 'final' ? (
                <Feather name="flag" size={10} color={segment.visual.fill === 'solid' ? segment.visual.backgroundColor : colors.textMuted} />
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </Pressable>
  )

  return (
    <>
      {hasLocaleSlot ? (
        <View style={styles.localeRouteRow} testID="quest-locale-route-row">
          {routeButton}
          <View style={styles.localeSlot}>{contentLocaleSlot}</View>
        </View>
      ) : routeButton}

      <ActionListSheet visible={sheetOpen} onClose={close} title={t('quests:components.quests.questRoute.title')}>
        <ScrollView ref={sheetScrollRef} style={styles.sheetBody} testID="quest-route-sheet">
          {model.rows.map((row) => (
            <Pressable
              key={row.key}
              testID={row.kind === 'finale' ? QUEST_NAV_FINALE_TEST_ID : `quest-route-row-${row.key}`}
              accessibilityRole="button"
              accessibilityLabel={row.accessibilityLabel}
              accessibilityState={{ disabled: row.disabled, selected: row.visual.state === 'current' }}
              disabled={row.disabled}
              onPress={() => openRow(row)}
              onLayout={
                row.visual.state === 'current' ? (e) => onCurrentRowLayout(e.nativeEvent.layout.y) : undefined
              }
              style={({ pressed }) => [styles.row, pressed && !row.disabled && styles.pressed]}
            >
              <QuestStepMarker visual={row.visual} text={row.numberLabel} />
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowTitle, row.disabled && { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {row.title}
                </Text>
                <Text style={styles.rowDetail} numberOfLines={1}>
                  {row.detail}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </ActionListSheet>
    </>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    strip: {
      minHeight: QUEST_ROUTE_ROW_MIN_HEIGHT,
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 4,
    },
    localeRouteRow: {
      height: QUEST_ROUTE_ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    localeSlot: { flexShrink: 0 },
    stripWithLocale: {
      flex: 1,
      minWidth: 0,
      height: QUEST_ROUTE_ROW_MIN_HEIGHT,
      gap: 2,
      paddingVertical: 2,
    },
    compactMetrics: { flex: 1, minWidth: 0 },
    compactMetric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    compactMetricText: { fontSize: 13, lineHeight: 14, fontWeight: '700', color: colors.text },
    pressed: { opacity: 0.7 },
    stripTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stripText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    segments: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 10 },
    segment: { flex: 1, height: 6, borderRadius: 3 },
    // Необязательная точка — короче по высоте: роль видна формой, не только цветом.
    segmentOptional: { height: 3, borderRadius: 1.5 },
    sheetBody: { flexGrow: 0 },
    row: {
      minHeight: QUEST_ROUTE_ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    rowDetail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  })
