import { DeviceEventEmitter, Platform } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import { normalizeAvatarUrl } from '@/utils/mediaUrl'

export const SIDEBAR_WEATHER_RESERVE_HEIGHT = 188
export const ROUTE_FILE_EXTS = new Set(['gpx', 'kml'])
export const DIVIDER_BEFORE_KEYS = new Set(['recommendation', 'plus', 'map', 'popular'])
export const DIVIDER_SKIP_PREV = new Set(['description', 'recommendation'])

export function webOnly<T extends object>(props: T): T | {} {
  return Platform.OS === 'web' ? props : {}
}

export function resolveAvatar(profile: any, travel: any): string {
  const raw =
    profile?.avatar ??
    travel?.user?.avatar ??
    travel?.avatar ??
    travel?.userAvatar ??
    travel?.user_avatar ??
    travel?.authorAvatar ??
    travel?.author_avatar ??
    null
  return raw ? normalizeAvatarUrl(String(raw)) || '' : ''
}

export function pickRouteFile(files: any[]) {
  return (
    files.find((file) => {
      const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
        .toLowerCase()
        .replace(/^\./, '')
      return ROUTE_FILE_EXTS.has(ext)
    }) ?? null
  )
}

export function parseViews(travel: any): number | null {
  const raw = travel?.countUnicIpView
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function emitOpenSection(key: string) {
  if (Platform.OS === 'web') {
    window.dispatchEvent(new CustomEvent('open-section', { detail: { key } }))
  } else {
    DeviceEventEmitter.emit('open-section', key)
  }
}

export function shouldShowDivider(links: TravelSectionLink[], index: number) {
  if (index === 0) return false
  const cur = links[index].key
  const prev = links[index - 1]?.key
  if (!DIVIDER_BEFORE_KEYS.has(cur)) return false
  if (cur === 'map' || cur === 'popular') return true
  return !DIVIDER_SKIP_PREV.has(prev)
}
