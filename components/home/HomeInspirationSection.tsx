import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { fetchTravelsPopular, fetchTravelsOfMonth } from '@/src/api/map';
import TravelCardCompact from '@/components/TravelCardCompact';
import { SkeletonLoader } from '@/components/SkeletonLoader';

interface HomeSectionProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  fetchFn: () => Promise<any>;
}

function HomeInspirationSection({ title, subtitle, queryKey, fetchFn }: HomeSectionProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  const { data: travelData = {}, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: fetchFn,
    staleTime: 5 * 60 * 1000,
  });

  const travelsList = useMemo(() => {
    // Обработка разных форматов ответа от API
    let arr: any[] = [];
    
    if (Array.isArray(travelData)) {
      arr = travelData;
    } else if (travelData?.data && Array.isArray(travelData.data)) {
      arr = travelData.data;
    } else if (travelData?.results && Array.isArray(travelData.results)) {
      arr = travelData.results;
    } else if (typeof travelData === 'object') {
      // Для TravelsMap формата (ключи - это ID путешествий)
      arr = Object.values(travelData).filter(item => item && typeof item === 'object');
    }
    
    return arr.slice(0, isMobile ? 4 : 6);
  }, [travelData, isMobile]);

  const handleViewMore = () => {
    sendAnalyticsEvent('HomeClick_ViewMore', { section: title });
    router.push('/search' as any);
  };

  if (isLoading) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <SkeletonLoader width={isMobile ? 200 : 300} height={isMobile ? 24 : 36} borderRadius={8} style={{ marginBottom: 8 }} />
            <SkeletonLoader width={isMobile ? 150 : 250} height={isMobile ? 14 : 16} borderRadius={4} />
          </View>
          <SkeletonLoader width={isMobile ? 140 : 180} height={44} borderRadius={8} />
        </View>
        <View style={styles.grid}>
          <View style={styles.row}>
            {Array.from({ length: isMobile ? 2 : 3 }).map((_, index) => (
              <View key={index} style={[styles.cardWrapper, isMobile && styles.cardWrapperMobile]}>
                <SkeletonLoader width="100%" height={isMobile ? 240 : 280} borderRadius={12} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.section, isMobile && styles.sectionMobile]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>{subtitle}</Text>}
        </View>
        <Pressable
          onPress={handleViewMore}
          style={({ pressed, hovered }) => [
            styles.viewMoreButton,
            (pressed || hovered) && styles.viewMoreButtonHover,
            globalFocusStyles.focusable,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Смотреть все ${title}`}
        >
          <Text style={styles.viewMoreText}>Найти ещё маршруты</Text>
          <Feather name="arrow-right" size={16} color={DESIGN_TOKENS.colors.text} />
        </Pressable>
      </View>

      <FlatList
        key={`inspiration-grid-${isMobile ? 2 : 3}`}
        data={travelsList}
        renderItem={({ item }) => (
          <View style={[styles.cardWrapper, isMobile && styles.cardWrapperMobile]}>
            <TravelCardCompact travel={item} />
          </View>
        )}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        scrollEnabled={false}
        numColumns={isMobile ? 2 : 3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

export default function HomeInspirationSections() {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <HomeInspirationSection
        title="Куда отправиться в этом месяце"
        subtitle="Истории путешественников, которые вдохновляют"
        queryKey="home-travels-of-month"
        fetchFn={() => fetchTravelsOfMonth()}
      />

      <HomeInspirationSection
        title="Популярные направления"
        subtitle="Маршруты, которые выбирают чаще всего"
        queryKey="home-popular-travels"
        fetchFn={() => fetchTravelsPopular()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 60,
    paddingVertical: 80,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    gap: 80,
  },
  containerMobile: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    gap: 60,
  },
  section: {
    gap: 32,
  },
  sectionMobile: {
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: DESIGN_TOKENS.colors.text,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 24,
  },
  subtitleMobile: {
    fontSize: 14,
    lineHeight: 20,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  viewMoreButtonHover: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderColor: DESIGN_TOKENS.colors.primary,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.light,
      },
    }),
  },
  viewMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
  },
  grid: {
    gap: 20,
  },
  row: {
    gap: 20,
  },
  cardWrapper: {
    flex: 1,
    minHeight: 280,
  },
  cardWrapperMobile: {
    minHeight: 240,
  },
});
