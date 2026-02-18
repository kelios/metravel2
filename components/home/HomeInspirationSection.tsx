import React, { useMemo, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
                    <RenderTravelItem item={item} index={index} isMobile={isMobile} hideAuthor={hideAuthor} viewportWidth={viewportWidth} />
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
                      <RenderTravelItem item={item} index={index} isMobile={isMobile} hideAuthor={hideAuthor} viewportWidth={viewportWidth} />
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
  const { isPhone, isLargePhone } = useResponsive();
  const colors = useThemedColors();
  const isMobile = isPhone || isLargePhone;

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
  }), [colors]);

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <HomeInspirationSection
            title="Куда отправиться в этом месяце"
            subtitle="Истории путешественников, которые вдохновляют"
            queryKey="home-travels-of-month"
            fetchFn={fetchTravelsOfMonth}
          />

          <HomeInspirationSection
            title="Популярные направления"
            subtitle="Маршруты, которые выбирают чаще всего"
            queryKey="home-popular-travels"
            fetchFn={fetchTravelsPopular}
            hideAuthor
          />

          <HomeInspirationSection
            title="Случайный маршрут"
            subtitle="Идея для поездки, если не знаешь, куда поехать"
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
