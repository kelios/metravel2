import React from 'react'
import type Feather from '@expo/vector-icons/Feather'
import * as Clipboard from 'expo-clipboard'

import PlacePopupCard from '@/components/MapPage/Map/PlacePopupCard'
import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildTelegramShareUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'
import { DESIGN_COLORS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'
import type { ImportedPoint } from '@/types/userPoints'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { getSiteBaseUrl } from '@/utils/seo'
import { showToast } from '@/utils/toast'

const DEFAULT_SITE_POINT_COLOR = DESIGN_COLORS.travelPoint

type DriveInfo =
  | { status: 'loading' }
  | { status: 'ok'; distanceKm: number; durationMin: number }
  | { status: 'error' }

type UserPointsMapPointMarkerWebProps = {
  mods: any
  point: ImportedPoint
  isActive: boolean
  colors: ReturnType<typeof useThemedColors>
  mapInstance: any
  isCompactPopup: boolean
  isNarrowPopup: boolean
  isTinyPopup: boolean
  centerOverride?: { lat: number; lng: number }
  driveInfo?: DriveInfo
  getMarkerIconCached: (color: any, opts?: { active?: boolean; emphasize?: boolean }) => any
  onPointPress?: (point: ImportedPoint) => void
  onEditPoint?: (point: ImportedPoint) => void
  onDeletePoint?: (point: ImportedPoint) => void
  requestDriveInfo: (args: { pointId: number; pointLat: number; pointLng: number }) => void
  onMarkerReady?: (args: { pointId: number; marker: any | null }) => void
}

type UserPointPopupAction = {
  key: string
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  onPress: () => void
  accessibilityLabel?: string
  tooltip?: string
}

const looksLikeFullAddress = (value: string): boolean => {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length >= 3
}

const firstMeaningfulSegment = (value: string): string => {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return value.trim()
  if (/^\d+[A-Za-zА-Яа-я]?$/.test(parts[0]) && parts[1]) return `${parts[0]}, ${parts[1]}`
  return parts[0]
}

const getPointTitle = (point: ImportedPoint): string => {
  const name = String(point.name ?? '').trim()
  if (name) return looksLikeFullAddress(name) ? firstMeaningfulSegment(name) : name
  const address = String(point.address ?? '').trim()
  if (address) return looksLikeFullAddress(address) ? firstMeaningfulSegment(address) : address
  return 'Точка'
}

const getPointSubtitle = (point: ImportedPoint, title: string): string => {
  const name = String(point.name ?? '').trim()
  const address = String(point.address ?? '').trim()
  const fullFromName = name && looksLikeFullAddress(name) && name !== title ? name : ''
  const source = fullFromName || address
  if (!source || source.toLowerCase() === title.toLowerCase()) return ''
  return source
}

const getPointPhotoUrl = (point: ImportedPoint): string | null => {
  const pointRecord = point as unknown as Record<string, unknown>
  const direct = typeof point.photo === 'string' ? point.photo.trim() : ''
  if (direct) return direct

  const legacy = pointRecord.photos
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim()
  if (!legacy || typeof legacy !== 'object') return null

  const knownKeys = ['url', 'src', 'photo', 'image', 'thumb', 'thumbnail', 'travelImageThumbUrl']
  for (const key of knownKeys) {
    const value = (legacy as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  for (const value of Object.values(legacy as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

const getCountryLabel = (point: ImportedPoint): string => {
  const direct = String((point as unknown as Record<string, unknown>).country ?? '').trim()
  if (direct) return direct
  const address = String(point.address ?? '').trim()
  if (!address) return ''
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 1] ?? '' : ''
}

const getCategoryLabel = (point: ImportedPoint, countryLabel: string): string => {
  const clean = (values: unknown[]) =>
    values
      .map((value) => String(value).trim())
      .filter(Boolean)
      .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0)
      .join(', ')

  const names = (point as unknown as Record<string, unknown>).categoryNames
  if (Array.isArray(names) && names.length > 0) return clean(names)

  const ids = point.categoryIds ?? point.category_ids
  if (Array.isArray(ids) && ids.length > 0) return clean(ids)

  const legacy = String(point.category ?? '').trim()
  if (!legacy) return ''
  if (countryLabel && legacy.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) === 0) return ''
  return legacy
}

const getRelatedUrls = (point: ImportedPoint) => {
  const tags = (point.tags ?? {}) as Record<string, unknown>
  const articleUrl = String(tags.articleUrl ?? '').trim()
  const travelUrl = String(tags.travelUrl ?? '').trim()
  return { articleUrl, travelUrl }
}

const openExternal = async (url: string, errorText = 'Не удалось открыть ссылку') => {
  if (!url) return
  const opened = await openExternalUrlInNewTab(url)
  if (!opened) void showToast({ type: 'info', text1: errorText, position: 'bottom' })
}

const openRelatedPage = async (url: string) => {
  if (!url) return
  const opened = await openExternalUrlInNewTab(url, {
    allowRelative: true,
    baseUrl: getSiteBaseUrl(),
  })
  if (!opened) void showToast({ type: 'info', text1: 'Не удалось открыть страницу', position: 'bottom' })
}

export const UserPointsMapPointMarkerWeb = React.memo(function UserPointsMapPointMarkerWeb(
  props: UserPointsMapPointMarkerWebProps
) {
  const {
    mods,
    point,
    isActive,
    colors,
    mapInstance,
    isCompactPopup,
    centerOverride,
    driveInfo,
    getMarkerIconCached,
    onPointPress,
    onEditPoint,
    onDeletePoint,
    requestDriveInfo,
    onMarkerReady,
  } = props

  const markerInstanceRef = React.useRef<any | null>(null)

  const hasCoords = Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  const lat = Number(point.latitude)
  const lng = Number(point.longitude)
  const coord = React.useMemo(
    () => (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : ''),
    [lat, lng]
  )

  const title = React.useMemo(() => getPointTitle(point), [point])
  const subtitle = React.useMemo(() => getPointSubtitle(point, title), [point, title])
  const countryLabel = React.useMemo(() => getCountryLabel(point), [point])
  const categoryLabel = React.useMemo(() => getCategoryLabel(point, countryLabel), [countryLabel, point])
  const imageUrl = React.useMemo(() => getPointPhotoUrl(point), [point])
  const { articleUrl, travelUrl } = React.useMemo(() => getRelatedUrls(point), [point])

  const pointId = React.useMemo(() => Number(point.id), [point.id])
  const markerPosition = React.useMemo(() => [lat, lng] as [number, number], [lat, lng])

  const handleClosePopup = React.useCallback(() => {
    try {
      markerInstanceRef.current?.closePopup?.()
    } catch {
      // noop
    }
    try {
      mapInstance?.closePopup?.()
    } catch {
      // noop
    }
  }, [mapInstance])

  const handleCopyCoords = React.useCallback(async () => {
    if (!coord) return
    try {
      await Clipboard.setStringAsync(coord)
      void showToast({ type: 'success', text1: 'Координаты скопированы', position: 'bottom' })
    } catch {
      void showToast({ type: 'error', text1: 'Не удалось скопировать координаты', position: 'bottom' })
    }
  }, [coord])

  const handleOpenArticle = React.useCallback(() => {
    void openRelatedPage(articleUrl || travelUrl)
  }, [articleUrl, travelUrl])

  const handleShareTelegram = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildTelegramShareUrl(coord), 'Не удалось поделиться')
  }, [coord])

  const handleOpenGoogleMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildGoogleMapsUrl(coord), 'Не удалось открыть Google Maps')
  }, [coord])

  const handleOpenAppleMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildAppleMapsUrl(coord), 'Не удалось открыть Apple Maps')
  }, [coord])

  const handleOpenOrganicMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildOrganicMapsUrl(coord, title), 'Не удалось открыть Organic Maps')
  }, [coord, title])

  const handleOpenWaze = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildWazeUrl(coord), 'Не удалось открыть Waze')
  }, [coord])

  const handleOpenYandexMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildYandexMapsUrl(coord), 'Не удалось открыть Яндекс Карты')
  }, [coord])

  const handleOpenYandexNavi = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildYandexNaviUrl(coord), 'Не удалось открыть Яндекс Навигатор')
  }, [coord])

  const handleOpenOpenStreetMap = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildOpenStreetMapUrl(coord), 'Не удалось открыть OpenStreetMap')
  }, [coord])

  const handleMarkerClick = React.useCallback(() => {
    try {
      const map = mapInstance
      if (map && typeof map.getZoom === 'function' && typeof map.setView === 'function') {
        const currentZoom = map.getZoom()
        const nextZoom = Math.max(14, Number.isFinite(currentZoom) ? currentZoom : 14)
        map.setView([lat, lng], nextZoom, { animate: true } as any)
      }
    } catch {
      // noop
    }

    try {
      markerInstanceRef.current?.openPopup?.()
    } catch {
      // noop
    }

    try {
      const userLat = Number(centerOverride?.lat)
      const userLng = Number(centerOverride?.lng)
      if (!Number.isFinite(pointId)) return
      if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return
      if (driveInfo?.status === 'ok' || driveInfo?.status === 'loading') return
      requestDriveInfo({ pointId, pointLat: lat, pointLng: lng })
    } catch {
      // noop
    }

    onPointPress?.(point)
  }, [centerOverride?.lat, centerOverride?.lng, driveInfo?.status, lat, lng, mapInstance, onPointPress, point, pointId, requestDriveInfo])

  const handleEditPoint = React.useCallback(() => {
    handleClosePopup()
    onEditPoint?.(point)
  }, [handleClosePopup, onEditPoint, point])

  const handleDeletePoint = React.useCallback(() => {
    handleClosePopup()
    onDeletePoint?.(point)
  }, [handleClosePopup, onDeletePoint, point])

  const isSitePoint = React.useMemo(() => Boolean(articleUrl || travelUrl), [articleUrl, travelUrl])
  const markerIcon = React.useMemo(() => {
    const fallback = colors.backgroundTertiary
    const baseColor = String(point.color ?? '').trim()
    const fill = isSitePoint ? baseColor || DEFAULT_SITE_POINT_COLOR : baseColor
    return getMarkerIconCached(String(fill || '').trim() || fallback, { active: isActive, emphasize: isSitePoint })
  }, [colors.backgroundTertiary, getMarkerIconCached, isActive, isSitePoint, point.color])

  const markerEventHandlers = React.useMemo(() => ({ click: handleMarkerClick } as any), [handleMarkerClick])
  const markerRefCb = React.useCallback(
    (marker: any | null) => {
      if (!Number.isFinite(pointId)) return
      markerInstanceRef.current = marker
      onMarkerReady?.({ pointId, marker })
    },
    [onMarkerReady, pointId]
  )

  const extraActions = React.useMemo<UserPointPopupAction[]>(() => {
    const actions: UserPointPopupAction[] = []
    if (onEditPoint) {
      actions.push({
        key: 'edit',
        label: 'Изменить',
        icon: 'edit-2',
        onPress: handleEditPoint,
        accessibilityLabel: 'Редактировать',
        tooltip: 'Редактировать',
      })
    }
    if (onDeletePoint) {
      actions.push({
        key: 'delete',
        label: 'Удалить',
        icon: 'trash-2',
        onPress: handleDeletePoint,
        accessibilityLabel: 'Удалить',
        tooltip: 'Удалить',
      })
    }
    actions.push({
      key: 'close',
      label: 'Закрыть',
      icon: 'x',
      onPress: handleClosePopup,
      accessibilityLabel: 'Закрыть попап',
      tooltip: 'Закрыть',
    })
    return actions
  }, [handleClosePopup, handleDeletePoint, handleEditPoint, onDeletePoint, onEditPoint])

  const drivingDistanceMeters = driveInfo?.status === 'ok' ? driveInfo.distanceKm * 1000 : null
  const drivingDurationSeconds = driveInfo?.status === 'ok' ? driveInfo.durationMin * 60 : null

  if (!hasCoords) return null

  return (
    <mods.Marker ref={markerRefCb as any} position={markerPosition} icon={markerIcon} eventHandlers={markerEventHandlers}>
      <mods.Popup
        className="metravel-user-point-popup metravel-place-popup"
        closeButton={false}
        autoPan
        autoPanPadding={isCompactPopup ? ([16, 92] as any) : ([28, 120] as any)}
      >
        <PlacePopupCard
          colors={colors}
          title={title}
          subtitle={subtitle}
          imageUrl={imageUrl}
          articleHref={articleUrl || travelUrl || null}
          relatedTravelUrl={travelUrl || null}
          categoryLabel={categoryLabel || null}
          coord={coord}
          drivingDistanceMeters={drivingDistanceMeters}
          drivingDurationSeconds={drivingDurationSeconds}
          isDrivingLoading={driveInfo?.status === 'loading'}
          onOpenArticle={articleUrl || travelUrl ? handleOpenArticle : undefined}
          onCopyCoord={handleCopyCoords}
          onShareTelegram={handleShareTelegram}
          onOpenGoogleMaps={handleOpenGoogleMaps}
          onOpenAppleMaps={handleOpenAppleMaps}
          onOpenOrganicMaps={handleOpenOrganicMaps}
          onOpenWaze={handleOpenWaze}
          onOpenYandexMaps={handleOpenYandexMaps}
          onOpenYandexNavi={handleOpenYandexNavi}
          onOpenOpenStreetMap={handleOpenOpenStreetMap}
          extraActions={extraActions}
          suppressFallbackPrimaryAction
          compactLayout={isCompactPopup}
          fullscreenOnMobile={isCompactPopup && Boolean(imageUrl)}
          popupSplit={!isCompactPopup && Boolean(imageUrl)}
          fullscreenTopInset={LAYOUT.headerHeight}
          fullscreenBottomInset={LAYOUT.tabBarHeight}
          onClose={handleClosePopup}
        />
      </mods.Popup>
    </mods.Marker>
  )
})
