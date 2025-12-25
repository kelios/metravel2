// src/components/listTravel/TravelListItem.tsx
import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Travel } from "@/src/types/types";
import OptimizedFavoriteButton from "@/components/OptimizedFavoriteButton";
import { fetchTravel, fetchTravelBySlug } from "@/src/api/travelsApi";
import { optimizeImageUrl } from "@/utils/imageOptimization";
import UnifiedTravelCard from "@/components/ui/UnifiedTravelCard";
import { LIGHT_MODERN_DESIGN_TOKENS as TOKENS } from '@/constants/lightModernDesignTokens';
import { getResponsiveCardValues } from './enhancedTravelCardStyles';
import { globalFocusStyles } from '@/styles/globalFocus';
import { formatViewCount } from "@/components/travel/utils/travelHelpers";
import { TRAVEL_CARD_IMAGE_HEIGHT, TRAVEL_CARD_MAX_WIDTH } from './utils/listTravelConstants';

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const ICON_COLOR = "#111827"; // тёмкие иконки под светлое стекло
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

const CountriesList = memo(function CountriesList({ countries }: { countries: string[] }) {
  if (!countries.length) return null;
  return (
    <View style={styles.tags}>
      {countries.slice(0, 1).map((c) => (
        <View key={c} style={styles.tag}>
          <Feather name="map-pin" size={11} color={ICON_COLOR} style={{ marginRight: 4 }} />
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

    const travelUrl = useMemo(() => {
        const key = (typeof slug === 'string' && slug.trim()) ? slug.trim() : id;
        return `/travels/${key}`;
    }, [id, slug]);

    const cardTestId = useMemo(() => {
        return selectable ? `travel-card-selectable-${id}` : `travel-card-${id}`;
    }, [selectable, id]);

    // ✅ УЛУЧШЕНИЕ: Оптимизация превью под карточку с использованием новых утилит
    const imgUrl = useMemo(() => {
        if (!travel_image_thumb_url) return null;

        // Упрощенная обработка - меньше вычислений при скролле
        return travel_image_thumb_url;
    }, [travel_image_thumb_url]);

    useEffect(() => {
        if (!isFirst || Platform.OS !== 'web' || !imgUrl) return;
        if (typeof document === 'undefined') return;

        const linkId = `preload-travel-img-${String(id)}`;
        // Если уже есть такой preload — не дублируем
        if (document.getElementById(linkId)) return;

        // Для LCP-картинки прелоадим оптимизированный вариант под реальный размер карточки,
        // чтобы не тянуть оригинал слишком большого разрешения и не создавать лишние скачивания.
        const assumedCardWidth =
          typeof cardWidth === 'number'
            ? Math.round(cardWidth)
            : 360;
        const assumedImageHeight = TRAVEL_CARD_IMAGE_HEIGHT; // соответствует styles.imageContainer

        const preloadUrl =
          optimizeImageUrl(imgUrl, {
            width: assumedCardWidth,
            height: assumedImageHeight,
            format: 'webp',
            quality: 85,
          }) ?? imgUrl;

        const link = document.createElement('link');
        link.id = linkId;
        // Use prefetch (instead of preload) to avoid "preloaded but not used" warnings when the first card
        // image is lazily mounted/updated.
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = preloadUrl;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);

        return () => {
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
        };
    }, [isFirst, imgUrl, id, cardWidth]);

    const countries = useMemo(
        () => (countryName || "").split(",").map((c) => c.trim()).filter(Boolean),
        [countryName]
    );

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
            router.push(`/travels/${travelId}`);
        }
    }, [selectable, onToggle, slug, id, queryClient]);

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
              'aria-label': `Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}. Просмотров: ${viewsFormatted}`,
            } as any)
          : {}
        : {
            onPress: handlePress,
            android_ripple: Platform.OS === "android" ? { color: "rgba(17,24,39,0.06)" } : undefined,
            accessibilityState: selectable ? { selected: isSelected } : undefined,
            accessibilityLabel: `Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}. Просмотров: ${viewsFormatted}`,
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
        {isSelected && <Feather name="check" size={14} color="#fff" />}
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
      <Feather name="edit-2" size={14} color={TOKENS.colors.text} />
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
      <Feather name="trash-2" size={14} color={TOKENS.colors.danger} />
    </InlineWebButton>
  </View>
) : null;

