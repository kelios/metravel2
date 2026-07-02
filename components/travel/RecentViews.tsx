// components/RecentViews.tsx
// ✅ РЕДИЗАЙН: Блок недавних просмотров
// ✅ РЕДИЗАЙН: Поддержка темной темы с useThemedColors

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlashList } from '@shopify/flash-list';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useVisibleCardCount } from '@/hooks/useVisibleCardCount';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import FavoriteButton from '@/components/travel/FavoriteButton';
import { useRouter } from 'expo-router';
import type { Travel } from '@/types/types';

interface RecentViewsProps {
  maxItems?: number;
  compact?: boolean;
  /**
   * Optional seed data (useful for deterministic tests or server-provided state)
   */
  initialTravels?: Travel[];
}

const spacing = DESIGN_TOKENS.spacing;
const STORAGE_KEY = 'metravel_recent_views';
const CARD_WIDTH = 200;
const CARD_GAP = spacing.sm;

function RecentViews({
  maxItems = 6,
  compact = false,
  initialTravels,
}: RecentViewsProps) {
  const router = useRouter();
  const [recentTravels, setRecentTravels] = React.useState<Travel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const colors = useThemedColors();

  const cardStyle = useMemo(() => ({ height: '100%' as const, backgroundColor: colors.surface }), [colors.surface]);
  const preview = useVisibleCardCount({
    itemCount: recentTravels.length,
    itemWidth: CARD_WIDTH,
    gap: CARD_GAP,
    max: maxItems,
  });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'opacity 0.2s ease',
          ':hover': {
            opacity: 0.7,
          },
        },
      }),
    },
    clearButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xs,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    listContent: {
      paddingHorizontal: spacing.sm,
      gap: spacing.sm,
    },
    cardWrapper: {
      width: CARD_WIDTH,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    seeAllText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600',
      color: colors.primaryText,
    },
    compactContainer: {
      padding: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    compactText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
  }), [colors]);

  React.useEffect(() => {
    if (initialTravels) {
      setRecentTravels(initialTravels.slice(0, maxItems));
      setIsLoading(false);
      return;
    }

    const loadRecentViews = async () => {
      if (!AsyncStorage?.getItem) {
        setIsLoading(false);
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          // ✅ FIX-010: Используем безопасный парсинг JSON
          const { safeJsonParseString } = require('@/utils/safeJsonParse');
          const parsed = safeJsonParseString(stored, []);
          setRecentTravels(parsed.slice(0, maxItems));
        }
      } catch (error) {
        // ✅ FIX-007: Используем централизованный logger
        const { devError } = require('@/utils/logger');
        devError('Error loading recent views:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentViews();
  }, [initialTravels, maxItems]);

  const handleClear = async () => {
    if (!AsyncStorage?.removeItem) {
      setRecentTravels([]);
      return;
    }

    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setRecentTravels([]);
    } catch (error) {
      // ✅ BUG-001: Логируем только в dev режиме
      if (__DEV__) {
        console.error('Error clearing recent views:', error);
      }
    }
  };

  const flashListKeyExtractor = useCallback((item: Travel) => String(item.id), []);
  const flashListRenderItem = useCallback(({ item }: { item: Travel }) => {
    const countries = item.countryName?.split(',').map((c: string) => c.trim()).filter(Boolean) || [];
    return (
      <View style={styles.cardWrapper}>
        <UnifiedTravelCard
          testID={`travel-card-${item.id}`}
          title={item.name}
          imageUrl={item.travel_image_thumb_url}
          metaText={countries.length > 0 ? countries.join(', ') : null}
          onPress={() => router.push(`/travels/${item.slug || item.id}`)}
          rightTopSlot={
            <FavoriteButton
              id={item.id}
              type="travel"
              title={item.name || ''}
              imageUrl={item.travel_image_thumb_url}
              url={`/travels/${item.slug || item.id}`}
              country={countries[0]}
              size={18}
            />
          }
          imageHeight={180}
          style={cardStyle}
        />
      </View>
    );
  }, [cardStyle, router, styles.cardWrapper]);

  if (isLoading || recentTravels.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactText}>
          Недавно просмотрено: {recentTravels.length}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="clock" size={16} color={colors.primaryDark} />
          <Text style={styles.title}>Недавние просмотры</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/history' as any)}
            style={styles.seeAllButton}
            accessibilityLabel="Смотреть всю историю просмотров"
            accessibilityRole="link"
          >
            <Text style={styles.seeAllText}>Все</Text>
            <Feather name="arrow-right" size={14} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            onPress={handleClear}
            style={styles.clearButton}
            accessibilityLabel="Очистить историю просмотров"
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={14} color={colors.textMuted} />
            <Text style={styles.clearButtonText}>Очистить</Text>
          </Pressable>
        </View>
      </View>

      {Platform.OS === 'web' ? (
        <View
          testID="recent-views-list"
          style={styles.previewRow}
          onLayout={preview.onLayout}
        >
          {recentTravels.slice(0, preview.visibleCount).map((item) => {
            const countries = item.countryName?.split(',').map((c: string) => c.trim()).filter(Boolean) || [];
            return (
              <View key={String(item.id)} style={styles.cardWrapper}>
                <UnifiedTravelCard
                  testID={`travel-card-${item.id}`}
                  title={item.name}
                  imageUrl={item.travel_image_thumb_url}
                  metaText={countries.length > 0 ? countries.join(', ') : null}
                  onPress={() => router.push(`/travels/${item.slug || item.id}`)}
                  rightTopSlot={
                    <FavoriteButton
                      id={item.id}
                      type="travel"
                      title={item.name || ''}
                      imageUrl={item.travel_image_thumb_url}
                      url={`/travels/${item.slug || item.id}`}
                      country={countries[0]}
                      size={18}
                    />
                  }
                  imageHeight={200}
                  style={cardStyle}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <FlashList
          testID="recent-views-list"
          data={recentTravels}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={flashListKeyExtractor}
          renderItem={flashListRenderItem}
          {...({ estimatedItemSize: 220 } as any)}
          contentContainerStyle={styles.listContent}
          drawDistance={800}
        />
      )}
    </View>
  );
}

export default React.memo(RecentViews);
