// ✅ УЛУЧШЕНИЕ: src/components/listTravel/TravelListItem.tsx - мигрирован на DESIGN_TOKENS и useThemedColors
import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Pressable, Text, Platform } from "react-native";
import Feather from '@expo/vector-icons/Feather';
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Travel } from "@/types/types";
import OptimizedFavoriteButton from "@/components/travel/OptimizedFavoriteButton";
import { fetchTravel, fetchTravelBySlug } from "@/api/travelsApi";
import { queryKeys } from "@/queryKeys";
import UnifiedTravelCard from "@/components/ui/UnifiedTravelCard";
import CardActionPressable from "@/components/ui/CardActionPressable";
import { useThemedColors } from '@/hooks/useTheme';
import { getResponsiveCardValues } from './enhancedTravelCardStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { formatViewCount } from "@/components/travel/utils/travelHelpers";
import { TRAVEL_CARD_IMAGE_HEIGHT } from './utils/listTravelConstants';
import TravelListItemCountriesList from './TravelListItemCountriesList';
import { createTravelListItemStyles } from './travelListItemStyles';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const ENABLE_TRAVEL_DETAILS_PREFETCH = false;
const AUTHOR_ICON_STYLE = { marginRight: 4 } as const;
const EMPTY_STYLE = {} as const;

// Простая эвристика для отбрасывания изображений с водяными знаками / стоковых доменов
const WATERMARK_DOMAINS = [
  'shutterstock',
  'istockphoto',
  'gettyimages',
  'depositphotos',
  'dreamstime',
  'alamy',
];

