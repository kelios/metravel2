import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
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

    const toggleExpanded = () => {
        setIsExpanded(prev => !prev);
    };

    const progressText = useMemo(() => {
        if (filledCount !== undefined && totalCount !== undefined && totalCount > 0) {
            return `${filledCount}/${totalCount}`;
        }
        return null;
    }, [filledCount, totalCount]);

    return (
        <View style={styles.container}>
            <Pressable
                style={({ pressed }) => [
                    styles.header,
                    pressed && styles.headerPressed,
                ]}
                onPress={toggleExpanded}
                accessibilityRole="button"
                accessibilityLabel={`${isExpanded ? 'Свернуть' : 'Развернуть'} секцию ${group.title}`}
                accessibilityState={{ expanded: isExpanded }}
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <View style={styles.headerLeft}>
                    <View style={styles.iconWrapper}>
                        <Feather name={group.iconName} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.headerTextColumn}>
                        <View style={styles.titleRow}>
                            <Text style={styles.headerTitle}>{group.title}</Text>
                            {progressText && (
                                <View style={styles.progressBadge}>
                                    <Text style={styles.progressText}>{progressText}</Text>
                                </View>
                            )}
                        </View>
                        {group.description && !isExpanded && (
                            <Text style={styles.headerDescription} numberOfLines={1}>
                                {group.description}
                            </Text>
                        )}
                    </View>
                </View>
                <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textMuted}
                />
            </Pressable>

            {isExpanded && (
                <View style={styles.content}>
                    {group.description && (
                        <Text style={styles.contentDescription}>{group.description}</Text>
                    )}
                    {children}
                </View>
            )}
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        marginBottom: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...(Platform.OS === 'web'
            ? ({ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any)
            : {}),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: DESIGN_TOKENS.spacing.md,
        minHeight: 60,
    },
    headerPressed: {
        backgroundColor: colors.surfaceMuted,
        opacity: 0.9,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
        minWidth: 0,
    },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextColumn: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        marginBottom: 2,
    },
    headerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
    },
    progressBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.primarySoft,
    },
    progressText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '700',
        color: colors.primary,
    },
    headerDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        lineHeight: 16,
    },
    content: {
        padding: DESIGN_TOKENS.spacing.md,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    contentDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        lineHeight: 20,
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
});

export default React.memo(GroupedFiltersSection);

