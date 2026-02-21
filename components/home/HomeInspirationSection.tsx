import React, { useMemo, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive, useResponsiveColumns } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { fetchTravelsPopular, fetchTravelsOfMonth, fetchTravelsRandom } from '@/api/map';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ResponsiveContainer } from '@/components/layout';
import Button from '@/components/ui/Button';
import { queryConfigs } from '@/utils/reactQueryConfig';

interface HomeSectionProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  fetchFn: (options?: { signal?: AbortSignal }) => Promise<any>;
  hideAuthor?: boolean;
  centerRowsOnWebDesktop?: boolean;
}

const FILTER_GROUPS = [
  {
    title: 'Тип маршрута',
    icon: 'layers',
    chips: [
      { label: 'Поход / хайкинг', filterParams: 'categories=2,21' },
      { label: 'Город',           filterParams: 'categories=19,20' },
      { label: 'Треккинг',        filterParams: 'categories=22' },
      { label: 'Велопоход',       filterParams: 'categories=7' },
      { label: 'Автопутешествие', filterParams: 'categories=6' },
    ],
  },
  {
    title: 'Ночлег',
    icon: 'moon',
    chips: [
      { label: 'Без ночлега',     filterParams: 'over_nights_stay=8',   route: '/search' },
      { label: 'Палатка',         filterParams: 'over_nights_stay=1',   route: '/search' },
      { label: 'Гостиница',       filterParams: 'over_nights_stay=2',   route: '/search' },
      { label: 'Квартира / дом',  filterParams: 'over_nights_stay=3,4', route: '/search' },
    ],
  },
  {
    title: 'Сезон',
    icon: 'calendar',
    chips: [
      { label: 'Весна', filterParams: 'month=3,4,5',   route: '/search' },
      { label: 'Лето',  filterParams: 'month=6,7,8',   route: '/search' },
      { label: 'Осень', filterParams: 'month=9,10,11', route: '/search' },
      { label: 'Зима',  filterParams: 'month=12,1,2',  route: '/search' },
    ],
  },
  {
    title: 'Расстояние на карте',
    icon: 'map-pin',
    chips: [
      { label: 'До 30 км',   filterParams: 'radius=30',  route: '/map' },
      { label: 'До 60 км',   filterParams: 'radius=60',  route: '/map' },
      { label: 'До 100 км',  filterParams: 'radius=100', route: '/map' },
      { label: 'До 200 км',  filterParams: 'radius=200', route: '/map' },
    ],
  },
];

const EMPTY_STATE_TEXT: Record<string, { title: string; subtitle: string }> = {
  'home-travels-of-month': {
    title: 'Новая подборка уже в пути',
    subtitle: 'Скоро добавим свежие идеи для ближайших выходных.',
  },
  'home-popular-travels': {
    title: 'Ещё мало данных по популярности',
    subtitle: 'Откройте каталог и выберите маршрут по фильтрам.',
  },
  'home-random-travels': {
    title: 'Случайная идея пока не загрузилась',
    subtitle: 'Попробуйте каталог или вернитесь к подборке чуть позже.',
  },
};

