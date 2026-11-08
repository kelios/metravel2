/**
 * Содержимое попапа личной точки на web-карте «Мои точки» (#3131).
 *
 * Раньше это был `UserPointsMapPointMarkerWeb`: маркер + попап + карточка на
 * каждую точку, смонтированные сразу для всей коллекции. Маркеры теперь живут в
 * `UserPointsClusterLayer.web.tsx`, а этот компонент монтируется порталом только
 * для открытой точки — один экземпляр `PlacePopupCard` на карту.
 */
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
import { useDockReservePx } from '@/components/layout/bottomChromeInset'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'
import type { ImportedPoint } from '@/types/userPoints'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { getSiteBaseUrl } from '@/utils/seo'
import { showToast } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'
import { useUserPointDetail } from './userPointDetailsStore'

import {
  getCategoryLabel,
  getCountryLabel,
  getPointPhotoUrl,
  getPointSubtitle,
  getPointTitle,
  getRelatedUrls,
} from './userPointPresentation'

type DriveInfo =
  | { status: 'loading' }
  | { status: 'ok'; distanceKm: number; durationMin: number }
  | { status: 'error' }

export type UserPointPopupContentProps = {
  point: ImportedPoint
  colors: ReturnType<typeof useThemedColors>
  isCompactPopup: boolean
  driveInfo?: DriveInfo
  onClose: () => void
  onEditPoint?: (point: ImportedPoint) => void
  onDeletePoint?: (point: ImportedPoint) => void
}

type UserPointPopupAction = {
  key: string
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  onPress: () => void
  accessibilityLabel?: string
  tooltip?: string
}

const openExternal = async (url: string, errorText = i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_ssylku_f3b28577')) => {
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
  if (!opened) void showToast({ type: 'info', text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_stranitsu_50207480'), position: 'bottom' })
}

export const UserPointPopupContent = React.memo(function UserPointPopupContent(props: UserPointPopupContentProps) {
  const { point: pointProp, colors, isCompactPopup, driveInfo, onClose, onEditPoint, onDeletePoint } = props
  const dockPx = useDockReservePx()
  // #3161: маркер несёт пин; название, адрес и фото приходят окном `ids=`.
  const { point, hydrating } = useUserPointDetail(pointProp)

  const lat = Number(point.latitude)
  const lng = Number(point.longitude)
  const coord = React.useMemo(
    () => (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : ''),
    [lat, lng]
  )

  const title = React.useMemo(
    () => (hydrating ? i18nT('map:components.UserPoints.UserPointPopupContent.zagruzka_40e36d59') : getPointTitle(point)),
    [hydrating, point],
  )
  const subtitle = React.useMemo(() => (hydrating ? '' : getPointSubtitle(point, title)), [hydrating, point, title])
  const countryLabel = React.useMemo(() => getCountryLabel(point), [point])
  const categoryLabel = React.useMemo(() => getCategoryLabel(point, countryLabel), [countryLabel, point])
  const imageUrl = React.useMemo(() => getPointPhotoUrl(point), [point])
  const { articleUrl, travelUrl, travelId } = React.useMemo(() => getRelatedUrls(point), [point])

  const handleCopyCoords = React.useCallback(async () => {
    if (!coord) return
    try {
      await Clipboard.setStringAsync(coord)
      void showToast({ type: 'success', text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.koordinaty_skopirovany_9794ecb0'), position: 'bottom' })
    } catch {
      void showToast({ type: 'error', text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_skopirovat_koordinaty_251cf34d'), position: 'bottom' })
    }
  }, [coord])

  const handleOpenArticle = React.useCallback(() => {
    void openRelatedPage(articleUrl || travelUrl)
  }, [articleUrl, travelUrl])

  const handleShareTelegram = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildTelegramShareUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_podelitsya_1ff7407d'))
  }, [coord])

  const handleOpenGoogleMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildGoogleMapsUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_google_maps_a2ca522b'))
  }, [coord])

  const handleOpenAppleMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildAppleMapsUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_apple_maps_c57c17b9'))
  }, [coord])

  const handleOpenOrganicMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildOrganicMapsUrl(coord, title), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_organic_maps_87cc6b2d'))
  }, [coord, title])

  const handleOpenWaze = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildWazeUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_waze_d35ab6c9'))
  }, [coord])

  const handleOpenYandexMaps = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildYandexMapsUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_yandeks_karty_860260b8'))
  }, [coord])

  const handleOpenYandexNavi = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildYandexNaviUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_yandeks_navigator_d112999a'))
  }, [coord])

  const handleOpenOpenStreetMap = React.useCallback(() => {
    if (!coord) return
    void openExternal(buildOpenStreetMapUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_openstreetmap_342ea6e3'))
  }, [coord])

  const handleEditPoint = React.useCallback(() => {
    onClose()
    onEditPoint?.(point)
  }, [onClose, onEditPoint, point])

  const handleDeletePoint = React.useCallback(() => {
    onClose()
    onDeletePoint?.(point)
  }, [onClose, onDeletePoint, point])

  const extraActions = React.useMemo<UserPointPopupAction[]>(() => {
    const actions: UserPointPopupAction[] = []
    // Правка и удаление — по полной карточке: пока она не пришла, кнопок нет.
    if (hydrating) return actions
    if (onEditPoint) {
      actions.push({
        key: 'edit',
        label: i18nT('map:components.UserPoints.UserPointsMapPointMarker.izmenit_c2243a6f'),
        icon: 'edit-2',
        onPress: handleEditPoint,
        accessibilityLabel: i18nT('map:components.UserPoints.UserPointsMapPointMarker.redaktirovat_44ce8fb2'),
        tooltip: i18nT('map:components.UserPoints.UserPointsMapPointMarker.redaktirovat_44ce8fb2'),
      })
    }
    if (onDeletePoint) {
      actions.push({
        key: 'delete',
        label: i18nT('common:action.delete'),
        icon: 'trash-2',
        onPress: handleDeletePoint,
        accessibilityLabel: i18nT('common:action.delete'),
        tooltip: i18nT('common:action.delete'),
      })
    }
    // Отдельного «Закрыть» нет — его роль играет ✕ карточки (onClose).
    return actions
  }, [handleDeletePoint, handleEditPoint, hydrating, onDeletePoint, onEditPoint])

  const drivingDistanceMeters = driveInfo?.status === 'ok' ? driveInfo.distanceKm * 1000 : null
  const drivingDurationSeconds = driveInfo?.status === 'ok' ? driveInfo.durationMin * 60 : null

  return (
    <PlacePopupCard
      colors={colors}
      title={title}
      subtitle={subtitle}
      imageUrl={imageUrl}
      articleHref={articleUrl || travelUrl || null}
      relatedTravelUrl={travelUrl || null}
      relatedTravelId={travelId}
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
      fullscreenBottomInset={dockPx}
      onClose={onClose}
    />
  )
})
