// src/components/listTravel/TravelListItem.tsx
import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import type { Travel } from "@/src/types/types";
import OptimizedFavoriteButton from "@/components/OptimizedFavoriteButton";
import { fetchTravel, fetchTravelBySlug } from "@/src/api/travelsApi";
import {generateSrcSet } from "@/utils/imageOptimization";
import { LIGHT_MODERN_DESIGN_TOKENS as TOKENS } from '@/constants/lightModernDesignTokens';
import { enhancedTravelCardStyles, getResponsiveCardValues } from './enhancedTravelCardStyles';
import { globalFocusStyles } from '@/styles/globalFocus';

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const ICON_COLOR = "#111827"; // тёмкие иконки под светлое стекло

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

const WebImageOptimized = memo(function WebImageOptimized({
                                                              src,
                                                              alt,
                                                              priority = false,
                                                          }: {
    src: string;
    alt: string;
    priority?: boolean;
}) {
    // ✅ ОПТИМИЗАЦИЯ: Intersection Observer для lazy loading (кроме приоритетных картинок)
    const [isInView, setIsInView] = useState(priority);
    const [isLoaded, setIsLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        // Для приоритетных изображений (первой карточки) не используем lazy loading — грузим сразу
        if (priority) {
            setIsInView(true);
            return;
        }

        if (!imgRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '50px' } // Начинаем загрузку за 50px до появления
        );

        observer.observe(imgRef.current);
        return () => observer.disconnect();
    }, [priority]);

    // Дополнительная проверка для SSR
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
        return null;
    }
    
    const imageSrcSet = useMemo(() => generateSrcSet(src, [400, 800, 1200]), [src]);
    // Для трёх колонок с левой панелью уточняем sizes, чтобы не тянуть лишнее
    const imageSizes = useMemo(
      () => "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 30vw",
      []
    );
    
    return (
        <img
            ref={imgRef}
            src={isInView ? src : undefined}
            srcSet={isInView ? imageSrcSet : undefined}
            sizes={imageSizes}
            alt={alt}
            style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: isLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
            }}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            {...(Platform.OS === 'web' ? { fetchpriority: priority ? "high" : "auto" } as any : {})}
        />
    );
});

const NativeImageOptimized = memo(function NativeImageOptimized({
                                                                    uri,
                                                                }: {
    uri: string;
}) {
    return (
        <ExpoImage
            source={{ uri }}
            style={styles.img}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            priority="low"
            recyclingKey={uri}
            accessibilityIgnoresInvertColors
            testID="travel-image"
        />
    );
});