function HomeInspirationSection({
  title,
  subtitle,
  queryKey,
  fetchFn,
  hideAuthor = false,
  centerRowsOnWebDesktop = false,
}: HomeSectionProps) {
  const router = useRouter();
  const colors = useThemedColors();
  const { isPhone, isLargePhone, width: viewportWidth } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const isWebDesktop = Platform.OS === 'web' && !isMobile;

  const numColumns = useResponsiveColumns({
    tablet: 2,
    largeTablet: 3,
    desktop: 3,
    largeDesktop: 4,
    default: 1,
  });

  const { data: travelData = {}, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: ({ signal } = {} as any) => fetchFn({ signal }),
    ...queryConfigs.dynamic,
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
    
    return arr.slice(0, isMobile ? 4 : numColumns <= 3 ? 6 : 8);
  }, [travelData, isMobile, numColumns]);

  const handleViewMore = useCallback(() => {
    sendAnalyticsEvent('HomeClick_ViewMore', { section: title });
    router.push('/search' as any);
  }, [title, router]);

  const handleOpenArticles = useCallback(() => {
    sendAnalyticsEvent('HomeClick_OpenSearch', { section: title });
    router.push('/search' as any);
  }, [title, router]);

  const sectionBadge = useMemo(() => {
    if (queryKey === 'home-travels-of-month') return { icon: 'zap', label: 'Идеи сезона' };
    if (queryKey === 'home-popular-travels') return { icon: 'trending-up', label: 'Выбор сообщества' };
    return { icon: 'shuffle', label: 'Маршрут-сюрприз' };
  }, [queryKey]);

  const viewMoreLabel = isMobile ? 'Все маршруты' : 'Смотреть все маршруты';
  const articlesLabel = isMobile ? 'Все маршруты' : 'Смотреть все маршруты';
  const emptyState = EMPTY_STATE_TEXT[queryKey] ?? {
    title: 'Пока здесь пусто',
    subtitle: 'Попробуйте открыть каталог маршрутов.',
  };

  const styles = useMemo(() => StyleSheet.create({
    section: {
      gap: 24,
    },
    sectionMobile: {
      gap: 18,
    },
    sectionFrame: {
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      padding: isMobile ? 14 : 24,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.modal,
          backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backdropFilter: 'blur(12px)',
        } as any,
      }),
    },
    sectionGlow: {
      position: 'absolute',
      top: -72,
      right: -86,
      width: 260,
      height: 180,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      opacity: 0.45,
      ...Platform.select({
        web: {
          filter: 'blur(1px)',
        },
      }),
    },
    sectionAccent: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: 4,
      backgroundColor: colors.primaryAlpha40,
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
      justifyContent: 'flex-start',
      gap: 12,
    },
    titleContainer: {
      flex: 1,
      gap: 10,
      minWidth: 0,
    },
    headerActions: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 10,
      flexShrink: 0,
    },
    sectionBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 4,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    sectionBadgeText: {
      color: colors.text,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 38,
      letterSpacing: -0.6,
    },
    titleMobile: {
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 23,
    },
    subtitleMobile: {
      fontSize: 13,
      lineHeight: 18,
    },
    viewMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: isMobile ? 12 : 20,
      paddingVertical: isMobile ? 8 : 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    viewMoreButtonMobile: {
      flexShrink: 0,
      width: '100%',
    },
    viewMoreButtonHover: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    viewMoreText: {
      fontSize: isMobile ? 13 : 15,
      fontWeight: '600',
      color: colors.text,
    },
    articlesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: isMobile ? 12 : 18,
      paddingVertical: isMobile ? 8 : 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    articlesButtonHover: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    articlesButtonText: {
      color: colors.text,
      fontSize: isMobile ? 13 : 15,
      lineHeight: isMobile ? 18 : 20,
      fontWeight: '700',
    },
    grid: {
      width: '100%',
      gap: 18,
      ...Platform.select({
        web: {
          touchAction: 'pan-y',
        } as any,
      }),
    },
    row: {
      flexDirection: 'row',
      gap: 18,
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      width: '100%',
      ...Platform.select({
        web: {
          justifyContent: 'flex-start',
          touchAction: 'pan-y',
        } as any,
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
      minHeight: isMobile ? 0 : 360,
      ...Platform.select({
        web: {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          alignSelf: 'stretch',
          touchAction: 'pan-y',
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
    },
    emptyState: {
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 14 : 20,
      paddingVertical: isMobile ? 16 : 22,
      alignItems: 'flex-start',
      gap: 10,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    emptyStateIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    emptyStateTitle: {
      color: colors.text,
      fontSize: isMobile ? 16 : 18,
      lineHeight: isMobile ? 22 : 24,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    emptyStateSubtitle: {
      color: colors.textMuted,
      fontSize: isMobile ? 13 : 14,
      lineHeight: isMobile ? 18 : 20,
    },
  }), [colors, isMobile]);

  if (isLoading) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View style={styles.sectionFrame}>
          <View style={styles.sectionGlow} />
          <View style={styles.sectionAccent} />
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
      </View>
    );
  }

  return (
    <View style={[styles.section, isMobile && styles.sectionMobile]}>
      <View style={styles.sectionFrame}>
        <View style={styles.sectionGlow} />
        <View style={styles.sectionAccent} />
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.titleContainer}>
            <View style={styles.sectionBadge}>
              <Feather name={sectionBadge.icon as any} size={12} color={colors.primary} />
              <Text style={styles.sectionBadgeText}>{sectionBadge.label}</Text>
            </View>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
            {subtitle && <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>{subtitle}</Text>}
          </View>
          <View style={styles.headerActions}>
            <Button
              label={viewMoreLabel}
              onPress={handleViewMore}
              accessibilityLabel={`Открыть каталог маршрутов для секции «${title}»`}
              icon={<Feather name="arrow-right" size={16} color={colors.text} />}
              iconPosition="right"
              variant="secondary"
              style={[styles.viewMoreButton, isMobile && styles.viewMoreButtonMobile]}
              labelStyle={styles.viewMoreText}
              hoverStyle={styles.viewMoreButtonHover}
              pressedStyle={styles.viewMoreButtonHover}
            />

            <Button
              label={articlesLabel}
              onPress={handleOpenArticles}
              accessibilityLabel={`Открыть каталог маршрутов для секции «${title}»`}
              icon={<Feather name="compass" size={15} color={colors.primaryText} />}
              variant="secondary"
              style={[styles.articlesButton, isMobile && styles.viewMoreButtonMobile]}
              labelStyle={styles.articlesButtonText}
              hoverStyle={styles.articlesButtonHover}
              pressedStyle={styles.articlesButtonHover}
            />
          </View>
        </View>

        {travelsList.length === 0 ? (
          <View style={styles.emptyState} testID={`home-empty-${queryKey}`}>
            <View style={styles.emptyStateIconWrap}>
              <Feather name="compass" size={16} color={colors.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>{emptyState.title}</Text>
            <Text style={styles.emptyStateSubtitle}>{emptyState.subtitle}</Text>
            <Button
              label="Открыть каталог"
              onPress={handleViewMore}
              variant="secondary"
              icon={<Feather name="arrow-right" size={16} color={colors.text} />}
              iconPosition="right"
              style={[styles.viewMoreButton, isMobile && styles.viewMoreButtonMobile]}
              labelStyle={styles.viewMoreText}
              hoverStyle={styles.viewMoreButtonHover}
              pressedStyle={styles.viewMoreButtonHover}
            />
            <Button
              label="Смотреть все маршруты"
              onPress={handleOpenArticles}
              variant="secondary"
              icon={<Feather name="compass" size={15} color={colors.primaryText} />}
              style={[styles.articlesButton, isMobile && styles.viewMoreButtonMobile]}
              labelStyle={styles.articlesButtonText}
              hoverStyle={styles.articlesButtonHover}
              pressedStyle={styles.articlesButtonHover}
            />
          </View>
        ) : (
          <View style={styles.grid}>
            {numColumns === 1
              ? travelsList.map((item: any, index: number) => {
                  const key = item?.id != null && String(item.id).length > 0
                    ? String(item.id)
                    : item?.url ? String(item.url) : `${queryKey}-${index}`;
                  return (
                    <React.Fragment key={key}>
                      {index > 0 && <Separator />}
                      <View
                        style={[
                          styles.cardWrapper,
                          isMobile && styles.cardWrapperMobile,
                          styles.cardWrapperSingleColumn,
                        ]}
                      >
                        <RenderTravelItem
                          item={item}
                          index={index}
                          isMobile={isMobile}
                          hideAuthor={hideAuthor}
                          viewportWidth={viewportWidth}
                          visualVariant="home-featured"
                        />
                      </View>
                    </React.Fragment>
                  );
                })
              : chunkArray(travelsList, numColumns).map((row: any[], rowIdx: number) => (
                  <View
                    key={`row-${rowIdx}`}
                    style={[
                      styles.row,
                      isWebDesktop && centerRowsOnWebDesktop ? styles.rowWebCentered : null,
                    ]}
                  >
                    {row.map((item: any, colIdx: number) => {
                      const index = rowIdx * numColumns + colIdx;
                      const key = item?.id != null && String(item.id).length > 0
                        ? String(item.id)
                        : item?.url ? String(item.url) : `${queryKey}-${index}`;
                      return (
                        <View
                          key={key}
                          style={[
                            styles.cardWrapper,
                            isMobile && styles.cardWrapperMobile,
                          ]}
                        >
                          <RenderTravelItem
                            item={item}
                            index={index}
                            isMobile={isMobile}
                            hideAuthor={hideAuthor}
                            viewportWidth={viewportWidth}
                            visualVariant="home-featured"
                          />
                        </View>
                      );
                    })}
                  </View>
                ))
            }
          </View>
        )}
      </View>
    </View>
  );
}

function chunkArray<T>(array: T[], columns: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += columns) result.push(array.slice(i, i + columns));
  return result;
}

