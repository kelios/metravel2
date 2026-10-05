import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

// Верх — всегда: у экрана вне оболочки шапки другого владельца верхнего отступа нет.
const STANDALONE_SCREEN_EDGES: readonly Edge[] = ['top', 'left', 'right', 'bottom']

type Props = {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Контейнер экрана вне оболочки шапки (#2272, MOBILE-INSETS-001).
 *
 * Экраны в `app/` вне группы `(tabs)` лежат под корневым `Stack` с
 * `headerShown: false`: шапка `CustomHeader`, которая несёт верхний инсет
 * (#2234), на них не подключается. Такой экран либо монтирует `CustomHeader` сам
 * (`contact`, `app`), либо целиком лежит в этом контейнере — содержимое начинается
 * ниже статус-бара и выреза. Набор краёв не настраивается: шаблон
 * `edges={['left', 'right', 'bottom']}` без `top` разошёлся копированием по трём
 * экранам, и «Назад»/заголовок оказались под статус-баром.
 *
 * Прямой `SafeAreaView` в таких экранах запрещён, а каждая ветка `return` обязана
 * содержать владельца верхнего отступа — `guard:screen-header`.
 */
export default function StandaloneScreen({ children, style, testID }: Props) {
  return (
    <SafeAreaView edges={STANDALONE_SCREEN_EDGES} style={[styles.root, style]} testID={testID}>
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
