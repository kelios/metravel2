import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { ResponsiveContainer } from '@/components/layout';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';

type TravelLikeItem = {
  id: string | number;
  title?: string | null;
  imageUrl?: string | null;
  url: string;
  country?: string | null;
  city?: string | null;
};

type ShelfSection = {
  badge?: { icon: 'clock' | 'favorite' };
  countLabel: string;
  countValue: number;
  ctaPath: '/favorites' | '/history';
  eyebrow: string;
  items: TravelLikeItem[];
  listTestID: string;
  subtitle: string;
  title: string;
  titleTestID: string;
};

function shouldHandleHorizontalWheelForElement(e: any, el: any) {
  if (Platform.OS !== 'web') return;
  if (!el || typeof (el as any).scrollLeft !== 'number') return;

  const deltaY = Number(e?.deltaY ?? 0);
  const deltaX = Number(e?.deltaX ?? 0);
  if (!deltaY || Math.abs(deltaY) <= Math.abs(deltaX)) return;

  const maxScrollLeft = (el.scrollWidth ?? 0) - (el.clientWidth ?? 0);
  if (maxScrollLeft <= 0) return;

  const isAtLeft = (el.scrollLeft ?? 0) <= 0;
  const isAtRight = (el.scrollLeft ?? 0) >= maxScrollLeft;
  if ((isAtLeft && deltaY < 0) || (isAtRight && deltaY > 0)) return;

  return true;
}

