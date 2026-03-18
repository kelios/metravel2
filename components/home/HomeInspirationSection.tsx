import React, { useMemo, memo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { sendAnalyticsEvent } from '@/utils/analytics';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ResponsiveContainer } from '@/components/layout';
import Button from '@/components/ui/Button';
import { queryConfigs } from '@/utils/reactQueryConfig';
import AdventureChaptersSection from './AdventureChaptersSection';
import { createSectionStyles, createSectionsStyles } from './homeInspirationStyles';

interface HomeSectionProps {
  title: string;
  titleAccent?: string;
  subtitle?: string;
  queryKey: string;
  fetchFn: (options?: { signal?: AbortSignal }) => Promise<any>;
  hideAuthor?: boolean;
  fixedCount?: number;
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

export function HomeInspirationSection({
  title,
  titleAccent,
  subtitle,
  queryKey,
  fetchFn,
  hideAuthor = false,
  fixedCount,
}: HomeSectionProps) {
  const router = useRouter();
  const colors = useThemedColors();
  const { isPhone, isLargePhone, width: viewportWidth } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const isWeekendShowcase = queryKey === 'home-travels-of-month';

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
    
    const maxItems = fixedCount ?? (isWeekendShowcase
      ? (isMobile ? 2 : 4)
      : (isMobile ? 4 : 6));

    return arr.slice(0, maxItems);
  }, [travelData, isMobile, isWeekendShowcase, fixedCount]);

  const handleViewMore = useCallback(() => {
    sendAnalyticsEvent('HomeClick_ViewMore', { section: title });
    router.push('/search' as any);
  }, [title, router]);


  const viewMoreLabel = isMobile ? 'Все маршруты' : 'Смотреть все маршруты';
  const emptyState = EMPTY_STATE_TEXT[queryKey] ?? {
    title: 'Пока здесь пусто',
    subtitle: 'Попробуйте открыть каталог маршрутов.',
  };

  const styles = useMemo(() => createSectionStyles(colors, isMobile), [colors, isMobile]);
  const isDesktopEditorial = Platform.OS === 'web' && !isMobile;
  const shouldUseThreeColumnRow =
    Platform.OS === 'web' &&
    !isMobile &&
    queryKey === 'home-random-travels' &&
    travelsList.length === 3;

  const getEditorialCardStyle = useCallback((index: number, count: number) => {
    if (count === 1) return styles.editorialCardHero;
    if (count === 2) return index === 0 ? styles.editorialCardHero : styles.editorialCardStackTop;
    if (count === 3) {
      if (index === 0) return styles.editorialCardHeroTall;
      if (index === 1) return styles.editorialCardStackTop;
      return styles.editorialCardStackMiddle;
    }

    if (index === 0) return styles.editorialCardHero;
    if (index === 1) return styles.editorialCardStackTop;
    if (index === 2) return styles.editorialCardStackMiddle;
    return styles.editorialCardStackBottom;
  }, [
    styles.editorialCardHero,
    styles.editorialCardHeroTall,
    styles.editorialCardStackBottom,
    styles.editorialCardStackMiddle,
    styles.editorialCardStackTop,
  ]);

  const getEditorialImageHeight = useCallback((index: number, count: number) => {
    if (count === 1) return 340;
    if (count === 2) return index === 0 ? 340 : 304;
    if (count === 3) return index === 0 ? 336 : 296;
    return index === 0 ? 316 : 292;
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View style={[styles.sectionFrame, isWeekendShowcase && styles.showcaseSectionFrame]}>
          <View style={[styles.showcaseHeader]}>
            <View style={styles.titleContainer}>
              <SkeletonLoader width={isMobile ? 80 : 110} height={28} borderRadius={14} style={{ marginBottom: 4 }} />
              <SkeletonLoader width={isMobile ? 200 : 320} height={isMobile ? 28 : 40} borderRadius={8} style={{ marginBottom: 6 }} />
              <SkeletonLoader width={isMobile ? 160 : 260} height={isMobile ? 14 : 16} borderRadius={4} />
            </View>
          </View>
          <View style={styles.bentoGrid}>
            {isMobile ? (
              Array.from({ length: 2 }).map((_, i) => (
                <SkeletonLoader key={i} width="100%" height={260} borderRadius={12} />
              ))
            ) : isDesktopEditorial ? (
              <View
                style={[
                  styles.editorialGrid,
                  styles.editorialGridFour,
                ]}
              >
                <View style={[styles.editorialCard, styles.editorialCardHero]}>
                  <SkeletonLoader width="100%" height="100%" borderRadius={12} />
                </View>
                <View style={[styles.editorialCard, styles.editorialCardStackTop]}>
                  <SkeletonLoader width="100%" height="100%" borderRadius={12} />
                </View>
                <View style={[styles.editorialCard, styles.editorialCardStackMiddle]}>
                  <SkeletonLoader width="100%" height="100%" borderRadius={12} />
                </View>
                <View style={[styles.editorialCard, styles.editorialCardStackBottom]}>
                  <SkeletonLoader width="100%" height="100%" borderRadius={12} />
                </View>
              </View>
            ) : (
              [0, 1].map((rowIdx) => {
                const wideFirst = rowIdx % 2 === 0;
                return (
                  <View key={rowIdx} style={styles.bentoRow}>
                    <View style={wideFirst ? styles.bentoCardWide : styles.bentoCardNarrow}>
                      <SkeletonLoader width="100%" height={340} borderRadius={12} />
                    </View>
                    <View style={wideFirst ? styles.bentoCardNarrow : styles.bentoCardWide}>
                      <SkeletonLoader width="100%" height={340} borderRadius={12} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.section, isMobile && styles.sectionMobile]}>
      <View style={[styles.sectionFrame, isWeekendShowcase && styles.showcaseSectionFrame]}>
        <View style={[styles.heroHeader, { marginBottom: isMobile ? 20 : 32 }]}>
          <View style={{ alignItems: 'center', gap: isMobile ? 6 : 10 }}>
            <Text style={styles.heroTitle}>{title}</Text>
            {titleAccent && <Text style={styles.heroTitleAccent}>{titleAccent}</Text>}
          </View>
          {subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
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
        ) : isMobile ? (
          <View style={styles.bentoGrid}>
            {travelsList.map((item: any, index: number) => {
              const key = item?.id != null && String(item.id).length > 0
                ? String(item.id)
                : item?.url ? String(item.url) : `${queryKey}-${index}`;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Separator />}
                  <View style={styles.bentoCardWide}>
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
            })}
          </View>
        ) : shouldUseThreeColumnRow ? (
          <View style={styles.threeColumnGrid}>
            {travelsList.map((item: any, index: number) => {
              const key = item?.id != null && String(item.id).length > 0
                ? String(item.id)
                : item?.url ? String(item.url) : `${queryKey}-${index}`;

              return (
                <View key={key} style={styles.threeColumnCard}>
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
        ) : isDesktopEditorial && travelsList.length >= 2 ? (
          <View
            style={[
              styles.editorialGrid,
              travelsList.length === 3 ? styles.editorialGridThree : styles.editorialGridFour,
            ]}
          >
            {travelsList.slice(0, 4).map((item: any, index: number) => {
              const key = item?.id != null && String(item.id).length > 0
                ? String(item.id)
                : item?.url ? String(item.url) : `${queryKey}-${index}`;

              return (
                <View
                  key={key}
                  style={[
                    styles.editorialCard,
                    getEditorialCardStyle(index, Math.min(travelsList.length, 4)),
                  ]}
                >
                  <RenderTravelItem
                    item={item}
                    index={index}
                    isMobile={isMobile}
                    imageHeight={getEditorialImageHeight(index, Math.min(travelsList.length, 4))}
                    hideAuthor={hideAuthor}
                    viewportWidth={viewportWidth}
                    visualVariant="home-featured"
                  />
                </View>
              );
            })}
          </View>
        ) : travelsList.length === 3 ? (
          <View style={styles.trioGrid}>
            <View style={styles.trioCardTop}>
              <RenderTravelItem
                item={travelsList[0]}
                index={0}
                isMobile={isMobile}
                hideAuthor={hideAuthor}
                viewportWidth={viewportWidth}
                visualVariant="home-featured"
              />
            </View>
            <View style={styles.trioBottomRow}>
              <View style={styles.trioCardBottom}>
                <RenderTravelItem
                  item={travelsList[1]}
                  index={1}
                  isMobile={isMobile}
                  hideAuthor={hideAuthor}
                  viewportWidth={viewportWidth}
                  visualVariant="home-featured"
                />
              </View>
              <View style={styles.trioCardBottom}>
                <RenderTravelItem
                  item={travelsList[2]}
                  index={2}
                  isMobile={isMobile}
                  hideAuthor={hideAuthor}
                  viewportWidth={viewportWidth}
                  visualVariant="home-featured"
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.bentoGrid}>
            {chunkArray(travelsList, 2).map((pair: any[], rowIdx: number) => {
              const wideFirst = rowIdx % 2 === 0;
              const left = pair[0] ?? null;
              const right = pair[1] ?? null;
              const leftKey = left?.id != null ? String(left.id) : left?.url ? String(left.url) : `${queryKey}-${rowIdx}-0`;
              const rightKey = right?.id != null ? String(right.id) : right?.url ? String(right.url) : `${queryKey}-${rowIdx}-1`;

              return (
                <View key={`bento-row-${rowIdx}`} style={styles.bentoRow}>
                  {left ? (
                    <View style={wideFirst ? styles.bentoCardWide : styles.bentoCardNarrow}>
                      <RenderTravelItem
                        item={left}
                        index={rowIdx * 2}
                        isMobile={isMobile}
                        hideAuthor={hideAuthor}
                        viewportWidth={viewportWidth}
                        visualVariant="home-featured"
                      />
                    </View>
                  ) : (
                    <View
                      key={`ph-${leftKey}`}
                      style={[wideFirst ? styles.bentoCardWide : styles.bentoCardNarrow, styles.cardWrapperPlaceholder]}
                      aria-hidden={Platform.OS === 'web' ? true : undefined}
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                  {right ? (
                    <View style={wideFirst ? styles.bentoCardNarrow : styles.bentoCardWide}>
                      <RenderTravelItem
                        item={right}
                        index={rowIdx * 2 + 1}
                        isMobile={isMobile}
                        hideAuthor={hideAuthor}
                        viewportWidth={viewportWidth}
                        visualVariant="home-featured"
                      />
                    </View>
                  ) : (
                    <View
                      key={`ph-${rightKey}`}
                      style={[wideFirst ? styles.bentoCardNarrow : styles.bentoCardWide, styles.cardWrapperPlaceholder]}
                      aria-hidden={Platform.OS === 'web' ? true : undefined}
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {!isWeekendShowcase && travelsList.length > 0 && (
          <View style={[styles.headerActions, { marginTop: isMobile ? 14 : 20 }]}>
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

function FilterGroupCard({
  group,
  selectedChip,
  onChipPress,
  styles,
  colors,
  isMobile,
}: {
  group: typeof FILTER_GROUPS[number];
  selectedChip: string | null;
  onChipPress: (label: string, filters?: QuickFilterParams, route?: string) => void;
  styles: ReturnType<typeof createSectionsStyles>;
  colors: ReturnType<typeof useThemedColors>;
  isMobile: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  return (
    <View
      style={[styles.filterGroupCard, hovered && styles.filterGroupCardHover]}
      {...(isWeb ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      } as any : {})}
    >
      <View style={styles.filterGroupCardHeader}>
        <View style={styles.filterGroupIconWrap}>
          <Feather name={group.icon as any} size={14} color={colors.primary} />
        </View>
        <Text style={styles.filterGroupTitleText}>{group.title}</Text>
      </View>
      {isMobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingRight: 16 }}
          style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
        >
          {group.chips.map((chip) => {
            const isSelected = selectedChip === chip.label;
            return (
              <Pressable
                key={chip.label}
                onPress={() => onChipPress(chip.label, (chip as any).filters, (chip as any).route)}
                style={({ pressed }) => [
                  styles.chip,
                  isSelected && styles.chipSelected,
                  !isSelected && pressed && styles.chipHover,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Фильтр ${chip.label}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.chipsWrap}>
          {group.chips.map((chip) => {
            const isSelected = selectedChip === chip.label;
            return (
              <Pressable
                key={chip.label}
                onPress={() => onChipPress(chip.label, (chip as any).filters, (chip as any).route)}
                style={({ pressed, hovered: chipHovered }) => [
                  styles.chip,
                  isSelected && styles.chipSelected,
                  !isSelected && (pressed || chipHovered) && styles.chipHover,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Фильтр ${chip.label}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function HomeInspirationSections() {
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const colors = useThemedColors();
  const isMobile = isPhone || isLargePhone;
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [btnHovered, setBtnHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  const handleFilterPress = useCallback(
    (label: string, filters?: QuickFilterParams, route?: string) => {
      sendAnalyticsEvent('HomeClick_QuickFilter', { label });
      setSelectedChip(label);
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
            {/* Decorative blobs */}
            <View style={styles.quickFiltersAccentBlob1} pointerEvents="none" />
            <View style={styles.quickFiltersAccentBlob2} pointerEvents="none" />

            {/* Header */}
            <View style={styles.quickFiltersHeader}>
              <View style={styles.quickFiltersHeaderLeft}>

                <Text style={styles.quickFiltersTitle}>Подберите поездку под свой ритм</Text>
                <Text style={styles.quickFiltersSubtitle}>
                  Комбинируйте формат, сезон и расстояние, чтобы найти идеальный маршрут
                </Text>
              </View>
              <Button
                label="Смотреть маршруты →"
                onPress={handleOpenArticles}
                variant="secondary"
                style={[
                  styles.quickFiltersArticlesButton,
                  btnHovered && styles.quickFiltersArticlesButtonHover,
                ]}
                labelStyle={styles.quickFiltersArticlesText}
                hoverStyle={styles.quickFiltersArticlesButtonHover}
                pressedStyle={styles.quickFiltersArticlesButtonHover}
                {...(isWeb ? {
                  onMouseEnter: () => setBtnHovered(true),
                  onMouseLeave: () => setBtnHovered(false),
                } as any : {})}
              />
            </View>

            {/* Filter cards grid */}
            <View style={styles.quickFiltersGrid}>
              {FILTER_GROUPS.map((group) => (
                <FilterGroupCard
                  key={group.title}
                  group={group}
                  selectedChip={selectedChip}
                  onChipPress={handleFilterPress}
                  styles={styles}
                  colors={colors}
                  isMobile={isMobile}
                />
              ))}
            </View>
          </View>

          <AdventureChaptersSection />

        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeInspirationSections);
