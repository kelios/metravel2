import { memo, useCallback, useMemo, useState } from 'react';
import type {
    CSSProperties,
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent as ReactMouseEvent,
} from 'react';
import { PixelRatio, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import NavigationIcon from '@/components/layout/NavigationIcon';
import UserAvatar from '@/components/layout/UserAvatar';
import QuestReviewsModal from '@/components/quests/QuestReviewsModal';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useBreakpoints } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { IMAGE_QUALITY, IMAGE_WIDTHS } from '@/constants/imageContract';

import { pluralizeRu } from '@/utils/pluralize';
import { getQuestAgeBadgeLabel, getQuestAgeCategory } from '@/utils/questAudience';
import { isBikeQuest } from './QuestsScreen.helpers';

import { pluralizePoints, type QuestMeta } from './questsShared';
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'
import { formatDistance } from '@/utils/distanceCalculator'
import { formatRatingValue } from '@/utils/ratingHelpers'
import { hasPublicQuestRating } from '@/api/questRating'
import { buildQuestPath } from '@/utils/routePaths'


const loadedQuestImageCache = new Set<string>();

const webCardLinkStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Passive visual layers do not receive web pointer events, so the anchor can
    // stay below action controls while still owning the rest of the card surface.
    zIndex: 1,
    cursor: 'pointer',
    textDecoration: 'none',
};

const getDifficultyInfo = (difficulty?: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
        case 'easy': return { label: i18nT('quests:screens.tabs.QuestCard.legko_3e670625'), color: 'rgba(129, 199, 132, 0.9)' };
        case 'medium': return { label: i18nT('quests:screens.tabs.QuestCard.sredne_4ab6d3e0'), color: 'rgba(255, 213, 79, 0.9)' };
        case 'hard': return { label: i18nT('quests:screens.tabs.QuestCard.slozhno_9a98f059'), color: 'rgba(239, 154, 154, 0.9)' };
        default: return null;
    }
};

type QuestCardProps = {
    styles: any;
    cardWidth: number;
    cityId: string;
    quest: QuestMeta & { _distanceKm?: number };
    nearby?: boolean;
    /** Позиция карточки в каталоге: первые получают высокий fetch-приоритет обложки. */
    index?: number;
};

