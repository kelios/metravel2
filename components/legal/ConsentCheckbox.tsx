import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

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

/**
 * Квадратный чекбокс согласия. Используется для гейтинга действий
 * (старт квеста, заявка на поездку и т.п.) — кнопка действия блокируется,
 * пока чекбокс не отмечен.
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

  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      style={styles.row}
      hitSlop={6}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Feather name="check" size={14} color={colors.textOnPrimary} /> : null}
      </View>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
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
