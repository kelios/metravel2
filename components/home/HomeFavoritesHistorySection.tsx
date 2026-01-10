import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { ResponsiveContainer } from '@/components/layout';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useTheme, useThemedColors } from '@/hooks/useTheme';

type TravelLikeItem = {
  id: string | number;
  title?: string | null;
  imageUrl?: string | null;
  url: string;
  country?: string | null;
  city?: string | null;
};

function handleHorizontalWheelForElement(e: any, el: any) {
  if (Platform.OS !== 'web') return;
  if (!el || typeof (el as any).scrollLeft !== 'number') return;

  const deltaY = Number(e?.deltaY ?? 0);
  const deltaX = Number(e?.deltaX ?? 0);
  if (!deltaY || Math.abs(deltaY) <= Math.abs(deltaX)) return;

  const maxScrollLeft = (el.scrollWidth ?? 0) - (el.clientWidth ?? 0);
  if (maxScrollLeft <= 0) return;

  if (e?.cancelable) e.preventDefault?.();
  (el as any).scrollLeft += deltaY;
}

function SectionHeader({
  title,
  count,
  onSeeAll,
  testID,
  styles,
  colors,
}: {
  title: string;
  count: number;
  onSeeAll: () => void;
  testID: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useThemedColors>;
}) {
  return (
    <View style={styles.sectionHeaderRow} testID={testID}>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{count} шт.</Text>
      </View>

      <Pressable
        onPress={onSeeAll}
        style={({ pressed, hovered }) => [
          styles.seeAllButton,
          (pressed || hovered) && styles.seeAllButtonHover,
          globalFocusStyles.focusable,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Смотреть все: ${title}`}
        {...Platform.select({ web: { cursor: 'pointer' } })}
      >
        <Text style={styles.seeAllButtonText}>Смотреть все</Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function HorizontalCards({
  data,
  badge,
  onPressItem,
  testID,
  colors,
  styles,
}: {
  data: TravelLikeItem[];
  badge?: { icon: 'clock' | 'favorite' };
  onPressItem: (url: string) => void;
  testID: string;
  colors: ReturnType<typeof useThemedColors>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { isDark } = useTheme();
  const scrollRef = useRef<any>(null);
  const historyBadge =
    badge?.icon === 'clock'
      ? {
          icon: 'clock' as const,
          backgroundColor: colors.overlay,
          iconColor: isDark ? colors.text : colors.textOnDark,
        }
      : undefined;

  const resolveScrollElement = useCallback(() => {
    const target = scrollRef.current as any;
    return target?._nativeNode || target?._domNode || target;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const el = resolveScrollElement();
    if (!el || typeof el.addEventListener !== 'function') return;

    const onWheel = (e: any) => {
      handleHorizontalWheelForElement(e, el);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel as any);
    };
  }, [resolveScrollElement]);

  if (Platform.OS === 'web') {
    return (
      <ScrollView
        testID={testID}
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalList}
        contentContainerStyle={styles.horizontalListContent}
      >
        {data.map((item) => (
          <TabTravelCard
            key={String(item.id)}
            item={{
              id: item.id,
              title: item.title,
              imageUrl: item.imageUrl,
              city: item.city ?? null,
              country: item.country ?? (item as any).countryName ?? null,
            }}
            badge={historyBadge}
            onPress={() => onPressItem(item.url)}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <FlatList
      testID={testID}
      horizontal
      data={data}
      renderItem={({ item }) => (
        <TabTravelCard
          item={{
            id: item.id,
            title: item.title,
            imageUrl: item.imageUrl,
            city: item.city ?? null,
            country: item.country ?? (item as any).countryName ?? null,
          }}
          badge={historyBadge}
          onPress={() => onPressItem(item.url)}
        />
      )}
      keyExtractor={(item) => `${String(item.id)}-${item.url}`}
      showsHorizontalScrollIndicator={false}
      style={styles.horizontalList}
      contentContainerStyle={styles.horizontalListContent}
      scrollEventThrottle={Platform.select({ web: 32, default: 16 })}
      nestedScrollEnabled={Platform.OS === 'android'}
      directionalLockEnabled={Platform.OS === 'ios'}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      bounces={Platform.OS === 'ios'}
      decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
      {...Platform.select({ web: { style: [styles.horizontalList, { touchAction: 'pan-x' } as any] } })}
    />
  );
}

export default function HomeFavoritesHistorySection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { favorites, viewHistory, ensureServerData } = useFavorites() as any;
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof ensureServerData !== 'function') return;

    ensureServerData('favorites');
    ensureServerData('history');
  }, [ensureServerData, isAuthenticated]);

  const favoritesData = useMemo(() => {
    const arr = Array.isArray(favorites) ? favorites : [];
    return arr
      .filter((item: any) => item && item.url)
      .slice(0, 10)
      .map(
        (item: any): TravelLikeItem => ({
          id: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          url: item.url,
          country: item.country ?? null,
          city: item.city ?? null,
        })
      );
  }, [favorites]);

  const historyData = useMemo(() => {
    const arr = Array.isArray(viewHistory) ? viewHistory : [];
    return arr
      .filter((item: any) => item && item.url)
      .slice(0, 10)
      .map(
        (item: any): TravelLikeItem => ({
          id: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          url: item.url,
          country: item.country ?? null,
          city: item.city ?? null,
        })
      );
  }, [viewHistory]);

  if (!isAuthenticated) {
    return null;
  }

  // If both are empty we don't show the block (keeps home clean)
  if (favoritesData.length === 0 && historyData.length === 0) {
    return null;
  }

  const openUrl = (url: string) => {
    router.push(url as any);
  };

  return (
    <View style={styles.band} testID="home-favorites-history">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.container}>
          {favoritesData.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Избранное"
                count={favoritesData.length}
                onSeeAll={() => router.push('/favorites' as any)}
                testID="home-favorites-header"
                styles={styles}
                colors={colors}
              />
              <HorizontalCards
                data={favoritesData}
                onPressItem={openUrl}
                testID="home-favorites-list"
                colors={colors}
                styles={styles}
              />
            </View>
          )}

          {historyData.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="История"
                count={historyData.length}
                onSeeAll={() => router.push('/history' as any)}
                testID="home-history-header"
                styles={styles}
                colors={colors}
              />
              <HorizontalCards
                data={historyData}
                badge={{ icon: 'clock' }}
                onPressItem={openUrl}
                testID="home-history-list"
                colors={colors}
                styles={styles}
              />
            </View>
          )}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    band: {
      paddingVertical: 56,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
    },
    container: {
      gap: 48,
      width: '100%',
    },
    section: {
      gap: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 30,
    },
    sectionSubtitle: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '500',
      color: colors.textMuted,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    seeAllButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    seeAllButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    horizontalList: {
      width: '100%',
      ...Platform.select({
        web: {
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
        } as any,
        default: {},
      }),
    },
    horizontalListContent: {
      paddingTop: 8,
      paddingBottom: 4,
      flexDirection: 'row',
      ...Platform.select({
        web: {
          minWidth: 'max-content',
        } as any,
        default: {},
      }),
    },
  });
