import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { globalFocusStyles } from '@/styles/globalFocus';

type TravelLikeItem = {
  id: string | number;
  title?: string | null;
  imageUrl?: string | null;
  url: string;
  country?: string | null;
  city?: string | null;
};

function SectionHeader({
  title,
  count,
  onSeeAll,
  testID,
}: {
  title: string;
  count: number;
  onSeeAll: () => void;
  testID: string;
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
        <Feather name="chevron-right" size={16} color={DESIGN_TOKENS.colors.primary} />
      </Pressable>
    </View>
  );
}

function HorizontalCards({
  data,
  badge,
  onPressItem,
  testID,
}: {
  data: TravelLikeItem[];
  badge?: { icon: 'history' | 'favorite' };
  onPressItem: (url: string) => void;
  testID: string;
}) {
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
          badge={
            badge?.icon === 'history'
              ? { icon: 'history', backgroundColor: 'rgba(0,0,0,0.7)', iconColor: '#fff' }
              : undefined
          }
          onPress={() => onPressItem(item.url)}
        />
      )}
      keyExtractor={(item) => `${String(item.id)}-${item.url}`}
      showsHorizontalScrollIndicator={false}
      style={styles.horizontalList}
      contentContainerStyle={styles.horizontalListContent}
    />
  );
}

export default function HomeFavoritesHistorySection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { favorites, viewHistory, ensureServerData } = useFavorites() as any;

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
              />
              <HorizontalCards
                data={favoritesData}
                onPressItem={openUrl}
                testID="home-favorites-list"
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
              />
              <HorizontalCards
                data={historyData}
                badge={{ icon: 'history' }}
                onPressItem={openUrl}
                testID="home-history-list"
              />
            </View>
          )}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingVertical: 56,
    backgroundColor: DESIGN_TOKENS.colors.background,
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
    color: DESIGN_TOKENS.colors.text,
    lineHeight: 30,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
  },
  seeAllButtonHover: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  seeAllButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  horizontalList: {
    width: '100%',
  },
  horizontalListContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
});
