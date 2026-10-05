import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import BottomSheet from '@/components/ui/BottomSheet'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

// Анимация fade закрытия ~300 мс; если `onDismiss` не пришёл — действие всё равно выполнится.
const IOS_DISMISS_FALLBACK_MS = 450

export type ActionListSheetItem = {
  key: string
  label: string
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
  accessibilityLabel?: string
  /** Optional tooltip / long label (web title attr); falls back to label. */
  title?: string
  /** Optional icon-bubble tint (e.g. per-navigator brand color). */
  iconColor?: string
  iconBubbleColor?: string
  /**
   * Разрушительное действие (удалить): красные иконка и подпись, над пунктом —
   * разделитель. Ставится последним; подтверждение — через `ConfirmDialog` (#2101).
   */
  destructive?: boolean
  testID?: string
}

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  actions?: ActionListSheetItem[]
  /** Произвольное тело листа над списком действий (InfoSheet: абзацы пояснения). */
  children?: React.ReactNode
}

/**
 * Shared mobile action-sheet: a vertical list of full-width rows (round icon
 * bubble + label) inside the app's single bottom sheet. Extracted from
 * `PlaceListCard`'s `OverflowActionSheet` so the same pattern is reused by the map
 * marker popup (nav «Навигация и действия») and the places list overflow menu —
 * one mechanism, no duplication. RN-Web + native compatible.
 *
 * Окно, шапка, свайп вниз, граница касаний и нижний отступ — контракт
 * `BottomSheet` (#2159, #2230, #2231, #2153); здесь только список действий.
 */
const ActionListSheet: React.FC<Props> = ({
  visible,
  onClose,
  title,
  actions = [],
  children,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // #2115: пункт часто открывает следующий Modal (`ConfirmDialog` удаления). На iOS
  // UIKit не покажет его, пока этот лист ещё закрывается (Fabric
  // `RCTModalHostViewComponentView` не ждёт dismiss), поэтому действие ждёт
  // `onDismiss` листа; страховка — таймер. Ровно один вызов. Web/Android — сразу.
  const pendingActionRef = useRef<(() => void) | null>(null)
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushPendingAction = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    pendingTimerRef.current = null
    const run = pendingActionRef.current
    pendingActionRef.current = null
    run?.()
  }, [])
  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
  }, [])
  const runAfterClose = useCallback(
    (run: () => void) => {
      onClose()
      if (Platform.OS !== 'ios') {
        run()
        return
      }
      pendingActionRef.current = run
      pendingTimerRef.current = setTimeout(flushPendingAction, IOS_DISMISS_FALLBACK_MS)
    },
    [flushPendingAction, onClose],
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} onDismiss={flushPendingAction}>
      {children}
      <View style={styles.list}>
        {actions.map((action, index) => (
          <React.Fragment key={action.key}>
          {action.destructive && index > 0 && !actions[index - 1].destructive ? (
            <View style={styles.separator} testID="action-sheet-separator" />
          ) : null}
          <CardActionPressable
            testID={action.testID}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
            onPress={() => runAfterClose(action.onPress)}
            title={action.title ?? action.label}
            enableWebClickFallback
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View
              style={[
                styles.iconBubble,
                action.iconBubbleColor
                  ? { backgroundColor: action.iconBubbleColor, borderColor: action.iconBubbleColor }
                  : null,
              ]}
            >
              <Feather
                name={action.icon}
                size={18}
                color={action.destructive ? colors.danger : (action.iconColor ?? colors.textMuted)}
              />
            </View>
            {/* Visible row text = the short brand `label` (e.g. «Google Maps»,
                «Waze», «Яндекс Карты»). The sheet title + per-row icon already
                convey the verb, so the verbose `title` (e.g. «Открыть точку в
                Google Maps») is kept ONLY for the web tooltip + a11y label, not
                repeated as the visible label — easier to scan. */}
            <Text style={[styles.itemText, action.destructive && { color: colors.danger }]} numberOfLines={2}>
              {action.label}
            </Text>
          </CardActionPressable>
          </React.Fragment>
        ))}
      </View>
    </BottomSheet>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    list: {
      gap: 4,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 4,
      backgroundColor: colors.borderLight,
    },
    item: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 12,
      ...Platform.select({
        web: { transition: 'background-color 0.16s ease, transform 0.16s ease' as any },
      }),
    },
    itemPressed: {
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({ web: { transform: 'scale(0.99)' as any } }),
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    itemText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.text,
    },
  })

export default React.memo(ActionListSheet)
