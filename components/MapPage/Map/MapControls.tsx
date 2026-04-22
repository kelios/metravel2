import React, { useCallback, useMemo } from 'react'
import { Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { LatLng } from '@/types/coordinates'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface MapControlsProps {
  userLocation: LatLng | null
  onCenterUserLocation: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  alignLeft?: boolean
}

const MOBILE_WEB_TOP_GAP = 16
const MOBILE_WEB_SIDE_GAP = 16
const CONTROL_GROUP_GAP = 10

const getButtonStyle = (colors: ThemedColors): React.CSSProperties => ({
  width: '42px',
  height: '42px',
  borderRadius: '16px',
  backgroundColor: 'rgba(255,255,255,0.62)',
  border: `1px solid ${colors.borderLight}`,
  boxShadow: '0 6px 16px rgba(58,58,58,0.08), 0 1px 4px rgba(58,58,58,0.04)',
  backdropFilter: 'blur(14px) saturate(1.08)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.08)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition:
    'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
  color: colors.primaryText,
})

const MapControlButton: React.FC<{
  onClick: () => void
  title: string
  ariaLabel: string
  icon: React.ComponentProps<typeof Feather>['name']
  iconSize?: number
  colors: ThemedColors
}> = ({ onClick, title, ariaLabel, icon, iconSize = 22, colors }) => {
  const style = useMemo(() => getButtonStyle(colors), [colors])

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.78)'
      e.currentTarget.style.borderColor = colors.borderLight
      e.currentTarget.style.transform = 'translateY(-1px)'
      e.currentTarget.style.boxShadow =
        '0 8px 18px rgba(58,58,58,0.10), 0 2px 6px rgba(58,58,58,0.05)'
    },
    [colors.borderLight],
  )

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.62)'
      e.currentTarget.style.borderColor = colors.borderLight
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow =
        '0 6px 16px rgba(58,58,58,0.08), 0 1px 4px rgba(58,58,58,0.04)'
    },
    [colors.borderLight],
  )

  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={title}
      aria-label={ariaLabel}
    >
      <Feather name={icon} size={iconSize} color={colors.text} />
    </button>
  )
}

const MapControls: React.FC<MapControlsProps> = ({
  userLocation,
  onCenterUserLocation,
  onZoomIn,
  onZoomOut,
  alignLeft = false,
}) => {
  const colors = useThemedColors()
  const shouldAlignLeft = alignLeft

  const controlsStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top:
        Platform.OS === 'web'
          ? (`calc(${MOBILE_WEB_TOP_GAP}px + env(safe-area-inset-top, 0px))` as const)
          : MOBILE_WEB_TOP_GAP,
      ...(Platform.OS === 'web'
        ? shouldAlignLeft
          ? {
              left: `calc(${MOBILE_WEB_SIDE_GAP}px + env(safe-area-inset-left, 0px))` as const,
            }
          : {
              right: `calc(${MOBILE_WEB_SIDE_GAP}px + env(safe-area-inset-right, 0px))` as const,
            }
        : shouldAlignLeft
          ? { left: MOBILE_WEB_SIDE_GAP }
          : { right: MOBILE_WEB_SIDE_GAP }),
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${CONTROL_GROUP_GAP}px`,
    }),
    [shouldAlignLeft],
  )

  const zoomGroupStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px',
    }),
    [],
  )

  if (Platform.OS !== 'web') return null

  return (
    <div style={controlsStyle}>
      {userLocation && (
        <MapControlButton
          onClick={onCenterUserLocation}
          title={'\u041c\u043e\u0435 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435'}
          ariaLabel={'\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u043c\u043e\u0435\u043c\u0443 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044e'}
          icon="crosshair"
          colors={colors}
        />
      )}
      {(onZoomIn || onZoomOut) && (
        <div style={zoomGroupStyle}>
          {onZoomIn && (
            <MapControlButton
              onClick={onZoomIn}
              title={'\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c'}
              ariaLabel={'\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443'}
              icon="plus"
              iconSize={20}
              colors={colors}
            />
          )}
          {onZoomOut && (
            <MapControlButton
              onClick={onZoomOut}
              title={'\u041e\u0442\u0434\u0430\u043b\u0438\u0442\u044c'}
              ariaLabel={'\u041e\u0442\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443'}
              icon="minus"
              iconSize={20}
              colors={colors}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(MapControls)
