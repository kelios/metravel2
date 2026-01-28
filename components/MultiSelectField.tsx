import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import SimpleMultiSelect from './SimpleMultiSelect';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type MultiSelectValue = string | number;

type SimpleMultiSelectPassthroughProps = {
    placeholder?: string;
    searchPlaceholder?: string;
    search?: boolean;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
};

type MultiSelectFieldProps<Item extends Record<string, unknown>> = {
    label?: string;
    items: Item[];
    value?: MultiSelectValue[] | MultiSelectValue;
    onChange: (value: MultiSelectValue[] | MultiSelectValue) => void;
    labelField: string;
    valueField: string;
    single?: boolean;
    compact?: boolean;
    testID?: string;
    accessibilityLabel?: string;
} & SimpleMultiSelectPassthroughProps;

const MultiSelectField = forwardRef<unknown, MultiSelectFieldProps<Record<string, unknown>>>(
    (
        {
            label,
            items,
            value = [],
            onChange,
            labelField,
            valueField,
            single = false,
            compact = false,
            placeholder,
            searchPlaceholder,
            search,
            style,
            disabled,
            testID,
            accessibilityLabel,
        },
        _ref,
    ) => {
        const colors = useThemedColors();
        const styles = useMemo(() => StyleSheet.create({
            container: { marginBottom: DESIGN_TOKENS.spacing.md },
            containerCompact: { marginBottom: DESIGN_TOKENS.spacing.sm },
            label: {
                fontSize: DESIGN_TOKENS.typography.sizes.sm,
                fontWeight: '600',
                color: colors.text,
                marginBottom: DESIGN_TOKENS.spacing.xs,
            },
            dropdown: {
                // Styles are now handled by SimpleMultiSelect
            },
            dropdownCompact: {
                // Compact styles handled by SimpleMultiSelect
            },
        }), [colors]);

        const extractValue = (item: unknown): MultiSelectValue => {
            if (item && typeof item === 'object' && valueField in (item as Record<string, unknown>)) {
                const raw = (item as Record<string, unknown>)[valueField];
                if (typeof raw === 'string' || typeof raw === 'number') return raw;
            }
            if (typeof item === 'string' || typeof item === 'number') return item;
            return '';
        };

        const handleChange = (selectedItems: unknown[]) => {
            const normalized = Array.isArray(selectedItems) ? selectedItems.map(extractValue) : [];

            if (single) {
                onChange(normalized[0] ?? '');
            } else {
                onChange(normalized);
            }
        };

        // Normalize value to array for SimpleMultiSelect
        const normalizedValue = single
            ? (value ? [value as MultiSelectValue] : [])
            : (Array.isArray(value) ? (value as MultiSelectValue[]) : []);

        return (
            <View
                style={[styles.container, compact && styles.containerCompact]}
                testID={testID}
                accessibilityLabel={accessibilityLabel}
            >
                {label ? <Text style={styles.label}>{label}</Text> : null}
                <SimpleMultiSelect
                    data={items}
                    value={normalizedValue}
                    onChange={handleChange}
                    labelField={labelField}
                    valueField={valueField}
                    placeholder={placeholder}
                    searchPlaceholder={searchPlaceholder}
                    search={search}
                    style={[styles.dropdown, compact && styles.dropdownCompact, style]}
                    disabled={disabled}
                />
            </View>
        );
    }
);

export default React.memo(MultiSelectField);
