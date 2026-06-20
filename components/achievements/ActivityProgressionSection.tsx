import { memo, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import {
  useMyGamificationProgress,
  useUserGamificationProgress,
} from '@/hooks/useGamification';
import { trackProgressionLevelUp } from '@/utils/gamificationAnalytics';
import ProgressionLineBar from '@/components/achievements/ProgressionLineBar';

interface Props {
  /** userId — публичный профиль автора; не задан — собственный профиль (/me/). */
  userId?: string | number | null;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 4 типа активности (Исследователь/Читатель/Автор/Участник) с их RPG-линейками
 * (Собачья/Кабанья/Лисья/Птичья) в профиле. FE-progression-bar + FE-activity-types-ui.
 */
function ActivityProgressionSection({ userId, testID, style }: Props) {
  const colors = useThemedColors();
  const isOwn = userId == null;
  const ownQuery = useMyGamificationProgress();
  const userQuery = useUserGamificationProgress(isOwn ? null : userId);
  const { data, isLoading, isError } = isOwn ? ownQuery : userQuery;

  // Только для собственного профиля: трекаем level-up по росту уровня между рефетчами.
  const prevLevels = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!isOwn || !data) return;
    for (const line of data.lines) {
      const prev = prevLevels.current[line.slug];
      if (prev != null && line.level > prev) {
        trackProgressionLevelUp({
          lineSlug: line.slug,
          activityKind: line.activityKind,
          newLevel: line.level,
        });
      }
      prevLevels.current[line.slug] = line.level;
    }
  }, [isOwn, data]);

  const styles = useMemo(() => getStyles(colors), [colors]);

  if (isError) return null;
  if (!isLoading && (!data || data.lines.length === 0)) return null;

  return (
    <View style={[styles.card, style]} testID={testID}>
      <Text style={styles.heading}>Линейки прогрессии</Text>
      <Text style={styles.subheading}>
        Четыре типа активности — четыре тропы. Чем больше вклад, тем выше уровень.
      </Text>

      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.lines}>
          {data.lines.map((line) => (
            <ProgressionLineBar key={line.slug} line={line} />
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    subheading: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    lines: { gap: DESIGN_TOKENS.spacing.md },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.lg, alignItems: 'center' },
  });

export default memo(ActivityProgressionSection);
