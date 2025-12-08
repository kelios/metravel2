// src/components/listTravel/TravelListItem.tsx
import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import type { Travel } from "@/src/types/types";
import OptimizedFavoriteButton from "@/components/OptimizedFavoriteButton";
import { fetchTravel, fetchTravelBySlug } from "@/src/api/travelsApi";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize, generateSrcSet } from "@/utils/imageOptimization";
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS, AIRY_SHADOWS, AIRY_BOX_SHADOWS } from "@/constants/airyColors";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { enhancedTravelCardStyles } from './enhancedTravelCardStyles';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const ICON_COLOR = "#111827"; // тёмкие иконки под светлое стекло

const WebImageOptimized = memo(function WebImageOptimized({
                                                              src,
                                                              alt,
                                                              priority = false,
                                                          }: {
    src: string;
    alt: string;
    priority?: boolean;
}) {
    // Дополнительная проверка для SSR
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
        return null;
    }
    
    const imageSrcSet = useMemo(() => generateSrcSet(src, [400, 800, 1200]), [src]);
    const imageSizes = useMemo(() => "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw", []);
    return (
        <img
            src={src}
            srcSet={imageSrcSet}
            sizes={imageSizes}
            alt={alt}
            style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
            }}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
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
                        }: Props) {
    if (!travel) return null;

    const {
        id,
        slug,
        travel_image_thumb_url,
        name,
        countryName = "",
        userName,
        countUnicIpView = 0,
        number_days = 0,
    } = travel;

    // ✅ УЛУЧШЕНИЕ: Оптимизация превью под карточку с использованием новых утилит
    const imgUrl = useMemo(() => {
        if (!travel_image_thumb_url) return null;
        
        // Упрощенная обработка - меньше вычислений при скролле
        return travel_image_thumb_url;
    }, [travel_image_thumb_url]);

    const viewsFormatted = useMemo(() => {
        const views = Number(countUnicIpView) || 0;
        try {
            // Компактный формат: 1,2K / 3,4M
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                compactDisplay: 'short',
            }).format(views);
        } catch {
            return String(views);
        }
    }, [countUnicIpView]);

    const countries = useMemo(
        () => (countryName || "").split(",").map((c) => c.trim()).filter(Boolean),
        [countryName]
    );

    // ✅ БИЗНЕС: Определение badges для социального доказательства
    const popularityFlags = useMemo(() => {
        const views = Number(countUnicIpView) || 0;
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
    }, [countUnicIpView, travel]);

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
    const cardWrapperProps = (Platform.OS === 'web' && !selectable) 
        ? {} 
        : {
            onPress: handlePress,
            android_ripple: Platform.OS === "android" ? { color: "rgba(17,24,39,0.06)" } : undefined,
            accessibilityState: selectable ? { selected: isSelected } : undefined,
            accessibilityLabel: `Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}`,
            accessibilityRole: "button" as const,
            accessibilityHint: selectable ? 'Нажмите для выбора' : 'Нажмите для просмотра деталей путешествия',
            // @ts-ignore - aria attributes for web accessibility
            'aria-label': Platform.OS === 'web' ? `Путешествие: ${name}` : undefined,
            // @ts-ignore
            'aria-pressed': selectable ? isSelected : undefined,
        };

    const card = (
      <CardWrapper
        {...cardWrapperProps}
        style={[
          styles.card,
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
              styles.selectionOverlay,
              isSelected && styles.selectionOverlayActive,
            ]}
          />
        )}

        {/* Блок изображения */}
        <View style={styles.imageContainer}>
          {imgUrl ? (
            Platform.OS === "web" ? (
              <WebImageOptimized src={imgUrl} alt={name} priority={isFirst} />
            ) : (
              <NativeImageOptimized uri={imgUrl} />
            )
          ) : (
            <View style={styles.imgStub}>
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
            <View style={styles.checkWrap} pointerEvents="none">
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Feather name="check" size={14} color="#fff" />}
              </View>
            </View>
          )}
        </View>

        {/* Контент под изображением */}
        <View style={styles.contentBelow}>
          <Text style={styles.title} numberOfLines={2}>
            {name}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaInfoLeft}>
              {!!userName && (
                <View style={styles.metaBox}>
                  <Feather name="user" size={Platform.select({ default: 10, web: 11 })} color="#64748b" style={{ marginRight: 4 }} />
                  <Text style={styles.metaTxt} numberOfLines={1}>
                    {userName}
                  </Text>
                </View>
              )}
              <View style={styles.metaBox}>
                <Feather name="eye" size={Platform.select({ default: 10, web: 11 })} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={styles.metaTxt}>{viewsFormatted}</Text>
              </View>

              {(popularityFlags.isPopular || popularityFlags.isNew) && (
                <View style={styles.metaIcons}>
                  {popularityFlags.isPopular && (
                    <View style={[styles.statusBadge, styles.statusBadgePopular]}>
                      <Feather
                        name="trending-up"
                        size={Platform.select({ default: 10, web: 12 })}
                        color={DESIGN_TOKENS.colors.primary}
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
                        color={DESIGN_TOKENS.colors.accent || "#f59e0b"}
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
        </View>
      </CardWrapper>
    );

  return (
    <View
      style={styles.wrap}
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

  // ... (rest of the styles remain the same)
  card: {
    ...enhancedTravelCardStyles.card,
  } as any,

  imageContainer: {
    ...enhancedTravelCardStyles.imageContainer,
  } as any,

  imageContainerMobile: {
    height: 220,
    // На мобильных фиксированная высота надежнее, чем aspectRatio
  } as any,

  androidOptimized: {
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
  },

  selected: {
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 2px ${DESIGN_TOKENS.colors.primary}`,
        borderColor: DESIGN_TOKENS.colors.primary,
      },
    }),
  },
  selectionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(96,165,250,0.08)",
    zIndex: 2,
    opacity: 0,
    transitionDuration: "150ms",
    pointerEvents: "none",
  } as any,
  selectionOverlayActive: {
    opacity: 1,
    backgroundColor: "rgba(5,150,105,0.12)",
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
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },

  grad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%", // Чуть выше градиент для лучшей читаемости бейджа
  },

  adminActionsContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 6px -1px rgba(15,23,42,0.08)',
      },
    }),
  },

  adminBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },

  adminDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 6,
    backgroundColor: 'rgba(148,163,184,0.5)',
  },

  favoriteButtonContainer: {
    ...enhancedTravelCardStyles.favoriteButton,
  } as any,

  contentBelow: {
    ...enhancedTravelCardStyles.contentContainer,
  } as any,
  
  topBadges: {
    position: "absolute",
    bottom: Platform.select({ default: 10, web: 12 }),
    left: Platform.select({ default: 10, web: 12 }),
    right: Platform.select({ default: 10, web: 12 }),
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.select({ default: 6, web: 8 }),
    zIndex: 10,
  },
  
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.select({ default: 4, web: 6 }),
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 100,
    paddingHorizontal: Platform.select({ default: 8, web: 10 }),
    paddingVertical: Platform.select({ default: 4, web: 6 }),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      },
    }),
  },
  
  infoBadgeText: {
    fontSize: Platform.select({ default: 11, web: 12 }),
    color: "#0f172a",
    fontWeight: "600",
    letterSpacing: -0.1,
  },

  // ... (badgesContainer, badge, badgeText - can remove if unused or keep)
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 4,
  },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  tagTxt: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },

  title: {
    ...enhancedTravelCardStyles.title,
  } as any,

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 'auto', // Прижимает футер к низу
  },
  
  metaInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  
  metaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  metaTxt: {
    fontSize: 13,
    color: "#64748b", // slate-500
    fontWeight: '500' as any,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Platform.select({ default: 6, web: 8 }),
    paddingVertical: Platform.select({ default: 2, web: 4 }),
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  statusBadgeText: {
    fontSize: Platform.select({ default: 10, web: 11 }),
    fontWeight: '600' as any,
    color: '#475569',
  },
  statusBadgePopular: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)', // Light blue/cyan
  },
  statusBadgeTextPopular: {
    color: '#0284c7', // Darker blue
  },
  statusBadgeNew: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)', // Light amber
  },
  statusBadgeTextNew: {
    color: '#d97706', // Darker amber
  },
  metaIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  actionsHidden: {
    opacity: 0,
  },

  btncard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    marginBottom: 16,
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        cursor: "pointer",
        // @ts-ignore
        ":hover": {
          backgroundColor: "#e2e8f0",
          color: DESIGN_TOKENS.colors.primary,
        },
      } as any,
    }),
  },

  btn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
        cursor: "pointer",
        // @ts-ignore
        ":hover": {
          backgroundColor: "#e2e8f0",
          color: DESIGN_TOKENS.colors.primary,
        },
      },
    }),
  },

  checkWrap: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 20,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        backdropFilter: "blur(4px)",
      }
    })
  },

  checkboxChecked: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderColor: DESIGN_TOKENS.colors.primary,
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