function QuestCard({
    styles,
    cardWidth,
    cityId,
    quest,
    nearby,
    index,
}: QuestCardProps) {
    const colors = useThemedColors();
    const { isPhone } = useBreakpoints();
    const [isHovered, setIsHovered] = useState(false);
    const [reviewsOpen, setReviewsOpen] = useState(false);

    const durationText = quest.durationMin ? i18nT('quests:screens.tabs.QuestCard.value1_min_1c47c0c7', { value1: formatInteger(Math.round((quest.durationMin ?? 60) / 5) * 5) }) : i18nT('quests:screens.tabs.QuestCard.1_2_ch_59b7a35e');
    const pointsText = pluralizePoints(quest.points ?? 0);
    const difficultyInfo = getDifficultyInfo(quest.difficulty);
    const ageCategory = quest.ageCategory ?? getQuestAgeCategory(quest.tags);
    const ageBadgeLabel = getQuestAgeBadgeLabel(ageCategory);
    const isBike = isBikeQuest(quest.tags);
    const categoryLabel = quest.cityName || quest.countryName || null;
    const distanceText = nearby && typeof quest._distanceKm === 'number'
        ? formatDistance(quest._distanceKm)
        : null;
    // Вход в читалку доступен только при наличии отзывов на всех платформах.
    const showReviewsAction = quest.ratingCount > 0;
    // Агрегированная оценка — только за достаточную выборку (#1486). Вход в
    // читалку живёт по своему правилу выше: количество отзывов — факт, а
    // усреднённая оценка по одному отзыву — вымысел.
    const showAggregateRating = hasPublicQuestRating(quest.ratingCount);
    const questPath = buildQuestPath(cityId, quest.id);
    const questLinkLabel = i18nT('quests:screens.tabs.QuestCard.nachat_priklyuchenie_value1_43ad4b32', { value1: quest.title });
    const reviewsLabel = `${quest.ratingCount} ${pluralizeRu(quest.ratingCount, i18nT('quests:screens.tabs.QuestCard.otzyv_9b980975'), i18nT('quests:screens.tabs.QuestCard.otzyva_7e8267a2'), i18nT('quests:screens.tabs.QuestCard.otzyvov_5a06b55c'))}`;

    const imageUrl = typeof quest.cover === 'string' ? quest.cover : null;
    const cacheKey = imageUrl ? String(imageUrl).trim() : '';
    const [imageLoaded, setImageLoaded] = useState(() => !!cacheKey && loadedQuestImageCache.has(cacheKey));
    // Первые карточки каталога — визуальная доминанта экрана: обложке нужен
    // высокий fetch-приоритет, иначе браузер тянет её последней (fetchPriority=low).
    const isAboveTheFold = typeof index === 'number' && index < 2;

    const handleImageLoad = useCallback(() => {
        if (cacheKey) loadedQuestImageCache.add(cacheKey);
        setImageLoaded(true);
    }, [cacheKey]);

    const handlePress = useCallback(() => {
        if (!questPath) return;
        router.push(questPath as Href);
    }, [questPath]);

    const handleWebLinkClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
        if (!questPath) {
            event.preventDefault();
            return;
        }

        const shouldUseBrowserNavigation =
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey;
        if (shouldUseBrowserNavigation) return;

        event.preventDefault();
        handlePress();
    }, [handlePress, questPath]);

    const handleWebLinkKeyDown = useCallback((event: ReactKeyboardEvent<HTMLAnchorElement>) => {
        // Enter is handled by the anchor's native click activation. Preserve the
        // former Space activation explicitly because anchors normally scroll on Space.
        if (event.key !== ' ') return;
        event.preventDefault();
        handlePress();
    }, [handlePress]);

    const handleReviewsPress = useCallback((event?: any) => {
        event?.stopPropagation?.();
        setReviewsOpen(true);
    }, []);

    const handleReviewsClose = useCallback(() => {
        setReviewsOpen(false);
    }, []);

    const cardHeight = isPhone ? 238 : Math.round((cardWidth / 380) * 260);
    const showOverlayMeta = !isPhone;

    // Ширина обложки = CSS-слот × плотность экрана, с потолком DPR 2.
    //
    // Здесь долго стоял `dpr = 1` на web с обоснованием «retina-вариант умножает
    // байты и холодные конверсии без полезного выигрыша». Обоснование было верным,
    // когда мастером лежал PNG на 2.4 МБ и каждая конверсия стоила секунды. После
    // нормализации обложек (#1166) мастер — WebP на 46 КБ, и цена ступени изменилась
    // до незначительной. А вот визуальная плата осталась и была видна на проде:
    // слот 280×192 CSS при DPR 2 требует 560 device px, запрашивалось 320 —
    // браузер растягивал в 1.75×, обложки выглядели мыльными.
    //
    // Замер 2026-07-31 на нормализованной обложке (`?q=60&fit=cover`):
    //   w=320 → 1 918 B, апскейл 1.75×   ← было
    //   w=640 → 5 390 B, апскейл 0.88×   ← стало
    // Плата за резкость — 3.5 КБ на карточку.
    const coverSrc = useMemo(() => {
        if (!imageUrl) return imageUrl;
        const dpr = Math.min(PixelRatio.get() || 2, 2);
        const requestedWidth = Math.max(1, Math.round(cardWidth * dpr));
        // #1167: набор — из общего контракта, а не литералом на месте.
        const responsiveWidths = IMAGE_WIDTHS.questCover;
        const targetWidth =
            responsiveWidths.find((candidate) => candidate >= requestedWidth) ??
            responsiveWidths[responsiveWidths.length - 1];
        return optimizeImageUrl(imageUrl, {
            width: targetWidth,
            quality: IMAGE_QUALITY.questCover,
            // Режим кадрирования у слота — `contain`, значит и серверу нельзя
            // просить `cover`: на durable-семействе `quest-cover` параметр
            // игнорируется, но на legacy-роуте он вырезал бы кадр, который мы
            // потом ещё раз вписываем — двойной кроп.
            fit: 'contain',
        }) ?? imageUrl;
    }, [imageUrl, cardWidth]);

    return (
        <View
            style={[
                styles.questCard,
                { width: cardWidth, maxWidth: '100%' },
                isHovered && styles.questCardHover,
            ]}
            {...Platform.select({
                web: {
                    onMouseEnter: () => setIsHovered(true),
                    onMouseLeave: () => setIsHovered(false),
                } as any,
                default: {},
            })}
            testID={Platform.OS === 'web' ? undefined : `quest-card-${quest.id}`}
        >
            {Platform.OS === 'web' ? (
                <a
                    href={questPath ?? undefined}
                    aria-label={questLinkLabel}
                    aria-disabled={questPath ? undefined : true}
                    tabIndex={questPath ? undefined : -1}
                    onClick={handleWebLinkClick}
                    onKeyDown={handleWebLinkKeyDown}
                    style={webCardLinkStyle}
                    data-testid={`quest-card-${quest.id}`}
                />
            ) : (
                <Pressable
                    style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
                    onPress={handlePress}
                    accessibilityRole="button"
                    accessibilityLabel={questLinkLabel}
                />
            )}

            <View
                style={[styles.questCardImage, { height: cardHeight }]}
                pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
            >
                {!imageLoaded && imageUrl && (
                    <ShimmerOverlay style={StyleSheet.absoluteFill} />
                )}

                {imageUrl ? (
                    // iPhone Safari regression guard: do not add the filtered
                    // blur backdrop here. WebKit can keep that composited layer
                    // visible while failing to paint the sharp img, leaving the
                    // card permanently blurred. QuestCard.test.tsx locks this.
                    // Гард — web-сторонний: `ImageCardMedia` и сам гасит
                    // `blurBackground` на web (`components/ui/ImageCardMedia.tsx:1003`),
                    // а константный `false` отбирал заливку у native, где
                    // индекс `dominant_color` не работает по замыслу
                    // (`ImageCardMedia.tsx:254`). При `contain` это оставило бы
                    // Android и iPhone прозрачные поля — ровно тот дефект, о
                    // котором предупреждает docs/RULES.md.
                    <ImageCardMedia
                        src={coverSrc}
                        alt={quest.title}
                        width={cardWidth}
                        height={cardHeight}
                        // `contain` — требование docs/RULES.md → «Images and
                        // placeholders»: обложки квестов кадрируются только так,
                        // исключений по поверхностям нет. `cover` приехал сюда
                        // 2026-07-26 коммитом c48fffe6 вместе со снятием
                        // блюр-подложки: без подложки поле было прозрачным, и
                        // кроп его прятал. С 2026-08-02 (#1208) поле заливает
                        // `dominant_color` из манифеста (обложки квестов
                        // индексируются в `api/quests.ts`), поэтому прежней
                        // причины больше нет. Слот карточки ландшафтный, поэтому
                        // поле мелкое: 9.6% на mobile 390 и 8.8–9.0% на всей
                        // десктопной полосе (слот 420×287 на 1280, 600×411 в
                        // одноколоночном городе). Но не «не больше 9%»: в полосе `isPhone`
                        // (360…479, `hooks/useResponsive.ts:218`) высота приколота
                        // к 238, а ширина едет за вьюпортом, и на краях полосы
                        // пропорция слота уходит до 1.311 и 1.811 — поле там до
                        // 13.2%. Это остаточный контентный долг того же семейства,
                        // что #1542/#1558, а не повод вернуть `cover`.
                        fit="contain"
                        blurBackground={Platform.OS !== 'web'}
                        style={StyleSheet.absoluteFill}
                        loading={isAboveTheFold ? 'eager' : 'lazy'}
                        priority={isAboveTheFold ? 'high' : 'low'}
                        optimizeWeb={false}
                        onLoad={handleImageLoad}
                        showImmediately={imageLoaded}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundTertiary }]} />
                )}

                {Platform.OS === 'web' && (
                    <>
                        <View style={styles.questCardVignette} />
                        <View style={[styles.questCardGradient, { pointerEvents: 'none' }]} />
                        <View style={styles.questCardMagicGlow} />
                    </>
                )}

                {distanceText && (
                    <View style={styles.questCardBadge}>
                        <Feather name="navigation" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardBadgeText}>{distanceText}</Text>
                    </View>
                )}

                {quest.isCompletedByMe && (
                    <View style={[styles.questCardCompletedBadge, distanceText ? { top: 44 } : null]}>
                        <Feather name="check-circle" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardCompletedText}>{i18nT('quests:screens.tabs.QuestCard.proyden_73ced70e')}</Text>
                    </View>
                )}

                {difficultyInfo && (
                    <View style={styles.questCardDifficultyBadge}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: difficultyInfo.color }} />
                        <Text style={styles.questCardDifficultyText}>{difficultyInfo.label}</Text>
                    </View>
                )}

                {ageBadgeLabel && (
                    <View
                        style={[styles.questCardKidsBadge, difficultyInfo ? { top: 44 } : null]}
                        testID={`quest-card-kids-${quest.id}`}
                    >
                        <Feather name="smile" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardKidsText} numberOfLines={1}>
                            {ageBadgeLabel}
                        </Text>
                    </View>
                )}

                {isBike && (
                    <View
                        style={[
                            styles.questCardBikeBadge,
                            // Стек правых бейджей: сложность и/или возраст выше — сдвигаемся вниз.
                            { top: 8 + (difficultyInfo ? 36 : 0) + (ageBadgeLabel ? 36 : 0) },
                        ]}
                        testID={`quest-card-bike-${quest.id}`}
                    >
                        <NavigationIcon name="bike" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardBikeText} numberOfLines={1}>
                            {i18nT('quests:screens.tabs.QuestCard.veloBadge')}
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.questCardPlayIcon,
                        // На телефоне hover нет (mobile web) — кнопка видна всегда, как на устройстве.
                        (isHovered || isPhone) && styles.questCardPlayIconVisible,
                        { pointerEvents: 'none' },
                    ]}
                >
                    <Feather name="play" size={18} color={colors.textOnDark} style={{ marginLeft: 2 } as any} />
                </View>

                <View style={[styles.questCardContent, { pointerEvents: 'none' }]}>
                    {categoryLabel && <Text style={styles.questCardCategory}>{categoryLabel}</Text>}
                    <Text style={styles.questCardTitle} numberOfLines={2}>
                        {quest.title}
                    </Text>
                    {showOverlayMeta && (
                        <View style={styles.questCardMeta}>
                            <View style={styles.questCardMetaItem}>
                                <Feather name="map-pin" size={13} color="rgba(255,255,255,0.9)" />
                                <Text style={styles.questCardMetaText}>{pointsText}</Text>
                            </View>
                                <View style={styles.questCardMetaItem}>
                                    <Feather name="clock" size={13} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.questCardMetaText}>{durationText}</Text>
                                </View>
                                {showAggregateRating && (
                                    <View
                                        style={styles.questCardMetaItem}
                                        testID={`quest-card-rating-${quest.id}`}
                                    >
                                        <Feather name="star" size={13} color="rgba(255,255,255,0.95)" />
                                        <Text style={styles.questCardMetaText}>
                                            {formatRatingValue(quest.ratingAvg ?? 0)} ({quest.ratingCount})
                                        </Text>
                                    </View>
                                )}
                                {quest.completionsCount > 0 && (
                                    <View
                                        style={styles.questCardMetaItem}
                                        testID={`quest-card-completions-${quest.id}`}
                                    >
                                        <Feather name="check-circle" size={13} color="rgba(255,255,255,0.9)" />
                                        <Text style={styles.questCardMetaText}>
                                            {i18nT('quests:screens.tabs.QuestCard.proydeno_5cec53cc')}{quest.completionsCount} {pluralizeRu(quest.completionsCount, i18nT('quests:screens.tabs.QuestCard.raz_cb5ff63c'), i18nT('quests:screens.tabs.QuestCard.raza_7014923e'), i18nT('quests:screens.tabs.QuestCard.raz_cb5ff63c'))}
                                        </Text>
                                    </View>
                                )}
                        </View>
                    )}

                    {showOverlayMeta && quest.firstCompleter && (
                        <View style={styles.questCardPioneerRow}>
                            <UserAvatar uri={quest.firstCompleter.avatar} size="sm" />
                            <Text style={styles.questCardPioneerText} numberOfLines={1}>
                                {i18nT('quests:screens.tabs.QuestCard.pervym_proshel_0647d9f1')}{quest.firstCompleter.name}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {isPhone && (
                <View
                    style={[
                        styles.questCardDetails,
                        Platform.OS === 'web' && { position: 'relative', zIndex: 30 },
                    ]}
                    pointerEvents={Platform.OS === 'web' ? 'box-none' : undefined}
                >
                    <View
                        style={styles.questCardDetailsMeta}
                        pointerEvents={Platform.OS === 'web' ? 'box-none' : undefined}
                    >
                        <View
                            style={styles.questCardDetailsItem}
                            pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
                        >
                            <Feather name="map-pin" size={13} color={colors.textMuted} />
                            <Text style={styles.questCardDetailsText}>{pointsText}</Text>
                        </View>
                        <View
                            style={styles.questCardDetailsItem}
                            pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
                        >
                            <Feather name="clock" size={13} color={colors.textMuted} />
                            <Text style={styles.questCardDetailsText}>{durationText}</Text>
                        </View>
                        {showAggregateRating && (
                            <View
                                style={styles.questCardDetailsItem}
                                pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
                                testID={`quest-card-rating-${quest.id}`}
                            >
                                <Feather name="star" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>
                                    {formatRatingValue(quest.ratingAvg ?? 0)}
                                </Text>
                            </View>
                        )}
                        {showReviewsAction && (
                            <Pressable
                                onPress={handleReviewsPress}
                                style={[
                                    styles.questCardDetailsItem,
                                    styles.questCardReviewsInline,
                                    Platform.OS !== 'web' && styles.questCardReviewsChipNativeInline,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('quests:screens.tabs.QuestCard.posmotret_otzyvy_value1_0859ae2d', { value1: reviewsLabel })}
                                accessibilityHint={i18nT('quests:screens.tabs.QuestCard.otkryvaet_otzyvy_k_kvestu_02dd3527')}
                                testID={`quest-card-reviews-${quest.id}`}
                                hitSlop={6}
                                pointerEvents={Platform.OS === 'web' ? 'auto' : undefined}
                            >
                                <Feather name="message-circle" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>{quest.ratingCount}</Text>
                            </Pressable>
                        )}
                        {quest.completionsCount > 0 && (
                            <View
                                style={styles.questCardDetailsItem}
                                pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
                                testID={`quest-card-completions-${quest.id}`}
                            >
                                <Feather name="check-circle" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>{quest.completionsCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {showReviewsAction && !isPhone && (
                <Pressable
                    onPress={handleReviewsPress}
                    style={[
                        styles.questCardReviewsChip,
                        Platform.OS !== 'web' && styles.questCardReviewsChipNative,
                        {
                            top:
                                cardHeight -
                                DESIGN_TOKENS.touchTarget.minHeight -
                                DESIGN_TOKENS.spacing.sm,
                        },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('quests:screens.tabs.QuestCard.posmotret_otzyvy_value1_0859ae2d', { value1: reviewsLabel })}
                    accessibilityHint={i18nT('quests:screens.tabs.QuestCard.otkryvaet_otzyvy_k_kvestu_02dd3527')}
                    testID={`quest-card-reviews-${quest.id}`}
                    hitSlop={6}
                    pointerEvents={Platform.OS === 'web' ? 'auto' : undefined}
                    {...Platform.select({
                        web: {
                            role: 'button',
                            tabIndex: 0,
                            'data-card-action': 'true',
                            onClick: (event: any) => {
                                event?.stopPropagation?.();
                                handleReviewsPress(event);
                            },
                        } as any,
                        default: {},
                    })}
                >
                    <Feather name="message-circle" size={13} color={colors.textOnDark} />
                    <Text style={styles.questCardReviewsChipText}>
                        {Platform.OS === 'web' ? quest.ratingCount : i18nT('quests:screens.tabs.QuestCard.posmotret_otzyvy_value1_4dd71d0d', { value1: quest.ratingCount })}
                    </Text>
                </Pressable>
            )}

            {reviewsOpen && (
                <QuestReviewsModal
                    questId={String(quest.id)}
                    visible={reviewsOpen}
                    onClose={handleReviewsClose}
                />
            )}
        </View>
    );
}

/**
 * #1826: каталог на web рисует до 177 карточек одним `map`, а состояние экрана
 * меняется на каждое нажатие в поиске. Без границы мемоизации один символ
 * перерисовывал ~12 000 элементов. Все пропсы карточки стабильны по ссылке:
 * `styles` — мемоизированный объект экрана, `quest` — элемент мемоизированного
 * каталога (спреды-копии сняты в `QuestsScreen`), остальное примитивы.
 */
export default memo(QuestCard)
