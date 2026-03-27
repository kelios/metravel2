import React from 'react'
import { Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_COLORS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { ImportedPoint } from '@/types/userPoints'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
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
    isNarrowPopup,
    isTinyPopup,
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

  const hasCoords = Number.isFinite((point as any)?.latitude) && Number.isFinite((point as any)?.longitude)
  const lat = Number((point as any)?.latitude)
  const lng = Number((point as any)?.longitude)

  const coordsText = React.useMemo(() => {
    return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : ''
  }, [lat, lng])

  const countryLabel = React.useMemo(() => {
    try {
      const direct = String((point as any)?.country ?? '').trim()
      if (direct) return direct
      const address = String((point as any)?.address ?? '').trim()
      if (!address) return ''
      const parts = address
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length >= 2) return parts[parts.length - 1]
      return ''
    } catch {
      return ''
    }
  }, [point])

  const categoryLabel = React.useMemo(() => {
    const names = (point as any)?.categoryNames
    if (Array.isArray(names) && names.length > 0) {
      const cleaned = names
        .map((v: any) => String(v).trim())
        .filter(Boolean)
        .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0)
      return cleaned.join(', ')
    }
    const ids = (point as any)?.categoryIds
    if (Array.isArray(ids) && ids.length > 0) {
      const cleaned = ids
        .map((v: any) => String(v).trim())
        .filter(Boolean)
        .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0)
      return cleaned.join(', ')
    }
    const legacy = String((point as any)?.category ?? '').trim()
    if (!legacy) return ''
    if (countryLabel && legacy.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) === 0) {
      return ''
    }
    return legacy
  }, [countryLabel, point])

  const handleCopyCoords = React.useCallback(() => {
    if (!coordsText) return
    try {
      ;(navigator as any)?.clipboard?.writeText?.(coordsText)
      void showToast({ type: 'success', text1: 'Скопировано', position: 'bottom' })
    } catch {
      // noop
    }
  }, [coordsText])

  const handleShareTelegram = React.useCallback(() => {
    if (!coordsText) return
    try {
      const text = String((point as any)?.name ?? '') || coordsText
      const url = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`
      const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
      void openExternalUrlInNewTab(tg)
      void showToast({ type: 'success', text1: 'Открываю Telegram', position: 'bottom' })
    } catch {
      // noop
    }
  }, [coordsText, point])

  const openExternalMap = React.useCallback((url: string) => {
    void openExternalUrlInNewTab(url)
    void showToast({ type: 'success', text1: 'Открываю карту', position: 'bottom' })
  }, [])

  const colorLabel = React.useMemo(() => String((point as any)?.color ?? '').trim(), [point])
  const markerAccentColor = React.useMemo(
    () => String((point as any)?.color ?? '').trim() || colors.backgroundTertiary,
    [colors.backgroundTertiary, point]
  )
  const badgeLabel = hasCoords && categoryLabel ? categoryLabel : colorLabel

  const photoUrl = React.useMemo(() => {
    const v = (point as any)?.photo
    if (typeof v === 'string' && v.trim()) return v.trim()

    const legacy = (point as any)?.photos
    if (typeof legacy === 'string' && legacy.trim()) return legacy.trim()
    if (legacy && typeof legacy === 'object') {
      const knownKeys = ['url', 'src', 'photo', 'image', 'thumb', 'thumbnail', 'travelImageThumbUrl']
      for (const k of knownKeys) {
        const val = (legacy as any)?.[k]
        if (typeof val === 'string' && val.trim()) return val.trim()
      }
      for (const val of Object.values(legacy as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim()) return val.trim()
      }
    }

    return ''
  }, [point])

  const mapLinks = React.useMemo(
    () =>
      [
        { key: 'Google', url: `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}` },
        { key: 'Apple', url: `https://maps.apple.com/?q=${encodeURIComponent(`${lat},${lng}`)}` },
        { key: 'Яндекс', url: `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lng},${lat}`)}&z=16&l=map` },
        {
          key: 'OSM',
          url: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(
            String(lng)
          )}#map=16/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`,
        },
      ] as const,
    [lat, lng]
  )

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
      const pointId = Number((point as any)?.id)
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
  }, [centerOverride?.lat, centerOverride?.lng, driveInfo?.status, lat, lng, mapInstance, onPointPress, point, requestDriveInfo])

  const markerPosition = React.useMemo(() => [lat, lng] as [number, number], [lat, lng])

  const isSitePoint = React.useMemo(() => {
    const tags = (point as any)?.tags
    return Boolean(String(tags?.travelUrl ?? '').trim() || String(tags?.articleUrl ?? '').trim())
  }, [point])

  const markerIcon = React.useMemo(() => {
    const fallback = colors.backgroundTertiary
    const baseColor = String((point as any)?.color ?? '').trim()
    const fill = isSitePoint ? baseColor || DEFAULT_SITE_POINT_COLOR : baseColor
    return getMarkerIconCached(String(fill || '').trim() || fallback, { active: isActive, emphasize: isSitePoint })
  }, [colors.backgroundTertiary, getMarkerIconCached, isActive, isSitePoint, point])

  const markerEventHandlers = React.useMemo(() => ({ click: handleMarkerClick } as any), [handleMarkerClick])

  const pointId = React.useMemo(() => Number((point as any)?.id), [point])
  const markerRefCb = React.useCallback(
    (marker: any | null) => {
      if (!Number.isFinite(pointId)) return
      markerInstanceRef.current = marker
      onMarkerReady?.({ pointId, marker })
    },
    [onMarkerReady, pointId]
  )

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

  const handleEditPoint = React.useCallback(() => {
    handleClosePopup()
    onEditPoint?.(point)
  }, [handleClosePopup, onEditPoint, point])

  const handleDeletePoint = React.useCallback(() => {
    handleClosePopup()
    onDeletePoint?.(point)
  }, [handleClosePopup, onDeletePoint, point])

  return (
    <mods.Marker ref={markerRefCb as any} position={markerPosition} icon={markerIcon} eventHandlers={markerEventHandlers}>
      <mods.Popup className="metravel-user-point-popup" closeButton={false} autoPan autoPanPadding={isCompactPopup ? ([16, 92] as any) : ([28, 120] as any)}>
        <div
          style={{
            width: isTinyPopup ? 276 : isNarrowPopup ? 292 : isCompactPopup ? 300 : 340,
            maxWidth: isCompactPopup ? '88vw' : '74vw',
            maxHeight: isCompactPopup ? '58vh' : '52vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isTinyPopup ? '10px 10px 8px' : isNarrowPopup ? '11px 11px 9px' : '12px 12px 10px',
            boxSizing: 'border-box',
            borderLeft: `5px solid ${markerAccentColor}`,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: isCompactPopup ? 'column' : 'row',
              alignItems: isCompactPopup ? 'stretch' : 'flex-start',
              justifyContent: 'space-between',
              gap: isCompactPopup ? 8 : 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: isCompactPopup ? 16 : 18,
                  fontWeight: 700,
                  lineHeight: isTinyPopup ? '20px' : isCompactPopup ? '22px' : '24px',
                  color: colors.text,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {(point as any)?.name}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isTinyPopup ? 6 : 8, marginTop: isTinyPopup ? 8 : 10 }}>
                {badgeLabel ? (
                  <div
                    style={{
                      background: colors.backgroundSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 999,
                      padding: isTinyPopup ? '5px 8px' : isCompactPopup ? '6px 10px' : '8px 12px',
                      fontSize: isTinyPopup ? 12 : isCompactPopup ? 13 : 14,
                      lineHeight: isTinyPopup ? '13px' : isCompactPopup ? '14px' : '16px',
                      color: colors.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {badgeLabel}
                  </div>
                ) : null}
                {!isSitePoint && countryLabel ? (
                  <div
                    style={{
                      background: colors.backgroundSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 999,
                      padding: isTinyPopup ? '5px 8px' : isCompactPopup ? '6px 10px' : '8px 12px',
                      fontSize: isTinyPopup ? 12 : isCompactPopup ? 13 : 14,
                      lineHeight: isTinyPopup ? '13px' : isCompactPopup ? '14px' : '16px',
                      color: colors.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {countryLabel}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isTinyPopup ? 6 : 8,
                flexShrink: 0,
                minWidth: 0,
                flexWrap: 'wrap',
                justifyContent: isCompactPopup ? 'flex-start' : 'flex-end',
              }}
            >
              {typeof onEditPoint === 'function' ? (
                <CardActionPressable
                  accessibilityLabel="Редактировать"
                  title="Редактировать"
                  onPress={handleEditPoint}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    borderRadius: 14,
                    width: isTinyPopup ? 38 : 40,
                    height: isTinyPopup ? 38 : 40,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
                  }}
                >
                  <Feather name="edit-2" size={isTinyPopup ? 16 : 17} color={colors.text} />
                </CardActionPressable>
              ) : null}

              {typeof onDeletePoint === 'function' ? (
                <CardActionPressable
                  accessibilityLabel="Удалить"
                  title="Удалить"
                  onPress={handleDeletePoint}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    borderRadius: 14,
                    width: isTinyPopup ? 38 : 40,
                    height: isTinyPopup ? 38 : 40,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
                  }}
                >
                  <Feather name="trash-2" size={isTinyPopup ? 16 : 17} color={colors.text} />
                </CardActionPressable>
              ) : null}

              <CardActionPressable
                accessibilityLabel="Закрыть попап"
                title="Закрыть"
                onPress={handleClosePopup}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderRadius: 14,
                  width: isTinyPopup ? 38 : 40,
                  height: isTinyPopup ? 38 : 40,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
                }}
              >
                <Feather name="x" size={isTinyPopup ? 16 : 17} color={colors.text} />
              </CardActionPressable>
            </div>
          </div>

          {photoUrl ? (
            <div
              style={{
                marginTop: 12,
                borderRadius: 12,
                overflow: 'hidden',
                border: `1px solid ${colors.border}`,
                background: colors.backgroundSecondary,
              }}
            >
              <ImageCardMedia
                src={photoUrl}
                alt="Фото точки"
                height={isTinyPopup ? 108 : isNarrowPopup ? 120 : 140}
                width="100%"
                borderRadius={12}
                fit="contain"
                blurBackground
                allowCriticalWebBlur
                blurRadius={16}
              />
            </div>
          ) : null}

          {(point as any)?.description ? (
            <div
              style={{
                marginTop: 10,
                color: colors.text,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontSize: isTinyPopup ? 13 : 14,
                lineHeight: isTinyPopup ? '18px' : '20px',
              }}
            >
              {(point as any)?.description}
            </div>
          ) : null}

          {(point as any)?.address ? (
            <div style={{ marginTop: 10, color: colors.textMuted, overflowWrap: 'anywhere' }}>
              <span style={{ fontSize: isTinyPopup ? 11 : 12, lineHeight: isTinyPopup ? '15px' : '16px' }}>{(point as any)?.address}</span>
            </div>
          ) : null}

          {(Boolean((point as any)?.address) || Boolean(coordsText)) ? (
            <div
              style={{
                height: 1,
                background: colors.border,
                opacity: 0.8,
                marginTop: 12,
                marginBottom: 12,
              }}
            />
          ) : null}

          {coordsText ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: isCompactPopup ? 'column' : 'row',
                  alignItems: isCompactPopup ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    background: colors.backgroundSecondary,
                    borderRadius: 12,
                    padding: isTinyPopup ? '9px 10px' : isCompactPopup ? '10px 12px' : '12px 14px',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: isTinyPopup ? 12 : isCompactPopup ? 13 : 15,
                      color: colors.textSecondary,
                      lineHeight: 1.2,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontWeight: 600,
                    }}
                  >
                    {coordsText}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isTinyPopup ? 5 : 6,
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    justifyContent: isCompactPopup ? 'flex-end' : 'flex-start',
                  }}
                >
                  <CardActionPressable
                    accessibilityLabel="Копировать координаты"
                    title="Копировать координаты"
                    onPress={handleCopyCoords}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderRadius: 14,
                      width: isTinyPopup ? 38 : 40,
                      height: isTinyPopup ? 38 : 40,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
                    }}
                  >
                    <Feather name="copy" size={isTinyPopup ? 16 : 17} color={colors.text} />
                  </CardActionPressable>

                  <CardActionPressable
                    accessibilityLabel="Поделиться в Telegram"
                    title="Поделиться в Telegram"
                    onPress={handleShareTelegram}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderRadius: 14,
                      width: isTinyPopup ? 38 : 40,
                      height: isTinyPopup ? 38 : 40,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
                    }}
                  >
                    <Feather name="send" size={isTinyPopup ? 16 : 17} color={colors.text} />
                  </CardActionPressable>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isTinyPopup ? 5 : 6, flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%' }}>
                  {mapLinks.map((p) => (
                    <CardActionPressable
                      key={p.key}
                      accessibilityLabel={p.key}
                      title={p.key}
                      onPress={() => openExternalMap(p.url)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.backgroundSecondary,
                        color: colors.text,
                        borderRadius: 999,
                        paddingVertical: isTinyPopup ? 4 : isCompactPopup ? 5 : 6,
                        paddingHorizontal: isTinyPopup ? 7 : isCompactPopup ? 9 : 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
                        minWidth: isTinyPopup ? 46 : isCompactPopup ? 50 : 52,
                      }}
                    >
                      <span
                        style={{
                          fontSize: isTinyPopup ? 10 : isCompactPopup ? 11 : 12,
                          lineHeight: isTinyPopup ? '12px' : isCompactPopup ? '13px' : '14px',
                          color: colors.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        {p.key}
                      </span>
                    </CardActionPressable>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {Number.isFinite((driveInfo as any)?.distanceKm) ? (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 1,
                  background: colors.border,
                  opacity: 0.8,
                  marginBottom: 10,
                }}
              />
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                На машине: {(driveInfo as any).distanceKm} км · ~{(driveInfo as any).durationMin} мин
              </div>
            </div>
          ) : driveInfo?.status === 'loading' ? (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 1,
                  background: colors.border,
                  opacity: 0.8,
                  marginBottom: 10,
                }}
              />
              <div style={{ fontSize: 12, color: colors.textMuted }}>Считаю маршрут…</div>
            </div>
          ) : null}
        </div>
      </mods.Popup>
    </mods.Marker>
  )
})
