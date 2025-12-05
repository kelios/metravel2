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
import { fetchTravel, fetchTravelBySlug } from "@/src/api/travelsApi";
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

    const handleEdit = useCallback(() => {
        router.push(`/travel/${id}`);
    }, [id]);

    const handleDelete = useCallback(() => {
        onDeletePress?.(id);
    }, [id, onDeletePress]);

    const actions = (canEdit && !selectable) && (
        <View style={styles.actions} pointerEvents="box-none">
            <Pressable 
                onPress={handleEdit} 
                hitSlop={10} 
                {...(Platform.OS === 'web' && {
                    onClick: (e: any) => e.stopPropagation(),
                    onMouseDown: (e: any) => e.stopPropagation(),
                })}
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
                {...(Platform.OS === 'web' && {
                    onClick: (e: any) => e.stopPropagation(),
                    onMouseDown: (e: any) => e.stopPropagation(),
                })}
                style={[styles.btn, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                accessibilityRole="button"
                accessibilityLabel="Удалить"
            >
                {/* ✅ ИСПРАВЛЕНИЕ: Увеличен размер иконки */}
                <Feather name="trash-2" size={18} color={ICON_COLOR} />
            </Pressable>
        </View>
    );

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
                    globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
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

            {/* Кнопки действий (редактирование/удаление) на native */}
            {Platform.OS !== 'web' && actions}

        </CardWrapper>
    );

    return (
        <View style={styles.wrap}>
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
                        {actions}
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
        padding: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xs }), 
        width: "100%",
    },

    card: {
        position: "relative",
        width: "100%",
        aspectRatio: 1,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        overflow: "hidden",
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                // @ts-ignore
                ":hover": {
                    transform: "translateY(-2px)",
                    boxShadow: DESIGN_TOKENS.shadows.medium,
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
        padding: Platform.select({ default: DESIGN_TOKENS.spacing.sm, web: DESIGN_TOKENS.spacing.md }),
    },
    topBadges: {
        position: "absolute",
        top: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        left: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        flexDirection: "row",
        gap: DESIGN_TOKENS.spacing.xs,
        zIndex: 10,
    },
    infoBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing.xxs,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        paddingVertical: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xxs }),
        ...Platform.select({
            web: {
                backdropFilter: "blur(10px)",
            },
        }),
    },
    infoBadgeText: {
        fontSize: Platform.select({ default: 11, web: 12 }),
        color: "#fff",
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    badgesContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: DESIGN_TOKENS.spacing.xs,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        zIndex: 5,
    },
    badge: {
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
            },
        }),
    },
    badgeText: {
        fontSize: 11,
        fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        letterSpacing: 0.2,
    },

    tags: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: DESIGN_TOKENS.spacing.xs,
        gap: DESIGN_TOKENS.spacing.xxs,
    },

    tag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.6)",
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        paddingVertical: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xxs }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: DESIGN_TOKENS.colors.borderLight,
    },

    tagTxt: {
        fontSize: Platform.select({ default: 11, web: 12 }),
        color: DESIGN_TOKENS.colors.text,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },

    titleBox: {
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: Platform.select({ default: DESIGN_TOKENS.spacing.sm, web: DESIGN_TOKENS.spacing.md }),
        paddingVertical: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        marginBottom: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        ...Platform.select({
            web: {
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: DESIGN_TOKENS.shadows.light,
            },
        }),
    },

    title: {
        fontSize: Platform.select({ default: 15, web: 17 }),
        fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        fontFamily: Platform.select({ web: DESIGN_TOKENS.typography.fontFamily, default: undefined }),
        color: DESIGN_TOKENS.colors.text,
        lineHeight: Platform.select({ default: 20, web: 23 }),
        letterSpacing: -0.3,
    },

    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
    },

    metaBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.6)",
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        paddingVertical: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xxs }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        marginRight: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        marginBottom: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xxs }),
    },

    metaTxt: {
        fontSize: Platform.select({ default: 12, web: 13 }),
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        lineHeight: Platform.select({ default: 16, web: 18 }),
    },

    actions: {
        position: "absolute",
        top: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        right: Platform.select({ default: DESIGN_TOKENS.spacing.xs, web: DESIGN_TOKENS.spacing.sm }),
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: DESIGN_TOKENS.radii.sm,
        padding: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xxs }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        zIndex: 10,
        gap: Platform.select({ default: DESIGN_TOKENS.spacing.xxs, web: DESIGN_TOKENS.spacing.xxs }),
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.light,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
            },
        }),
    },

    btn: {
        minWidth: 40,
        minHeight: 40,
        width: 40,
        height: 40,
        borderRadius: DESIGN_TOKENS.radii.sm,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: DESIGN_TOKENS.spacing.xs,
        ...Platform.select({
            web: {
                transition: "all 0.2s ease",
                cursor: "pointer",
                // @ts-ignore
                ":hover": {
                    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
                    transform: "scale(1.05)",
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
        top: DESIGN_TOKENS.spacing.sm,
        left: DESIGN_TOKENS.spacing.sm,
    },

    checkbox: {
        width: 24,
        height: 24,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 2,
        borderColor: DESIGN_TOKENS.colors.primary,
        backgroundColor: "rgba(96,165,250,0.1)",
        justifyContent: "center",
        alignItems: "center",
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
