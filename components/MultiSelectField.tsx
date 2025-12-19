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
                    activeColor={DESIGN_TOKENS.colors.primarySoft}
                    selectedStyle={styles.selectedChip}
                    selectedTextStyle={styles.selectedChipText}
                    renderItem={(item, selected) => (
                        <Pressable
                            style={[styles.menuItem, selected && { backgroundColor: DESIGN_TOKENS.colors.primarySoft }]}
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
    dropdown: {
        minHeight: DESIGN_TOKENS.touchTarget.minHeight,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    dropdownCompact: {
        borderRadius: DESIGN_TOKENS.radii.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    placeholder: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    selectedText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
    },
    searchInput: {
        height: DESIGN_TOKENS.touchTarget.minHeight,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    },
    icon: {
        width: 18,
        height: 18,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    menuContainer: {
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        ...(DESIGN_TOKENS.shadows.card as any),
    },
    menuItemContainer: {
        borderRadius: DESIGN_TOKENS.radii.sm,
        marginHorizontal: DESIGN_TOKENS.spacing.xs,
    },
    menuItemText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
    },
    selectedChip: {
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        marginRight: DESIGN_TOKENS.spacing.xs,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    selectedChipText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: DESIGN_TOKENS.colors.primaryDark,
    },
});

export default React.memo(MultiSelectField);
