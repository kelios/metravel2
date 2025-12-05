// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useMemo } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import TravelListItem from "./TravelListItem";
import AnimatedCard from "../AnimatedCard";
import type { Travel } from "@/src/types/types";

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
                          }: RenderTravelItemProps) {
    if (!item) return null;

    const { width } = useWindowDimensions();
    const isTablet = width >= 768 && width < 1024;

    const containerStyle = useMemo(() => {
        const base = {
            borderRadius: Platform.select({ default: 8, web: 10 }), // ✅ ОПТИМИЗАЦИЯ: Уменьшен радиус для более современного вида
            overflow:
                Platform.OS === "android"
                    ? ("visible" as const)
                    : ("hidden" as const),
            marginBottom: Platform.select({ 
                default: isMobile ? 8 : 10, // ✅ ОПТИМИЗАЦИЯ: Уменьшены отступы
                web: 12 
            }),
        };

        if (isSingle) {
            return {
                ...base,
                width: "100%",
                maxWidth: Platform.OS === 'web' ? 700 : undefined, // ✅ ОПТИМИЗАЦИЯ: Увеличена максимальная ширина для одиночной карточки
                alignSelf: "center" as const,
            };
        }

        if (isMobile) {
            return {
                ...base,
                width: "100%",
            };
        }

        // ✅ ОПТИМИЗАЦИЯ: Упрощена логика для планшетов и десктопа
        return {
            ...base,
            flex: 1,
            minWidth: 0, // ✅ ИСПРАВЛЕНИЕ: Предотвращает переполнение flex-элементов
        };
    }, [isMobile, isTablet, isSingle]);

    return (
        <AnimatedCard index={index || 0} style={containerStyle}>
            <TravelListItem
                travel={item}
                isMobile={isMobile}
                isSuperuser={isSuperuser}
                isMetravel={isMetravel}
                onDeletePress={onDeletePress}
                isFirst={!!isFirst}
                isSingle={!!isSingle}
                selectable={!!selectable}
                isSelected={!!isSelected}
                onToggle={onToggle}
            />
        </AnimatedCard>
    );
}

function areEqual(prev: RenderTravelItemProps, next: RenderTravelItemProps) {
    // Важно: сравниваем ссылку на объект, чтобы компонент обновлялся,
    // когда react-query приносит новый объект с тем же id.
    const sameItemRef = prev.item === next.item;

    const sameFlags =
        prev.isSuperuser === next.isSuperuser &&
        prev.isMetravel === next.isMetravel &&
        prev.isFirst === next.isFirst &&
        prev.isSingle === next.isSingle &&
        prev.selectable === next.selectable &&
        prev.isSelected === next.isSelected &&
        prev.isMobile === next.isMobile;

    return sameItemRef && sameFlags;
}

export default memo(RenderTravelItem, areEqual);
