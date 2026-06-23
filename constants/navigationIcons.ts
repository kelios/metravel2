import type { ComponentProps } from 'react'
import type Feather from '@expo/vector-icons/Feather'

export type FeatherIconName = ComponentProps<typeof Feather>['name']
export type CustomNavigationIconName = 'belarus-outline' | 'quest-route'
export type NavigationIconName = FeatherIconName | CustomNavigationIconName
