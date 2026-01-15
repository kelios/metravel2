import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Pressable,
    Platform,
    StyleSheet,
    ActivityIndicator,
    FlatList,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Option {
    id: number | string;
    name: string;
}

interface RadiusSelectProps {
    value?: number | string | null;
    options?: Option[];
    onChange: (value: number | string | null) => void;
    label?: string;
    disabled?: boolean;
    loading?: boolean;
    placeholder?: string;
    compact?: boolean;
}

const withAlpha = (color: string, alpha: number) => {
    if (!color || color.startsWith('rgba') || color.startsWith('rgb') || color.startsWith('var(')) {
        return color;
    }

    if (color.startsWith('#')) {
        const raw = color.replace('#', '');
        const hex = raw.length === 3
            ? raw.split('').map((ch) => ch + ch).join('')
            : raw;
        const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
        return `#${hex}${alphaHex}`;
    }

    return color;
};

const RadiusSelect: React.FC<RadiusSelectProps> = ({
                                                       value,
                                                       options = [],
                                                       onChange,
                                                       label = 'Радиус (км)',
                                                       disabled = false,
                                                       loading = false,
                                                       placeholder = 'Выберите радиус',
                                                   }) => {
    const [visible, setVisible] = useState(false);
    const themeColors = useThemedColors();
    const styles = useMemo(() => getStyles(themeColors), [themeColors]);

    const selectedOption = useMemo(
        () => options.find((opt) => String(opt.id) === String(value)),
        [options, value]
    );

    const selectedLabel = selectedOption ? selectedOption.name : placeholder;
    const hasSelection = Boolean(selectedOption);

    const handleChange = useCallback(
        (newValue: number | string | null) => {
            onChange(newValue);
            setVisible(false);
        },
        [onChange]
    );

    const renderWebSelect = () => (
        <View style={[styles.container, disabled && styles.disabled]}>
            <div style={{ position: 'relative' }}>
                <select
                    value={value ?? ''}
                    onChange={(e) => handleChange(e.target.value || null)}
                    style={styles.webSelect as any}
                    disabled={disabled || loading}
                >
                    <option value="">{placeholder}</option>
                    {options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.name} км
                        </option>
                    ))}
                </select>
                {(loading || disabled) && (
                    <div
                        style={[
                            styles.webOverlay,
                            { backgroundColor: withAlpha(themeColors.surface, 0.7) },
                        ] as any}
                    >
                        {loading && <ActivityIndicator size="small" color={themeColors.textMuted} />}
                    </div>
                )}
            </div>
        </View>
    );

    const renderMobileSelect = () => (
        <View style={[styles.container, disabled && styles.disabled]}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
                style={[styles.selector, disabled && styles.selectorDisabled]}
                onPress={() => !disabled && setVisible(true)}
                activeOpacity={0.7}
                disabled={disabled || loading}
            >
                <View style={styles.leftIcon}>
                    <Feather name="radio" size={16} color={themeColors.textMuted} />
                </View>

                {loading ? (
                    <ActivityIndicator size="small" color={themeColors.textMuted} style={styles.loader} />
                ) : (
                    <View style={styles.selectorLabel}>
                        <Text
                            style={[
                                styles.selectorText,
                                !value && styles.placeholderText,
                                disabled && styles.textDisabled,
                            ]}
                        >
                            {selectedLabel}
                        </Text>
                        {hasSelection && (
                            <Text style={styles.selectorSuffix}> км</Text>
                        )}
                    </View>
                )}

                {!!value && !disabled && !loading && (
                    <TouchableOpacity
                        onPress={() => handleChange(null)}
                        style={styles.clearButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.clearIcon}>×</Text>
                    </TouchableOpacity>
                )}

                {!loading && (
                    <View style={styles.chevronContainer}>
                        <Text style={styles.chevron}>⌄</Text>
                    </View>
                )}
            </TouchableOpacity>

            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
                    <View style={styles.modalContent}>
                        <FlatList
                            data={options}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={({ item }) => {
                                const isSelected = String(item.id) === String(value);
                                return (
                                    <Pressable
                                        onPress={() => handleChange(item.id)}
                                        style={({ pressed }) => [
                                            styles.option,
                                            pressed && styles.optionPressed,
                                            isSelected && styles.optionSelected,
                                        ]}
                                        android_ripple={{ color: themeColors.primaryLight }}
                                    >
                                        <View style={styles.optionLabel}>
                                            <Text style={styles.optionNumber}>{item.name}</Text>
                                            <Text style={styles.optionSuffix}> км</Text>
                                        </View>
                                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                    </Pressable>
                                );
                            }}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            contentContainerStyle={styles.listContent}
                        />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );

    return Platform.OS === 'web' ? renderWebSelect() : renderMobileSelect();
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
        color: colors.text,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
        backgroundColor: colors.surface,
        width: '100%',
        ...colors.shadows.light,
    },
    selectorDisabled: {
        backgroundColor: colors.mutedBackground,
    },
    selectorText: {
        fontSize: 15,
        color: colors.text,
        flexShrink: 1,
        paddingVertical: 2,
    },
    selectorLabel: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flex: 1,
    },
    selectorSuffix: {
        fontSize: 13,
        marginLeft: 4,
        color: colors.textMuted,
    },
    placeholderText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
    },
    textDisabled: {
        color: colors.disabledText,
    },
    leftIcon: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    clearButton: {
        paddingHorizontal: 4,
    },
    clearIcon: {
        fontSize: 18,
        color: colors.textTertiary,
    },
    chevronContainer: {
        marginLeft: 8,
        minWidth: 18,
        alignItems: 'center',
    },
    chevron: {
        fontSize: 16,
        color: colors.textMuted,
        textAlign: 'right',
    },
    loader: {
        marginRight: 8,
    },
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        maxHeight: '70%',
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
    },
    listContent: {
        paddingVertical: 8,
    },
    option: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionPressed: {
        backgroundColor: colors.backgroundSecondary,
    },
    optionSelected: {
        backgroundColor: colors.infoLight,
        borderLeftWidth: 4,
        borderLeftColor: colors.info,
    },
    optionLabel: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    optionNumber: {
        fontSize: 15,
        color: colors.text,
    },
    optionSuffix: {
        fontSize: 13,
        color: colors.textMuted,
    },
    checkmark: {
        color: colors.info,
        fontSize: 16,
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        backgroundColor: colors.borderLight,
        marginHorizontal: 16,
    },
    webSelect: {
        width: '100%',
        height: 44,
        borderRadius: 8,
        paddingLeft: 10,
        fontSize: 15,
        backgroundColor: colors.surface,
        color: colors.text,
    } as any,
    webOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        pointerEvents: 'none',
    },
    disabled: {
        opacity: 0.7,
    },
});

export default React.memo(RadiusSelect);
