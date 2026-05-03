// ✅ УЛУЧШЕНИЕ: src/components/listTravel/TravelListItem.tsx - мигрирован на DESIGN_TOKENS и useThemedColors
import React, { memo, useCallback, useMemo, useRef } from "react";
import { View, Pressable, Text, Platform } from "react-native";
import Feather from '@expo/vector-icons/Feather';
import { router } from "expo-router";
import type { Travel } from "@/types/types";
import OptimizedFavoriteButton from "@/components/travel/OptimizedFavoriteButton";
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers';
import UnifiedTravelCard from "@/components/ui/UnifiedTravelCard";
import { isIOSSafariUserAgent } from "@/components/ui/ImageCardMedia";
import CardActionPressable from "@/components/ui/CardActionPressable";

import { useThemedColors } from '@/hooks/useTheme';
import { getResponsiveCardValues } from './enhancedTravelCardStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { formatViewCount } from "@/components/travel/utils/travelHelpers";
import { TRAVEL_CARD_IMAGE_HEIGHT } from './utils/listTravelConstants';
import TravelListItemCountriesList from './TravelListItemCountriesList';
import { createTravelListItemStyles } from './travelListItemStyles';
import TravelListItemSelectableOverlay from './TravelListItemSelectableOverlay';
import {
  isLikelyWatermarked,
  normalizeOwnerIds,
  resolveTravelAuthorDisplayName,
  resolveTravelAuthorName,
} from './travelListItemHelpers';
import { useTravelListItemNavigation } from './useTravelListItemNavigation';

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const EMPTY_STYLE = {} as const;

type Props = {
    travel: Travel;
    currentUserId?: string | null;
    isSuperuser?: boolean;
    isMetravel?: boolean;
    onDeletePress?: (id: number) => void;
    isFirst?: boolean;
    isSingle?: boolean;
    selectable?: boolean;
    isSelected?: boolean;
    onToggle?: () => void;
    isMobile?: boolean; // ✅ УЛУЧШЕНИЕ: Добавлен проп для определения мобильного устройства
    cardWidth?: number; // ✅ Фактическая ширина карточки (с учётом паддингов и колонок)
    imageHeight?: number;
    viewportWidth?: number; // ✅ Ширина viewport для width-based адаптивности на web
    hideAuthor?: boolean;
    visualVariant?: 'default' | 'home-featured';
};

