import React from 'react'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'

import { PRESSED_OPACITY } from './constants'

const ActionIconButton = React.memo(function ActionIconButton({
  name,
  size,
  color,
  onPress,
  style,
  accessibilityLabel,
}: {
  name: keyof typeof Feather.glyphMap
  size: number
  color: string
  onPress?: () => void
  style?: any
  accessibilityLabel: string
}) {
  return (
    <CardActionPressable
      onPress={onPress}
      style={({ pressed }) => [style, pressed && PRESSED_OPACITY]}
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={name} size={size} color={color} />
    </CardActionPressable>
  )
})

export default ActionIconButton
