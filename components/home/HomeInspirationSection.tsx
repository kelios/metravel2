import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive, useResponsiveColumns } from '@/hooks/useResponsive';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { fetchTravelsPopular, fetchTravelsOfMonth } from '@/src/api/map';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ResponsiveContainer } from '@/components/layout';
import { TRAVEL_CARD_MAX_WIDTH } from '@/components/listTravel/utils/listTravelConstants';

interface HomeSectionProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  fetchFn: () => Promise<any>;
  hideAuthor?: boolean;
  centerRowsOnWebDesktop?: boolean;
}

function HomeInspirationSection({
  title,
  subtitle,
  queryKey,
  fetchFn,
  hideAuthor = false,
  centerRowsOnWebDesktop = false,
}: HomeSectionProps) {
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const isWebDesktop = Platform.OS === 'web' && !isMobile;

  const numColumns = useResponsiveColumns({
    tablet: 2,
    largeTablet: 2,
    desktop: 3,
    default: 1,
  });

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
            {Array.from({ length: isMobile ? 1 : 3 }).map((_, index) => (
              <View key={index} style={[styles.cardWrapper, isMobile && styles.cardWrapperMobile]}>
                <SkeletonLoader width="100%" height={isMobile ? 320 : 360} borderRadius={12} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.section, isMobile && styles.sectionMobile]}>
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>{subtitle}</Text>}
        </View>
        <Pressable
          onPress={handleViewMore}
          style={({ pressed, hovered }) => [
            styles.viewMoreButton,
            isMobile && styles.viewMoreButtonMobile,
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
        key={`inspiration-grid-${numColumns}`}
        data={travelsList}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.cardWrapper,
              isMobile && styles.cardWrapperMobile,
              numColumns === 1 ? styles.cardWrapperSingleColumn : null,
            ]}
          >
            <RenderTravelItem item={item} index={index} isMobile={isMobile} hideAuthor={hideAuthor} />
          </View>
        )}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        scrollEnabled={false}
        numColumns={numColumns}
        ItemSeparatorComponent={numColumns === 1 ? Separator : undefined}
        columnWrapperStyle={
          numColumns === 1
            ? undefined
            : [
                styles.row,
                isWebDesktop && centerRowsOnWebDesktop ? styles.rowWebCentered : null,
              ]
        }
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export default function HomeInspirationSections() {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.container}>
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
            hideAuthor
          />
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingVertical: 72,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    width: '100%',
    alignSelf: 'stretch',
  },
  bandMobile: {
    paddingVertical: 56,
  },
  container: {
    gap: 72,
    width: '100%',
    alignSelf: 'stretch',
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
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 8,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 20,
  },
  titleContainer: {
    flex: 1,
    gap: 8,
    minWidth: 0,
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
    justifyContent: 'center',
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
  viewMoreButtonMobile: {
    width: '100%',
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
    width: '100%',
    gap: 20,
  },
  separator: {
    height: 20,
  },
  row: {
    gap: 20,
    justifyContent: 'flex-start',
    width: '100%',
    ...Platform.select({
      web: {
        justifyContent: 'flex-start',
      },
    }),
  },
  rowWebCentered: {
    justifyContent: 'center',
  },
  cardWrapper: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 360,
    ...Platform.select({
      web: {
        // На web desktop фиксируем ширину карточки, чтобы неполный ряд
        // (например 2 карточки при numColumns=3) не растягивался с огромными пустотами.
        width: TRAVEL_CARD_MAX_WIDTH,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
      } as any,
    }),
  },
  cardWrapperSingleColumn: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'stretch',
  },
  cardWrapperMobile: {
    width: '100%',
    minWidth: 150,
    minHeight: 320,
  },
});
