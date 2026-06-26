import type { ComponentProps } from 'react'
import type Feather from '@expo/vector-icons/Feather'

export type FeatherIconName = ComponentProps<typeof Feather>['name']
export type CustomNavigationIconName =
  | 'belarus-outline'
  | 'route-walk'
  | 'map-fold'
  | 'quest-map-person'
  | 'quest-route'
  | 'coin-flip'
export type NavigationIconName = FeatherIconName | CustomNavigationIconName