const separatorStyles = StyleSheet.create({
  separator: {
    height: 20,
  },
});

function Separator() {
  return <View style={separatorStyles.separator} />;
}

function HomeInspirationSections() {
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const colors = useThemedColors();
  const isMobile = isPhone || isLargePhone;

  const handleFilterPress = useCallback(
    (label: string, filterParams?: string, route?: string) => {
      sendAnalyticsEvent('HomeClick_QuickFilter', { label });
      const base = route ?? '/search';
      const path = filterParams ? `${base}?${filterParams}` : base;
      router.push(path as any);
    },
    [router],
  );

  const handleOpenArticles = useCallback(() => {
    sendAnalyticsEvent('HomeClick_OpenSearch', { source: 'home-filter-block' });
    router.push('/search' as any);
  }, [router]);

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingVertical: 64,
      backgroundColor: colors.backgroundSecondary,
      width: '100%',
      alignSelf: 'stretch',
      ...Platform.select({
        web: {
          backgroundImage: `radial-gradient(ellipse 92% 72% at 50% -2%, ${colors.primarySoft} 0%, transparent 72%), linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`,
          backgroundRepeat: 'no-repeat',
        },
      }),
    },
    bandMobile: {
      paddingVertical: 40,
    },
    container: {
      gap: 52,
      width: '100%',
      alignSelf: 'stretch',
    },
    containerMobile: {
      gap: 32,
    },
    quickFiltersSection: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      padding: isMobile ? 16 : 24,
      gap: isMobile ? 14 : 18,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.modal,
          backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
          backdropFilter: 'blur(12px)',
        },
      }),
    },
    quickFiltersHeader: {
      gap: 8,
    },
    quickFiltersBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 4,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    quickFiltersBadgeText: {
      color: colors.text,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    quickFiltersTitle: {
      color: colors.text,
      fontSize: isMobile ? 22 : 28,
      lineHeight: isMobile ? 28 : 35,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    quickFiltersSubtitle: {
      color: colors.textMuted,
      fontSize: isMobile ? 13 : 15,
      lineHeight: isMobile ? 19 : 22,
    },
    quickFiltersLinks: {
      marginTop: 4,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    quickFiltersHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      flexShrink: 1,
      maxWidth: 620,
    },
    quickFiltersArticlesButton: {
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 14,
      paddingVertical: 9,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    quickFiltersArticlesButtonHover: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    quickFiltersArticlesText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    quickFiltersGroups: {
      gap: 10,
    },
    filterGroupRow: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 12 : 14,
      paddingVertical: isMobile ? 11 : 12,
    },
    filterGroupTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: isMobile ? 0 : 152,
    },
    filterGroupIconWrap: {
      width: 28,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterGroupTitleText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    chipsWrap: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 11,
      paddingVertical: 7,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    chipHover: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    chipText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
  }), [colors, isMobile]);

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.quickFiltersSection}>
            <View style={styles.quickFiltersHeader}>
              <View style={styles.quickFiltersBadge}>
                <Feather name="filter" size={12} color={colors.primary} />
                <Text style={styles.quickFiltersBadgeText}>Быстрый старт</Text>
              </View>
              <Text style={styles.quickFiltersTitle}>Подберите поездку под свой ритм</Text>
              <Text style={styles.quickFiltersSubtitle}>
                Комбинируйте расстояние, формат, длительность и сезон и сразу получайте подходящие маршруты.
              </Text>
              <View style={styles.quickFiltersLinks}>
                <Text style={styles.quickFiltersHint}>
                  Хотите посмотреть, как это выглядит на практике? Откройте каталог с готовыми маршрутами.
                </Text>
                <Button
                  label="Смотреть маршруты"
                  onPress={handleOpenArticles}
                  variant="secondary"
                  icon={<Feather name="compass" size={15} color={colors.primaryText} />}
                  style={styles.quickFiltersArticlesButton}
                  labelStyle={styles.quickFiltersArticlesText}
                  hoverStyle={styles.quickFiltersArticlesButtonHover}
                  pressedStyle={styles.quickFiltersArticlesButtonHover}
                />
              </View>
            </View>

            <View style={styles.quickFiltersGroups}>
              {FILTER_GROUPS.map((group) => (
                <View key={group.title} style={styles.filterGroupRow}>
                  <View style={styles.filterGroupTitle}>
                    <View style={styles.filterGroupIconWrap}>
                      <Feather name={group.icon as any} size={14} color={colors.primary} />
                    </View>
                    <Text style={styles.filterGroupTitleText}>{group.title}</Text>
                  </View>
                  <View style={styles.chipsWrap}>
                    {group.chips.map((chip) => (
                      <Pressable
                        key={chip.label}
                        onPress={() => handleFilterPress(chip.label, chip.filterParams, (chip as any).route)}
                        style={({ pressed, hovered }) => [
                          styles.chip,
                          (pressed || hovered) && styles.chipHover,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Фильтр ${chip.label}`}
                      >
                        <Text style={styles.chipText}>{chip.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <HomeInspirationSection
            title="Маршруты на ближайшие выходные"
            subtitle="Реальные поездки, которые можно успеть за 1-2 дня"
            queryKey="home-travels-of-month"
            fetchFn={fetchTravelsOfMonth}
          />

          <HomeInspirationSection
            title="Что сейчас выбирают чаще всего"
            subtitle="Маршруты, которые пользователи чаще сохраняют в свои книги"
            queryKey="home-popular-travels"
            fetchFn={fetchTravelsPopular}
            hideAuthor
          />

          <HomeInspirationSection
            title="Не хотите выбирать долго?"
            subtitle="Откройте случайный маршрут для спонтанного выезда"
            queryKey="home-random-travels"
            fetchFn={fetchTravelsRandom}
            hideAuthor
          />
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeInspirationSections);
