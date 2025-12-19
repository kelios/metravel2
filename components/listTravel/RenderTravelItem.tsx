// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useMemo } from "react";
import { Platform, View, ViewStyle } from "react-native";
import TravelListItem from "./TravelListItem";
import AnimatedCard from "../AnimatedCard";
import type { Travel } from "@/src/types/types";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { router } from 'expo-router';
import { TRAVEL_CARD_WEB_HEIGHT, TRAVEL_CARD_WEB_MOBILE_HEIGHT } from './utils/listTravelConstants';

const { spacing, radii, shadows } = DESIGN_TOKENS;

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
                          }: RenderTravelItemProps) {
    if (!item) return null;

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
        const base: ContainerStyle = {
            borderRadius: radii.lg,
            overflow: Platform.OS === "android" ? "visible" : "hidden",
            backgroundColor: 'white',
            // Platform-specific shadows
            ...(Platform.OS === 'web' 
                ? ({
                    boxShadow: shadows.medium,
                    minHeight: isMobile ? TRAVEL_CARD_WEB_MOBILE_HEIGHT : TRAVEL_CARD_WEB_HEIGHT,
                  } as any)
                : DESIGN_TOKENS.shadowsNative.medium
            ),
        };

        // Убираем transition и :hover, так как они вызывают ошибки в React Native Web
        // Анимация уже есть в AnimatedCard компоненте

        if (isSingle) {
            return {
                ...base,
                width: "100%",
                maxWidth: Platform.OS === 'web' ? 800 : undefined,
                alignSelf: "center",
            };
        }

        if (isMobile) {
            return {
                ...base,
                width: "100%",
                maxWidth: "100%", // Явно ограничиваем ширину
                overflow: "hidden",
                // ✅ FIX: Убран дублирующий marginBottom
            };
        }

        // Для desktop/tablet в сетке: карточка занимает всю ширину своей колонки
        return {
            ...base,
            flexShrink: 0,
            width: "100%",
            maxWidth: "100%",
        };
    }, [isMobile, isSingle]);

    const selectedStyle = useMemo<ViewStyle>(() => ({
        borderWidth: 2,
        borderColor: DESIGN_TOKENS.colors.primary,
    }), []);

    // Всегда используем TravelListItem
    return (
        <AnimatedCard 
            index={index || 0} 
            style={[containerStyle, isSelected && selectedStyle]}
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
