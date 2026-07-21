import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { parseTravelStatusDateParts } from '@/stores/travelStatusStore';

interface TravelVisitedDateInputProps {
    value: string;
    onChange: (value: string) => void;
    accessibilityLabel: string;
    calendarLabel: string;
    invalidDateMessage: string;
    placeholder: string;
}

type WebDateInput = HTMLInputElement & {
    showPicker?: () => void;
};

export const formatVisitedDateForEditing = (value: string): string => {
    const parts = parseTravelStatusDateParts(value);
    if (!parts) return value;
    return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${String(parts.year).padStart(4, '0')}`;
};

export const maskVisitedDateDraft = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    return [day, month, year].filter(Boolean).join('.');
};

export const parseVisitedDateDraft = (value: string): string | null => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!match) return null;
    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    return parseTravelStatusDateParts(isoDate) ? isoDate : null;
};

const TravelVisitedDateInput: React.FC<TravelVisitedDateInputProps> = ({
    value,
    onChange,
    accessibilityLabel,
    calendarLabel,
    invalidDateMessage,
    placeholder,
}) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const pickerRef = useRef<WebDateInput | null>(null);
    const formattedValue = formatVisitedDateForEditing(value);
    const [draft, setDraft] = useState(formattedValue);
    const [showInvalidState, setShowInvalidState] = useState(false);

    useEffect(() => {
        setDraft(formattedValue);
        setShowInvalidState(false);
    }, [formattedValue]);

    const commitDraft = useCallback((nextDraft: string) => {
        if (!nextDraft) {
            setShowInvalidState(false);
            if (value) onChange('');
            return;
        }

        const parsedDate = parseVisitedDateDraft(nextDraft);
        if (!parsedDate) {
            setShowInvalidState(nextDraft.length === 10);
            return;
        }

        setShowInvalidState(false);
        if (parsedDate !== value) onChange(parsedDate);
    }, [onChange, value]);

    const handleChangeText = useCallback((nextValue: string) => {
        const nextDraft = maskVisitedDateDraft(nextValue);
        setDraft(nextDraft);
        commitDraft(nextDraft);
    }, [commitDraft]);

    const handleBlur = useCallback(() => {
        if (draft && !parseVisitedDateDraft(draft)) {
            setShowInvalidState(true);
        }
    }, [draft]);

    const handleCalendarChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        if (!parseTravelStatusDateParts(nextValue)) return;
        setDraft(formatVisitedDateForEditing(nextValue));
        setShowInvalidState(false);
        onChange(nextValue);
    }, [onChange]);

    const openCalendar = useCallback(() => {
        const picker = pickerRef.current;
        if (!picker) return;
        if (typeof picker.showPicker === 'function') {
            picker.showPicker();
            return;
        }
        picker.click();
    }, []);

    return (
        <View>
            <View style={[styles.field, showInvalidState && styles.fieldInvalid]}>
                <TextInput
                    value={draft}
                    onChangeText={handleChangeText}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    inputMode="numeric"
                    maxLength={10}
                    accessibilityLabel={accessibilityLabel}
                    aria-invalid={showInvalidState}
                    testID="travel-visited-date-input"
                    style={[styles.input, Platform.OS === 'web' && styles.inputWithCalendar]}
                />
                {Platform.OS === 'web' ? (
                    <>
                        <IconButton
                            icon={<Feather name="calendar" size={18} color={colors.text} />}
                            label={calendarLabel}
                            onPress={openCalendar}
                            size="sm"
                            style={styles.calendarButton}
                            testID="travel-visited-date-calendar-button"
                            tooltipPlacement="left"
                        />
                        <input
                            ref={pickerRef}
                            type="date"
                            value={parseTravelStatusDateParts(value) ? value : ''}
                            onChange={handleCalendarChange}
                            aria-hidden="true"
                            tabIndex={-1}
                            data-testid="travel-visited-date-picker"
                            style={hiddenPickerStyle}
                        />
                    </>
                ) : null}
            </View>
            {showInvalidState ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                    {invalidDateMessage}
                </Text>
            ) : null}
        </View>
    );
};

const hiddenPickerStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    field: {
        position: 'relative',
        minHeight: 44,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: colors.surface,
        justifyContent: 'center',
    },
    fieldInvalid: {
        borderColor: colors.danger,
    },
    input: {
        minHeight: 42,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        color: colors.text,
        fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
    inputWithCalendar: {
        paddingRight: 52,
    },
    calendarButton: {
        position: 'absolute',
        right: 3,
        top: 3,
        marginHorizontal: 0,
        backgroundColor: colors.surface,
        shadowOpacity: 0,
        elevation: 0,
    },
    errorText: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        color: colors.danger,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        lineHeight: 16,
    },
});

export default TravelVisitedDateInput;