function handleHorizontalWheelForElement(e: any, el: any, prevent: boolean) {
  if (!shouldHandleHorizontalWheelForElement(e, el)) return;

  const deltaY = Number(e?.deltaY ?? 0);

  if (prevent && e?.cancelable) e.preventDefault?.();
  (el as any).scrollLeft += deltaY;
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  countLabel,
  countValue,
  onSeeAll,
  testID,
  styles,
  colors,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  countLabel: string;
  countValue: number;
  onSeeAll: () => void;
  testID: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useThemedColors>;
}) {
  return (
    <View style={styles.sectionHeaderRow} testID={testID}>
      <View style={styles.headerTitleBlock}>
        <View style={styles.headerEyebrow}>
          <Feather name="bookmark" size={12} color={colors.primaryText} />
          <Text style={styles.headerEyebrowText}>{eyebrow}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        <View style={styles.headerMetaRow}>
          <View style={styles.headerStatPill}>
            <Text style={styles.headerStatValue}>{countValue}</Text>
            <Text style={styles.headerStatLabel}>{countLabel}</Text>
          </View>
        </View>
      </View>

      <Button
        label="Смотреть все"
        onPress={onSeeAll}
        accessibilityLabel={`Смотреть все: ${title}`}
        icon={<Feather name="chevron-right" size={16} color={colors.primary} />}
        iconPosition="right"
        variant="secondary"
        style={styles.seeAllButton}
        labelStyle={styles.seeAllButtonText}
        hoverStyle={styles.seeAllButtonHover}
        pressedStyle={styles.seeAllButtonHover}
      />
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
  const historyBadge = useMemo(() =>
    badge?.icon === 'clock'
      ? {
          icon: 'clock' as const,
          backgroundColor: colors.overlay,
          iconColor: isDark ? colors.text : colors.textOnDark,
        }
      : undefined,
    [badge?.icon, colors.overlay, colors.text, colors.textOnDark, isDark]);

  const resolveScrollElement = useCallback(() => {
    const target = scrollRef.current as any;
    return target?._nativeNode || target?._domNode || target;
  }, []);

  const renderItem = useCallback(({ item }: { item: TravelLikeItem }) => (
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
  ), [historyBadge, onPressItem]);

  const keyExtractor = useCallback((item: TravelLikeItem) => `${String(item.id)}-${item.url}`, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const el = resolveScrollElement();
    if (!el || typeof el.addEventListener !== 'function') return;

    let usingActive = false;

    const onWheelActive = (e: any) => {
      handleHorizontalWheelForElement(e, el, true);
    };

    const onWheelPassive = (e: any) => {
      handleHorizontalWheelForElement(e, el, false);
      if (!usingActive && e?.cancelable && shouldHandleHorizontalWheelForElement(e, el)) {
        usingActive = true;
        try {
          el.removeEventListener('wheel', onWheelPassive as any);
        } catch {
          // noop
        }
        try {
          el.addEventListener('wheel', onWheelActive as any, { passive: false } as any);
        } catch {
          // noop
        }
      }
    };

    el.addEventListener('wheel', onWheelPassive as any, { passive: true } as any);
    return () => {
      try {
        el.removeEventListener('wheel', onWheelPassive as any);
        el.removeEventListener('wheel', onWheelActive as any);
      } catch {
        // noop
      }
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
    <FlashList
      testID={testID}
      horizontal
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      {...({ estimatedItemSize: 220 } as any)}
      showsHorizontalScrollIndicator={false}
      style={styles.horizontalList}
      contentContainerStyle={styles.horizontalListContent}
      scrollEventThrottle={Platform.select({ web: 32, default: 16 })}
      nestedScrollEnabled={Platform.OS === 'android'}
      directionalLockEnabled={Platform.OS === 'ios'}
      keyboardShouldPersistTaps="handled"
      bounces={Platform.OS === 'ios'}
      decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
      {...Platform.select({ web: { style: [styles.horizontalList, { touchAction: 'pan-x pan-y' } as any] } })}
      drawDistance={800}
    />
  );
}

function HomeFavoritesHistorySection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { favorites, viewHistory, ensureServerData } = useFavorites() as any;
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors, DESIGN_TOKENS), [colors]);

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

  const sections = useMemo(
    (): ShelfSection[] => ([
      {
        eyebrow: 'Сохранено',
        title: 'Избранное',
        subtitle: 'Маршруты, к которым вы хотите вернуться позже.',
        countLabel: 'в списке',
        countValue: favoritesData.length,
        ctaPath: '/favorites',
        items: favoritesData,
        listTestID: 'home-favorites-list',
        titleTestID: 'home-favorites-header',
      },
      {
        eyebrow: 'Недавнее',
        title: 'История',
        subtitle: 'Последние маршруты, которые вы уже открывали.',
        countLabel: 'просмотрено',
        countValue: historyData.length,
        ctaPath: '/history',
        items: historyData,
        listTestID: 'home-history-list',
        titleTestID: 'home-history-header',
        badge: { icon: 'clock' },
      },
    ] satisfies ShelfSection[]).filter((section) => section.items.length > 0),
    [favoritesData, historyData],
  );

  if (!isAuthenticated) {
    return null;
  }

  // If both are empty we don't show the block (keeps home clean)
  if (sections.length === 0) {
    return null;
  }

  const openUrl = (url: string) => {
    router.push(url as any);
  };

  return (
    <View style={styles.band} testID="home-favorites-history">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.container}>
          {sections.map((section) => (
            <View key={section.ctaPath} style={styles.section}>
              <SectionHeader
                eyebrow={section.eyebrow}
                title={section.title}
                subtitle={section.subtitle}
                countLabel={section.countLabel}
                countValue={section.countValue}
                onSeeAll={() => router.push(section.ctaPath as any)}
                testID={section.titleTestID}
                styles={styles}
                colors={colors}
              />
              <HorizontalCards
                data={section.items}
                badge={section.badge}
                onPressItem={openUrl}
                testID={section.listTestID}
                colors={colors}
                styles={styles}
              />
            </View>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, tokens: typeof DESIGN_TOKENS) =>
  StyleSheet.create({
    band: {
      paddingVertical: 56,
      backgroundColor: colors.background,
      width: '100%',
      alignSelf: 'stretch',
    },
    container: {
      gap: 44,
      width: '100%',
    },
    section: {
      gap: 18,
    },
    sectionHeaderRow: {
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      alignItems: Platform.OS === 'web' ? 'flex-end' : 'stretch',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    headerEyebrow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: tokens.radii.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    headerEyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    sectionTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.text,
      lineHeight: 32,
      letterSpacing: -0.5,
    },
    sectionSubtitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textMuted,
      lineHeight: 22,
    },
    headerMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerStatPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: tokens.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          boxShadow: tokens.shadows.medium,
        },
      }),
    },
    headerStatValue: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    headerStatLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: tokens.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    seeAllButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: tokens.shadows.medium,
        },
      }),
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

export default memo(HomeFavoritesHistorySection);