function TravelListItem({
                            travel,
                            currentUserId,
                            isSuperuser,
                            isMetravel: _isMetravel = false,
                            onDeletePress,
                            isFirst = false,
                            isSingle = false,
                            selectable = false,
                            isSelected = false,
                            onToggle,
                            isMobile = false,
                            cardWidth,
                            imageHeight,
                            viewportWidth,
                            hideAuthor = false,
                            visualVariant = 'default',
                        }: Props) {
    // ✅ ДИЗАЙН: Используем динамические цвета темы
    const colors = useThemedColors();
    const styles = useMemo(() => createTravelListItemStyles(colors), [colors]);
    const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';
    const isMobileSafariFirstCard = useMemo(() => {
        if (!isWeb || !isMobile || !isFirst || typeof navigator === 'undefined') return false;
        return isIOSSafariUserAgent(
            String(navigator.userAgent || ''),
            navigator.maxTouchPoints,
        );
    }, [isFirst, isMobile, isWeb]);
    const tagIconColor = colors.textSecondary;

    const {
        id,
        slug,
        travel_image_thumb_url,
        name,
        countryName = "",
        userName,
        countUnicIpView = 0
    } = travel;

    const title = useMemo(() => {
        const v = name?.trim() ?? '';
        return v || 'Без названия';
    }, [name]);

    const authorName = useMemo(() => resolveTravelAuthorName(travel, userName), [userName, travel]);

    const authorDisplayName = useMemo(() => resolveTravelAuthorDisplayName(authorName), [authorName]);

    const views = Number(countUnicIpView) || 0;

    const viewsFormatted = useMemo(() => formatViewCount(views), [views]);

    const travelKey = useMemo(() => {
        if (slug?.trim()) return slug.trim();
        return String(id);
    }, [id, slug]);

    const travelUrl = useMemo(() => {
        return resolveTravelUrl({
            id: Number(id) || 0,
            slug,
            url: typeof (travel as any)?.url === 'string' ? (travel as any).url : undefined,
        } as any);
    }, [id, slug, travel]);

    const {
      anchorRef,
      navigationUrl,
      handlePress,
      handlePointerEnter,
      isNavigable,
    } = useTravelListItemNavigation({
      id,
      slug,
      travelUrl,
      isMetravel: _isMetravel,
      selectable,
      onToggle,
    });

    const cardTestId = useMemo(() => {
        const suffix = travelKey || 'unknown';
        return selectable ? `travel-card-selectable-${suffix}` : `travel-card-${suffix}`;
    }, [selectable, travelKey]);

    // ✅ УЛУЧШЕНИЕ: Оптимизация превью под карточку с использованием новых утилит
    const imgUrl = useMemo(() => {
        if (!travel_image_thumb_url) return null;

        // Упрощенная обработка - меньше вычислений при скролле
        return travel_image_thumb_url;
    }, [travel_image_thumb_url]);

    const countries = useMemo(() => {
        return (countryName ?? '').split(",").map((c) => c.trim()).filter(Boolean);
    }, [countryName]);

    // ✅ Width-based адаптивные значения для карточки: используем фактическую ширину, если она есть
    const effectiveWidth = typeof cardWidth === 'number' ? cardWidth : viewportWidth;

    const responsiveValues = useMemo(
        () => getResponsiveCardValues(
            typeof effectiveWidth === 'number'
                ? effectiveWidth
                : isMobile
                    ? 375 // разумный fallback для мобильных
                    : 1024 // fallback для desktop
        ),
        [effectiveWidth, isMobile]
    );

    // ✅ БИЗНЕС: Определение badges для социального доказательства
    const popularityFlags = useMemo(() => {
        const updatedAt = (travel as any).updated_at;
        const createdAt = (travel as any).created_at || updatedAt;

        let isPopular = false;
        let isNew = false;

        if (views > 1000) {
            isPopular = true;
        }

        if (createdAt) {
            const createdDate = new Date(createdAt);
            if (!isNaN(createdDate.getTime())) {
                const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceCreated <= 7 && daysSinceCreated >= 0) {
                    isNew = true;
                }
            }
        }

        return { isPopular, isNew };
    }, [views, travel]);

    // Право редактирования:
    //  - суперпользователь может управлять всеми путешествиями
    //  - обычный пользователь — только своими (по userIds / user.id)
    // Не доверяем одному лишь факту, что карточка показана на /metravel:
    // backend/кэш могут вернуть чужие записи, и тогда delete/edit приводит к 404.
    const canEdit = React.useMemo(() => {
        if (isSuperuser) return true;
        if (!currentUserId) return false;

        const ownerIds = normalizeOwnerIds(
            (travel as any).userIds ??
            (travel as any).userId ??
            (travel as any).user_id ??
            (travel as any).ownerId ??
            (travel as any).owner_id ??
            (travel as any).user?.id ??
            ''
        );
        if (!ownerIds.length) return false;

        const normalizedCurrentUserId = String(currentUserId).trim();
        return ownerIds.includes(normalizedCurrentUserId);
    }, [isSuperuser, currentUserId, travel]);
    const lastSelectableTouchAtRef = useRef(0);

    const authorUserId = useMemo(() => {
        const ownerRaw =
            (travel as any).userIds ??
            (travel as any).userId ??
            (travel as any).user_id ??
            (travel as any).ownerId ??
            (travel as any).owner_id ??
            (travel as any).user?.id ??
            null;
        if (ownerRaw == null) return null;
        const v = normalizeOwnerIds(ownerRaw)[0] ?? '';
        return v ? v : null;
    }, [travel]);

    const handleAuthorPress = useCallback(
        (e?: any) => {
            if (!authorUserId) return;
            if (e) {
                e.stopPropagation?.();
                e.preventDefault?.();
            }
            router.push(`/user/${authorUserId}` as any);
        },
        [authorUserId]
    );

    const handleSelectableWebActivate = useCallback(
        (event?: any, source: 'click' | 'touch' | 'key' = 'click') => {
            if (source === 'click' && Date.now() - lastSelectableTouchAtRef.current < 500) {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                return;
            }

            if (source === 'touch') {
                lastSelectableTouchAtRef.current = Date.now();
            }

            event?.stopPropagation?.();
            event?.preventDefault?.();
            handlePress();
        },
        [handlePress]
    );
    const handleEdit = useCallback((e?: any) => {
        // Предотвращаем всплытие и стандартное поведение на веб-платформе
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) {
                e.preventDefault();
            }
        }
        router.push(`/travel/${id}`);
    }, [id]);

    const handleDelete = useCallback((e?: any) => {
        // Предотвращаем всплытие и стандартное поведение на веб-платформе
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) {
                e.preventDefault();
            }
        }
        onDeletePress?.(id);
    }, [id, onDeletePress]);

    
    // ✅ B5.1: Улучшенные accessibility атрибуты
    const a11yLabelBase = `Путешествие: ${title}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}`;
    const a11yLabelWithViews = views > 0 ? `${a11yLabelBase}. Просмотров: ${viewsFormatted}` : a11yLabelBase;

    const cardWrapperProps =
      isWeb
        ? selectable
          ? ({
              role: 'checkbox',
              tabIndex: 0 as const,
              onClick: (e: any) => {
                handleSelectableWebActivate(e, 'click');
              },
              onTouchStart: (e: any) => {
                e.stopPropagation?.();
              },
              onTouchEnd: (e: any) => {
                handleSelectableWebActivate(e, 'touch');
              },
              onKeyDown: (e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectableWebActivate(e, 'key');
                }
              },
              onMouseDown: (e: any) => e.stopPropagation?.(),
              'aria-checked': isSelected,
              'aria-label': a11yLabelWithViews,
            } as any)
          : {}
        : {
            onPress: handlePress,
            android_ripple: Platform.OS === "android" ? { color: "rgba(17,24,39,0.06)" } : undefined,
            accessibilityState: selectable ? { selected: isSelected } : undefined,
            accessibilityLabel: a11yLabelWithViews,
            accessibilityRole: "button" as const,
            accessibilityHint: selectable ? 'Двойное нажатие для выбора' : 'Двойное нажатие для просмотра деталей',
          };

