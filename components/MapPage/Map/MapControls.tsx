import React, { useCallback, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
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

const getButtonStyle = (colors: ThemedColors): React.CSSProperties => ({
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  boxShadow: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
  color: colors.text,
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
    e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
    e.currentTarget.style.borderColor = colors.borderStrong;
  }, [colors.backgroundSecondary, colors.borderStrong]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = colors.surface;
    e.currentTarget.style.borderColor = colors.border;
  }, [colors.border, colors.surface]);

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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // На мобильном размещаем слева, чтобы не конфликтовать с Bottom Sheet
  const shouldAlignLeft = alignLeft || isMobile;

  const controlsStyle = useMemo(() => ({
    position: 'absolute' as const,
    bottom: Math.max(18, bottomOffset),
    ...(shouldAlignLeft ? { left: 10 } : { right: 10 }),
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
      {userLocation && !isMobile && (
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