const CountriesList = memo(function CountriesList({ countries }: { countries: string[] }) {
    if (!countries.length) return null;
    return (
        <View style={styles.tags}>
            {countries.slice(0, 2).map((c) => (
                <View key={c} style={styles.tag}>
                    <Feather name="map-pin" size={11} color={ICON_COLOR} style={{ marginRight: 4 }} />
                    <Text style={styles.tagTxt} numberOfLines={1} ellipsizeMode="tail">
                        {c}
                    </Text>
                </View>
            ))}
            {countries.length > 2 && (
                <View style={styles.tag}>
                    <Text style={styles.tagTxt} numberOfLines={1}>
                        +{countries.length - 2}
                    </Text>
                </View>
            )}
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
};

function TravelListItem({
                            travel,
                            currentUserId,
                            isSuperuser,
                            isMetravel,
                            onDeletePress,
                            isFirst = false,
                            isSingle = false,
                            selectable = false,
                            isSelected = false,
                            onToggle,
                            isMobile = false,
                            cardWidth,
                            viewportWidth,
                        }: Props) {
    if (!travel) return null;

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
            if (!/^[\.\s\u00B7\u2022]+$|^Автор|^Пользователь|^User/i.test(clean)) {
                return clean;
            }
        }
        
        // 3. Используем поле userName как основной fallback
        const base = userName;
        if (typeof base === 'string' && base.trim()) {
            const clean = base.trim();
            // Проверяем на плейсхолдеры, но менее строго
            if (!/^[\.\s\u00B7\u2022]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i.test(clean)) {
                return clean;
            }
        }
        
        // 4. Ничего не найдено
        return '';
    }, [userName, travel.user?.name, travel.user?.first_name, travel.user?.last_name]);

    // Отладка: выводим результат
    if (__DEV__) {
        console.log('Author name result:', authorName, 'Raw userName:', userName, 'User object:', travel.user);
    }

    const views = Number(countUnicIpView) || 0;

    // ✅ УЛУЧШЕНИЕ: Оптимизация превью под карточку с использованием новых утилит
    const imgUrl = useMemo(() => {
        if (!travel_image_thumb_url) return null;
        
        // Упрощенная обработка - меньше вычислений при скролле
        return travel_image_thumb_url;
    }, [travel_image_thumb_url]);

    // ✅ PRELOAD: для первой карточки на web добавляем link rel="preload" для её изображения
    useEffect(() => {
        if (!isFirst || Platform.OS !== 'web' || !imgUrl) return;
        if (typeof document === 'undefined') return;

        const linkId = `preload-travel-img-${String(id)}`;
        // Если уже есть такой preload — не дублируем
        if (document.getElementById(linkId)) return;

        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'preload';
        link.as = 'image';
        link.href = imgUrl;
        // Небольшой hint для браузера
        (link as any).fetchpriority = 'high';
        document.head.appendChild(link);

        return () => {
            // При анмаунте можно убрать, но это не обязательно критично
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
        };
    }, [isFirst, imgUrl, id]);

    const viewsFormatted = useMemo(() => {
        try {
            // Компактный формат: 1,2K / 3,4M
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                compactDisplay: 'short',
            }).format(views);
        } catch {
            return String(views);
        }
    }, [views]);

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

    // ✅ ИСПРАВЛЕНИЕ: Предзагрузка данных только при клике (с небольшой задержкой)
    // Не делаем запрос при наведении - это вызывает множественные ненужные запросы
    const travelUrl = `/travels/${slug ?? id}`;

    const handlePress = useCallback(() => {
        if (selectable) {
            onToggle?.();
        } else {
            const travelId = slug ?? id;
            const isId = !isNaN(Number(travelId));
            
            // ✅ Предзагружаем данные только при клике (если данных еще нет в кеше)
            // Используем небольшую задержку, чтобы навигация была плавной
            if (Platform.OS === 'web') {
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
            router.push(`/travels/${slug ?? id}`);
        }
    }, [selectable, onToggle, slug, id, router, queryClient]);

    const handleEdit = useCallback((e?: any) => {
        // Предотвращаем всплытие и стандартное поведение на веб-платформе
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) {
                e.preventDefault();
            }
        }
        console.log('Edit travel ID:', id, typeof id);
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

    
    // ✅ FIX: On web (non-selectable), we wrap card in <a>, so use View instead of Pressable to avoid nested buttons
    const CardWrapper = (Platform.OS === 'web' && !selectable) ? View : Pressable;
    // ✅ B5.1: Улучшенные accessibility атрибуты
    const cardWrapperProps = (Platform.OS === 'web' && !selectable) 
        ? {} 
        : {
            onPress: handlePress,
            android_ripple: Platform.OS === "android" ? { color: "rgba(17,24,39,0.06)" } : undefined,
            accessibilityState: selectable ? { selected: isSelected } : undefined,
            accessibilityLabel: `Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}. Просмотров: ${viewsFormatted}`,
            accessibilityRole: "button" as const,
            accessibilityHint: selectable ? 'Двойное нажатие для выбора' : 'Двойное нажатие для просмотра деталей',
            // ✅ B5.1: Дополнительные ARIA атрибуты для web
            // @ts-ignore - aria attributes for web accessibility
            'aria-label': Platform.OS === 'web' ? `Путешествие: ${name}. ${countries.length > 0 ? `Страны: ${countries.join(', ')}. ` : ''}Просмотров: ${viewsFormatted}` : undefined,
            // @ts-ignore
            'aria-pressed': selectable ? isSelected : undefined,
        };

    const cardTestId = 'travel-card-link';
    const card = (
      <CardWrapper
        {...cardWrapperProps}
        testID={cardTestId}
        style={[
          styles.card,
          Platform.OS === 'web' && {
            // ✅ Радиус карточки на web теперь зависит от ширины viewport
            borderRadius: responsiveValues.borderRadius,
          },
          globalFocusStyles.focusable,
          Platform.OS === "android" && styles.androidOptimized,
          isSingle && styles.single,
          selectable && isSelected && styles.selected,
        ]}
      >
        {selectable && (
          <View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: isSelected ? "rgba(5,150,105,0.12)" : "rgba(96,165,250,0.08)",
                zIndex: 2,
                opacity: 1,
                transitionDuration: "150ms",
                pointerEvents: "none",
              } as any,
            ]}
          />
        )}

        {/* Блок изображения */}
        <View style={styles.imageContainer}>
          {imgUrl && !isLikelyWatermarked(imgUrl) ? (
            Platform.OS === "web" ? (
              // Первую карточку загружаем с приоритетом для улучшения LCP
              <WebImageOptimized src={imgUrl} alt={name} priority={!!isFirst} />
            ) : (
              <NativeImageOptimized uri={imgUrl} />
            )
          ) : (
            <View style={styles.imgStub} testID="image-stub">
              <Feather name="image" size={40} color="#94a3b8" />
            </View>
          )}

          {/* Избранное (сердечко) в правом верхнем углу */}
          {!selectable && (
            <View
              style={styles.favoriteButtonContainer}
              pointerEvents="box-none"
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
          )}

          {/* Кнопки управления (Top Left) - перенесены сюда, чтобы не мешать бейджам внизу */}
          {canEdit && !selectable && (
            <View
              style={styles.adminActionsContainer}
              pointerEvents="box-none"
              {...(Platform.OS === "web" && {
                onClick: (e: any) => {
                  e.stopPropagation();
                  e.preventDefault();
                },
                onMouseDown: (e: any) => e.stopPropagation(),
              })}
            >
              <Pressable 
                onPress={(e) => handleEdit(e)} 
                hitSlop={10} 
                style={styles.adminBtn}
                accessibilityRole="button"
                accessibilityLabel="Редактировать"
                {...(Platform.OS === 'web' && {
                  onClick: (e: any) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleEdit(e);
                  },
                  onMouseDown: (e: any) => e.stopPropagation(),
                })}
              >
                <Feather name="edit-2" size={Platform.select({ default: 14, web: 16 })} color="#1e293b" />
              </Pressable>
              <View style={styles.adminDivider} />
              <Pressable 
                onPress={(e) => handleDelete(e)} 
                hitSlop={10} 
                style={styles.adminBtn}
                testID="delete-button"
                accessibilityRole="button"
                accessibilityLabel="Удалить"
                {...(Platform.OS === 'web' && {
                  onClick: (e: any) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDelete(e);
                  },
                  onMouseDown: (e: any) => e.stopPropagation(),
                })}
              >
                <Feather name="trash-2" size={Platform.select({ default: 14, web: 16 })} color="#1e293b" />
              </Pressable>
            </View>
          )}

          {/* Минимальный градиент только внизу для читаемости - заменен на CSS для производительности */}
          {Platform.OS === 'web' ? (
            <View 
              style={{
                position: 'absolute' as any,
                bottom: 0,
                left: 0,
                right: 0,
                height: 120,
                backgroundColor: 'transparent' as any,
                pointerEvents: 'none' as any,
              }}
            />
          ) : (
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.02)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.35)"]}
              pointerEvents="none"
              style={styles.grad}
            />
          )}

          {/* Только бейдж локации на фото - полупрозрачный */}
          {countries.length > 0 && countries[0] && (
            <View style={styles.topBadges} pointerEvents="none">
              <View style={styles.infoBadge}>
                <Feather name="map-pin" size={Platform.select({ default: 10, web: 11 })} color="#0f172a" />
                <Text style={styles.infoBadgeText} numberOfLines={1}>
                  {countries[0]}
                </Text>
              </View>
            </View>
          )}

          {selectable && (
            <Pressable
              style={styles.checkWrap}
              testID="selection-checkbox"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={(e: any) => {
                if (e?.stopPropagation) {
                  e.stopPropagation();
                }
                onToggle?.();
              }}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Feather name="check" size={14} color="#fff" />}
              </View>
            </Pressable>
          )}
        </View>

        {/* Контент под изображением */}
        <View
          style={[
            styles.contentBelow,
            // На web делаем компактную, но "дышащую" панель текста с небольшим отступом снизу
            Platform.OS === 'web' && {
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: 10,
              gap: 4,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              Platform.OS === 'web' && {
                // Фиксированная типографика заголовка на web
                fontFamily: "Inter, System",
                fontSize: 17,
                lineHeight: responsiveValues.titleLineHeight,
                marginBottom: responsiveValues.titleMarginBottom,
                minHeight: responsiveValues.titleMinHeight,
              },
            ]}
            numberOfLines={2}
          >
            {name}
          </Text>

          <View
            style={[
              styles.metaRow,
              Platform.OS === 'web' && typeof viewportWidth === 'number' && viewportWidth < 375 && {
                // ✅ На очень узких экранах выравниваем по верху, чтобы элементы могли переноситься на новую строку
                alignItems: 'flex-start',
              },
            ]}
          >
            {/* Первая строка: иконка пользователя + имя + просмотры */}
            <View style={styles.metaInfoTopRow}>
              <View style={styles.metaBox}>
                <Feather
                  name="user"
                  size={Platform.select({ default: 10, web: 11 })}
                  color="#64748b"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.metaTxt}>
                  {authorName || 'Аноним'}
                </Text>
              </View>
              {views > 0 && (
                <View
                  style={styles.metaBoxViews}
                  testID="views-meta"
                >
                  <Feather
                    name="eye"
                    size={Platform.select({ default: 10, web: 11 })}
                    color="#64748b"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.metaTxtViews}>{viewsFormatted}</Text>
                </View>
              )}
            </View>

            {/* Вторая строка: только бейджи Популярное / Новое */}
            {(popularityFlags.isPopular || popularityFlags.isNew) && (
              <View
                style={[
                  styles.metaBadgesRow,
                  Platform.OS === 'web' && typeof viewportWidth === 'number' && viewportWidth < 375 && {
                    // ✅ Бейджи могут переноситься на следующую строку вместо выхода за правый край
                    flexWrap: 'wrap',
                    gap: 6,
                  },
                ]}
              >
                {popularityFlags.isPopular && (
                  <View style={[styles.statusBadge, styles.statusBadgePopular]}>
                    <Feather
                      name="trending-up"
                      size={Platform.select({ default: 10, web: 12 })}
                      color={TOKENS.colors.primary}
                    />
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextPopular]}>
                      Популярное
                    </Text>
                  </View>
                )}
                {popularityFlags.isNew && (
                  <View style={[styles.statusBadge, styles.statusBadgeNew]}>
                    <Feather
                      name="star"
                      size={Platform.select({ default: 10, web: 12 })}
                      color={TOKENS.colors.success}
                    />
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextNew]}>
                      Новое
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </CardWrapper>
    );

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
      // 2) selectable === false — поведение как раньше, с <a href> и SPA-навигацией
      selectable ? (
        card
      ) : (
        <>
          <a
            href={travelUrl}
            {...(Platform.OS === 'web' ? { 'data-testid': 'travel-card-link' } : {})}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            onClick={(e: any) => {
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
            }}
          >
            {card}
          </a>
        </>
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
    // Фиксированная высота на web, чтобы все карточки в ряду были одной высоты
    ...(Platform.OS === 'web'
      ? {
          height: 360,
        }
      : {}),
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
    height: 220,
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

  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as any,
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: 'space-between',
    gap: TOKENS.spacing.xs,
    flexWrap: 'wrap',
  },

  // Первая строка: пользователь + просмотры
  metaInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    position: 'relative', // Для абсолютного позиционирования просмотров
    minHeight: 20, // Минимальная высота для размещения элементов
  },

  // Вторая строка: бейджи Популярное / Новое
  metaBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOKENS.spacing.xs,
    marginTop: TOKENS.spacing.xs * 0.5,
    marginBottom: TOKENS.spacing.xs, // небольшой визуальный отступ снизу
    flexWrap: 'wrap',
    // Чуть меньшая минимальная высота, чтобы панель была компактнее
    minHeight: 22,
  },

  metaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    width: '100%', // Занимаем всю ширину родителя
    paddingRight: 120, // Увеличиваем место для просмотров справа
  },

  // Отдельный стиль для просмотров - абсолютно позиционированы
  metaBoxViews: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    position: 'absolute',
    right: 0,
    top: 0,
    paddingHorizontal: TOKENS.spacing.xs,
    paddingVertical: 2,
  },

  metaTxt: {
    fontSize: TOKENS.card.meta.size,
    color: TOKENS.colors.textSecondary,
    fontWeight: TOKENS.card.meta.weight,
    lineHeight: TOKENS.card.meta.lineHeight,
    flex: 1, // Занимаем доступное пространство в контейнере
    minWidth: 0, // Важно для корректного обрезания текста
  },

  // Отдельный стиль для текста просмотров - не обрезается
  metaTxtViews: {
    fontSize: TOKENS.card.meta.size,
    color: TOKENS.colors.textSecondary,
    fontWeight: TOKENS.card.meta.weight,
    lineHeight: TOKENS.card.meta.lineHeight,
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
    paddingVertical: TOKENS.spacing.xs,
    gap: TOKENS.spacing.xs,
  },

  tagTxt: {
    fontSize: TOKENS.typography.sizes.sm,
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