const selectableOverlay = selectable ? (
  <TravelListItemSelectableOverlay
    isWeb={isWeb}
    isSelected={isSelected}
    handlePress={handlePress}
    handleSelectableWebActivate={handleSelectableWebActivate}
    styles={styles}
    colors={{ textOnPrimary: colors.textOnPrimary }}
  />
) : null;

const rightTopSlot = (
  <View
    style={[styles.favoriteButtonContainer, { pointerEvents: 'box-none' } as any]}
    {...(isWeb && {
      onClick: (e: any) => {
        e.stopPropagation();
        e.preventDefault();
      },
      onMouseDown: (e: any) => e.stopPropagation(),
    })}
  >
    <OptimizedFavoriteButton
      id={id}
      type="travel"
      title={title}
      imageUrl={travel_image_thumb_url}
      url={travelUrl}
      country={countries[0]}
      size={Platform.select({ default: 16, web: 18 })}
    />
  </View>
);

const leftTopSlot = canEdit ? (
  <View style={styles.adminActionsContainer} testID="admin-actions">
    <CardActionPressable
      accessibilityLabel="Редактировать"
      title="Редактировать"
      onPress={() => handleEdit()}
      style={styles.adminBtn}
    >
      <Feather name="edit-2" size={14} color={colors.text} />
    </CardActionPressable>
    <View style={styles.adminDivider} />
    <CardActionPressable
      accessibilityLabel="Удалить"
      title="Удалить"
      onPress={() => handleDelete()}
      style={styles.adminBtn}
      testID="delete-button"
    >
      <Feather name="trash-2" size={14} color={colors.danger} />
    </CardActionPressable>
  </View>
) : null;

// Проверяем, есть ли какая-либо информация для отображения в контентной области
const hasAuthorMeta = !hideAuthor && authorDisplayName !== '';

const hasContentInfo = useMemo(() => {
  const hasRating = travel.rating != null && travel.rating > 0;
  return (
    hasAuthorMeta ||
    countries.length > 0 ||
    views > 0 ||
    hasRating ||
    popularityFlags.isPopular ||
    popularityFlags.isNew
  );
}, [countries.length, hasAuthorMeta, popularityFlags.isPopular, popularityFlags.isNew, views, travel.rating]);

