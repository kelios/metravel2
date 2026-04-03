// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useMemo } from "react";
import { Platform, View, ViewStyle } from "react-native";
import TravelListItem from "./TravelListItem";
import type { Travel } from "@/types/types";
 

interface ContainerStyle extends ViewStyle {
    ':hover'?: ViewStyle;
    transition?: string;
}

const hasSameRenderedTravelSnapshot = (prev: Travel, next: Travel) => {
    const prevUser = (prev as any)?.user;
    const nextUser = (next as any)?.user;

    return (
        prev.id === next.id &&
        prev.slug === next.slug &&
        prev.travel_image_thumb_url === next.travel_image_thumb_url &&
        prev.name === next.name &&
        prev.countryName === next.countryName &&
        prev.userName === next.userName &&
        prev.countUnicIpView === next.countUnicIpView &&
        (prev as any)?.url === (next as any)?.url &&
        (prev as any)?.rating === (next as any)?.rating &&
        (prev as any)?.rating_count === (next as any)?.rating_count &&
        (prev as any)?.created_at === (next as any)?.created_at &&
        (prev as any)?.updated_at === (next as any)?.updated_at &&
        (prev as any)?.userIds === (next as any)?.userIds &&
        (prev as any)?.userId === (next as any)?.userId &&
        (prev as any)?.user_id === (next as any)?.user_id &&
        (prev as any)?.ownerId === (next as any)?.ownerId &&
        (prev as any)?.owner_id === (next as any)?.owner_id &&
        (prev as any)?.author_name === (next as any)?.author_name &&
        (prev as any)?.authorName === (next as any)?.authorName &&
        (prev as any)?.owner_name === (next as any)?.owner_name &&
        (prev as any)?.ownerName === (next as any)?.ownerName &&
        prevUser?.id === nextUser?.id &&
        prevUser?.name === nextUser?.name &&
        prevUser?.first_name === nextUser?.first_name &&
        prevUser?.last_name === nextUser?.last_name
    );
}

type RenderTravelItemProps = {
    item: Travel;
    index?: number;
    isMobile?: boolean;
    isSuperuser?: boolean;
    currentUserId?: string | null;
    isMetravel?: boolean;
    onDeletePress?: (id: number) => void;
    isFirst?: boolean;
    isSingle?: boolean;
    selectable?: boolean;
    isSelected?: boolean;
    onToggle?: () => void;
    cardWidth?: string | number; // пока не используем для width, оставляем для совместимости пропсов
    imageHeight?: number;
    viewportWidth?: number;
    hideAuthor?: boolean;
    visualVariant?: 'default' | 'home-featured';
};

function RenderTravelItem({
                              item,
                              index: _index = 0,
                              isMobile = false,
                              isSuperuser,
                              currentUserId,
                              isMetravel,
                              onDeletePress,
                              isFirst,
                              isSingle = false,
                              selectable = false,
                              isSelected = false,
                              onToggle,
                              cardWidth,
                              imageHeight,
                              viewportWidth = 0,
                              hideAuthor = false,
                              visualVariant = 'default',
                          }: RenderTravelItemProps) {

    const cardWidthNumber = useMemo(() => {
        if (typeof cardWidth === 'number') return cardWidth;
        if (typeof cardWidth === 'string') {
            const v = Number(cardWidth);
            return Number.isFinite(v) ? v : undefined;
        }
        return undefined;
    }, [cardWidth]);

    const containerStyle = useMemo<ContainerStyle>(() => {
        // Внешний wrapper не должен выглядеть как карточка.
        // Вся визуальная часть (фон/радиус/тени/высота) живёт внутри UnifiedTravelCard (TravelListItem).
        return {
            width: '100%',
            maxWidth: '100%',
            flexShrink: 0,
            // Не обрезаем тени внутренней карточки
            overflow: Platform.OS === 'android' ? 'visible' : 'visible',
            ...(Platform.OS === 'web' ? { height: '100%' } : {}),
        };
    }, []);

    if (!item) return null;

    return (
        <View style={containerStyle}>
            <TravelListItem
                travel={item}
                currentUserId={currentUserId}
                isSuperuser={isSuperuser}
                isMetravel={isMetravel}
                onDeletePress={onDeletePress}
                isFirst={isFirst}
                isSingle={isSingle}
                selectable={selectable}
                isSelected={isSelected}
                onToggle={onToggle}
                isMobile={isMobile}
                viewportWidth={viewportWidth}
                cardWidth={cardWidthNumber}
                imageHeight={imageHeight}
                hideAuthor={hideAuthor}
                visualVariant={visualVariant}
            />
        </View>
    );
}

function areEqual(prev: RenderTravelItemProps, next: RenderTravelItemProps) {
    // ✅ A3.1: Оптимизированный порядок сравнений - самые частые изменения первыми для early exit
    
    // 1. Самые частые изменения (при выборе/скролле)
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.index !== next.index) return false;
    
    // 2. Пропускаем refresh с новой ссылкой на item, если карточка визуально не меняется.
    if (prev.item !== next.item && !hasSameRenderedTravelSnapshot(prev.item, next.item)) return false;
    
    // 3. Режимы работы (меняются при навигации)
    if (prev.selectable !== next.selectable) return false;
    if (prev.isMetravel !== next.isMetravel) return false;
    
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
    if (prev.imageHeight !== next.imageHeight) return false;
    if (prev.visualVariant !== next.visualVariant) return false;

    return true;
}

export default memo(RenderTravelItem, areEqual);