const isLikelyWatermarked = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return WATERMARK_DOMAINS.some((domain) => lower.includes(domain));
};

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
    viewportWidth?: number; // ✅ Ширина viewport для width-based адаптивности на web
    hideAuthor?: boolean;
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
                            viewportWidth,
                            hideAuthor = false,
                        }: Props) {

    // ✅ ДИЗАЙН: Используем динамические цвета темы
    const colors = useThemedColors();
    const styles = useMemo(() => createTravelListItemStyles(colors), [colors]);
    const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';
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

    const authorName = useMemo(() => {
        // 1. Пробуем user объект (самый надежный источник)
        const userObj = travel.user;
        if (userObj) {
            const firstName = userObj.first_name || userObj.name;
            const lastName = userObj.last_name;
            
            if (firstName && typeof firstName === 'string' && firstName.trim()) {
                const cleanFirstName = firstName.trim();
                if (lastName && typeof lastName === 'string' && lastName.trim()) {
                    return `${cleanFirstName} ${lastName.trim()}`.trim();
                }
                return cleanFirstName;
            }
        }
        
        // 2. Пробуем прямые поля в travel объекте
        const directName = (travel as any).author_name || (travel as any).authorName || (travel as any).owner_name || (travel as any).ownerName;
            if (directName && typeof directName === 'string' && directName.trim()) {
                const clean = directName.trim();
                // Проверяем на очевидные плейсхолдеры
                if (!/^[.\s\u00B7\u2022]+$|^Автор|^Пользователь|^User/i.test(clean)) {
                    return clean;
                }
            }
        
        // 3. Используем поле userName как основной fallback
        const base = userName;
            if (typeof base === 'string' && base.trim()) {
                const clean = base.trim();
                // Проверяем на плейсхолдеры, но менее строго
                if (!/^[.\s\u00B7\u2022]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i.test(clean)) {
                    return clean;
                }
            }
        
        // 4. Ничего не найдено
        return '';
    }, [userName, travel]);

    const _authorNameDisplay = useMemo(() => {
        const v = (authorName || '').trim();
        // Если в данных приходит плейсхолдер вроде "....." — показываем нормальный fallback
        if (!v) return 'Аноним';
        if (/^[.\s\u00B7\u2022_-]{2,}$/.test(v)) return 'Аноним';
        return v;
    }, [authorName]);

    const views = Number(countUnicIpView) || 0;

    const viewsFormatted = useMemo(() => formatViewCount(views), [views]);

    const travelKey = useMemo(() => {
        if (typeof slug === 'string' && slug.trim()) return slug.trim();
        if (typeof id === 'number' || typeof id === 'string') return String(id);
        return '';
    }, [id, slug]);

    const travelUrl = useMemo(() => {
        if (!travelKey) return '';
        return `/travels/${travelKey}`;
    }, [travelKey]);

    const navigationUrl = useMemo(() => {
        if (!travelUrl) return '';
        if (!_isMetravel) return travelUrl;
        return `${travelUrl}?returnTo=${encodeURIComponent('/metravel')}`;
    }, [_isMetravel, travelUrl]);

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
        const raw = typeof countryName === 'string' ? countryName : String(countryName ?? '');
        return raw.split(",").map((c) => c.trim()).filter(Boolean);
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
    const canEdit = React.useMemo(() => {
        if (isSuperuser) return true;
        if (!currentUserId) return false;

        const ownerId = String(
            (travel as any).userIds ??
            (travel as any).userId ??
            (travel as any).user?.id ??
            ''
        );

        return !!ownerId && String(currentUserId) === ownerId;
    }, [isSuperuser, currentUserId, travel]);
    const queryClient = useQueryClient();
    const anchorRef = useRef<any>(null);
    const hasPrefetchedRef = useRef(false);

    const authorUserId = useMemo(() => {
        const ownerId =
            (travel as any).userIds ??
            (travel as any).userId ??
            (travel as any).user?.id ??
            null;
        if (ownerId == null) return null;
        const v = String(ownerId).trim();
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

    const prefetchTravelDetails = useCallback(() => {
        if (!ENABLE_TRAVEL_DETAILS_PREFETCH) return;
        const travelId = slug ?? id;
        const isId = !isNaN(Number(travelId));

        const cachedData = queryClient.getQueryData(queryKeys.travel(travelId));
        if (cachedData) return;

        queryClient.prefetchQuery({
            queryKey: queryKeys.travel(travelId),
            queryFn: ({ signal }) =>
              isId
                ? fetchTravel(Number(travelId), { signal })
                : fetchTravelBySlug(travelId as string, { signal }),
            staleTime: 5 * 60 * 1000,
        });
    }, [slug, id, queryClient]);

    useEffect(() => {
        if (!ENABLE_TRAVEL_DETAILS_PREFETCH) return;
        if (Platform.OS !== 'web') return;
        if (hasPrefetchedRef.current) return;

        const el = anchorRef.current;
        if (!el) return;

        if (typeof window === 'undefined') return;
        if (typeof (window as any).IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                if (hasPrefetchedRef.current) return;
                hasPrefetchedRef.current = true;
                prefetchTravelDetails();
                observer.disconnect();
            },
            {
                root: null,
                // Небольшой запас, чтобы прогреть данные до клика
                rootMargin: '200px',
                threshold: 0.01,
            }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [prefetchTravelDetails]);

    const handlePress = useCallback(() => {
        if (!navigationUrl) return;
        if (selectable) {
            onToggle?.();
        } else {
            const travelId = (typeof slug === 'string' && slug.trim()) ? slug.trim() : id;
            const isId = !isNaN(Number(travelId));
            
            if (ENABLE_TRAVEL_DETAILS_PREFETCH && Platform.OS === 'web') {
                // Проверяем наличие в кеше перед prefetch
                const cachedData = queryClient.getQueryData(queryKeys.travel(travelId));
                if (!cachedData) {
                    // Предзагружаем в фоне с небольшой задержкой
                    setTimeout(() => {
                        queryClient.prefetchQuery({
                            queryKey: queryKeys.travel(travelId),
                            queryFn: ({ signal }) =>
                              isId
                                ? fetchTravel(Number(travelId), { signal })
                                : fetchTravelBySlug(travelId as string, { signal }),
                            staleTime: 5 * 60 * 1000, // 5 минут
                        });
                    }, 100);
                }
            }
            
            // На всякий: если слуг нет — откроем по ID
            router.push(navigationUrl as any);
        }
    }, [selectable, onToggle, slug, id, queryClient, navigationUrl]);

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

    
    // ✅ FIX: На web всегда используем View, чтобы избежать вложенных button ↔ button
    const InlineWebButton = isWeb ? View : Pressable;
    // ✅ B5.1: Улучшенные accessibility атрибуты
    const a11yLabelBase = `Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}`;
    const a11yLabelWithViews = views > 0 ? `${a11yLabelBase}. Просмотров: ${viewsFormatted}` : a11yLabelBase;

    const cardWrapperProps =
      isWeb
        ? selectable
          ? ({
              role: 'checkbox',
              tabIndex: 0 as const,
              onClick: (e: any) => {
                e.stopPropagation();
                e.preventDefault();
                handlePress();
              },
              onKeyDown: (e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePress();
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
  <View style={[styles.checkWrap, { pointerEvents: isWeb ? 'none' : 'auto' }] as any}>
    {isWeb ? (
      <View
        accessibilityLabel={isSelected ? 'Убрать из выбранного' : 'Выбрать'}
        testID="selection-checkbox"
        style={[styles.checkbox, isSelected && styles.checkboxChecked]}
      >
        {isSelected && <Feather name="check" size={14} color={colors.textOnPrimary} />}
      </View>
    ) : (
      <InlineWebButton
        accessibilityRole={isWeb ? undefined : 'button'}
        accessibilityLabel={isSelected ? 'Убрать из выбранного' : 'Выбрать'}
        testID="selection-checkbox"
        {...({ onPress: handlePress } as any)}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Feather name="check" size={14} color={colors.textOnPrimary} />}
        </View>
      </InlineWebButton>
    )}
  </View>
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
      title={name}
      imageUrl={travel_image_thumb_url}
      url={travelUrl}
      country={countries[0]}
      size={Platform.select({ default: 16, web: 18 })}
    />
  </View>
);

const leftTopSlot = canEdit ? (
  <View style={styles.adminActionsContainer}>
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
const hasContentInfo = useMemo(() => {
  return (
    (!hideAuthor && !!authorName) ||
    countries.length > 0 ||
    views > 0 ||
    popularityFlags.isPopular ||
    popularityFlags.isNew
  );
}, [hideAuthor, authorName, countries.length, popularityFlags.isPopular, popularityFlags.isNew, views]);

const contentSlotWithoutTitle = hasContentInfo ? (
  <>
    <View style={styles.countrySlot}>
      {countries.length > 0 ? (
        <TravelListItemCountriesList
          countries={countries}
          styles={styles}
          iconColor={tagIconColor}
        />
      ) : null}
    </View>

    <View
      style={[
        styles.metaRow,
        Platform.OS === 'web' && typeof viewportWidth === 'number' && viewportWidth < 375 && {
          alignItems: 'flex-start',
        },
      ]}
    >
      {((!hideAuthor && !!authorName) || views > 0) && (
        <View style={styles.metaInfoTopRow}>
          {!hideAuthor && !!authorName && (
            <View style={styles.metaBox}>
              <Feather
                name="user"
                size={Platform.select({ default: 10, web: 11 })}
                color={colors.textMuted}
                style={AUTHOR_ICON_STYLE}
              />
              {Platform.OS === 'web' ? (
                <View
                  {...({
                    ...(authorUserId
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `Открыть профиль автора ${authorName || 'Аноним'}`,
                        }
                      : {}),
                  } as any)}
                  onClick={handleAuthorPress}
                >
                  <Text
                    style={[
                      styles.metaTxt,
                    ]}
                    numberOfLines={1}
                  >
                    {authorName || 'Аноним'}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleAuthorPress}
                  style={({ pressed }) => [pressed && authorUserId ? { opacity: 0.85 } : null]}
                >
                  <Text style={styles.metaTxt} numberOfLines={1}>
                    {authorName || 'Аноним'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {views > 0 && (
            <View style={styles.metaBoxViews} testID="views-meta">
              <Feather
                name="eye"
                size={Platform.select({ default: 10, web: 11 })}
                color={colors.textMuted}
              />
              <Text style={styles.metaTxtViews} numberOfLines={1}>
                {viewsFormatted}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.metaBadgesRow}>
        {popularityFlags.isPopular && (
          <View style={[styles.statusBadge, styles.statusBadgePopular]}>
            <Feather name="trending-up" size={Platform.select({ default: 10, web: 12 })} color={colors.accent} />
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextPopular]}>Популярное</Text>
          </View>
        )}
        {popularityFlags.isNew && (
          <View style={[styles.statusBadge, styles.statusBadgeNew]}>
            <Feather name="star" size={Platform.select({ default: 10, web: 12 })} color={colors.success} />
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextNew]}>Новое</Text>
          </View>
        )}
      </View>
    </View>
  </>
) : null;

const unifiedCard = (
  <UnifiedTravelCard
    title={name}
    imageUrl={imgUrl && !isLikelyWatermarked(imgUrl) ? imgUrl : null}
    onPress={handlePress}
    mediaFit="contain"
    heroTitleOverlay={true}
    testID={cardTestId}
    style={[
      styles.card,
      Platform.OS === 'web' && ({ height: '100%' as any } as any),
      Platform.OS === 'web' && ({ borderRadius: responsiveValues.borderRadius } as any),
      globalFocusStyles.focusable,
      Platform.OS === 'android' && styles.androidOptimized,
      isSingle && styles.single,
      selectable && isSelected && styles.selected,
    ]}
    imageHeight={TRAVEL_CARD_IMAGE_HEIGHT}
    leftTopSlot={leftTopSlot}
    rightTopSlot={selectable ? null : rightTopSlot}
    containerOverlaySlot={selectableOverlay}
    contentSlot={contentSlotWithoutTitle}
    webAsView={isWeb}
    webPressableProps={
      isWeb
        ? selectable
          ? cardWrapperProps
          : {}
        : undefined
    }
    mediaProps={{
      placeholderBlurhash: PLACEHOLDER_BLURHASH,
      blurBackground: true,
      priority: Platform.OS === 'web' ? (isFirst ? 'high' : 'low') : 'normal',
      loading: Platform.OS === 'web' ? (isFirst ? 'eager' : 'lazy') : 'lazy',
      prefetch: Platform.OS === 'web' ? !!isFirst : false,
    }}
  />
);

const card = unifiedCard;
const isNavigable = Boolean(navigationUrl);

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
            <View
              testID="travel-card-link"
              ref={anchorRef}
              style={EMPTY_STYLE}
              {...(isWeb
                ? ({
                    'data-testid': 'travel-card-link',
                    role: isNavigable ? 'link' : 'group',
                    tabIndex: isNavigable ? 0 : -1,
                    'aria-disabled': !isNavigable,
                    onClick: (e: any) => {
                      if (!isNavigable) return;
                      e.stopPropagation();

                      const hasModifier =
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey ||
                        e.button === 1;

                      if (hasModifier) {
                        e.preventDefault();
                        void openExternalUrlInNewTab(navigationUrl, {
                          allowRelative: true,
                          baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
                        });
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
            </View>
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
            a.countUnicIpView === b.countUnicIpView;
        if (!sameCore) return false;
    }

    // Флаги, влияющие на оформление/обработчики
    if (
        prev.isSuperuser !== next.isSuperuser ||
        prev.isMetravel !== next.isMetravel ||
        prev.isSingle !== next.isSingle ||
        prev.selectable !== next.selectable ||
        prev.isSelected !== next.isSelected
    ) {
        return false;
    }

    return true;
}

export default memo(TravelListItem, areEqual);
