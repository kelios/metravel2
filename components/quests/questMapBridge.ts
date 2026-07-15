import type { QuestMapApp } from '@/components/quests/questWizardHelpers'
import {
  parseWebViewJsonObject,
  toFiniteCoordinate,
  toFiniteNumber,
} from '@/utils/webViewBridge'

const QUEST_MAP_APPS: ReadonlySet<QuestMapApp> = new Set([
  'google',
  'apple',
  'yandex',
  'organic',
  'mapsme',
  'waze',
  'osm',
])

export type QuestMapBridgeMessage =
  | { type: 'quest-map-png'; ok: boolean; dataUrl: string | null }
  | {
      type: 'quest-map-nav'
      app: QuestMapApp
      lat: number
      lng: number
      title?: string
    }
  | {
      type: 'quest-map-status'
      expectedMarkers: number | null
      markerNodes: number | null
      visibleMarkers: number | null
      settled: boolean
    }

export interface QuestMapMarkerStatus {
  expectedMarkers: number
  markerNodes: number
  visibleMarkers: number
  settled: boolean
}

export const parseQuestMapBridgeMessage = (raw: unknown): QuestMapBridgeMessage | null => {
  const parsed = parseWebViewJsonObject(raw)
  if (!parsed || typeof parsed.type !== 'string') return null

  if (parsed.type === 'quest-map-png') {
    if (typeof parsed.ok !== 'boolean') return null
    if (parsed.dataUrl != null && typeof parsed.dataUrl !== 'string') return null
    return { type: 'quest-map-png', ok: parsed.ok, dataUrl: parsed.dataUrl ?? null }
  }

  if (parsed.type === 'quest-map-nav') {
    if (typeof parsed.app !== 'string' || !QUEST_MAP_APPS.has(parsed.app as QuestMapApp)) {
      return null
    }
    const coordinate = toFiniteCoordinate(parsed.lat, parsed.lng)
    if (!coordinate) return null
    return {
      type: 'quest-map-nav',
      app: parsed.app as QuestMapApp,
      lat: coordinate.latitude,
      lng: coordinate.longitude,
      ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    }
  }

  if (parsed.type === 'quest-map-status') {
    return {
      type: 'quest-map-status',
      expectedMarkers: toFiniteNumber(parsed.expectedMarkers),
      markerNodes: toFiniteNumber(parsed.markerNodes),
      visibleMarkers: toFiniteNumber(parsed.visibleMarkers),
      settled: parsed.settled === true,
    }
  }

  return null
}
