// src/components/listTravel/TravelListItem.tsx
import React, { memo, useCallback, useMemo } from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import type { Travel } from "@/src/types/types";
import FavoriteButton from "@/components/FavoriteButton";
import { fetchTravel, fetchTravelBySlug } from "@/src/api/travels";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize, generateSrcSet } from "@/utils/imageOptimization";
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS, AIRY_SHADOWS, AIRY_BOX_SHADOWS } from "@/constants/airyColors";
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

/** LQIP-плейсхолдер — чтобы не мигало чёрным на native */
const PLACEHOLDER_BLURHASH = "LEHL6nWB2yk8pyo0adR*.7kCMdnj";
const ICON_COLOR = "#111827"; // тёмные иконки под светлое стекло

const WebImageOptimized = memo(function WebImageOptimized({
                                                              src,
                                                              alt,
                                                              priority = false,
                                                          }: {
    src: string;
    alt: string;
    priority?: boolean;
}) {
    // ✅ УЛУЧШЕНИЕ: Используем новые утилиты для генерации srcset
    const srcset = useMemo(() => {
        if (!src) return undefined;
        const sizes = [400, 600, 800, 1200];
        return generateSrcSet(src, sizes);
    }, [src]);

    // Определяем sizes для правильного выбора изображения
    const sizesAttr = useMemo(() => {
        return "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw";
    }, []);

    // RN Web допускает нативный <img>, TS может ругаться в некоторых конфигурациях — это безопасно.
    // eslint-disable-next-line jsx-a11y/alt-text
    return (
        <img
            src={src}
            srcSet={srcset}
            sizes={sizesAttr}
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
                    <Text style={styles.tagTxt}>{c}</Text>
                </View>
            ))}
            {countries.length > 2 && (
                <View style={styles.tag}>
                    <Text style={styles.tagTxt}>+{countries.length - 2}</Text>
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
        
        const versionedUrl = buildVersionedImageUrl(
            travel_image_thumb_url,
            (travel as any).updated_at,
            travel.id
        );
        
        const targetW = isSingle ? 600 : 400;
        const targetH = Math.floor(targetW * 0.75);
        const optimalSize = getOptimalImageSize(targetW, targetH);
        
        return optimizeImageUrl(versionedUrl, {
            width: optimalSize.width,
            height: optimalSize.height,
            format: 'webp',
            quality: 75,
            fit: 'cover',
        }) || versionedUrl;
    }, [travel_image_thumb_url, isSingle, travel]);

    const countries = useMemo(
        () => (countryName || "").split(",").map((c) => c.trim()).filter(Boolean),
        [countryName]
    );

    // ✅ БИЗНЕС: Определение badges для социального доказательства
    const badges = useMemo(() => {
        const result: Array<{ label: string; color: string; bgColor: string }> = [];
        const views = Number(countUnicIpView) || 0;
        const updatedAt = (travel as any).updated_at;
        const createdAt = (travel as any).created_at || updatedAt;
        
        // ✅ ИСПРАВЛЕНИЕ: Используем тёмный текст для лучшего контраста на светлых badges
        const badgeTextColor = AIRY_COLORS.badgeText || '#1a1a1a';
        
        // "Популярное" - более 1000 просмотров
        if (views > 1000) {
            result.push({
                label: 'Популярное',
                color: badgeTextColor, // ✅ ИСПРАВЛЕНИЕ: Тёмный текст для контраста
                bgColor: AIRY_COLORS.badgePopular,
            });
        }
        
        // "Новое" - создано за последние 7 дней
        if (createdAt) {
            const createdDate = new Date(createdAt);
            const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceCreated <= 7) {
                result.push({
                    label: 'Новое',
                    color: badgeTextColor, // ✅ ИСПРАВЛЕНИЕ: Тёмный текст для контраста
                    bgColor: AIRY_COLORS.badgeNew,
                });
            }
        }
        
        // "Тренд" - растущая популярность (более 500 просмотров и обновлено за последние 30 дней)
        if (updatedAt && views > 500) {
            const updatedDate = new Date(updatedAt);
            const daysSinceUpdated = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdated <= 30 && !result.find(b => b.label === 'Новое')) {
                result.push({
                    label: 'Тренд',
                    color: badgeTextColor, // ✅ ИСПРАВЛЕНИЕ: Тёмный текст для контраста
                    bgColor: AIRY_COLORS.badgeTrend,
                });
            }
        }
        
        return result;
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

    const handleEdit = useCallback(() => {
        router.push(`/travel/${id}`);
    }, [id]);

    const handleDelete = useCallback(() => {
        onDeletePress?.(id);
    }, [id, onDeletePress]);

    return (
        <View style={styles.wrap}>
            <Pressable
                onPress={handlePress}
                android_ripple={
                    Platform.OS === "android" ? { color: "rgba(17,24,39,0.06)" } : undefined
                }
                style={[
                    styles.card,
                    globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                    Platform.OS === "android" && styles.androidOptimized,
                    isSingle && styles.single,
                    selectable && isSelected && styles.selected,
                ]}
                accessibilityState={selectable ? { selected: isSelected } : undefined}
                accessibilityLabel={`Путешествие: ${name}${countries.length > 0 ? `. Страны: ${countries.join(', ')}` : ''}`}
                accessibilityRole="button"
                accessibilityHint={selectable ? 'Нажмите для выбора' : 'Нажмите для просмотра деталей путешествия'}
                // @ts-ignore - для веб доступности
                aria-label={Platform.OS === 'web' ? `Путешествие: ${name}` : undefined}
                // @ts-ignore
                aria-pressed={selectable ? isSelected : undefined}
                // @ts-ignore
                tabIndex={Platform.OS === 'web' ? 0 : undefined}
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
                {/* Изображение */}
                {imgUrl ? (
                    Platform.OS === "web" ? (
                        <WebImageOptimized 
                            src={imgUrl} 
                            alt={name} 
                            priority={isFirst} 
                        />
                    ) : (
                        <NativeImageOptimized uri={imgUrl} />
                    )
                ) : (
                    <View style={styles.imgStub}>
                        <Feather name="image" size={40} color="#94a3b8" />
                    </View>
                )}

                {/* Кнопка избранного */}
                {!selectable && (
                    <View 
                        style={styles.favoriteButtonContainer} 
                        pointerEvents="box-none"
                        {...(Platform.OS === 'web' && {
                            // Prevent clicks on favorite button from triggering parent Pressable on web
                            onClick: (e: any) => e.stopPropagation(),
                            onMouseDown: (e: any) => e.stopPropagation(),
                        })}
                    >
                        <FavoriteButton
                            id={id}
                            type="travel"
                            title={name}
                            imageUrl={travel_image_thumb_url}
                            url={`/travels/${slug ?? id}`}
                            country={countries[0]}
                            size={22}
                        />
                    </View>
                )}

                {/* Градиент для читаемости текста */}
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.7)"]} // ✅ ДИЗАЙН: Более сильный градиент для читаемости
                    locations={[0.5, 0.7, 0.85, 1]}
                    style={styles.grad}
                    pointerEvents="none"
                />

                {/* Контент поверх изображения */}
                <View style={styles.overlay} pointerEvents="none">
                    {/* ✅ UX УЛУЧШЕНИЕ: Badge с ключевой информацией вверху */}
                    <View style={styles.topBadges}>
                        {countries.length > 0 && countries[0] && (
                            <View style={styles.infoBadge}>
                                <Feather name="map-pin" size={11} color="#fff" />
                                <Text style={styles.infoBadgeText} numberOfLines={1}>
                                    {countries[0]}
                                </Text>
                            </View>
                        )}
                        {number_days > 0 && (
                            <View style={styles.infoBadge}>
                                <Feather name="calendar" size={11} color="#fff" />
                                <Text style={styles.infoBadgeText}>
                                    {number_days} {number_days === 1 ? 'день' : number_days < 5 ? 'дня' : 'дней'}
                                </Text>
                            </View>
                        )}
                    </View>
                    
                    <CountriesList countries={countries} />

                    {/* ✅ БИЗНЕС: Badges для социального доказательства */}
                    {badges.length > 0 && (
                        <View style={styles.badgesContainer}>
                            {badges.map((badge, index) => (
                                <View 
                                    key={index} 
                                    style={[
                                        styles.badge,
                                        { backgroundColor: badge.bgColor }
                                    ]}
                                >
                                    <Text style={[styles.badgeText, { color: badge.color }]}>
                                        {badge.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={styles.titleBox}>
                        <Text style={styles.title} numberOfLines={2}>
                            {name}
                        </Text>
                    </View>

                    <View style={styles.metaRow}>
                        {!!userName && (
                            <View style={styles.metaBox}>
                                <Feather name="user" size={12} color={ICON_COLOR} style={{ marginRight: 4 }} />
                                <Text style={styles.metaTxt} numberOfLines={1}>
                                    {userName}
                                </Text>
                            </View>
                        )}
                        <View style={styles.metaBox}>
                            <Feather name="eye" size={12} color={ICON_COLOR} style={{ marginRight: 4 }} />
                            <Text style={styles.metaTxt}>{countUnicIpView}</Text>
                        </View>
                    </View>
                </View>

                {/* Индикатор выбора */}
                {selectable && (
                    <View style={styles.checkWrap} pointerEvents="none">
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                            {isSelected && <Feather name="check" size={14} color="#fff" />}
                        </View>
                    </View>
                )}

                {/* Кнопки действий (редактирование/удаление) */}
                {canEdit && !selectable && (
                    <View style={styles.actions} pointerEvents="box-none">
                        <Pressable 
                            onPress={handleEdit} 
                            hitSlop={10} 
                            style={[styles.btn, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                            accessibilityRole="button"
                            accessibilityLabel="Редактировать"
                        >
                            {/* ✅ ИСПРАВЛЕНИЕ: Увеличен размер иконки */}
                            <Feather name="edit-2" size={18} color={ICON_COLOR} />
                        </Pressable>
                        <Pressable 
                            onPress={handleDelete} 
                            hitSlop={10} 
                            style={[styles.btn, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                            accessibilityRole="button"
                            accessibilityLabel="Удалить"
                        >
                            {/* ✅ ИСПРАВЛЕНИЕ: Увеличен размер иконки */}
                            <Feather name="trash-2" size={18} color={ICON_COLOR} />
                        </Pressable>
                    </View>
                )}

            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: 8, width: "100%" },

    card: {
        position: "relative",
        width: "100%",
        aspectRatio: 1,
        borderRadius: Platform.select({ default: 10, web: 12 }),
        backgroundColor: DESIGN_TOKENS.colors.surface,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        overflow: "hidden",
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                // @ts-ignore - для hover эффектов
                ":hover": {
                    transform: "translateY(-4px)",
                    boxShadow: DESIGN_TOKENS.shadows.hover,
                },
            },
        }),
    },

    androidOptimized: {
        shadowColor: undefined,
        shadowOffset: undefined,
        shadowOpacity: undefined,
        shadowRadius: undefined,
    },

    selected: {
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень и overlay
        ...Platform.select({
            web: {
                boxShadow: `0 0 0 2px ${DESIGN_TOKENS.colors.primary}`,
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
        borderRadius: 12,
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
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    },

    imgStub: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    },

    grad: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "58%",
    },

    favoriteButtonContainer: {
        position: "absolute",
        top: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        right: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        zIndex: 10,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: Platform.select({ default: 18, web: 22 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
        padding: Platform.select({ default: 5, web: 6 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...Platform.select({
            web: {
                boxShadow: '0 1px 3px rgba(31, 31, 31, 0.04)',
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            },
        }),
    },

    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: Platform.select({ default: 12, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    },
    // ✅ UX УЛУЧШЕНИЕ: Badge с ключевой информацией вверху карточки
    topBadges: {
        position: "absolute",
        top: Platform.select({ default: 10, web: 12 }),
        left: Platform.select({ default: 10, web: 12 }),
        flexDirection: "row",
        gap: 6,
        zIndex: 10,
    },
    infoBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        borderRadius: Platform.select({ default: 8, web: 10 }),
        paddingHorizontal: Platform.select({ default: 8, web: 10 }),
        paddingVertical: Platform.select({ default: 4, web: 5 }),
        ...Platform.select({
            web: {
                backdropFilter: "blur(8px)",
            },
        }),
    },
    infoBadgeText: {
        fontSize: Platform.select({ default: 11, web: 12 }),
        color: "#fff",
        fontWeight: "600",
    },
    // ✅ БИЗНЕС: Badges для социального доказательства
    badgesContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 8,
        zIndex: 5,
    },
    badge: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        ...Platform.select({
            web: {
                boxShadow: AIRY_BOX_SHADOWS.medium,
            },
        }),
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.2,
    },

    tags: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 8,
    },

    tag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.55)",
        borderRadius: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
        paddingHorizontal: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        paddingVertical: Platform.select({ default: 3, web: 4 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
        borderColor: "rgba(0, 0, 0, 0.06)", // ✅ ДИЗАЙН: Более светлая граница
        marginRight: Platform.select({ default: 4, web: 6 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        marginBottom: Platform.select({ default: 4, web: 6 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    },

    tagTxt: {
        fontSize: Platform.select({ default: 11, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        color: "#111827",
        fontWeight: "600",
    },

    titleBox: {
        backgroundColor: "rgba(255,255,255,0.95)", // ✅ ДИЗАЙН: Более непрозрачный фон
        borderRadius: Platform.select({ default: 8, web: 10 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
        paddingHorizontal: Platform.select({ default: 12, web: 14 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        paddingVertical: Platform.select({ default: 8, web: 10 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
        borderColor: "rgba(0, 0, 0, 0.06)", // ✅ ДИЗАЙН: Единая граница
        marginBottom: Platform.select({ default: 8, web: 10 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        ...Platform.select({
            web: {
                backdropFilter: "blur(12px)", // ✅ ДИЗАЙН: Увеличен blur
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)", // ✅ ДИЗАЙН: Более легкая тень
            },
        }),
    },

    title: {
        fontSize: Platform.select({ default: 16, web: 18 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        fontWeight: "700",
        fontFamily: Platform.select({ web: "Georgia, serif", default: undefined }), // ✅ ДИЗАЙН: Georgia для заголовков
        color: "#1a202c", // ✅ ДИЗАЙН: Единый цвет текста
        lineHeight: Platform.select({ default: 22, web: 24 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        letterSpacing: -0.2, // ✅ ДИЗАЙН: Меньше отрицательный letter-spacing
    },

    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
    },

    metaBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.5)",
        borderRadius: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
        paddingHorizontal: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        paddingVertical: Platform.select({ default: 3, web: 4 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
        borderColor: "rgba(0, 0, 0, 0.06)", // ✅ ДИЗАЙН: Более светлая граница
        marginRight: Platform.select({ default: 6, web: 8 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        marginBottom: Platform.select({ default: 3, web: 4 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    },

    metaTxt: {
        fontSize: Platform.select({ default: 12, web: 13 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        color: "#4a5568", // ✅ ДИЗАЙН: Вторичный цвет текста для метаданных
        fontWeight: "500",
        lineHeight: Platform.select({ default: 16, web: 18 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
    },

    actions: {
        position: "absolute",
        top: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        right: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: Platform.select({ default: 10, web: 12 }), // ✅ АДАПТИВНОСТЬ: Меньше радиус на мобильных
        padding: Platform.select({ default: 3, web: 4 }), // ✅ АДАПТИВНОСТЬ: Меньше на мобильных
        borderWidth: 0.5, // ✅ ДИЗАЙН: Более тонкая граница
        borderColor: "rgba(0, 0, 0, 0.06)", // ✅ ДИЗАЙН: Более светлая граница
        zIndex: 10,
        gap: Platform.select({ default: 3, web: 4 }), // ✅ АДАПТИВНОСТЬ: Меньше gap на мобильных
        ...Platform.select({
            web: {
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)", // ✅ ДИЗАЙН: Более легкая тень
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            },
        }),
    },

    btn: {
        // ✅ ИСПРАВЛЕНИЕ: Увеличен размер до минимума 44x44px для touch-целей
        minWidth: 44,
        minHeight: 44,
        width: 44,
        height: 44,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: 6, // Добавлен padding для визуального размера
        ...Platform.select({
            web: {
                transition: "all 0.2s ease",
                cursor: "pointer",
                outlineWidth: 2,
                outlineColor: DESIGN_TOKENS.colors.primary,
                outlineStyle: 'solid',
                outlineOffset: 2,
                // @ts-ignore
                ":hover": {
                    backgroundColor: AIRY_COLORS.primary,
                    transform: "scale(1.1)",
                },
                ":focus": {
                    outlineWidth: 2,
                    outlineColor: DESIGN_TOKENS.colors.primary,
                    outlineStyle: 'solid',
                    outlineOffset: 2,
                },
            },
        }),
    },

    checkWrap: {
        position: "absolute",
        top: 10,
        left: 10,
    },

    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96,165,250,0.15)",
        justifyContent: "center",
        alignItems: "center",
    },

    checkboxChecked: {
        backgroundColor: "#60a5fa",
        borderColor: "#60a5fa",
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
