import React, { useMemo } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

const IS_WEB = Platform.OS === 'web'

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
}

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  actions: ActionListSheetItem[]
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
  actions,
  bottomOffset,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors, bottomOffset), [colors, bottomOffset])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Закрыть меню действий"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={styles.panel}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.list}>
            {actions.map((action) => (
              <CardActionPressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                onPress={() => {
                  onClose()
                  action.onPress()
                }}
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
                    color={action.iconColor ?? colors.textMuted}
                  />
                </View>
                {/* Visible row text = the short brand `label` (e.g. «Google Maps»,
                    «Waze», «Яндекс Карты»). The sheet title + per-row icon already
                    convey the verb, so the verbose `title` (e.g. «Открыть точку в
                    Google Maps») is kept ONLY for the web tooltip + a11y label, not
                    repeated as the visible label — easier to scan. */}
                <Text style={styles.itemText} numberOfLines={2}>
                  {action.label}
                </Text>
              </CardActionPressable>
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
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.borderLight,
      marginBottom: 10,
    },
    title: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    list: {
      gap: 4,
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
