import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import CollapsibleBlock from '@/components/ui/CollapsibleBlock';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';


interface FilterGroup {
    id: string;
    title: string;
    iconName: keyof typeof Feather.glyphMap;
    description?: string;
    defaultExpanded?: boolean;
}

interface GroupedFiltersSectionProps {
    group: FilterGroup;
    children: React.ReactNode;
    filledCount?: number;
    totalCount?: number;
}

/**
 * ✅ УЛУЧШЕНИЕ: Компонент группировки фильтров с коллапсом
 * Используется на шаге 5 для структурирования дополнительных параметров
 */
const GroupedFiltersSection: React.FC<GroupedFiltersSectionProps> = ({
    group,
    children,
    filledCount,
    totalCount,
}) => {
    const colors = useThemedColors();
    const [isExpanded, setIsExpanded] = useState(group.defaultExpanded ?? false);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const progressText = useMemo(() => {
        if (filledCount !== undefined && totalCount !== undefined && totalCount > 0) {
            return `${filledCount}/${totalCount}`;
        }
        return null;
    }, [filledCount, totalCount]);

    return (
        <CollapsibleBlock
            id={`travel-filter-group-${group.id}`}
            title={group.title}
            description={!isExpanded ? group.description : undefined}
            icon={group.iconName}
            expanded={isExpanded}
            onToggle={setIsExpanded}
            hasCloseButton={false}
            showExpandHint={false}
            unmountWhenCollapsed
            headerActions={progressText ? (
                <View style={styles.progressBadge}>
                    <Text style={styles.progressText}>{progressText}</Text>
                </View>
            ) : undefined}
        >
            {group.description ? (
                <Text style={styles.contentDescription}>{group.description}</Text>
            ) : null}
            {children}
        </CollapsibleBlock>
    );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    progressBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.primarySoft,
    },
    progressText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '700',
        color: colors.primaryText,
    },
    contentDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        lineHeight: 20,
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
});

export default React.memo(GroupedFiltersSection);
