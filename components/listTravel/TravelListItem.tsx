// ✅ УЛУЧШЕНИЕ: src/components/listTravel/TravelListItem.tsx - мигрирован на DESIGN_TOKENS и useThemedColors
import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import Feather from '@expo/vector-icons/Feather';
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Travel } from "@/src/types/types";
import OptimizedFavoriteButton from "@/components/OptimizedFavoriteButton";
import { fetchTravel, fetchTravelBySlug } from "@/src/api/travelsApi";
import UnifiedTravelCard from "@/components/ui/UnifiedTravelCard";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { getResponsiveCardValues } from './enhancedTravelCardStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { formatViewCount } from "@/components/travel/utils/travelHelpers";
import { TRAVEL_CARD_IMAGE_HEIGHT } from './utils/listTravelConstants';

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const ENABLE_TRAVEL_DETAILS_PREFETCH = false;

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

type CountriesListProps = {
  countries: string[];
  styles: ReturnType<typeof createStyles>;
  iconColor: string;
};

const CountriesList = memo(function CountriesList({ countries, styles, iconColor }: CountriesListProps) {
  if (!countries.length) return null;
  return (
    <View style={styles.tags}>
      {countries.slice(0, 1).map((c) => (
        <View key={c} style={styles.tag}>
          <Feather name="map-pin" size={11} color={iconColor} style={{ marginRight: 4 }} />
          <Text style={styles.tagTxt} numberOfLines={1} ellipsizeMode="tail">
            {c}
          </Text>
        </View>
      ))}
    </View>
  );
});

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
    const styles = useMemo(() => createStyles(colors), [colors]);
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

    const authorNameDisplay = useMemo(() => {
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

        const cachedData = queryClient.getQueryData(['travel', travelId]);
        if (cachedData) return;

        queryClient.prefetchQuery({
            queryKey: ['travel', travelId],
            queryFn: () => isId ? fetchTravel(Number(travelId)) : fetchTravelBySlug(travelId as string),
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
                const cachedData = queryClient.getQueryData(['travel', travelId]);
                if (!cachedData) {
                    // Предзагружаем в фоне с небольшой задержкой
                    setTimeout(() => {
                        queryClient.prefetchQuery({
                            queryKey: ['travel', travelId],
                            queryFn: () => isId ? fetchTravel(Number(travelId)) : fetchTravelBySlug(travelId as string),
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
    const InlineWebButton = Platform.OS === 'web' ? View : Pressable;
    // ✅ B5.1: Улучшенные accessibility атрибуты
    const a11yLabelBase = `Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}`;
    const a11yLabelWithViews = views > 0 ? `${a11yLabelBase}. Просмотров: ${viewsFormatted}` : a11yLabelBase;

    const cardWrapperProps =
      Platform.OS === 'web'
        ? selectable
          ? ({
              role: 'button',
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
              'aria-pressed': isSelected,
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
  <View style={styles.checkWrap}>
    <InlineWebButton
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel={isSelected ? 'Убрать из выбранного' : 'Выбрать'}
      testID="selection-checkbox"
      {...(Platform.OS === 'web'
        ? (cardWrapperProps as any)
        : ({ onPress: handlePress } as any))}
    >
      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
        {isSelected && <Feather name="check" size={14} color={colors.textOnPrimary} />}
      </View>
    </InlineWebButton>
  </View>
) : null;

const rightTopSlot = (
  <View
    style={[styles.favoriteButtonContainer, { pointerEvents: 'box-none' } as any]}
    {...(Platform.OS === 'web' && {
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
    <InlineWebButton
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel="Редактировать"
      onPress={(handleEdit as any)}
      style={styles.adminBtn}
      {...(Platform.OS === 'web'
        ? ({
            role: 'button',
            tabIndex: 0,
            onClick: (e: any) => handleEdit(e),
            onKeyDown: (e: any) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleEdit(e);
              }
            },
            onMouseDown: (e: any) => e.stopPropagation?.(),
          } as any)
        : {})}
    >
      <Feather name="edit-2" size={14} color={colors.text} />
    </InlineWebButton>
    <View style={styles.adminDivider} />
    <InlineWebButton
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel="Удалить"
      onPress={(handleDelete as any)}
      style={styles.adminBtn}
      testID="delete-button"
      {...(Platform.OS === 'web'
        ? ({
            role: 'button',
            tabIndex: 0,
            onClick: (e: any) => handleDelete(e),
            onKeyDown: (e: any) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleDelete(e);
              }
            },
            onMouseDown: (e: any) => e.stopPropagation?.(),
          } as any)
        : {})}
    >
      <Feather name="trash-2" size={14} color={colors.danger} />
    </InlineWebButton>
  </View>
) : null;

// Проверяем, есть ли какая-либо информация для отображения в контентной области
const hasContentInfo = useMemo(() => {
  return (
    (!hideAuthor && (authorName || authorNameDisplay)) ||
    countries.length > 0 ||
    views > 0 ||
    popularityFlags.isPopular ||
    popularityFlags.isNew
  );
}, [hideAuthor, authorName, authorNameDisplay, countries.length, popularityFlags.isPopular, popularityFlags.isNew, views]);

const contentSlotWithoutTitle = hasContentInfo ? (
  <>
    <View style={styles.countrySlot}>
      {countries.length > 0 ? (
        <CountriesList countries={countries} styles={styles} iconColor={tagIconColor} />
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
      {(!hideAuthor || views > 0) && (
        <View style={styles.metaInfoTopRow}>
          {!hideAuthor && (
            <View style={styles.metaBox}>
              <Feather
                name="user"
                size={Platform.select({ default: 10, web: 11 })}
                color={colors.textMuted}
                style={{ marginRight: 4 }}
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
    webAsView={Platform.OS === 'web'}
    webPressableProps={
      Platform.OS === 'web'
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
    {Platform.OS === 'web'
      ? selectable
        ? card
        : (
            <View
              testID="travel-card-link"
              ref={anchorRef}
              style={{}}
              {...(Platform.OS === 'web'
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
                        if (typeof window !== 'undefined') {
                          window.open(navigationUrl, '_blank', 'noopener,noreferrer');
                        }
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

// ✅ ДИЗАЙН: Создание динамических стилей с useThemedColors
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  wrap: {
    width: '100%',
  },

  // Современная минималистичная карточка
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: colors.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          maxWidth: '100%',
          alignSelf: 'stretch',
        } as any)
      : null),
    // Минимальные тени для глубины - разделены по платформам
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.light,
      } as any,
      ios: colors.shadows.light,
      android: { elevation: 2 },
      default: colors.shadows.light,
    }),
  },

  androidOptimized: {
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
  },

  selected: {
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.hover,
        borderColor: colors.primary,
      } as any,
      default: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },

  single: {
    maxWidth: 600,
    alignSelf: 'center',
  },

  infoBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    letterSpacing: -0.2,
  },

  // Упрощенные кнопки управления
  adminActionsContainer: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    left: DESIGN_TOKENS.spacing.sm,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    // Компактный glass-пил, по высоте близкий к кнопке избранного
    backgroundColor: colors.surfaceMuted,
    borderRadius: DESIGN_TOKENS.radii.full,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs * 0.75,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    } : {}),
  },

  adminBtn: {
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs * 0.25,
    borderRadius: DESIGN_TOKENS.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  adminDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },

  favoriteButtonContainer: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    right: DESIGN_TOKENS.spacing.sm,
    zIndex: 20,
  },

  // Упрощенный контент
  contentBelow: {
    // Компактный внутренний отступ и небольшой gap между элементами
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: colors.surface,
    width: '100%',
    minWidth: 0,
    ...(Platform.OS === 'web'
      ? {
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 16,
        }
      : {}),
  },

  countrySlot: {
    width: '100%',
    minWidth: 0,
    ...(Platform.OS === 'web'
      ? ({
          minHeight: 34,
        } as any)
      : ({ minHeight: 28 } as any)),
  },

  // Современная типографика
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 0,
  },

  // Упрощенная мета-информация
  metaRow: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: 'flex-start',
    gap: Platform.OS === 'web' ? 6 : DESIGN_TOKENS.spacing.xs,
  },

  // Первая строка: пользователь + просмотры
  metaInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: Platform.OS === 'web' ? 18 : 20,
    minWidth: 0,
  },

  // Вторая строка: бейджи Популярное / Новое
  metaBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: Platform.OS === 'web' ? 4 : DESIGN_TOKENS.spacing.xs * 0.5,
    marginBottom: Platform.OS === 'web' ? 8 : 0,
    flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap',
    overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
    // Чуть меньшая минимальная высота, чтобы панель была компактнее
    minHeight: Platform.OS === 'web' ? 28 : 22,
  },

  metaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.xs,
    flex: 1,
    minWidth: 0,
  },

  // Отдельный стиль для просмотров - абсолютно позиционированы
  metaBoxViews: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: 2,
    flexShrink: 0,
  },

  metaTxt: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    lineHeight: Platform.OS === 'web' ? 16 : 18,
    flex: 1, // Занимаем доступное пространство в контейнере
    minWidth: 0, // Важно для корректного обрезания текста
    opacity: 1,
  },

  // Отдельный стиль для текста просмотров - не обрезается
  metaTxtViews: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    lineHeight: Platform.OS === 'web' ? 16 : 18,
    opacity: 1,
  },

  // Упрощенные статус-бейджи (современные нейтральные pill-метки)
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs * 0.75,
    borderRadius: DESIGN_TOKENS.radii.full,
    borderWidth: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },

  statusBadgePopular: {},

  statusBadgeNew: {},

  statusBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    letterSpacing: -0.1,
    color: colors.textSecondary,
  },

  statusBadgeTextPopular: {},

  statusBadgeTextNew: {},

  // Упрощенные теги стран
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: DESIGN_TOKENS.spacing.xs,
  },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: Platform.OS === 'web' ? DESIGN_TOKENS.spacing.xxs : DESIGN_TOKENS.spacing.xs,
    gap: DESIGN_TOKENS.spacing.xs,
  },

  tagTxt: {
    fontSize: Platform.OS === 'web' ? DESIGN_TOKENS.typography.sizes.xs : DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },

  // Упрощенные чекбоксы
  checkWrap: {
    position: "absolute",
    top: DESIGN_TOKENS.spacing.sm,
    right: DESIGN_TOKENS.spacing.sm,
    zIndex: 20,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },

  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});

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
