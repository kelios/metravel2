import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SimpleMultiSelect from './SimpleMultiSelect';

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
        const extractValue = (item: any) =>
            item && typeof item === 'object' && valueField in item ? item[valueField] : item;

        const handleChange = (selectedItems: any[]) => {
            const normalized = Array.isArray(selectedItems) ? selectedItems.map(extractValue) : [];

            if (single) {
                onChange(normalized[0] ?? '');
            } else {
                onChange(normalized);
            }
        };

        // Normalize value to array for SimpleMultiSelect
        const normalizedValue = single 
            ? (value ? [value] : [])
            : (Array.isArray(value) ? value : []);

        return (
            <View style={[styles.container, compact && styles.containerCompact]}>
                {label ? <Text style={styles.label}>{label}</Text> : null}
                <SimpleMultiSelect
                    data={items}
                    value={normalizedValue}
                    onChange={handleChange}
                    labelField={labelField}
                    valueField={valueField}
                    style={[styles.dropdown, compact && styles.dropdownCompact]}
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
    dropdown: {
        // Styles are now handled by SimpleMultiSelect
    },
    dropdownCompact: {
        // Compact styles handled by SimpleMultiSelect
    },
});

export default React.memo(MultiSelectField);
