import React from 'react'
import Feather from '@expo/vector-icons/Feather'
import type { TextStyle } from 'react-native'

import { mapIconName } from '@/components/MapPage/mapIconName'

type MapIconProps = {
  name: string
  size: number
  color: string
  style?: TextStyle
}

function MapIcon({ name, size, color, style }: MapIconProps) {
  return <Feather name={mapIconName(name)} size={size} color={color} style={style} />
}

export default React.memo(MapIcon)
