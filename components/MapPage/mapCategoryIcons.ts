import React from 'react'
import Feather from '@expo/vector-icons/Feather'

export type FeatherIconName = React.ComponentProps<typeof Feather>['name']

export const CATEGORY_ICONS: Record<string, FeatherIconName> = {
  Горы: 'triangle',
  Пляжи: 'sun',
  Города: 'map-pin',
  Природа: 'feather',
  Музеи: 'home',
  Озера: 'droplet',
  Культура: 'music',
  Спорт: 'activity',
  Еда: 'coffee',
  Архитектура: 'layers',
}
