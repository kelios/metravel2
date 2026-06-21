import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useThemedColors } from '@/hooks/useTheme';

interface CoverTopoTextureProps {
  height: number;
}

// Деликатные контурные «топо-линии» (горизонтали как на карте) одним цветом —
// нейтральный identity-баннер вместо AI-градиента, пока BE не отдаёт cover_photo.
// Цвет линий — colors.textSecondary (непрозрачный токен, читаемый на светлой и
// тёмной поверхности) с явной strokeOpacity 0.16 → эффективная альфа ~16%:
// заметно, но спокойно. Линии масштабируются по ширине через
// preserveAspectRatio="none". Толщина/амплитуда варьируются, чтобы рисунок
// напоминал реальные горизонтали рельефа, а не набор параллельных дуг.
const TOPO_LINES: { d: string; width: number }[] = [
  { d: 'M0 12 C 70 2, 130 22, 210 10 C 280 0, 320 18, 360 9', width: 1 },
  { d: 'M0 26 C 60 12, 122 40, 182 24 C 242 10, 300 38, 360 25', width: 1.4 },
  { d: 'M0 44 C 48 33, 96 28, 150 40 C 214 54, 286 32, 360 46', width: 1 },
  { d: 'M0 58 C 80 70, 150 48, 214 56 C 274 63, 320 50, 360 60', width: 1.6 },
  { d: 'M0 74 C 56 62, 120 84, 188 70 C 250 57, 312 82, 360 68', width: 1 },
  { d: 'M0 90 C 64 80, 132 100, 206 88 C 268 78, 322 96, 360 86', width: 1.3 },
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
        {TOPO_LINES.map((line, i) => (
          <Path
            key={i}
            d={line.d}
            stroke={colors.textSecondary}
            strokeWidth={line.width}
            strokeOpacity={0.16}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

export const CoverTopoTexture = memo(CoverTopoTextureBase);
