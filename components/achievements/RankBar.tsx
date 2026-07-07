import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { MaxLevelLaurel } from '@/components/achievements/GamificationIcons';
import type { UserRank } from '@/api/achievements';

interface Props {
  rank: UserRank;
  /** Компактный вариант (карточка автора): без подписи XP. */
  compact?: boolean;
  /** Префикс перед названием ранга, напр. «Ранг: » — делает слово понятным. */
  titlePrefix?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function RankBar({ rank, compact = false, titlePrefix = '', testID, style }: Props) {
  const colors = useThemedColors();

  // 'max' — достигнут максимум; 'progress' — есть следующий уровень; 'unknown' —
  // пороги не пришли (legacy-ответ без summary и без rank_levels), полосу не рисуем.
  // Canonical: progressRatio/remainingPoints приходят готовыми с бэка (#721). Legacy:
  // если их нет (null) — считаем из порогов клиентом (старый деплой).
  const { mode, ratio, remaining } = useMemo(() => {
    if (rank.isMaxLevel) return { mode: 'max' as const, ratio: 1, remaining: 0 };
    if (rank.nextLevelMinPoints == null) {
      return { mode: 'unknown' as const, ratio: 0, remaining: 0 };
    }
    if (rank.progressRatio != null && rank.remainingPoints != null) {
      return {
        mode: 'progress' as const,
        ratio: Math.max(0, Math.min(1, rank.progressRatio)),
        remaining: Math.max(0, rank.remainingPoints),
      };
    }
    const span = Math.max(1, rank.nextLevelMinPoints - rank.currentLevelMinPoints);
    const done = rank.totalPoints - rank.currentLevelMinPoints;
    return {
      mode: 'progress' as const,
      ratio: Math.max(0, Math.min(1, done / span)),
      remaining: Math.max(0, rank.nextLevelMinPoints - rank.totalPoints),
    };
  }, [rank]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { gap: 6 },
        row: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
        levelChip: {
          width: compact ? 30 : 38,
          height: compact ? 30 : 38,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        levelGradient: { ...StyleSheet.absoluteFillObject },
        levelText: {
          color: '#FFFFFF',
          fontWeight: '800',
          fontSize: compact ? 13 : 16,
          textShadowColor: 'rgba(0,0,0,0.25)',
          textShadowRadius: 2,
        },
        titleWrap: { flex: 1, minWidth: 0 },
        title: {
          fontSize: compact
            ? DESIGN_TOKENS.typography.sizes.sm
            : DESIGN_TOKENS.typography.sizes.md,
          fontWeight: '700',
          color: colors.text,
        },
        points: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          color: colors.textMuted,
        },
        track: {
          height: compact ? 5 : 7,
          borderRadius: 999,
          backgroundColor: colors.backgroundTertiary,
          overflow: 'hidden',
        },
        fill: { height: '100%', borderRadius: 999 },
        caption: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
        captionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
      }),
    [colors, compact],
  );

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={
        mode === 'max'
          ? `Уровень ${rank.level}, ${rank.title}. Максимальный уровень`
          : mode === 'progress'
            ? `Уровень ${rank.level}, ${rank.title}. ${rank.totalPoints} очков, до уровня ${rank.nextLevelTitle ?? ''} осталось ${remaining}`
            : `Уровень ${rank.level}, ${rank.title}. ${rank.totalPoints} очков`
      }
    >
      <View style={styles.row}>
        <View style={styles.levelChip}>
          <LinearGradient
            colors={[colors.brand, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.levelGradient}
          />
          <Text style={styles.levelText}>{rank.level}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {`${titlePrefix}${rank.title}`}
          </Text>
          {!compact ? (
            <Text style={styles.points}>
              {rank.totalPoints} очков опыта · значков: {rank.badgesCount}
            </Text>
          ) : null}
        </View>
      </View>

      {mode !== 'unknown' ? (
        <View style={styles.track}>
          <LinearGradient
            colors={[colors.brand, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${ratio * 100}%` }]}
          />
        </View>
      ) : null}

      {!compact && mode !== 'unknown' ? (
        mode === 'max' ? (
          <View style={styles.captionRow}>
            <MaxLevelLaurel size={16} color={colors.textMuted} />
            <Text style={styles.caption}>Максимальный уровень достигнут</Text>
          </View>
        ) : (
          <Text style={styles.caption}>
            До «{rank.nextLevelTitle}»: ещё {remaining} очков опыта
          </Text>
        )
      ) : null}
    </View>
  );
}

export default memo(RankBar);
