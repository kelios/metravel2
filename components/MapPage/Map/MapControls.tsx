import React, { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { LatLng } from '@/types/coordinates';
import { useThemedColors } from '@/hooks/useTheme';

interface MapControlsProps {
  userLocation: LatLng | null;
  onCenterUserLocation: () => void;
  /** Отступ снизу для избежания конфликта с Bottom Sheet (в пикселях) */
  bottomOffset?: number;
  /** Разместить контролы слева (для мобильного, чтобы не перекрывались Bottom Sheet) */
  alignLeft?: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  userLocation,
  onCenterUserLocation,
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
    zIndex: 1000,
  }), [bottomOffset, shouldAlignLeft]);

  if (!userLocation || Platform.OS !== 'web') return null;

  return (
    <div style={controlsStyle}>
      <button
        onClick={onCenterUserLocation}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: colors.surface,
          border: `2px solid ${colors.borderStrong}`,
          boxShadow: colors.boxShadows.card,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'all 0.2s ease',
          color: colors.info,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.infoLight;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.surface;
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Мое местоположение"
        aria-label="Вернуться к моему местоположению"
      >
        <Feather name="crosshair" size={22} color={colors.info} />
      </button>
    </div>
  );
};

export default React.memo(MapControls);
