import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'

type Colors = ReturnType<typeof useThemedColors>

interface ConsentCheckboxProps {
  checked: boolean
  onToggle: (next: boolean) => void
  /** Текст согласия. Можно передать ReactNode со ссылками на юр-страницы. */
  children: React.ReactNode
  testID?: string
  accessibilityLabel?: string
}

/** Web: цель клика лежит внутри `<a>` (вложенный `<Link>` подписи). */
const isClickFromAnchor = (event: GestureResponderEvent | undefined): boolean => {
  const target = (event as { target?: { closest?: (selector: string) => unknown } } | undefined)
    ?.target
  return Boolean(target?.closest?.('a'))
}

/**
 * Квадратный чекбокс согласия с кликабельной подписью (#2093). Используется
 * для гейтинга действий (старт квеста, заявка на поездку и т.п.) — кнопка
 * действия блокируется, пока чекбокс не отмечен.
 *
 * Роль `checkbox` несёт только квадрат 44×44; подпись — соседний `<Text>` со
 * своим `onPress`, а не потомок чекбокса. Обернуть всю строку в `Pressable`
 * нельзя: на iOS доступный (`accessible`) `Pressable` — лист дерева
 * VoiceOver, и ссылки `<Link>` из подписи (правила, отказ от
 * ответственности) становятся недостижимы; на вебе `<a>` внутри
 * `role="checkbox"` — вложенный интерактив (детали checkbox презентационные).
 *
 * Тап по ссылке: на native вложенный `Text` ссылки со своим `onPress`
 * забирает responder раньше подписи. На вебе `<Link>` без `asChild` — это
 * `<a>` с `onClick` без `stopPropagation`, клик после перехода всплывает в
 * `onClick` подписи, поэтому клик с целью внутри `<a>` не переключает.
 */
export default function ConsentCheckbox({
  checked,
  onToggle,
  children,
  testID,
  accessibilityLabel,
}: ConsentCheckboxProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const handleLabelPress = (event: GestureResponderEvent) => {
    if (Platform.OS === 'web' && isClickFromAnchor(event)) return
    onToggle(!checked)
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onToggle(!checked)}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        aria-checked={checked}
        accessibilityLabel={accessibilityLabel}
        {...(Platform.OS === 'web'
          ? {
              // RNW activates Enter for role=checkbox, but Space only for role=button.
              // Space would scroll the page, so toggle here and cancel that default.
              onKeyDown: (event: { key: string; repeat?: boolean; preventDefault: () => void }) => {
                if (event.key !== ' ' || event.repeat) return
                event.preventDefault()
                onToggle(!checked)
              },
            }
          : null)}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Feather name="check" size={14} color={colors.textOnPrimary} /> : null}
        </View>
      </Pressable>
      <Text style={styles.label} onPress={handleLabelPress}>
        {children}
      </Text>
    </View>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 0,
    },
    control: {
      width: 44,
      height: 44,
      marginLeft: -11,
      marginRight: -1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 1,
    },
    controlPressed: {
      opacity: 0.72,
    },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      marginTop: 1,
    },
    boxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    label: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
  })
