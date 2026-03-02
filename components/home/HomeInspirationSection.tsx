import React, { useMemo, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive, useResponsiveColumns } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { fetchTravelsPopular, fetchTravelsOfMonth, fetchTravelsRandom } from '@/api/map';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ResponsiveContainer } from '@/components/layout';
import Button from '@/components/ui/Button';
import { queryConfigs } from '@/utils/reactQueryConfig';
import { createSectionStyles, createSectionsStyles } from './homeInspirationStyles';

interface HomeSectionProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  fetchFn: (options?: { signal?: AbortSignal }) => Promise<any>;
  hideAuthor?: boolean;
  centerRowsOnWebDesktop?: boolean;
}

type QuickFilterValue = string | number | Array<string | number>;
type QuickFilterParams = Record<string, QuickFilterValue | undefined>;

const normalizeQuickFilterValue = (value: QuickFilterValue | undefined): string | null => {
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0);
    if (!cleaned.length) return null;
    return cleaned.join(',');
  }

  const scalar = String(value).trim();
  return scalar.length > 0 ? scalar : null;
};

const buildFilterPath = (base: string, params?: QuickFilterParams) => {
  if (!params) return base;

  const query = Object.entries(params)
    .map(([key, value]) => {
      const normalized = normalizeQuickFilterValue(value);
      if (!normalized) return null;
      return `${key}=${normalized}`;
    })
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .join('&');

  return query.length > 0 ? `${base}?${query}` : base;
};

const FILTER_GROUPS = [
  {
    title: 'Тип маршрута',
    icon: 'layers',
    chips: [
      { label: 'Поход / хайкинг', filters: { categories: [2, 21] } },
      { label: 'Город',           filters: { categories: [19, 20] } },
      { label: 'Треккинг',        filters: { categories: [22] } },
      { label: 'Велопоход',       filters: { categories: [7] } },
      { label: 'Автопутешествие', filters: { categories: [6] } },
    ],
  },
  {
    title: 'Ночлег',
    icon: 'moon',
    chips: [
      { label: 'Без ночлега',     filters: { over_nights_stay: [8] }, route: '/search' },
      { label: 'Палатка',         filters: { over_nights_stay: [1] }, route: '/search' },
      { label: 'Гостиница',       filters: { over_nights_stay: [2] }, route: '/search' },
      { label: 'Квартира / дом',  filters: { over_nights_stay: [3, 4] }, route: '/search' },
    ],
  },
  {
    title: 'Сезон',
    icon: 'calendar',
    chips: [
      { label: 'Весна', filters: { month: [3, 4, 5] }, route: '/search' },
      { label: 'Лето',  filters: { month: [6, 7, 8] }, route: '/search' },
      { label: 'Осень', filters: { month: [9, 10, 11] }, route: '/search' },
      { label: 'Зима',  filters: { month: [12, 1, 2] }, route: '/search' },
    ],
  },
  {
    title: 'Объекты',
    icon: 'map',
    chips: [
      { label: 'Озеро', filters: { categoryTravelAddress: [84] }, route: '/search' },
      { label: 'Гора', filters: { categoryTravelAddress: [26] }, route: '/search' },
      { label: 'Водопад', filters: { categoryTravelAddress: [20] }, route: '/search' },
      { label: 'Бухта', filters: { categoryTravelAddress: [18] }, route: '/search' },
    ],
  },
  {
    title: 'Расстояние на карте',
    icon: 'map-pin',
    chips: [
      { label: 'До 30 км',   filters: { radius: 30 }, route: '/map' },
      { label: 'До 60 км',   filters: { radius: 60 }, route: '/map' },
      { label: 'До 100 км',  filters: { radius: 100 }, route: '/map' },
      { label: 'До 200 км',  filters: { radius: 200 }, route: '/map' },
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

  const sectionBadge = useMemo(() => {
    if (queryKey === 'home-travels-of-month') return { icon: 'zap', label: 'Идеи сезона', color: 'warning' };
    if (queryKey === 'home-popular-travels') return { icon: 'trending-up', label: 'Выбор сообщества', color: 'primary' };
    return { icon: 'shuffle', label: 'Маршрут-сюрприз', color: 'success' };
  }, [queryKey]);

  const viewMoreLabel = isMobile ? 'Все маршруты' : 'Смотреть все маршруты';
  const emptyState = EMPTY_STATE_TEXT[queryKey] ?? {
    title: 'Пока здесь пусто',
    subtitle: 'Попробуйте открыть каталог маршрутов.',
  };

  const styles = useMemo(() => createSectionStyles(colors, isMobile), [colors, isMobile]);

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
            <View style={[
              styles.sectionBadge,
              sectionBadge.color === 'warning' && { backgroundColor: colors.warningSoft ?? colors.primarySoft, borderColor: colors.warningAlpha40 ?? colors.primaryAlpha30 },
              sectionBadge.color === 'success' && { backgroundColor: colors.successSoft, borderColor: colors.primaryAlpha30 },
            ]}>
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
          </View>
        </View>

        {travelsList.length === 0 ? (
          <View style={styles.emptyState} testID={`home-empty-${queryKey}`}>
            <View style={styles.emptyStateIconWrap}>
              <Feather name="compass" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyStateTitle, { textAlign: 'center' }]}>{emptyState.title}</Text>
            <Text style={[styles.emptyStateSubtitle, { textAlign: 'center' }]}>{emptyState.subtitle}</Text>
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
              : chunkArray(travelsList, numColumns).map((row: any[], rowIdx: number) => {
                  const paddedRow = row.concat(Array.from({ length: Math.max(0, numColumns - row.length) }, () => null));

                  return (
                    <View
                      key={`row-${rowIdx}`}
                      style={[
                        styles.row,
                        isWebDesktop && centerRowsOnWebDesktop ? styles.rowWebCentered : null,
                      ]}
                    >
                      {paddedRow.map((item: any, colIdx: number) => {
                      const index = rowIdx * numColumns + colIdx;
                      const key = item?.id != null && String(item.id).length > 0
                        ? String(item.id)
                        : item?.url ? String(item.url) : `${queryKey}-${index}`;

                      if (!item) {
                        return (
                          <View
                            key={`placeholder-${rowIdx}-${colIdx}`}
                            style={[styles.cardWrapper, styles.cardWrapperPlaceholder]}
                            aria-hidden={Platform.OS === 'web' ? true : undefined}
                            importantForAccessibility="no-hide-descendants"
                          />
                        );
                      }

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
                  );
                })
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
    (label: string, filters?: QuickFilterParams, route?: string) => {
      sendAnalyticsEvent('HomeClick_QuickFilter', { label });
      const base = route ?? '/search';
      const path = buildFilterPath(base, filters);
      router.push(path as any);
    },
    [router],
  );

  const handleOpenArticles = useCallback(() => {
    sendAnalyticsEvent('HomeClick_OpenSearch', { source: 'home-filter-block' });
    router.push('/search' as any);
  }, [router]);

  const styles = useMemo(() => createSectionsStyles(colors, isMobile), [colors, isMobile]);

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
                        onPress={() => handleFilterPress(chip.label, (chip as any).filters, (chip as any).route)}
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
