import React, { Suspense } from 'react'
import { View } from 'react-native'

import { withLazy } from './TravelDetailsLazy'

const LazyFeather = withLazy(() =>
  import('@expo/vector-icons/Feather').then((m: any) => ({
    default: m.Feather || m.default || m,
  }))
)

const mapIconName = (name: string): string => {
  // Keep existing MaterialIcons-ish names in the app code, but render Feather to avoid loading MaterialIcons.ttf.
  switch (name) {
    // Section links (sectionLinks.ts)
    case 'photo-library':
      return 'image'
    case 'ondemand-video':
      return 'video'
    case 'description':
      return 'file-text'
    case 'recommend':
      return 'thumbs-up'
    case 'add':
      return 'plus'
    case 'remove':
      return 'minus'
    case 'explore':
      return 'compass'
    case 'map':
      return 'map'
    case 'list':
      return 'list'
    case 'location-on':
      return 'map-pin'
    case 'star':
      return 'star'
    // Other icons
    case 'expand-more':
      return 'chevron-down'
    case 'expand-less':
      return 'chevron-up'
    case 'menu-book':
      return 'book-open'
    case 'play-circle-fill':
      return 'play-circle'
    case 'tips-and-updates':
      return 'info'
    case 'thumb-up-alt':
      return 'thumbs-up'
    case 'thumb-down-alt':
      return 'thumbs-down'
    case 'lightbulb':
    case 'lightbulb-outline':
      return 'zap'
    case 'check-circle':
      return 'check-circle'
    case 'circle':
      return 'circle'
    case 'arrow-upward':
      return 'arrow-up'
    default:
      return name
  }
}

export const Icon: React.FC<
  { name: string; size?: number; color?: string } & Record<string, any>
> = ({
  name,
  size = 22,
  color,
  ...rest
}) => (
  <Suspense fallback={<View style={{ width: size, height: size }} />}>
    <LazyFeather
      // @ts-ignore - Feather name prop
      name={mapIconName(name)}
      size={size}
      color={color}
      {...(rest as any)}
    />
  </Suspense>
)
