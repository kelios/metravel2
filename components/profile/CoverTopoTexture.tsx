import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useThemedColors } from '@/hooks/useTheme';

interface CoverTopoTextureProps {
  height: number;
}

// Низкоконтрастные контурные «топо-линии» (как на карте) одним цветом —
// нейтральный identity-баннер вместо AI-градиента, пока BE не отдаёт cover_photo.
// Линии масштабируются по ширине через preserveAspectRatio="none".
const TOPO_PATHS = [
  'M0 28 C 60 14, 120 42, 180 26 C 240 12, 300 40, 360 26',
  'M0 48 C 70 34, 130 62, 200 46 C 260 32, 320 58, 360 46',
  'M0 70 C 50 56, 130 82, 190 66 C 250 52, 310 80, 360 66',
  'M0 14 C 80 4, 140 24, 220 12 C 280 4, 320 22, 360 12',
  'M0 90 C 60 80, 140 100, 210 88 C 270 78, 320 96, 360 86',
];

function CoverTopoTextureBase({ height }: CoverTopoTextureProps) {
  const colors = useThemedColors();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} pointerEvents="none">
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 360 104"
        preserveAspectRatio="none"
      >
        <Rect x={0} y={0} width={360} height={104} fill={colors.surface} />
        {TOPO_PATHS.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={colors.border}
            strokeWidth={1}
            strokeOpacity={0.6}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

export const CoverTopoTexture = memo(CoverTopoTextureBase);
