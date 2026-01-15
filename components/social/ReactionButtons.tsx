import React, { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface ReactionButtonsProps {
  travelId: string;
  compact?: boolean;
  showViews?: boolean;
}

interface Reactions {
  like: number;
  love: number;
  fire: number;
}

interface UserReaction {
  travelId: string;
  type: 'like' | 'love' | 'fire' | null;
}

const STORAGE_KEY_REACTIONS = 'travel_reactions';
const STORAGE_KEY_USER_REACTIONS = 'user_reactions';
const STORAGE_KEY_VIEWS = 'travel_views';

const ReactionButtons = ({ travelId, compact = false, showViews = true }: ReactionButtonsProps) => {
  const [reactions, setReactions] = useState<Reactions>({ like: 0, love: 0, fire: 0 });
  const [userReaction, setUserReaction] = useState<'like' | 'love' | 'fire' | null>(null);
  const [views, setViews] = useState<number>(0);
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const loadData = useCallback(async () => {
    try {
      // Загрузка реакций
      const reactionsData = await AsyncStorage.getItem(STORAGE_KEY_REACTIONS);
      if (reactionsData) {
        const allReactions = JSON.parse(reactionsData);
        setReactions(allReactions[travelId] || { like: 0, love: 0, fire: 0 });
      }

      // Загрузка реакции пользователя
      const userReactionsData = await AsyncStorage.getItem(STORAGE_KEY_USER_REACTIONS);
      if (userReactionsData) {
        const userReactions: UserReaction[] = JSON.parse(userReactionsData);
        const userReactionItem = userReactions.find(r => r.travelId === travelId);
        setUserReaction(userReactionItem?.type || null);
      }

      // Загрузка просмотров
      const viewsData = await AsyncStorage.getItem(STORAGE_KEY_VIEWS);
      if (viewsData) {
        const allViews = JSON.parse(viewsData);
        setViews(allViews[travelId] || 0);
      }
    } catch (error) {
      console.error('Error loading reaction data:', error);
    }
  }, [travelId]);

  const incrementViews = useCallback(async () => {
    try {
      const viewsData = await AsyncStorage.getItem(STORAGE_KEY_VIEWS);
      const allViews = viewsData ? JSON.parse(viewsData) : {};
      const currentViews = allViews[travelId] || 0;
      allViews[travelId] = currentViews + 1;
      await AsyncStorage.setItem(STORAGE_KEY_VIEWS, JSON.stringify(allViews));
      setViews(currentViews + 1);
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  }, [travelId]);

  useEffect(() => {
    loadData();
    incrementViews();
  }, [loadData, incrementViews]);

  const handleReaction = useCallback(async (type: 'like' | 'love' | 'fire') => {
    try {
      // Обновление реакций
      const reactionsData = await AsyncStorage.getItem(STORAGE_KEY_REACTIONS);
      const allReactions = reactionsData ? JSON.parse(reactionsData) : {};
      const currentReactions = allReactions[travelId] || { like: 0, love: 0, fire: 0 };

      // Если пользователь уже поставил эту реакцию - убираем
      if (userReaction === type) {
        currentReactions[type] = Math.max(0, currentReactions[type] - 1);
        setUserReaction(null);
      } else {
        // Убираем предыдущую реакцию
        if (userReaction) {
          currentReactions[userReaction] = Math.max(0, currentReactions[userReaction] - 1);
        }
        // Добавляем новую
        currentReactions[type] = currentReactions[type] + 1;
        setUserReaction(type);
      }

      allReactions[travelId] = currentReactions;
      await AsyncStorage.setItem(STORAGE_KEY_REACTIONS, JSON.stringify(allReactions));
      setReactions(currentReactions);

      // Обновление реакции пользователя
      const userReactionsData = await AsyncStorage.getItem(STORAGE_KEY_USER_REACTIONS);
      const userReactions: UserReaction[] = userReactionsData ? JSON.parse(userReactionsData) : [];
      const existingIndex = userReactions.findIndex(r => r.travelId === travelId);

      if (userReaction === type) {
        // Убираем реакцию
        if (existingIndex !== -1) {
          userReactions.splice(existingIndex, 1);
        }
      } else {
        // Обновляем или добавляем
        if (existingIndex !== -1) {
          userReactions[existingIndex].type = type;
        } else {
          userReactions.push({ travelId, type });
        }
      }

      await AsyncStorage.setItem(STORAGE_KEY_USER_REACTIONS, JSON.stringify(userReactions));
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }, [travelId, userReaction]);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {showViews && (
        <View style={styles.viewsContainer}>
          <Feather name="eye" size={compact ? 14 : 16} color={colors.textMuted} />
          <Text style={[styles.viewsText, compact && styles.textCompact]}>
            {formatNumber(views)}
          </Text>
        </View>
      )}

      <View style={styles.reactionsContainer}>
        <Pressable
          onPress={() => handleReaction('like')}
          style={({ pressed }) => [
            styles.reactionButton,
            compact && styles.reactionButtonCompact,
            userReaction === 'like' && styles.reactionButtonActive,
            pressed && styles.reactionButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Полезно"
        >
          <Feather
            name="thumbs-up"
            size={compact ? 14 : 16}
            color={userReaction === 'like' ? colors.primary : colors.textMuted}
            style={styles.reactionIcon}
          />
          {reactions.like > 0 && (
            <Text style={[styles.reactionCount, compact && styles.textCompact]}>
              {formatNumber(reactions.like)}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleReaction('love')}
          style={({ pressed }) => [
            styles.reactionButton,
            compact && styles.reactionButtonCompact,
            userReaction === 'love' && styles.reactionButtonActive,
            pressed && styles.reactionButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Вдохновляет"
        >
          <Feather
            name="heart"
            size={compact ? 14 : 16}
            color={userReaction === 'love' ? colors.primary : colors.textMuted}
            style={styles.reactionIcon}
          />
          {reactions.love > 0 && (
            <Text style={[styles.reactionCount, compact && styles.textCompact]}>
              {formatNumber(reactions.love)}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleReaction('fire')}
          style={({ pressed }) => [
            styles.reactionButton,
            compact && styles.reactionButtonCompact,
            userReaction === 'fire' && styles.reactionButtonActive,
            pressed && styles.reactionButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Круто"
        >
          <Feather
            name="zap"
            size={compact ? 14 : 16}
            color={userReaction === 'fire' ? colors.primary : colors.textMuted}
            style={styles.reactionIcon}
          />
          {reactions.fire > 0 && (
            <Text style={[styles.reactionCount, compact && styles.textCompact]}>
              {formatNumber(reactions.fire)}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  containerCompact: {
    gap: 12,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewsText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  reactionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.mutedBackground,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 32,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  reactionButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
  },
  reactionButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  reactionButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  reactionIcon: {
    fontSize: 16,
    opacity: 0.7,
  },
  reactionIconActive: {
    opacity: 1,
  },
  reactionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  textCompact: {
    fontSize: 12,
  },
});

export default memo(ReactionButtons);