const contentSlot = (
  <>
    <Text
      style={[
        styles.title,
      ]}
      numberOfLines={2}
    >
      {name}
    </Text>

    <View style={styles.countrySlot}>
      {countries.length > 0 ? <CountriesList countries={countries} /> : null}
    </View>

    <View
      style={[
        styles.metaRow,
        Platform.OS === 'web' && typeof viewportWidth === 'number' && viewportWidth < 375 && {
          alignItems: 'flex-start',
        },
      ]}
    >
      <View style={styles.metaInfoTopRow}>
        {!hideAuthor && (
          <View style={styles.metaBox}>
            <Feather
              name="user"
              size={Platform.select({ default: 10, web: 11 })}
              color={Platform.OS === 'web' ? '#334155' : '#64748b'}
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
                        onClick: (e: any) => handleAuthorPress(e),
                        onKeyDown: (e: any) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAuthorPress(e);
                          }
                        },
                        onMouseDown: (e: any) => e.stopPropagation?.(),
                        style: { cursor: 'pointer' },
                      }
                    : {
                        style: {},
                      }),
                } as any)}
              >
                <Text style={styles.metaTxt} numberOfLines={1}>
                  {authorNameDisplay}
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleAuthorPress}
                disabled={!authorUserId}
                accessibilityRole={authorUserId ? 'button' : undefined}
                accessibilityLabel={authorUserId ? `Открыть профиль автора ${authorNameDisplay}` : undefined}
                style={({ pressed }) => [pressed && authorUserId ? { opacity: 0.85 } : null]}
              >
                <Text style={styles.metaTxt} numberOfLines={1}>
                  {authorNameDisplay}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.metaBoxViews} testID="views-meta">
          <Feather
            name="eye"
            size={Platform.select({ default: 10, web: 11 })}
            color={Platform.OS === 'web' ? '#334155' : '#64748b'}
          />
          <Text style={styles.metaTxtViews} numberOfLines={1}>
            {viewsFormatted}
          </Text>
        </View>
      </View>

      <View style={styles.metaBadgesRow}>
        {popularityFlags.isPopular && (
          <View style={[styles.statusBadge, styles.statusBadgePopular]}>
            <Feather
              name="trending-up"
              size={Platform.select({ default: 10, web: 12 })}
              color={TOKENS.colors.primary}
            />
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextPopular]}>Популярное</Text>
          </View>
        )}
        {popularityFlags.isNew && (
          <View style={[styles.statusBadge, styles.statusBadgeNew]}>
            <Feather name="star" size={Platform.select({ default: 10, web: 12 })} color={TOKENS.colors.success} />
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextNew]}>Новое</Text>
          </View>
        )}
      </View>
    </View>
  </>
);

