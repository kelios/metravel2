// components/RecentViews.tsx
// ✅ РЕДИЗАЙН: Блок недавних просмотров

import React from 'react';
import { View, Text, StyleSheet, FlatList, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import TravelCardCompact from '@/components/TravelCardCompact';
import type { Travel } from '@/src/types/types';

interface RecentViewsProps {
  maxItems?: number;
  compact?: boolean;
  /**
   * Optional seed data (useful for deterministic tests or server-provided state)
   */
  initialTravels?: Travel[];
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;

const STORAGE_KEY = 'metravel_recent_views';

function handleHorizontalWheel(e: any) {
  if (Platform.OS !== 'web') return;

  const deltaY = Number(e?.deltaY ?? 0);
  const deltaX = Number(e?.deltaX ?? 0);
  if (!deltaY || Math.abs(deltaY) <= Math.abs(deltaX)) return;

  const target = e?.currentTarget as any;
  const el = target?._nativeNode || target?._domNode || target;
  if (!el || typeof (el as any).scrollLeft !== 'number') return;

  const maxScrollLeft = (el.scrollWidth ?? 0) - (el.clientWidth ?? 0);
  if (maxScrollLeft <= 0) return;

  e.preventDefault?.();
  (el as any).scrollLeft += deltaY;
}

export default function RecentViews({
  maxItems = 6,
  compact = false,
  initialTravels,
}: RecentViewsProps) {
  const [recentTravels, setRecentTravels] = React.useState<Travel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

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
          const { safeJsonParseString } = require('@/src/utils/safeJsonParse');
          const parsed = safeJsonParseString(stored, []);
          setRecentTravels(parsed.slice(0, maxItems));
        }
      } catch (error) {
        // ✅ FIX-007: Используем централизованный logger
        const { devError } = require('@/src/utils/logger');
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
          <Feather name="clock" size={16} color={palette.primary} />
          <Text style={styles.title}>Недавние просмотры</Text>
        </View>
        <Pressable
          onPress={handleClear}
          style={styles.clearButton}
          accessibilityLabel="Очистить историю просмотров"
          {...Platform.select({
            web: {
              cursor: 'pointer',
            },
          })}
        >
          <Feather name="trash-2" size={14} color={palette.textMuted} />
          <Text style={styles.clearButtonText}>Очистить</Text>
        </Pressable>
      </View>

      <FlatList
        data={recentTravels}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <TravelCardCompact travel={item} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        {...Platform.select({ web: { onWheel: handleHorizontalWheel as any } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
        // @ts-ignore
        ':hover': {
          opacity: 0.7,
        },
      },
    }),
  },
  clearButtonText: {
    fontSize: 12,
    color: palette.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    ...Platform.select({
      web: {
        minWidth: 'max-content',
        overscrollBehaviorX: 'contain',
      } as any,
      default: {},
    }),
  },
  cardWrapper: {
    width: 200,
  },
  compactContainer: {
    padding: spacing.sm,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 8,
  },
  compactText: {
    fontSize: 12,
    color: palette.textMuted,
  },
});
