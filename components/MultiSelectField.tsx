import React, { forwardRef, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MultiSelect } from 'react-native-element-dropdown';

import { DESIGN_TOKENS } from '@/constants/designSystem';

type MultiSelectFieldProps = {
    label?: string;
    items: any[];
    value?: any[] | any;
    onChange: (value: any) => void;
    labelField: string;
    valueField: string;
    single?: boolean;
    compact?: boolean;
    [key: string]: any;
};

const MultiSelectField = forwardRef<any, MultiSelectFieldProps>(
    ({ label, items, value = [], onChange, labelField, valueField, single = false, compact = false, ...rest }, _ref) => {
        const multiSelectRef = useRef<any>(null);

        const handleChange = (selectedItems: any) => {
            if (single) {
                const selected = selectedItems?.[0] || '';
                // ✅ ИСПРАВЛЕНИЕ: Извлекаем значение, если это объект
                const value = typeof selected === 'object' && selected !== null && valueField in selected
                    ? selected[valueField]
                    : selected;
                onChange(value);
                multiSelectRef.current?.close();
            } else {
                // ✅ ИСПРАВЛЕНИЕ: Извлекаем значения из объектов, если они есть
                const values = Array.isArray(selectedItems)
                    ? selectedItems.map(item => 
                        typeof item === 'object' && item !== null && valueField in item
                            ? item[valueField]
                            : item
                      )
                    : selectedItems;
                onChange(values);
            }
        };

        return (
            <View style={[styles.container, compact && styles.containerCompact]}>
                {label ? <Text style={styles.label}>{label}</Text> : null}
                <MultiSelect
                    ref={multiSelectRef}
                    data={items}
                    value={
                        single
                            ? value
                                ? [value]
                                : []
                            : value
                    }
                    labelField={labelField}
                    valueField={valueField}
                    placeholder="Выберите..."
                    search
                    onChange={handleChange}
                    searchPlaceholder="Поиск..."
                    style={[styles.dropdown, compact && styles.dropdownCompact]}
                    placeholderStyle={styles.placeholder}
                    inputSearchStyle={styles.searchInput}
                    containerStyle={styles.menuContainer}
                    itemContainerStyle={styles.menuItemContainer}
                    itemTextStyle={styles.menuItemText}
                    flatListProps={{
                        contentContainerStyle: styles.menuListContent,
                        showsVerticalScrollIndicator: false,
                    }}
                    activeColor="rgba(122, 157, 143, 0.2)"
                    selectedStyle={styles.selectedChip}
                    selectedTextStyle={styles.selectedChipText}
                    renderItem={(item, selected) => (
                        <Pressable
                            style={[styles.menuItem, selected && styles.menuItemSelected]}
                            onPress={() => {
                                if (single) {
                                    handleChange([item[valueField]]);
                                } else {
                                    const newValue = value?.includes(item[valueField])
                                        ? value.filter((v: any) => v !== item[valueField])
                                        : [...(value || []), item[valueField]];
                                    handleChange(newValue);
                                }
                            }}
                        >
                            <Text style={[styles.menuItemText, selected && styles.selectedItemText]}>
                                {item[labelField]}
                            </Text>
                        </Pressable>
                    )}
                    {...rest}
                />
            </View>
        );
    }
);

const styles = StyleSheet.create({
    container: { marginBottom: DESIGN_TOKENS.spacing.md },
    containerCompact: { marginBottom: DESIGN_TOKENS.spacing.sm },
    label: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: DESIGN_TOKENS.colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    menuItem: {
        padding: DESIGN_TOKENS.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedItemText: {
        color: DESIGN_TOKENS.colors.textInverse,
    },
    menuItemSelected: {
        backgroundColor: 'rgba(122, 157, 143, 0.2)',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
    },
    dropdown: {
        minHeight: DESIGN_TOKENS.touchTarget.minHeight,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        boxShadow: DESIGN_TOKENS.shadows.card as any,
    },
    dropdownCompact: {
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    placeholder: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },
    selectedText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },
    searchInput: {
        height: DESIGN_TOKENS.touchTarget.minHeight,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    icon: {
        width: 18,
        height: 18,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    menuContainer: {
        borderRadius: DESIGN_TOKENS.radii.lg,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        boxShadow: DESIGN_TOKENS.shadows.card as any,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        maxHeight: 320,
    },
    menuListContent: {
        paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    menuItemContainer: {
        borderRadius: DESIGN_TOKENS.radii.md,
        marginHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    menuItemText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: DESIGN_TOKENS.colors.text,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },
    selectedChip: {
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        marginRight: DESIGN_TOKENS.spacing.sm,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    selectedChipText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: DESIGN_TOKENS.colors.primaryDark,
    },
});

export default React.memo(MultiSelectField);
