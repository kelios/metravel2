// src/components/listTravel/RenderTravelItem.tsx
import React, { memo, useMemo } from "react";
import { Platform, View, useWindowDimensions, ViewStyle } from "react-native";
import TravelListItem from "./TravelListItem";
import AnimatedCard from "../AnimatedCard";
import type { Travel } from "@/src/types/types";
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
            ...(shadows.medium as ViewStyle),
        };

        if (Platform.OS === 'web') {
            base.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
            base[':hover'] = {
                transform: [{ translateY: -2 }],
                ...(shadows.hover as ViewStyle)
            };
        }

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
                marginHorizontal: spacing.sm,
            };
        }

        return {
            ...base,
            flex: 1,
            minWidth: 0,
            marginHorizontal: spacing.sm,
        };
    }, [isMobile, isTablet, isSingle]);

    const selectedStyle = useMemo<ViewStyle>(() => ({
        borderWidth: 2,
        borderColor: DESIGN_TOKENS.colors.primary,
    }), []);

    return (
        <AnimatedCard 
            index={index || 0} 
            style={[containerStyle, isSelected && selectedStyle]}
        >
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
