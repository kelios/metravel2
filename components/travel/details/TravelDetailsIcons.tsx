import React, { Suspense } from 'react'
import { View } from 'react-native'

import { withLazy } from './TravelDetailsLazy'

const LazyMaterialIcons = withLazy(() =>
  import('@expo/vector-icons/MaterialIcons').then((m: any) => ({
    default: m.MaterialIcons || m.default || m,
  }))
)

export const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 22,
  color,
}) => (
  <Suspense fallback={<View style={{ width: size, height: size }} />}>
    <LazyMaterialIcons
      // @ts-ignore - MaterialIcons name prop
      name={name}
      size={size}
      color={color}
    />
  </Suspense>
)
