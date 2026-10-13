import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { getSeasonalThemePalette } from '@/constants/seasonalThemePalettes';

export default function SeasonalThemeDecoration() {
  const { activeSeasonalTheme, isDark } = useTheme();
  const palette = getSeasonalThemePalette(activeSeasonalTheme, isDark);
  if (!activeSeasonalTheme || !palette) return null;

  const jewel = palette.sceneJewel;
  const foliage = palette.sceneWordmark;

  return (
    <View
      testID="seasonal-theme-decoration"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.decoration}
    >
      <Svg width="100%" height="100%" viewBox="0 0 390 56" preserveAspectRatio="xMidYMid meet">
        <G opacity={0.38}>
          {activeSeasonalTheme === 'spring' && (
            <G testID="seasonal-motif-spring">
              <Path d="M75 0Q99 4 122 15M112 0Q116 8 122 15M316 56Q293 50 280 40" stroke={foliage} strokeWidth={1.5} fill="none" />
              <Ellipse cx={92} cy={5} rx={6} ry={2.5} fill={foliage} transform="rotate(20 92 5)" />
              <Ellipse cx={294} cy={48} rx={6} ry={2.5} fill={foliage} transform="rotate(20 294 48)" />
              <Path d="M115 11q-8-9-2-10q7-1 7 5q7-5 10 0q2 6-8 8q-5 6-7-3Z" fill={jewel} />
              <Path d="M282 42q-8-8-3-10q6-2 7 4q6-4 9 1q1 5-7 6q-4 6-6-1Z" fill={jewel} />
            </G>
          )}
          {activeSeasonalTheme === 'easter' && (
            <G testID="seasonal-motif-easter">
              <Path d="M111 2C105 2 102 13 103 17C104 24 119 24 120 17C121 13 117 2 111 2Z" fill={jewel} />
              <Path d="M104 14l4-3 4 3 4-3 4 3" stroke={foliage} strokeWidth={1.5} fill="none" />
              <Path d="M286 34C281 34 278 43 279 48C280 54 293 54 294 48C295 43 291 34 286 34Z" fill={foliage} />
              <Path d="M280 45h13" stroke={jewel} strokeWidth={2} />
              <Circle cx={98} cy={7} r={2} fill={foliage} />
              <Circle cx={302} cy={50} r={2} fill={jewel} />
            </G>
          )}
          {activeSeasonalTheme === 'autumn' && (
            <G testID="seasonal-motif-autumn">
              <Path d="M91 0q24 0 30 18q-21 4-30-18ZM272 52q8-22 29-22q-1 22-29 22Z" fill={jewel} />
              <Path d="M92 1l27 16M275 50l22-18" stroke={foliage} strokeWidth={1.2} />
              <Path d="M131 1q11 2 10 14q-11-3-10-14ZM306 56q-12-2-13-13q11 1 13 13Z" fill={foliage} />
            </G>
          )}
          {activeSeasonalTheme === 'halloween' && (
            <G testID="seasonal-motif-halloween">
              <Path d="M107 1A11 11 0 1 0 119 17A9 9 0 0 1 107 1Z" fill={foliage} />
              <Path d="M286 30v5M277 37q9-5 18 0l-2 15h-14Z" stroke={foliage} strokeWidth={1.5} fill={jewel} />
              <Path d="M281 42l3-2 3 2 3-2M282 47q4 3 8 0" stroke={foliage} strokeWidth={1.5} fill="none" />
              <Circle cx={129} cy={6} r={1.5} fill={jewel} />
              <Circle cx={306} cy={45} r={1.5} fill={jewel} />
            </G>
          )}
          {activeSeasonalTheme === 'christmas' && (
            <G testID="seasonal-motif-christmas">
              <Path d="M79 0q20 8 54 6M268 56q25-11 48-8" stroke={foliage} strokeWidth={2} fill="none" />
              <Path d="M88 2l3 9M96 4l6 9M106 5l5 10M116 6l6 8M281 51l-5-8M292 48l-4-9M302 48l-2-9" stroke={foliage} strokeWidth={2} />
              <Circle cx={92} cy={13} r={2.5} fill={jewel} />
              <Circle cx={116} cy={17} r={2.5} fill={jewel} />
              <Circle cx={287} cy={37} r={2.5} fill={jewel} />
              <Circle cx={307} cy={37} r={2.5} fill={jewel} />
            </G>
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  decoration: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
