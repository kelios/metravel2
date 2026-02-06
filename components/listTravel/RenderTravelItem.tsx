// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useMemo } from "react";
import { Platform, ViewStyle } from "react-native";
import TravelListItem from "./TravelListItem";
import AnimatedCard from "@/components/ui/AnimatedCard";
import type { Travel } from "@/types/types";
import { useResponsive } from '@/hooks/useResponsive';
 

interface ContainerStyle extends ViewStyle {
    ':hover'?: ViewStyle;
    transition?: string;
}

type RenderTravelItemProps = {
    item: Travel;
    index?: number;
    isMobile?: boolean;
    isSuperuser?: boolean;
    isMetravel?: boolean;
    onDeletePress?: (id: number) => void;
    isFirst?: boolean;
    isSingle?: boolean;
    selectable?: boolean;
    isSelected?: boolean;
    onToggle?: () => void;
    cardWidth?: string | number; // пока не используем для width, оставляем для совместимости пропсов
    hideAuthor?: boolean;
};

function RenderTravelItem({
                              item,
                              index = 0,
                              isMobile = false,
                              isSuperuser,
                              isMetravel,
                              onDeletePress,
                              isFirst,
                              isSingle = false,
                              selectable = false,
                              isSelected = false,
                              onToggle,
                              cardWidth,
                              hideAuthor = false,
                          }: RenderTravelItemProps) {
    const { width } = useResponsive();

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
        };
    }, []);

    if (!item) return null;

    // Всегда используем TravelListItem
    return (
        <AnimatedCard 
            index={index || 0} 
            style={containerStyle}
        >
            <TravelListItem
                travel={item}
                isSuperuser={isSuperuser}
                isMetravel={isMetravel}
                onDeletePress={onDeletePress}
                isFirst={isFirst}
                isSingle={isSingle}
                selectable={selectable}
                isSelected={isSelected}
                onToggle={onToggle}
                isMobile={isMobile}
                viewportWidth={width}
                cardWidth={cardWidthNumber}
                hideAuthor={hideAuthor}
            />
        </AnimatedCard>
    );
}

function areEqual(prev: RenderTravelItemProps, next: RenderTravelItemProps) {
    // ✅ A3.1: Оптимизированный порядок сравнений - самые частые изменения первыми для early exit
    
    // 1. Самые частые изменения (при выборе/скролле)
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.index !== next.index) return false;
    
    // 2. Проверка ссылки на объект данных (меняется при обновлении данных)
    if (prev.item !== next.item) return false;
    
    // 3. Режимы работы (меняются при навигации)
    if (prev.selectable !== next.selectable) return false;
    if (prev.isMetravel !== next.isMetravel) return false;
    
    // 4. Редкие изменения (меняются только при resize или смене роли)
    if (prev.isMobile !== next.isMobile) return false;
    if (prev.isSuperuser !== next.isSuperuser) return false;
    
    // 5. Очень редкие изменения
    if (prev.isFirst !== next.isFirst) return false;
    if (prev.isSingle !== next.isSingle) return false;

    return true;
}

export default memo(RenderTravelItem, areEqual);
