import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedColors } from '@/hooks/useTheme';
import BadgeCard, { Badge } from './BadgeCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const STORAGE_KEY_BADGES = 'user_badges';
const STORAGE_KEY_STATS = 'user_stats';

interface UserStats {
  articlesPublished: number;
  photosUploaded: number;
  routesCreated: number;
  likesReceived: number;
  commentsReceived: number;
}

// Базовые бейджи для MVP
const AVAILABLE_BADGES: Badge[] = [
  {
    id: 'first_article',
    name: 'Первопроходец',
    description: 'Опубликовал первую статью',
    icon: 'star',
    color: DESIGN_TOKENS.colors.warning,
    maxProgress: 1,
    earned: false,
  },
  {
    id: 'traveler',
    name: 'Путешественник',
    description: 'Опубликовал 5 статей',
    icon: 'navigation',
    color: DESIGN_TOKENS.colors.info,
    maxProgress: 5,
    earned: false,
  },
  {
    id: 'explorer',
    name: 'Исследователь',
    description: 'Опубликовал 10 статей',
    icon: 'globe',
    color: DESIGN_TOKENS.colors.success,
    maxProgress: 10,
    earned: false,
  },
];

interface BadgeSystemProps {
  userId?: string;
  compact?: boolean;
}

const BadgeSystem = ({ userId, compact = false }: BadgeSystemProps) => {
  const [badges, setBadges] = useState<Badge[]>(AVAILABLE_BADGES);
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const updateBadgesProgress = useCallback((userStats: UserStats) => {
    setBadges((prev) =>
      prev.map((badge) => {
        let progress = 0;

        switch (badge.id) {
          case 'first_article':
            progress = Math.min(userStats.articlesPublished, 1);
            break;
          case 'traveler':
            progress = Math.min(userStats.articlesPublished, 5);
            break;
          case 'explorer':
            progress = Math.min(userStats.articlesPublished, 10);
            break;
          default:
            progress = 0;
        }

        const earned = progress >= (badge.maxProgress || 1);

        return {
          ...badge,
          progress,
          earned,
        };
      })
    );
  }, []);

  const loadBadgesAndStats = useCallback(async () => {
    try {
      const [badgesData, statsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_BADGES),
        AsyncStorage.getItem(STORAGE_KEY_STATS),
      ]);

      if (statsData) {
        const userStats: UserStats = JSON.parse(statsData);
        updateBadgesProgress(userStats);
      }

      if (badgesData) {
        const earnedBadges: string[] = JSON.parse(badgesData);
        setBadges((prev) =>
          prev.map((badge) => ({
            ...badge,
            earned: earnedBadges.includes(badge.id),
          }))
        );
      }
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  }, [updateBadgesProgress]);

  useEffect(() => {
    loadBadgesAndStats();
  }, [userId, loadBadgesAndStats]);

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Достижения</Text>
        <Text style={styles.subtitle}>
          {earnedCount} из {badges.length}
        </Text>
      </View>

      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.scrollContentHorizontal : styles.scrollContentVertical}
      >
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} size={compact ? 'small' : 'medium'} />
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  scrollContentHorizontal: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
  },
  scrollContentVertical: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
});

export default memo(BadgeSystem);

// Утилита для обновления статистики пользователя
export const updateUserStats = async (updates: Partial<UserStats>) => {
  try {
    const statsData = await AsyncStorage.getItem(STORAGE_KEY_STATS);
    const currentStats: UserStats = statsData
      ? JSON.parse(statsData)
      : {
          articlesPublished: 0,
          photosUploaded: 0,
          routesCreated: 0,
          likesReceived: 0,
          commentsReceived: 0,
        };

    const newStats = { ...currentStats, ...updates };
    await AsyncStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(newStats));

    // Проверка и выдача новых бейджей
    await checkAndAwardBadges(newStats);
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

// Проверка и выдача бейджей
const checkAndAwardBadges = async (stats: UserStats) => {
  try {
    const badgesData = await AsyncStorage.getItem(STORAGE_KEY_BADGES);
    const earnedBadges: string[] = badgesData ? JSON.parse(badgesData) : [];

    const newBadges: string[] = [];

    // Проверка условий для каждого бейджа
    if (stats.articlesPublished >= 1 && !earnedBadges.includes('first_article')) {
      newBadges.push('first_article');
    }
    if (stats.articlesPublished >= 5 && !earnedBadges.includes('traveler')) {
      newBadges.push('traveler');
    }
    if (stats.articlesPublished >= 10 && !earnedBadges.includes('explorer')) {
      newBadges.push('explorer');
    }

    if (newBadges.length > 0) {
      const updatedBadges = [...earnedBadges, ...newBadges];
      await AsyncStorage.setItem(STORAGE_KEY_BADGES, JSON.stringify(updatedBadges));
      
      // Здесь можно показать уведомление о получении нового бейджа
      // showBadgeNotification(newBadges);
    }
  } catch (error) {
    console.error('Error checking badges:', error);
  }
};
