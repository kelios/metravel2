import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


const IS_WEB = Platform.OS === 'web'
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
  /**
   * Extra bottom margin so the panel clears a global dock / tab bar (web only;
   * native uses safe-area + Modal so the panel already sits above system chrome).
   */
  bottomOffset?: number
}

/**
 * Shared mobile action-sheet: a bottom Modal with a grabber, a bold title and a
 * vertical list of full-width rows (round icon bubble + label). Extracted from
 * `PlaceListCard`'s `OverflowActionSheet` so the same pattern is reused by the map
 * marker popup (nav «Навигация и действия») and the places list overflow menu —
 * one mechanism, no duplication. RN-Web + native compatible.
 */
const ActionListSheet: React.FC<Props> = ({
  visible,
  onClose,
  title,
  actions = [],
  children,
  bottomOffset,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors, bottomOffset), [colors, bottomOffset])

  // Swipe-down-to-close on the header (grabber + title row). Native uses a
  // PanResponder; the visible ✕ covers web + a11y. onClose is read from a ref so
  // the responder identity stays stable across renders.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

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
  const swipeHandlers = useMemo(() => {
    if (IS_WEB) return null
    return PanResponder.create({
      // #2159: шапка берёт касание на старте. Иначе ответчиком на старте
      // становится предок листа вне Modal, и `onMoveShouldSet*` шапке уже не
      // задаётся — свайп не доходил ни на iOS, ни на Android. ✕ глубже и
      // выигрывает своё касание сам; отдавать жест на полпути нечему.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, g) => {
        if (g.dy > 56) onCloseRef.current()
      },
      onPanResponderTerminate: (_evt, g) => {
        if (g.dy > 56) onCloseRef.current()
      },
    }).panHandlers
  }, [])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={flushPendingAction}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel={i18nT('shared:components.ui.ActionListSheet.zakryt_menyu_deystviy_85947952')}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={styles.panel}>
          <View style={styles.header} {...(swipeHandlers ?? {})}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <CardActionPressable
                accessibilityRole="button"
                accessibilityLabel={i18nT('shared:components.ui.ActionListSheet.zakryt_e47a2993')}
                title={i18nT('shared:components.ui.ActionListSheet.zakryt_e47a2993')}
                onPress={onClose}
                enableWebClickFallback
                style={({ pressed }) => [styles.closeBtn, pressed && styles.itemPressed]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </CardActionPressable>
            </View>
          </View>
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
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ThemedColors, bottomOffset?: number) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 23, 42, 0.28)',
    },
    panel: {
      marginBottom: bottomOffset ?? (IS_WEB ? 58 : 0),
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      maxHeight: '72%',
      ...Platform.select({
        web: { boxShadow: '0 -12px 34px rgba(15,23,42,0.16)' as any },
      }),
    },
    header: {
      paddingBottom: 4,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.borderLight,
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    title: {
      flex: 1,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      color: colors.text,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
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
