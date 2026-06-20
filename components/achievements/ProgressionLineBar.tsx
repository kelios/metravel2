import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { ProgressionLine } from '@/api/gamification';

interface Props {
  line: ProgressionLine;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Одна линейка прогрессии: маскот ветки, тип активности, уровень и % до следующего. */
function ProgressionLineBar({ line, testID, style }: Props) {
  const colors = useThemedColors();

  const { ratio, remaining } = useMemo(() => {
    if (line.isMaxLevel || line.nextLevelMin == null) {
      return { ratio: 1, remaining: 0 };
    }
    const span = Math.max(1, line.nextLevelMin - line.currentLevelMin);
    const done = line.current - line.currentLevelMin;
    return {
      ratio: Math.max(0, Math.min(1, done / span)),
      remaining: Math.max(0, line.nextLevelMin - line.current),
    };
  }, [line]);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const caption = line.isMaxLevel
    ? 'Максимальный уровень 🏆'
    : `До «${line.nextLevelTitle}»: ещё ${remaining}`;

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={`${line.activityName}, ${line.name}. Уровень ${line.level}, ${line.levelTitle}. ${
        line.isMaxLevel ? 'Максимальный уровень' : `до следующего уровня осталось ${remaining}`
      }`}
    >
      <View style={styles.row}>
        <Text style={styles.emoji}>{line.emoji}</Text>
        <View style={styles.titleWrap}>
          <Text style={styles.activity} numberOfLines={1}>
            {line.activityName}
          </Text>
          <Text style={styles.lineName} numberOfLines={1}>
            {line.name} · ур. {line.level} «{line.levelTitle}»
          </Text>
        </View>
        <Text style={styles.value}>{line.current}</Text>
      </View>

      <View style={styles.track}>
        <LinearGradient
          colors={[colors.brand, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${ratio * 100}%` }]}
        />
      </View>

      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: { gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
    emoji: { fontSize: 22 },
    titleWrap: { flex: 1, minWidth: 0 },
    activity: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    lineName: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    value: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.primary,
    },
    track: {
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.backgroundTertiary,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 999 },
    caption: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
  });

export default memo(ProgressionLineBar);
