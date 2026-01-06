import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

const STORAGE_KEY_ACTIVITIES = 'user_activities';

export type ActivityType = 
  | 'article_published'
  | 'badge_earned'
  | 'level_up'
  | 'reaction_received'
  | 'comment_received'
  | 'photo_added'
  | 'route_added';

export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: string;
  data: {
    articleId?: string;
    articleTitle?: string;
    badgeName?: string;
    badgeIcon?: string;
    levelName?: string;
    reactionType?: string;
    commentText?: string;
    photoCount?: number;
  };
}

interface ActivityFeedProps {
  userId?: string;
  limit?: number;
  showHeader?: boolean;
}

const ActivityFeed = ({ userId, limit = 20, showHeader = true }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const loadActivities = useCallback(async () => {
    try {
      const activitiesData = await AsyncStorage.getItem(STORAGE_KEY_ACTIVITIES);
      if (activitiesData) {
        const allActivities: Activity[] = JSON.parse(activitiesData);
        const filteredActivities = userId
          ? allActivities.filter((a) => a.userId === userId)
          : allActivities;
        
        setActivities(filteredActivities.slice(0, limit));
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  }, [limit, userId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }, [loadActivities]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const renderActivity = useCallback(
    ({ item }: { item: Activity }) => (
      <ActivityItem activity={item} colors={colors} styles={styles} />
    ),
    [colors, styles]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка активности...</Text>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="activity" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Пока нет активности</Text>
        <Text style={styles.emptyText}>
          Создавай статьи, получай бейджи и взаимодействуй с сообществом
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <Feather name="activity" size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>Активность</Text>
        </View>
      )}

      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

interface ActivityItemProps {
  activity: Activity;
  colors: ThemedColors;
  styles: ReturnType<typeof getStyles>;
}

const ActivityItem = memo(({ activity, colors, styles }: ActivityItemProps) => {
  const { type, userName, timestamp, data } = activity;

  const getActivityIcon = (): string => {
    switch (type) {
      case 'article_published': return '📝';
      case 'badge_earned': return data.badgeIcon || '🏆';
      case 'level_up': return '⬆️';
      case 'reaction_received': return '❤️';
      case 'comment_received': return '💬';
      case 'photo_added': return '📸';
      case 'route_added': return '🗺️';
      default: return '✨';
    }
  };

  const getActivityText = (): string => {
    switch (type) {
      case 'article_published':
        return `опубликовал статью "${data.articleTitle}"`;
      case 'badge_earned':
        return `получил бейдж ${data.badgeIcon} ${data.badgeName}`;
      case 'level_up':
        return `достиг уровня ${data.levelName}`;
      case 'reaction_received':
        return `получил реакцию на статью "${data.articleTitle}"`;
      case 'comment_received':
        return `получил комментарий: "${data.commentText}"`;
      case 'photo_added':
        return `добавил ${data.photoCount} фото`;
      case 'route_added':
        return `добавил новый маршрут`;
      default:
        return 'выполнил действие';
    }
  };

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    return activityTime.toLocaleDateString('ru-RU');
  };

  const handlePress = () => {
    if (data.articleId) {
      router.push(`/travels/${data.articleId}`);
    }
  };

  const isClickable = !!data.articleId;

  return (
    <Pressable
      style={[styles.activityItem, isClickable && styles.activityItemClickable]}
      onPress={isClickable ? handlePress : undefined}
      disabled={!isClickable}
    >
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>{getActivityIcon()}</Text>
      </View>

      <View style={styles.activityContent}>
        <Text style={styles.activityText}>
          <Text style={styles.activityUserName}>{userName}</Text>{' '}
          {getActivityText()}
        </Text>
        <Text style={styles.activityTime}>{getTimeAgo(timestamp)}</Text>
      </View>

      {isClickable && (
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
});

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  list: {
    paddingVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityItemClickable: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIconText: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  activityUserName: {
    fontWeight: '600',
    color: colors.primary,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default memo(ActivityFeed);

// Утилита для добавления активности
export const addActivity = async (activity: Omit<Activity, 'id' | 'timestamp'>) => {
  try {
    const activitiesData = await AsyncStorage.getItem(STORAGE_KEY_ACTIVITIES);
    const activities: Activity[] = activitiesData ? JSON.parse(activitiesData) : [];

    const newActivity: Activity = {
      ...activity,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    activities.unshift(newActivity);

    // Храним только последние 100 активностей
    const trimmedActivities = activities.slice(0, 100);
    await AsyncStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(trimmedActivities));

    return newActivity;
  } catch (error) {
    console.error('Error adding activity:', error);
    return null;
  }
};
