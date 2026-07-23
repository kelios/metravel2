import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import TravelVisitedDateInput, {
    formatVisitedDateForEditing,
    maskVisitedDateDraft,
    parseVisitedDateDraft,
} from '@/components/travel/TravelVisitedDateInput';

const openAndroidDatePicker = jest.fn();

jest.mock('@react-native-community/datetimepicker', () => ({
    DateTimePickerAndroid: {
        open: (options: unknown) => openAndroidDatePicker(options),
    },
}), { virtual: true });

const renderDateInput = (value: string, onChange = jest.fn()) => {
    const result = render(
        <TravelVisitedDateInput
            value={value}
            onChange={onChange}
            accessibilityLabel="Дата поездки"
            calendarLabel="Открыть календарь"
            invalidDateMessage="Введите корректную дату в формате ДД.ММ.ГГГГ"
            placeholder="ДД.ММ.ГГГГ"
        />
    );

    return { ...result, onChange };
};

describe('TravelVisitedDateInput', () => {
    const originalPlatform = Platform.OS;

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
        openAndroidDatePicker.mockReset();
    });

    it('formats the stored ISO date for direct day, month and year editing', () => {
        expect(formatVisitedDateForEditing('2026-07-26')).toBe('26.07.2026');
        expect(maskVisitedDateDraft('26072025')).toBe('26.07.2025');
        expect(parseVisitedDateDraft('26.07.2025')).toBe('2025-07-26');
    });

    it('commits a manually replaced year as an ISO date', () => {
        const { getByTestId, onChange } = renderDateInput('2026-07-26');
        const input = getByTestId('travel-visited-date-input');

        expect(input.props.value).toBe('26.07.2026');
        fireEvent.changeText(input, '26.07.2025');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('2025-07-26');
    });

    it('does not commit an incomplete or impossible date', () => {
        const { getByTestId, getByText, onChange } = renderDateInput('');
        const input = getByTestId('travel-visited-date-input');

        fireEvent.changeText(input, '26.07.202');
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.changeText(input, '31.02.2025');
        expect(onChange).not.toHaveBeenCalled();
        expect(getByText('Введите корректную дату в формате ДД.ММ.ГГГГ')).toBeTruthy();
        expect(input.props['aria-invalid']).toBe(true);
    });

    it('clears the stored exact date when the manual input is cleared', () => {
        const { getByTestId, onChange } = renderDateInput('2026-07-26');

        fireEvent.changeText(getByTestId('travel-visited-date-input'), '');

        expect(onChange).toHaveBeenCalledWith('');
    });

    it('opens the Android system date picker and commits its local calendar date', () => {
        Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
        const { getByTestId, onChange } = renderDateInput('2026-07-26');

        const calendarButton = getByTestId('travel-visited-date-calendar-button');
        const calendarButtonStyle = StyleSheet.flatten(calendarButton.props.style);
        expect(calendarButtonStyle.width).toBe(48);
        expect(calendarButtonStyle.height).toBe(48);
        expect(calendarButtonStyle.minWidth).toBe(48);
        expect(calendarButtonStyle.minHeight).toBe(48);

        fireEvent.press(calendarButton);

        expect(openAndroidDatePicker).toHaveBeenCalledTimes(1);
        const options = openAndroidDatePicker.mock.calls[0][0] as {
            value: Date;
            onChange: (event: { type: string }, date?: Date) => void;
        };
        expect(options.value.getFullYear()).toBe(2026);
        options.onChange({ type: 'set' }, new Date(2025, 10, 9));

        expect(onChange).toHaveBeenCalledWith('2025-11-09');
    });
});
