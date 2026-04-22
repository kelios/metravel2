import React, { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { LatLng } from '@/types/coordinates';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface MapControlsProps {
  userLocation: LatLng | null;
  onCenterUserLocation: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** Отступ снизу для избежания конфликта с Bottom Sheet (в пикселях) */
  bottomOffset?: number;
  /** Разместить контролы слева (для мобильного, чтобы не перекрывались Bottom Sheet) */
  alignLeft?: boolean;
}

const MOBILE_WEB_BOTTOM_CHROME_GAP = 28;
const MOBILE_WEB_SIDE_GAP = 16;

const getButtonStyle = (colors: ThemedColors): React.CSSProperties => ({
  width: '44px',
  height: '44px',
  borderRadius: '16px',
  backgroundColor: 'rgba(255,255,255,0.62)',
  border: `1px solid ${colors.borderLight}`,
  boxShadow: '0 8px 18px rgba(58,58,58,0.08), 0 1px 4px rgba(58,58,58,0.04)',
  backdropFilter: 'blur(14px) saturate(1.08)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.08)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
  color: colors.primaryText,
});

const MapControlButton: React.FC<{
  onClick: () => void;
  title: string;
  ariaLabel: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  iconSize?: number;
  colors: ThemedColors;
}> = ({ onClick, title, ariaLabel, icon, iconSize = 22, colors }) => {
  const style = useMemo(() => getButtonStyle(colors), [colors]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.78)';
    e.currentTarget.style.borderColor = colors.borderLight;
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.boxShadow = '0 10px 20px rgba(58,58,58,0.10), 0 2px 6px rgba(58,58,58,0.05)';
  }, [colors.borderLight]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.62)';
    e.currentTarget.style.borderColor = colors.borderLight;
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 8px 18px rgba(58,58,58,0.08), 0 1px 4px rgba(58,58,58,0.04)';
  }, [colors.borderLight]);

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
  );
};

const MapControls: React.FC<MapControlsProps> = ({
  userLocation,
  onCenterUserLocation,
  onZoomIn,
  onZoomOut,
  bottomOffset = 0,
  alignLeft = false,
}) => {
  const colors = useThemedColors();

  // На мобильном размещаем слева, чтобы не конфликтовать с Bottom Sheet
  const shouldAlignLeft = alignLeft;

  const controlsStyle = useMemo(() => ({
    position: 'absolute' as const,
    bottom:
      Platform.OS === 'web'
        ? (`calc(${Math.max(18, bottomOffset)}px + env(safe-area-inset-bottom) + ${MOBILE_WEB_BOTTOM_CHROME_GAP}px)` as any)
        : Math.max(18, bottomOffset),
    ...(Platform.OS === 'web'
      ? shouldAlignLeft
        ? { left: `calc(${MOBILE_WEB_SIDE_GAP}px + env(safe-area-inset-left, 0px))` as any }
        : { right: `calc(${MOBILE_WEB_SIDE_GAP}px + env(safe-area-inset-right, 0px))` as any }
      : shouldAlignLeft
        ? { left: MOBILE_WEB_SIDE_GAP }
        : { right: MOBILE_WEB_SIDE_GAP }),
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  }), [bottomOffset, shouldAlignLeft]);

  if (Platform.OS !== 'web') return null;

  return (
    <div style={controlsStyle}>
      {onZoomIn && (
        <MapControlButton
          onClick={onZoomIn}
          title="Приблизить"
          ariaLabel="Приблизить карту"
          icon="plus"
          iconSize={20}
          colors={colors}
        />
      )}
      {onZoomOut && (
        <MapControlButton
          onClick={onZoomOut}
          title="Отдалить"
          ariaLabel="Отдалить карту"
          icon="minus"
          iconSize={20}
          colors={colors}
        />
      )}
      {/* MAP-05: Кнопка «Моя геопозиция» видна на всех устройствах */}
      {userLocation && (
        <MapControlButton
          onClick={onCenterUserLocation}
          title="Мое местоположение"
          ariaLabel="Вернуться к моему местоположению"
          icon="crosshair"
          colors={colors}
        />
      )}
    </div>
  );
};

export default React.memo(MapControls);
