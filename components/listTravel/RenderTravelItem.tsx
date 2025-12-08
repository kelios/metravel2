// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useMemo } from "react";
import { Platform, View, useWindowDimensions, ViewStyle } from "react-native";
import TravelListItem from "./TravelListItem";
import AnimatedCard from "../AnimatedCard";
import type { Travel } from "@/src/types/types";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { router } from 'expo-router';

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

    const containerStyle = useMemo<ContainerStyle>(() => {
        const base: ContainerStyle = {
            borderRadius: radii.lg,
            overflow: Platform.OS === "android" ? "visible" : "hidden",
            marginBottom: isMobile ? spacing.sm : spacing.md,
            backgroundColor: 'white',
            // Platform-specific shadows
            ...(Platform.OS === 'web' 
                ? { boxShadow: shadows.medium } as any
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
                marginBottom: spacing.sm,
                overflow: "hidden",
            };
        }

        return {
            ...base,
            flex: 1,
            minWidth: 0,
            marginHorizontal: spacing.sm,
        };
    }, [isMobile, isSingle]); // Убрали isTablet из зависимостей, так как она не используется

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
            />
        </AnimatedCard>
    );
}

function areEqual(prev: RenderTravelItemProps, next: RenderTravelItemProps) {
    // Важно: сравниваем ссылку на объект, чтобы компонент обновлялся,
    // когда react-query приносит новый объект с тем же id.
    const sameItemRef = prev.item === next.item;

    // Оптимизированное сравнение флагов - выходим раньше если есть различия
    if (prev.isSuperuser !== next.isSuperuser) return false;
    if (prev.isMetravel !== next.isMetravel) return false;
    if (prev.isFirst !== next.isFirst) return false;
    if (prev.isSingle !== next.isSingle) return false;
    if (prev.selectable !== next.selectable) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isMobile !== next.isMobile) return false;
    if (prev.index !== next.index) return false;

    return sameItemRef;
}

export default memo(RenderTravelItem, areEqual);
