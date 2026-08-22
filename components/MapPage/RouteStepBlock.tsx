// components/MapPage/RouteStepBlock.tsx
// Один шаг построения маршрута: номер, заголовок, правый слот (бейдж/подсказка/
// «Готово») и содержимое.
//
// #1491: разметка шага объявлена здесь один раз и рендерится и на /map, и в
// планировщике поездки. Визуальные токены остаются за поверхностью — их
// передают в `styles`, — а последовательность и структура шагов общие, иначе
// «те же самые шаги» на двух экранах держались бы только на договорённости.
import React from 'react'
import { Text, View } from 'react-native'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

export interface RouteStepBlockStyles {
  block: StyleProp<ViewStyle>
  header: StyleProp<ViewStyle>
  number: StyleProp<TextStyle>
  title: StyleProp<TextStyle>
}

interface RouteStepBlockProps {
  step: number
  title: string
  styles: RouteStepBlockStyles
  /** Правая часть заголовка: бейдж выбранного значения, подсказка или «Готово». */
  aside?: React.ReactNode
  children?: React.ReactNode
  testID?: string
}

const RouteStepBlock: React.FC<RouteStepBlockProps> = ({
  step,
  title,
  styles,
  aside,
  children,
  testID,
}) => (
  <View style={styles.block} testID={testID}>
    <View style={styles.header}>
      <Text style={styles.number}>{step}</Text>
      <Text style={styles.title}>{title}</Text>
      {aside}
    </View>
    {children}
  </View>
)

export default React.memo(RouteStepBlock)
