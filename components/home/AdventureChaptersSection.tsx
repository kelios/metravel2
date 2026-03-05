import React, { useMemo, memo, useCallback, useState } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';

import { useResponsive, useResponsiveColumns } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { fetchTravelsPopular } from '@/api/map';
import OptimizedFavoriteButton from '@/components/travel/OptimizedFavoriteButton';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import Button from '@/components/ui/Button';
import { queryConfigs } from '@/utils/reactQueryConfig';
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import type { Travel } from '@/types/types';
import { createAdventureChaptersStyles } from './homeAdventureChaptersStyles';

const PLACEHOLDER_BLURHASH = 'LEHL6nWB2yk8pyo0adR*.7kCMdnj';


function isLikelyWatermarked(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return ['shutterstock', 'istockphoto', 'gettyimages', 'depositphotos', 'dreamstime', 'alamy'].some(
    (d) => lower.includes(d),
  );
}

// ── Chapter card ─────────────────────────────────────────────────────────────

type ChapterCardProps = {
  item: Travel;
  index: number;
  isMobile: boolean;
  styles: ReturnType<typeof createAdventureChaptersStyles>;
  colors: ReturnType<typeof useThemedColors>;
};

function ChapterCard({ item, index, isMobile, styles, colors }: ChapterCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isWeb = Platform.OS === 'web';

  const title = (typeof item.name === 'string' ? item.name.trim() : '') || 'Без названия';
  const countries = useMemo(() => {
    const raw = typeof item.countryName === 'string' ? item.countryName : String(item.countryName ?? '');
    return raw.split(',').map((c) => c.trim()).filter(Boolean);
  }, [item.countryName]);

  const views = Number(item.countUnicIpView) || 0;
  const rating = item.rating ?? null;
  const isPopular = views > 1000;

  const travelUrl = useMemo(
    () =>
      resolveTravelUrl({
        id: Number(item.id) || 0,
        slug: typeof item.slug === 'string' ? item.slug : undefined,
        url: typeof (item as any).url === 'string' ? (item as any).url : undefined,
      } as any),
    [item],
  );

  const rawImageUrl = !isLikelyWatermarked(item.travel_image_thumb_url)
    ? item.travel_image_thumb_url
    : null;

  const imageUrl = useMemo(() => {
    if (!rawImageUrl || !isWeb) return rawImageUrl ?? null;
    return (
      optimizeImageUrl(rawImageUrl, {
        width: isMobile ? 480 : 640,
        height: isMobile ? 260 : 320,
        fit: 'cover',
      }) ?? rawImageUrl
    );
  }, [rawImageUrl, isWeb, isMobile]);

  const handlePress = useCallback(() => {
    if (!travelUrl) return;
    sendAnalyticsEvent('AdventureChapters_CardClick', { travelId: item.id, index });
    router.push(travelUrl as any);
  }, [travelUrl, item.id, index, router]);

  const webContainerProps = useMemo(
    () =>
      isWeb
        ? ({
            tabIndex: 0,
            role: 'link' as const,
            'aria-label': `Открыть маршрут «${title}»`,
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
            onFocus: () => setIsFocused(true),
            onBlur: () => setIsFocused(false),
            onClick: (e: any) => {
              if (e?.target?.closest?.('[data-card-action="true"]')) return;
              e?.preventDefault?.();
              handlePress();
            },
            onKeyDown: (e: any) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (e?.target?.closest?.('[data-card-action="true"]')) return;
                e.preventDefault();
                handlePress();
              }
            },
          } as any)
        : {},
    [isWeb, title, handlePress],
  );

  const cardContent = (
    <View
      style={[
        styles.card,
        isHovered && styles.cardHovered,
        isFocused && styles.cardFocused,
      ]}
      {...(isWeb ? webContainerProps : {})}
      {...Platform.select({ web: { cursor: 'pointer' } as any })}
    >
      {/* ── Cover photo ── */}
      <View style={styles.coverContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[
              styles.coverImage,
              isHovered && isWeb && styles.coverImageHovered,
            ]}
            contentFit="cover"
            placeholder={PLACEHOLDER_BLURHASH}
            transition={300}
            accessibilityLabel={title}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={36} color={colors.borderStrong} />
          </View>
        )}

        {/* Gradient overlay */}
        {isWeb ? (
          <View style={styles.coverGradient} />
        ) : (
          <View style={styles.coverGradientNative} />
        )}


        {/* Favorite button — top right */}
        <View
          style={styles.favoriteSlot}
          {...(isWeb
            ? ({
                'data-card-action': 'true',
                onClick: (e: any) => {
                  e.stopPropagation();
                  e.preventDefault();
                },
              } as any)
            : {})}
        >
          <OptimizedFavoriteButton
            id={item.id}
            type="travel"
            title={title}
            imageUrl={item.travel_image_thumb_url}
            url={travelUrl}
            country={countries[0]}
            size={18}
          />
        </View>

        {/* Title overlay — bottom of cover */}
        <View style={styles.titleOverlay}>
          <Text style={styles.titleOverlayText} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      {/* ── Card meta content ── */}
      <View style={styles.cardContent}>
        <View style={styles.metaRow}>
          {countries.length > 0 && (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={11} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {countries.slice(0, 2).join(', ')}
              </Text>
            </View>
          )}

          {views > 0 && (
            <>
              {countries.length > 0 && <View style={styles.metaDot} />}
              <View style={styles.metaItem}>
                <Feather name="eye" size={11} color={colors.textMuted} />
                <Text style={styles.metaText}>{views > 999 ? `${Math.floor(views / 1000)}k` : views}</Text>
              </View>
            </>
          )}

          {rating != null && rating > 0 && (
            <>
              <View style={styles.metaDot} />
              <View style={styles.metaRating}>
                <Text style={styles.metaRatingStar}>★</Text>
                <Text style={styles.metaRatingText}>{rating.toFixed(1)}</Text>
              </View>
            </>
          )}

          {isPopular && (
            <>
              <View style={styles.metaDot} />
              <View style={styles.metaPopular}>
                <Feather name="trending-up" size={10} color={colors.primaryText} />
                <Text style={styles.metaPopularText}>Популярное</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );

  if (isWeb) {
    return (
      <a
        href={travelUrl || undefined}
        style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%' } as any}
        onClick={(e: any) => {
          if (e?.target?.closest?.('[data-card-action="true"]')) return;
          const shouldUseBrowserDefault =
            e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
          if (shouldUseBrowserDefault) return;
          e.preventDefault();
          handlePress();
        }}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePress();
          }
        }}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Открыть маршрут «${title}»`}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
    >
      {cardContent}
    </Pressable>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function AdventureChaptersSection() {
  const router = useRouter();
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const numColumns = useResponsiveColumns({
    tablet: 2,
    largeTablet: 3,
    desktop: 3,
    largeDesktop: 3,
    default: 1,
  });

  const { data: travelData = {}, isLoading } = useQuery({
    queryKey: ['home-popular-travels'],
    queryFn: ({ signal } = {} as any) => fetchTravelsPopular({ signal }),
    ...queryConfigs.dynamic,
  });

  const travelsList = useMemo(() => {
    let arr: any[] = [];
    if (Array.isArray(travelData)) {
      arr = travelData;
    } else if ((travelData as any)?.data && Array.isArray((travelData as any).data)) {
      arr = (travelData as any).data;
    } else if ((travelData as any)?.results && Array.isArray((travelData as any).results)) {
      arr = (travelData as any).results;
    } else if (typeof travelData === 'object') {
      arr = Object.values(travelData).filter((item) => item != null && typeof item === 'object');
    }
    return arr.slice(0, isMobile ? 4 : numColumns <= 3 ? 6 : 6);
  }, [travelData, isMobile, numColumns]);

  const styles = useMemo(() => createAdventureChaptersStyles(colors, isMobile), [colors, isMobile]);

  const handleViewAll = useCallback(() => {
    sendAnalyticsEvent('AdventureChapters_ViewAll');
    router.push('/search' as any);
  }, [router]);

  const isWeb = Platform.OS === 'web';

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionFrame}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <SkeletonLoader width={140} height={28} borderRadius={999} />
              <SkeletonLoader width={isMobile ? 260 : 420} height={isMobile ? 32 : 50} borderRadius={8} style={{ marginTop: 4 }} />
              <SkeletonLoader width={isMobile ? 200 : 340} height={16} borderRadius={4} />
            </View>
          </View>
          <View style={styles.grid}>
            {Array.from({ length: isMobile ? 2 : numColumns }).map((_, i) => (
              <View key={i} style={styles.skeletonCard} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Grid rows ──
  function chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  const rows = numColumns === 1
    ? travelsList.map((item) => [item])
    : chunkArray(travelsList, numColumns);

  return (
    <View style={styles.section}>
        <View style={styles.sectionFrame}>
          {/* ── Section header ── */}
          <View style={styles.header}>

            <Text style={styles.heroTitle}>Главы путешествий,</Text>
            <Text style={styles.heroTitleAccent}>которые выбирают чаще всего</Text>

          </View>

          {/* ── Cards ── */}
          {travelsList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="book-open" size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Главы путешествий скоро появятся</Text>
              <Text style={styles.emptySubtitle}>Загляните в каталог маршрутов</Text>
              <Button
                label="Открыть каталог"
                onPress={handleViewAll}
                variant="secondary"
                icon={<Feather name="arrow-right" size={16} color={colors.text} />}
                iconPosition="right"
              />
            </View>
          ) : (
            <View style={styles.grid}>
              {rows.map((row, rowIdx) => {
                const paddedRow =
                  numColumns > 1
                    ? row.concat(
                        Array.from({ length: Math.max(0, numColumns - row.length) }, () => null as unknown as Travel),
                      )
                    : row;

                return paddedRow.map((item, colIdx) => {
                  const globalIndex = rowIdx * numColumns + colIdx;
                  const key = item?.id != null && String(item.id).length > 0
                    ? String(item.id)
                    : `chapter-placeholder-${rowIdx}-${colIdx}`;

                  if (!item) {
                    return (
                      <View
                        key={key}
                        style={[styles.cardSlot, styles.cardSlotPlaceholder]}
                        aria-hidden={isWeb ? true : undefined}
                        importantForAccessibility="no-hide-descendants"
                      />
                    );
                  }

                  return (
                    <View key={key} style={styles.cardSlot}>
                      <ChapterCard
                        item={item}
                        index={globalIndex}
                        isMobile={isMobile}
                        styles={styles}
                        colors={colors}
                      />
                    </View>
                  );
                });
              })}
            </View>
          )}
        </View>
    </View>
  );
}

export default memo(AdventureChaptersSection);
