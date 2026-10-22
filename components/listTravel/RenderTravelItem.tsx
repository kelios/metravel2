// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useCallback, useMemo } from "react";
import { Platform, View, ViewStyle } from "react-native";
import TravelListItem from "./TravelListItem";
import type { Travel } from "@/types/types";
import TravelModerationFeedback from '@/components/travel/TravelModerationFeedback';
import { extractOwnerIds } from '@/components/listTravel/travelListItemHelpers';

/** Extra fields that the API may include on travel cards but are missing from the global Travel type */
interface TravelCardExtras {
    userId?: string | number;
    user_id?: string | number;
    ownerId?: string | number;
    owner_id?: string | number;
    author_name?: string;
    authorName?: string;
    owner_name?: string;
    ownerName?: string;
}

type TravelCard = Travel & TravelCardExtras;

const hasSameRenderedTravelSnapshot = (prev: Travel, next: Travel) => {
    const p = prev as TravelCard;
    const n = next as TravelCard;

    return (
        p.id === n.id &&
        p.slug === n.slug &&
        p.travel_image_thumb_url === n.travel_image_thumb_url &&
        p.travel_image_thumb_small_url === n.travel_image_thumb_small_url &&
        p.media?.cover === n.media?.cover &&
        p.name === n.name &&
        p.year === n.year &&
        p.monthName === n.monthName &&
        p.countryName === n.countryName &&
        p.userName === n.userName &&
        p.countUnicIpView === n.countUnicIpView &&
        p.engagementStats?.favoritesCount === n.engagementStats?.favoritesCount &&
        p.engagementStats?.wishlistCount === n.engagementStats?.wishlistCount &&
        p.engagementStats?.visitedCount === n.engagementStats?.visitedCount &&
        p.engagementStats?.plannedCount === n.engagementStats?.plannedCount &&
        p.url === n.url &&
        p.rating === n.rating &&
        p.rating_count === n.rating_count &&
        p.created_at === n.created_at &&
        p.updated_at === n.updated_at &&
        p.publication_status === n.publication_status &&
        p.publish === n.publish &&
        p.moderation === n.moderation &&
        p.moderation_decision === n.moderation_decision &&
        p.moderation_decision_reason === n.moderation_decision_reason &&
        p.moderation_decided_at === n.moderation_decided_at &&
        p.userIds === n.userIds &&
        p.userId === n.userId &&
        p.user_id === n.user_id &&
        p.ownerId === n.ownerId &&
        p.owner_id === n.owner_id &&
        p.author_name === n.author_name &&
        p.authorName === n.authorName &&
        p.owner_name === n.owner_name &&
        p.ownerName === n.ownerName &&
        p.user?.id === n.user?.id &&
        p.user?.name === n.user?.name &&
        p.user?.first_name === n.user?.first_name &&
        p.user?.last_name === n.user?.last_name
    );
}

type RenderTravelItemProps = {
    item: Travel;
    index?: number;
    isMobile?: boolean;
    isSuperuser?: boolean;
    currentUserId?: string | null;
    isMetravel?: boolean;
    showAuthorModerationFeedback?: boolean;
    onDeletePress?: (id: number) => void;
    isFirst?: boolean;
    isSingle?: boolean;
    selectable?: boolean;
    isSelected?: boolean;
    onToggle?: () => void;
    cardWidth?: string | number; // пока не используем для width, оставляем для совместимости пропсов
    imageHeight?: number;
    viewportWidth?: number;
    gridColumns?: number;
    hideAuthor?: boolean;
    visualVariant?: 'default' | 'home-featured';
    isDeleting?: boolean;
    /** См. `TravelListItem.mediaLoading` — экраны без виртуализации передают `lazy` (#1285). */
    mediaLoading?: 'lazy' | 'eager';
};

type TravelListItemCompatProps = React.ComponentProps<typeof TravelListItem> & {
    isDeleting?: boolean;
};

const TravelListItemCompat = TravelListItem as React.ComponentType<TravelListItemCompatProps>;

