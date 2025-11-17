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
    isSuperuser?: boolean;
    isMetravel?: boolean;
    onDeletePress?: (id: number) => void;
    isFirst?: boolean;
    isSingle?: boolean;
    selectable?: boolean;
    isSelected?: boolean;
    onToggle?: () => void;
};

function TravelListItem({
                            travel,
                            isSuperuser,
                            isMetravel,
                            onDeletePress,
                            isFirst = false,
                            isSingle = false,
                            selectable = false,
                            isSelected = false,
                            onToggle,
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
        
        // "Популярное" - более 1000 просмотров
        if (views > 1000) {
            result.push({
                label: 'Популярное',
                color: '#fff',
                bgColor: AIRY_COLORS.badgePopular, // ✅ ДИЗАЙН: Воздушный полупрозрачный персик
            });
        }
        
        // "Новое" - создано за последние 7 дней
        if (createdAt) {
            const createdDate = new Date(createdAt);
            const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceCreated <= 7) {
                result.push({
                    label: 'Новое',
                    color: '#fff',
                    bgColor: AIRY_COLORS.badgeNew, // ✅ ДИЗАЙН: Воздушный полупрозрачный мятный
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
                    color: '#fff',
                    bgColor: AIRY_COLORS.badgeTrend, // ✅ ДИЗАЙН: Воздушный полупрозрачный голубой
                });
            }
        }
        
        return result;
    }, [countUnicIpView, travel]);

    const canEdit = !!(isSuperuser || isMetravel);
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
                    <View style={styles.favoriteButtonContainer} pointerEvents="box-none">
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
                        <Pressable onPress={handleEdit} hitSlop={10} style={styles.btn} accessibilityLabel="Редактировать">
                            <Feather name="edit-2" size={16} color={ICON_COLOR} />
                        </Pressable>
                        <Pressable onPress={handleDelete} hitSlop={10} style={styles.btn} accessibilityLabel="Удалить">
                            <Feather name="trash-2" size={16} color={ICON_COLOR} />
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
        borderRadius: 12, // ✅ ДИЗАЙН: Унифицированный радиус (medium)
        backgroundColor: "#ffffff",
        ...AIRY_SHADOWS.light, // ✅ ДИЗАЙН: Легкая воздушная тень
        borderWidth: 1,
        borderColor: AIRY_COLORS.border, // ✅ ДИЗАЙН: Почти невидимая граница
        overflow: "hidden",
        ...Platform.select({
            web: {
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", // ✅ ДИЗАЙН: Плавный переход
                cursor: "pointer",
                // @ts-ignore - для hover эффектов
                ":hover": {
                    transform: "translateY(-4px) scale(1.02)", // ✅ ДИЗАЙН: Масштаб + подъем
                    boxShadow: AIRY_BOX_SHADOWS.hover, // ✅ ДИЗАЙН: Легкая воздушная тень при hover
                    borderColor: AIRY_COLORS.borderAccent, // ✅ ДИЗАЙН: Воздушная легкая персиковая граница при hover
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
        borderWidth: 2,
        borderColor: AIRY_COLORS.accent, // ✅ ДИЗАЙН: Воздушный бирюзовый для выбранных элементов
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
        backgroundColor: "#f3f4f6",
    },

    imgStub: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f1f5f9",
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
        top: 12,
        right: 12,
        zIndex: 10,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 22,
        padding: 6,
        borderWidth: 1,
        borderColor: "rgba(17,24,39,0.1)",
        ...Platform.select({
            web: {
                boxShadow: AIRY_BOX_SHADOWS.light,
                transition: "all 0.2s ease",
            },
        }),
    },

    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: 14,
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
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(17,24,39,0.06)",
        marginRight: 6,
        marginBottom: 6,
    },

    tagTxt: {
        fontSize: 12,
        color: "#111827",
        fontWeight: "600",
    },

    titleBox: {
        backgroundColor: "rgba(255,255,255,0.95)", // ✅ ДИЗАЙН: Более непрозрачный фон
        borderRadius: 10, // ✅ ДИЗАЙН: Меньший радиус для согласованности
        paddingHorizontal: 14, // ✅ ДИЗАЙН: Увеличены отступы
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.06)", // ✅ ДИЗАЙН: Единая граница
        marginBottom: 10,
        ...Platform.select({
            web: {
                backdropFilter: "blur(12px)", // ✅ ДИЗАЙН: Увеличен blur
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: AIRY_BOX_SHADOWS.light, // ✅ ДИЗАЙН: Легкая воздушная тень
            },
        }),
    },

    title: {
        fontSize: 18, // ✅ ДИЗАЙН: Увеличен размер для лучшей читаемости
        fontWeight: "700",
        fontFamily: Platform.select({ web: "Georgia, serif", default: undefined }), // ✅ ДИЗАЙН: Georgia для заголовков
        color: "#1a202c", // ✅ ДИЗАЙН: Единый цвет текста
        lineHeight: 24, // ✅ ДИЗАЙН: Оптимальный line-height
        letterSpacing: -0.3, // ✅ ДИЗАЙН: Отрицательный letter-spacing для читаемости
    },

    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
    },

    metaBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.5)",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(17,24,39,0.06)",
        marginRight: 8,
        marginBottom: 4,
    },

    metaTxt: {
        fontSize: 13, // ✅ ДИЗАЙН: Сохранен размер
        color: "#4a5568", // ✅ ДИЗАЙН: Вторичный цвет текста для метаданных
        fontWeight: "500",
        lineHeight: 18,
    },

    actions: {
        position: "absolute",
        top: 12, // ✅ ДИЗАЙН: Увеличены отступы
        right: 12,
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 12, // ✅ ДИЗАЙН: Меньший радиус для согласованности
        padding: 4, // ✅ ДИЗАЙН: Уменьшен padding
        borderWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.08)",
        zIndex: 10,
        gap: 4, // ✅ ДИЗАЙН: Используем gap вместо marginLeft
        ...Platform.select({
            web: {
                boxShadow: AIRY_BOX_SHADOWS.light,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            },
        }),
    },

    btn: {
        width: 32,
        height: 32,
        borderRadius: 8, // ✅ ДИЗАЙН: Меньший радиус
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.95)",
        ...Platform.select({
            web: {
                transition: "all 0.2s ease",
                cursor: "pointer",
                // @ts-ignore
                ":hover": {
                    backgroundColor: AIRY_COLORS.primary, // ✅ ДИЗАЙН: Воздушный легкий персик при hover
                    transform: "scale(1.1)",
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
