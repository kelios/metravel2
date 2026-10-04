import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet from '@/components/ui/ActionListSheet'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import type { QuestRouteModel, QuestRouteRow } from './questRouteModel'
import { QUEST_NAV_FINALE_TEST_ID, QuestStepMarker } from './questWizardNavigation'

/** Высота строки полосы и строки листа — минимальная цель касания (§11 макета). */
export const QUEST_ROUTE_ROW_MIN_HEIGHT = 44

type Props = {
  model: QuestRouteModel
  onGoToStep: (stepIndex: number) => void
  onShowFinale: () => void
}

/**
 * #2149: полоса маршрута на телефоне (< 600 px) вместо полосы прогресса и ряда
 * кружков. Одна кнопка: «Точка 12 из 14 · Задания 10/11» и шкала из сегментов,
 * по нажатию — лист «Маршрут» со всеми точками. Вид и подписи — `buildQuestRouteModel`.
 */
export default function QuestRouteStrip({ model, onGoToStep, onShowFinale }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [sheetOpen, setSheetOpen] = useState(false)
  const close = useCallback(() => setSheetOpen(false), [])
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

  return (
    <>
      <Pressable
        testID="quest-route-strip"
        accessibilityRole="button"
        accessibilityLabel={model.stripAccessibilityLabel}
        accessibilityHint={i18nT('quests:components.quests.questRoute.stripHint')}
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
      >
        <View style={styles.stripTextRow}>
          <Text style={styles.stripText} numberOfLines={1}>
            {model.stripText}
          </Text>
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

      <ActionListSheet visible={sheetOpen} onClose={close} title={i18nT('quests:components.quests.questRoute.title')}>
        <ScrollView style={styles.sheetBody} testID="quest-route-sheet">
          {model.rows.map((row) => (
            <Pressable
              key={row.key}
              testID={row.kind === 'finale' ? QUEST_NAV_FINALE_TEST_ID : `quest-route-row-${row.key}`}
              accessibilityRole="button"
              accessibilityLabel={row.accessibilityLabel}
              accessibilityState={{ disabled: row.disabled, selected: row.visual.state === 'current' }}
              disabled={row.disabled}
              onPress={() => openRow(row)}
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