const metaInfoTopRowChildren = useMemo(() => {
  const children: React.ReactNode[] = [];

  if (countries.length > 0) {
    children.push(
      <TravelListItemCountriesList
        key="countries"
        countries={countries}
        styles={styles}
        iconColor={tagIconColor}
      />
    );
  }

  if (hasAuthorMeta) {
    if (countries.length > 0) {
      children.push(<View key="author-dot" style={styles.metaDot} />);
    }

    children.push(
      Platform.OS === 'web' ? (
        <View
          key="author"
          {...({
            ...(authorUserId
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Открыть профиль автора ${authorDisplayName}`,
                }
              : {}),
          } as any)}
          onClick={handleAuthorPress}
          style={{ flexShrink: 1, minWidth: 0 }}
        >
          <Text style={styles.metaTxt} numberOfLines={1}>
            {authorDisplayName}
          </Text>
        </View>
      ) : (
        <Pressable
          key="author"
          onPress={handleAuthorPress}
          style={({ pressed }) => [{ flexShrink: 1, minWidth: 0 }, pressed && authorUserId ? { opacity: 0.85 } : null]}
          accessibilityRole="button"
          accessibilityLabel={`Автор: ${authorDisplayName}`}
        >
          <Text style={styles.metaTxt} numberOfLines={1}>
            {authorDisplayName}
          </Text>
        </Pressable>
      )
    );
  }

  if (views > 0) {
    if (countries.length > 0 || hasAuthorMeta) {
      children.push(<View key="views-dot" style={styles.metaDot} />);
    }

    children.push(
      <View key="views" style={styles.metaBoxViews} testID="views-meta">
        <Feather
          name="eye"
          size={Platform.select({ default: 10, web: 11 })}
          color={colors.textMuted}
        />
        <Text style={styles.metaTxtViews} numberOfLines={1}>
          {viewsFormatted}
        </Text>
      </View>
    );
  }

  return children;
}, [
  authorDisplayName,
  authorUserId,
  colors.textMuted,
  countries,
  handleAuthorPress,
  hasAuthorMeta,
  styles,
  tagIconColor,
  views,
  viewsFormatted,
]);

const contentSlotWithoutTitle = hasContentInfo ? (
  <View style={styles.metaRow}>
    <View style={styles.metaInfoTopRow}>
      {metaInfoTopRowChildren}
    </View>

    <View style={styles.metaBadgesRow}>
      {travel.rating != null && travel.rating > 0 && (
        <View style={styles.metaRating} testID="rating-meta">
          <Text style={styles.metaRatingStar}>★</Text>
          <Text style={styles.metaRatingValue}>{travel.rating.toFixed(1)}</Text>
        </View>
      )}
      {popularityFlags.isPopular && (
        <View style={[styles.statusBadge, styles.statusBadgePopular]}>
          <Feather
            name="trending-up"
            size={Platform.select({ default: 9, web: 10 })}
            color={colors.warningDark}
          />
        </View>
      )}
      {popularityFlags.isNew && (
        <View style={[styles.statusBadge, styles.statusBadgeNew]}>
          <Feather
            name="star"
            size={Platform.select({ default: 9, web: 10 })}
            color={colors.success}
          />
        </View>
      )}
    </View>
  </View>
) : null;

const card = (
  <UnifiedTravelCard
    title={title}
    imageUrl={imgUrl && !isLikelyWatermarked(imgUrl) ? imgUrl : null}
    onPress={handlePress}
    width={isWeb ? undefined : (typeof cardWidth === 'number' ? cardWidth : undefined)}
    mediaFit={visualVariant === 'home-featured' ? 'contain' : 'cover'}
    visualVariant={visualVariant === 'home-featured' ? 'featured' : 'default'}
    heroTitleOverlay={true}
    testID={cardTestId}
    style={[
      styles.card,
      visualVariant === 'home-featured' && styles.cardHomeFeatured,
      Platform.OS === 'web' && ({ height: '100%' as any } as any),
      Platform.OS === 'web' && ({ borderRadius: responsiveValues.borderRadius } as any),
      globalFocusStyles.focusable,
      Platform.OS === 'android' && styles.androidOptimized,
      isSingle && styles.single,
      selectable && isSelected && styles.selected,
    ]}
    imageHeight={typeof imageHeight === 'number' ? imageHeight : TRAVEL_CARD_IMAGE_HEIGHT}
    contentPosition="belowMedia"
    insetMedia={false}
    leftTopSlot={leftTopSlot}
    rightTopSlot={selectable ? null : rightTopSlot}
    containerOverlaySlot={selectableOverlay}
    contentSlot={contentSlotWithoutTitle}
    webHoverScale={!isMobile && Platform.OS === 'web'}
    webAsView={isWeb}
    webPressableProps={
      isWeb
        ? selectable
          ? cardWrapperProps
          : {}
        : undefined
    }
    webTouchAction={selectable ? 'manipulation' : undefined}
    mediaProps={{
      placeholderBlurhash: PLACEHOLDER_BLURHASH,
      blurBackground: true,
      allowCriticalWebBlur: Platform.OS === 'web',
      revealOnLoadOnly: isMobileSafariFirstCard,
      recyclingKey: travelKey,
      priority: Platform.OS === 'web' ? (isFirst ? 'high' : 'low') : 'normal',
      loading: Platform.OS === 'web' ? (isFirst ? 'eager' : 'lazy') : 'lazy',
      prefetch: Platform.OS === 'web' ? isFirst : false,
    }}
  />
);

return (
  <View
    style={[
      styles.wrap,
      // ✅ Grid mode: the slot already controls the column width.
      // Do not center the card inside the slot, otherwise it "floats" and shifts the left edge.
      Platform.OS === 'web' && typeof cardWidth === 'number' && {
        width: '100%',
      },
    ]}
  >
    {isWeb
      ? selectable
        ? card
        : (
            <a
              ref={anchorRef}
              href={isNavigable ? navigationUrl : undefined}
              style={
                isWeb && visualVariant === 'home-featured'
                  ? ({ display: 'block', width: '100%', height: '100%' } as any)
                  : (EMPTY_STYLE as any)
              }
              {...(isWeb
                ? ({
                    'data-testid': 'travel-card-link',
                    role: isNavigable ? undefined : 'group',
                    tabIndex: isNavigable ? undefined : -1,
                    'aria-disabled': !isNavigable,
                    // P5.1: Hover-prefetch при наведении мыши
                    onPointerEnter: handlePointerEnter,
                    onClick: (e: any) => {
                      if (!isNavigable) return;
                      e.stopPropagation();

                      // Let browser keep native anchor behavior for new tab/window actions.
                      const shouldUseBrowserDefault =
                        e.button !== 0 ||
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey;

                      if (shouldUseBrowserDefault) {
                        return;
                      }

                      e.preventDefault();
                      handlePress();
                    },
                    onKeyDown: (e: any) => {
                      if (!isNavigable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handlePress();
                      }
                    },
                  } as any)
                : {})}
            >
              {card}
            </a>
          )
      : card}
  </View>
);
}

/** Компаратор: учитываем все поля, влияющие на рендер */
function areEqual(prev: Props, next: Props) {
    // Если объект поменялся по ссылке — почти всегда есть смысл перерендерить.
    if (prev.travel !== next.travel) {
        // Но можно быстро отсечь, если не изменились критичные поля (частый кейс)
        const a = prev.travel;
        const b = next.travel;
        const sameCore =
            a.id === b.id &&
            a.travel_image_thumb_url === b.travel_image_thumb_url &&
            a.name === b.name &&
            a.countryName === b.countryName &&
            a.userName === b.userName &&
            a.countUnicIpView === b.countUnicIpView &&
            a.rating === b.rating &&
            a.rating_count === b.rating_count;
        if (!sameCore) return false;
    }

    // Флаги, влияющие на оформление/обработчики
    if (
        prev.isSuperuser !== next.isSuperuser ||
        prev.isMetravel !== next.isMetravel ||
        prev.isSingle !== next.isSingle ||
        prev.selectable !== next.selectable ||
        prev.isSelected !== next.isSelected ||
        prev.visualVariant !== next.visualVariant ||
        prev.hideAuthor !== next.hideAuthor
    ) {
        return false;
    }

    // Resize-зависимые пропсы: при изменении viewport карточка должна перерисоваться
    return (
        prev.isMobile === next.isMobile &&
        prev.cardWidth === next.cardWidth &&
        prev.imageHeight === next.imageHeight &&
        prev.viewportWidth === next.viewportWidth
    );
}

export default memo(TravelListItem, areEqual);
