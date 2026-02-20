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
    title: 'Формат',
    icon: 'layers',
    chips: ['Природа', 'Города', 'Активный отдых', 'Романтика', 'Бюджетные'],
  },
  {
    title: 'Длительность',
    icon: 'clock',
    chips: ['1 день', '2 дня', 'Уикенд'],
  },
  {
    title: 'Сезон',
    icon: 'calendar',
    chips: ['Весна', 'Лето', 'Осень', 'Зима'],
  },
  {
    title: 'Расстояние',
    icon: 'navigation',
    chips: ['До 100 км', '100-250 км', '250+ км'],
  },
] as const;

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
    if (queryKey === 'home-travels-of-month') return { icon: 'zap', label: 'Сезонные идеи' };
    if (queryKey === 'home-popular-travels') return { icon: 'trending-up', label: 'Чаще всего выбирают' };
    return { icon: 'shuffle', label: 'Спонтанный выбор' };
  }, [queryKey]);

  const styles = useMemo(() => StyleSheet.create({
    section: {
      gap: 28,
    },
    sectionMobile: {
      gap: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 4,
    },
    headerMobile: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleContainer: {
      flex: 1,
      gap: 8,
      minWidth: 0,
    },
    sectionBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    sectionBadgeText: {
      color: colors.primaryText,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    titleMobile: {
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
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
      backgroundColor: colors.surface,
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
    },
    viewMoreButtonHover: {
      backgroundColor: colors.primaryLight,
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
    grid: {
      width: '100%',
      gap: 20,
      ...Platform.select({
        web: {
          touchAction: 'pan-y',
        } as any,
      }),
    },
    separator: {
      height: 20,
    },
    row: {
      flexDirection: 'row',
      gap: 20,
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
  }), [colors, isMobile]);

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
          <View style={styles.sectionBadge}>
            <Feather name={sectionBadge.icon as any} size={12} color={colors.primary} />
            <Text style={styles.sectionBadgeText}>{sectionBadge.label}</Text>
          </View>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>{subtitle}</Text>}
        </View>
        <Button
          label={isMobile ? 'Ещё маршруты' : 'Найти ещё маршруты'}
          onPress={handleViewMore}
          accessibilityLabel={`Смотреть все ${title}`}
          icon={<Feather name="arrow-right" size={16} color={colors.text} />}
          iconPosition="right"
          variant="secondary"
          style={[styles.viewMoreButton, isMobile && styles.viewMoreButtonMobile]}
          labelStyle={styles.viewMoreText}
          hoverStyle={styles.viewMoreButtonHover}
          pressedStyle={styles.viewMoreButtonHover}
        />
      </View>

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
    (label: string) => {
      sendAnalyticsEvent('HomeClick_QuickFilter', { label });
      router.push('/search' as any);
    },
    [router],
  );

  const styles = useMemo(() => StyleSheet.create({
    band: {
      paddingVertical: 56,
      backgroundColor: colors.backgroundSecondary,
      width: '100%',
      alignSelf: 'stretch',
    },
    bandMobile: {
      paddingVertical: 32,
    },
    container: {
      gap: 56,
      width: '100%',
      alignSelf: 'stretch',
    },
    containerMobile: {
      gap: 40,
    },
    quickFiltersSection: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: isMobile ? 14 : 20,
      gap: isMobile ? 14 : 16,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
        },
      }),
    },
    quickFiltersHeader: {
      gap: 6,
    },
    quickFiltersTitle: {
      color: colors.text,
      fontSize: isMobile ? 20 : 24,
      lineHeight: isMobile ? 26 : 30,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    quickFiltersSubtitle: {
      color: colors.textMuted,
      fontSize: isMobile ? 13 : 15,
      lineHeight: isMobile ? 19 : 22,
    },
    filterGroupRow: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: 10,
    },
    filterGroupTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: isMobile ? 0 : 140,
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
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    chipHover: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
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
              <Text style={styles.quickFiltersTitle}>Подбор поездок по параметрам</Text>
              <Text style={styles.quickFiltersSubtitle}>
                Быстрый старт, если не знаешь куда поехать на выходные.
              </Text>
            </View>

            {FILTER_GROUPS.map((group) => (
              <View key={group.title} style={styles.filterGroupRow}>
                <View style={styles.filterGroupTitle}>
                  <Feather name={group.icon as any} size={14} color={colors.primary} />
                  <Text style={styles.filterGroupTitleText}>{group.title}</Text>
                </View>
                <View style={styles.chipsWrap}>
                  {group.chips.map((chip) => (
                    <Pressable
                      key={chip}
                      onPress={() => handleFilterPress(chip)}
                      style={({ pressed, hovered }) => [
                        styles.chip,
                        (pressed || hovered) && styles.chipHover,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Фильтр ${chip}`}
                    >
                      <Text style={styles.chipText}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <HomeInspirationSection
            title="Идеи на ближайшие выходные"
            subtitle="Маршруты с атмосферой «хочу туда прямо сейчас»"
            queryKey="home-travels-of-month"
            fetchFn={fetchTravelsOfMonth}
          />

          <HomeInspirationSection
            title="Популярные направления"
            subtitle="То, что чаще всего сохраняют в личные книги путешествий"
            queryKey="home-popular-travels"
            fetchFn={fetchTravelsPopular}
            hideAuthor
          />

          <HomeInspirationSection
            title="Если не знаешь, куда поехать"
            subtitle="Случайная идея для спонтанной поездки на 1-2 дня"
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
