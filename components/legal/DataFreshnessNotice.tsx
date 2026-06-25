import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useThemedColors } from '@/hooks/useTheme'

type Colors = ReturnType<typeof useThemedColors>

interface DataFreshnessNoticeProps {
  /** Переопределить текст (по умолчанию — про актуальность данных мест/маршрутов). */
  text?: string
  style?: object
  testID?: string
}

const DEFAULT_TEXT =
  'Информация может быть неактуальной: режим работы, цены и доступность мест меняются. Проверяйте данные перед поездкой.'

/**
 * Информационное предупреждение об актуальности данных.
 * Используется на страницах мест / маршрутов / путешествий.
 */
export default function DataFreshnessNotice({ text, style, testID }: DataFreshnessNoticeProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View
      style={[styles.container, style]}
      testID={testID ?? 'data-freshness-notice'}
      accessibilityRole="alert"
    >
      <Feather name="info" size={16} color={colors.warning} style={styles.icon} />
      <Text style={styles.text}>{text ?? DEFAULT_TEXT}</Text>
    </View>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surfaceMuted,
    },
    icon: {
      marginTop: 1,
    },
    text: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  })
