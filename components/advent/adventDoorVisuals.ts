import type Feather from '@expo/vector-icons/Feather'

import type { AdventDoorKind, AdventDoorState } from '@/types/advent'
import { translate as i18nT } from '@/i18n'

export type FeatherName = keyof typeof Feather.glyphMap

/** Иконка типа дверцы — для открытых плиток и шапки листа. */
export const KIND_ICONS: Record<AdventDoorKind, FeatherName> = {
  content: 'gift',
  'site-action': 'compass',
  riddle: 'help-circle',
  geo: 'map-pin',
  creative: 'camera',
  social: 'users',
  planning: 'calendar',
}

export const STATE_ICONS: Record<AdventDoorState, FeatherName> = {
  locked: 'lock',
  available: 'gift',
  opened: 'unlock',
  done: 'check-circle',
}

export const stateLabel = (state: AdventDoorState): string => {
  switch (state) {
    case 'locked':
      return i18nT('adventStatic:tile.locked', { value1: '' }).trim()
    case 'available':
      return i18nT('adventStatic:tile.available')
    case 'opened':
      return i18nT('adventStatic:tile.opened')
    default:
      return i18nT('adventStatic:tile.done')
  }
}