const unifiedCard = (
  <UnifiedTravelCard
    title={name}
    imageUrl={imgUrl && !isLikelyWatermarked(imgUrl) ? imgUrl : null}
    onPress={handlePress}
    mediaFit="contain"
    heroTitleOverlay={false}
    testID={cardTestId}
    style={[
      styles.card,
      Platform.OS === 'web' &&
        { height: '100%' as any },
      Platform.OS === 'web' && { borderRadius: responsiveValues.borderRadius },
      globalFocusStyles.focusable,
      Platform.OS === 'android' && styles.androidOptimized,
      isSingle && styles.single,
      selectable && isSelected && styles.selected,
    ]}
    imageHeight={TRAVEL_CARD_IMAGE_HEIGHT}
    leftTopSlot={leftTopSlot}
    rightTopSlot={selectable ? null : rightTopSlot}
    containerOverlaySlot={selectableOverlay}
    contentSlot={contentSlot}
    webAsView={Platform.OS === 'web'}
    webPressableProps={selectable ? cardWrapperProps : {}}
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

return (
  <View
    style={[
      styles.wrap,
      Platform.OS === 'web' && typeof cardWidth === 'number' && {
        // ✅ На web ограничиваем фактическую ширину карточки и центрируем её в колонке
        // maxWidth: cardWidth, // УБРАНО: теперь ширина ограничивается в самих стилях карточки
        alignSelf: 'center',
        width: '100%',
      },
    ]}
  >
    {Platform.OS === 'web' ? (
      // На вебе различаем два режима:
      // 1) selectable === true (страница экспорта) — карточка только выбирает, без перехода по ссылке
      // 2) selectable === false — поведение как раньше, но без вложенных <button>/<a>
      selectable ? (
        card
      ) : (
        <View
          testID="travel-card-link"
          ref={anchorRef}
          style={{}}
          {...(Platform.OS === 'web'
            ? ({
                'data-testid': 'travel-card-link',
                role: 'link',
                tabIndex: 0,
                onClick: (e: any) => {
                  // Не даём событию дойти до внутренних Pressable
                  e.stopPropagation();

                  const hasModifier =
                    e.metaKey ||
                    e.ctrlKey ||
                    e.shiftKey ||
                    e.altKey ||
                    e.button === 1;

                  if (hasModifier) {
                    // Открываем ТОЛЬКО в новой вкладке, текущую не трогаем
                    e.preventDefault();
                    if (typeof window !== 'undefined') {
                      window.open(travelUrl, '_blank', 'noopener,noreferrer');
                    }
                    return;
                  }

                  // Обычный клик: SPA-навигация в текущей вкладке
                  e.preventDefault();
                  handlePress();
                },
                onKeyDown: (e: any) => {
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
    ) : (
      card
    )}
  </View>
);

}

 const styles = StyleSheet.create({
  wrap: { 
    width: "100%",
  },

  // Современная минималистичная карточка
  card: {
    width: '100%',
    backgroundColor: TOKENS.colors.surface,
    borderRadius: TOKENS.radii.lg,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: TOKENS.colors.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          maxWidth: TRAVEL_CARD_MAX_WIDTH,
          alignSelf: 'center',
        } as any)
      : null),
    // Минимальные тени для глубины - разделены по платформам
    ...(Platform.OS === 'web' 
      ? { boxShadow: TOKENS.shadows.subtle }
      : TOKENS.shadowsNative.subtle
    ),
  },

  imageContainer: {
    position: 'relative',
    width: '100%',
    // Фиксированная высота для предсказуемого layout и отсутствия прыжков при загрузке изображений
    height: TRAVEL_CARD_IMAGE_HEIGHT,
    backgroundColor: TOKENS.colors.backgroundSecondary,
    overflow: 'hidden',
  },

  androidOptimized: {
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
  },

  selected: {
    ...(Platform.OS === 'web' 
      ? { boxShadow: TOKENS.shadows.soft, borderColor: TOKENS.colors.primary }
      : {
          shadowColor: TOKENS.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }
    ),
  },

  single: {
    maxWidth: 600,
    alignSelf: "center",
  },

  imgStub: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: TOKENS.colors.backgroundSecondary,
  },

  // Убираем градиент для минимализма
  grad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "25%", // Минимальный градиент
  },

  // Упрощенные бейджи
  topBadges: {
    position: "absolute",
    bottom: TOKENS.spacing.sm,
    left: TOKENS.spacing.sm,
    right: TOKENS.spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TOKENS.spacing.xs,
    zIndex: 10,
  },

  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: TOKENS.radii.full,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    ...(Platform.OS === 'web' ? {
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    } : {}),
  },

  infoBadgeText: {
    fontSize: TOKENS.typography.sizes.sm,
    color: TOKENS.colors.text,
    fontWeight: TOKENS.typography.weights.medium,
    letterSpacing: -0.2,
  },

  // Упрощенные кнопки управления
  adminActionsContainer: {
    position: 'absolute',
    top: TOKENS.spacing.sm,
    left: TOKENS.spacing.sm,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOKENS.spacing.xs,
    // Компактный glass-пил, по высоте близкий к кнопке избранного
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: TOKENS.radii.full,
    paddingHorizontal: TOKENS.spacing.xs,
    paddingVertical: TOKENS.spacing.xs * 0.75,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    } : {}),
  },

  adminBtn: {
    paddingHorizontal: TOKENS.spacing.xs,
    paddingVertical: TOKENS.spacing.xs * 0.25,
    borderRadius: TOKENS.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  adminDivider: {
    width: 1,
    height: 16,
    backgroundColor: TOKENS.colors.border,
  },

  favoriteButtonContainer: {
    position: 'absolute',
    top: TOKENS.spacing.sm,
    right: TOKENS.spacing.sm,
    zIndex: 20,
  },

  // Упрощенный контент
  contentBelow: {
    // Компактный внутренний отступ и небольшой gap между элементами
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: TOKENS.colors.surface,
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
    fontSize: TOKENS.card.title.size,
    fontWeight: TOKENS.card.title.weight,
    lineHeight: TOKENS.card.title.lineHeight,
    color: TOKENS.colors.text,
    marginBottom: 0,
  },

  // Упрощенная мета-информация
  metaRow: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: 'flex-start',
    gap: Platform.OS === 'web' ? 6 : TOKENS.spacing.xs,
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
    gap: TOKENS.spacing.xs,
    marginTop: Platform.OS === 'web' ? 4 : TOKENS.spacing.xs * 0.5,
    marginBottom: Platform.OS === 'web' ? 8 : 0,
    flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap',
    overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
    // Чуть меньшая минимальная высота, чтобы панель была компактнее
    minHeight: Platform.OS === 'web' ? 28 : 22,
  },

  metaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    flex: 1,
    minWidth: 0,
  },

  // Отдельный стиль для просмотров - абсолютно позиционированы
  metaBoxViews: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.xs,
    paddingVertical: 2,
    flexShrink: 0,
  },

  metaTxt: {
    fontSize: TOKENS.card.meta.size,
    color: Platform.OS === 'web' ? TOKENS.colors.text : TOKENS.colors.textSecondary,
    fontWeight: Platform.OS === 'web' ? '500' : TOKENS.card.meta.weight,
    lineHeight: Platform.OS === 'web' ? 16 : TOKENS.card.meta.lineHeight,
    flex: 1, // Занимаем доступное пространство в контейнере
    minWidth: 0, // Важно для корректного обрезания текста
    opacity: 1,
  },

  // Отдельный стиль для текста просмотров - не обрезается
  metaTxtViews: {
    fontSize: TOKENS.card.meta.size,
    color: Platform.OS === 'web' ? TOKENS.colors.text : TOKENS.colors.textSecondary,
    fontWeight: Platform.OS === 'web' ? '500' : TOKENS.card.meta.weight,
    lineHeight: Platform.OS === 'web' ? 16 : TOKENS.card.meta.lineHeight,
    opacity: 1,
  },

  // Упрощенные статус-бейджи (современные нейтральные pill-метки)
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs * 0.75,
    borderRadius: TOKENS.radii.full,
    borderWidth: 1,
    backgroundColor: TOKENS.colors.backgroundSecondary,
    borderColor: TOKENS.colors.border,
  },

  statusBadgePopular: {},

  statusBadgeNew: {},

  statusBadgeText: {
    fontSize: TOKENS.typography.sizes.xs,
    fontWeight: TOKENS.typography.weights.semibold,
    letterSpacing: -0.1,
    color: TOKENS.colors.textSecondary,
  },

  statusBadgeTextPopular: {},

  statusBadgeTextNew: {},

  // Упрощенные теги стран
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TOKENS.spacing.xs,
  },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.backgroundSecondary,
    borderRadius: TOKENS.radii.sm,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: Platform.OS === 'web' ? TOKENS.spacing.xxs : TOKENS.spacing.xs,
    gap: TOKENS.spacing.xs,
  },

  tagTxt: {
    fontSize: Platform.OS === 'web' ? TOKENS.typography.sizes.xs : TOKENS.typography.sizes.sm,
    color: TOKENS.colors.textSecondary,
    fontWeight: TOKENS.typography.weights.medium,
  },

  // Упрощенные чекбоксы
  checkWrap: {
    position: "absolute",
    top: TOKENS.spacing.sm,
    right: TOKENS.spacing.sm,
    zIndex: 20,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 2,
    borderColor: TOKENS.colors.borderStrong,
    backgroundColor: TOKENS.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },

  checkboxChecked: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
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