function RenderTravelItem({
                              item,
                              index: _index = 0,
                              isMobile = false,
                              isSuperuser,
                              currentUserId,
                              isMetravel,
                              showAuthorModerationFeedback = false,
                              onDeletePress,
                              isFirst,
                              isSingle = false,
                              selectable = false,
                              isSelected = false,
                              onToggle,
                              cardWidth,
                              imageHeight,
                              viewportWidth = 0,
                              gridColumns,
                              hideAuthor = false,
                              visualVariant = 'default',
                               isDeleting = false,
                               mediaLoading,
                          }: RenderTravelItemProps) {

    const cardWidthNumber = useMemo(() => {
        if (typeof cardWidth === 'number') return cardWidth;
        if (typeof cardWidth === 'string') {
            const v = Number(cardWidth);
            return Number.isFinite(v) ? v : undefined;
        }
        return undefined;
    }, [cardWidth]);

    const authorFeedbackVisible = Boolean(item && !selectable && (showAuthorModerationFeedback || isMetravel)
        && currentUserId && extractOwnerIds(item).includes(String(currentUserId).trim()));
    const renderAuthorFeedback = useCallback((onEdit: () => void) => (
        <TravelModerationFeedback key={`${item.id}:${currentUserId}`} travel={item} onCorrect={onEdit} list />
    ), [currentUserId, item]);
    const containerStyle = useMemo<ViewStyle>(() => ({
        width: '100%',
        maxWidth: '100%',
        flexShrink: 0,
        flexGrow: authorFeedbackVisible ? 1 : 0,
        overflow: 'visible',
        ...(Platform.OS === 'web' ? { height: authorFeedbackVisible ? 'auto' : '100%' } : {}),
    }), [authorFeedbackVisible]);

    if (!item) return null;

    return (
        <View style={containerStyle}>
            <TravelListItemCompat
                travel={item}
                currentUserId={currentUserId}
                isSuperuser={isSuperuser}
                isMetravel={isMetravel}
                onDeletePress={onDeletePress}
                renderAuthorFeedback={authorFeedbackVisible ? renderAuthorFeedback : undefined}
                isFirst={isFirst}
                isSingle={isSingle}
                selectable={selectable}
                isSelected={isSelected}
                onToggle={onToggle}
                isMobile={isMobile}
                viewportWidth={viewportWidth}
                cardWidth={cardWidthNumber}
                imageHeight={imageHeight}
                gridColumns={gridColumns}
                hideAuthor={hideAuthor}
                visualVariant={visualVariant}
                isDeleting={isDeleting}
                mediaLoading={mediaLoading}
            />
        </View>
    );
}

function areEqual(prev: RenderTravelItemProps, next: RenderTravelItemProps) {
    // Самые частые изменения первыми для early exit

    // 1. Самые частые изменения (при выборе/скролле)
    if (prev.isSelected !== next.isSelected) return false;

    // 2. Пропускаем refresh с новой ссылкой на item, если карточка визуально не меняется.
    if (prev.item !== next.item && !hasSameRenderedTravelSnapshot(prev.item, next.item)) return false;
    
    // 3. Режимы работы (меняются при навигации)
    if (prev.selectable !== next.selectable) return false;
    if (prev.isMetravel !== next.isMetravel) return false;
    if (prev.showAuthorModerationFeedback !== next.showAuthorModerationFeedback) return false;
    
    // 4. Редкие изменения (меняются только при resize или смене роли)
    if (prev.isMobile !== next.isMobile) return false;
    if (prev.isSuperuser !== next.isSuperuser) return false;
    if (prev.currentUserId !== next.currentUserId) return false;
    
    // 5. Очень редкие изменения
    if (prev.isFirst !== next.isFirst) return false;
    if (prev.isSingle !== next.isSingle) return false;
    if (prev.hideAuthor !== next.hideAuthor) return false;
    if (prev.cardWidth !== next.cardWidth) return false;
    if (prev.viewportWidth !== next.viewportWidth) return false;
    if (prev.gridColumns !== next.gridColumns) return false;
    if (prev.imageHeight !== next.imageHeight) return false;
    if (prev.visualVariant !== next.visualVariant) return false;
    if (prev.isDeleting !== next.isDeleting) return false;
    if (prev.mediaLoading !== next.mediaLoading) return false;

    return true;
}

export default memo(RenderTravelItem, areEqual);
