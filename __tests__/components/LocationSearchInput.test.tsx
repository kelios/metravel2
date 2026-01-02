import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import LocationSearchInput from '@/components/travel/LocationSearchInput';

// Mock fetch
global.fetch = jest.fn();

// Mock hooks
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        primary: '#7a9d8f',
        primarySoft: 'rgba(122, 157, 143, 0.06)',
        surface: '#ffffff',
        border: 'rgba(58, 58, 58, 0.06)',
        borderLight: 'rgba(58, 58, 58, 0.03)',
        text: '#3a3a3a',
        textMuted: '#6a6a6a',
        textSubtle: '#8a8a8a',
        danger: '#b89090',
        surfaceMuted: 'rgba(255, 255, 255, 0.75)',
        surfaceElevated: '#ffffff',
    }),
}));

describe('LocationSearchInput', () => {
    const advanceSearchTimers = async (ms = 600) => {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, ms));
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
    });

    it('renders correctly', () => {
        const { getByPlaceholderText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        expect(getByPlaceholderText('Поиск места на карте...')).toBeTruthy();
    });

    it('renders with custom placeholder', () => {
        const { getByPlaceholderText } = render(
            <LocationSearchInput
                onLocationSelect={jest.fn()}
                placeholder="Custom placeholder"
            />
        );

        expect(getByPlaceholderText('Custom placeholder')).toBeTruthy();
    });

    it('does not search with less than 3 characters', async () => {
        const { getByPlaceholderText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'ab');

        await advanceSearchTimers();

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('searches after debounce with valid query', async () => {
        const mockResults = [
            {
                place_id: '1',
                display_name: 'Эйфелева башня, Париж, Франция',
                lat: '48.8582599',
                lon: '2.2945006',
                address: {
                    city: 'Париж',
                    country: 'Франция',
                    country_code: 'fr',
                },
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResults,
        });

        const { getByPlaceholderText, getByText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'Эйфелева башня');

        await advanceSearchTimers();

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('nominatim.openstreetmap.org/search'),
                expect.any(Object)
            );
        });

        await waitFor(() => {
            expect(getByText('Эйфелева башня')).toBeTruthy();
            expect(getByText('Париж, Франция')).toBeTruthy();
        });
    });

    it('displays empty state when no results found', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        });

        const { getByPlaceholderText, getByText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'abcdefg12345');

        await advanceSearchTimers();

        await waitFor(() => {
            expect(getByText('Ничего не найдено')).toBeTruthy();
        });
    });

    it('displays error message on network error', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const { getByPlaceholderText, getByText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'test query');

        await advanceSearchTimers();

        await waitFor(() => {
            expect(getByText('Ошибка поиска. Попробуйте еще раз.')).toBeTruthy();
        });
    });

    it('calls onLocationSelect when result is pressed', async () => {
        const mockOnSelect = jest.fn();
        const mockResults = [
            {
                place_id: '1',
                display_name: 'Эйфелева башня, Париж, Франция',
                lat: '48.8582599',
                lon: '2.2945006',
                address: {
                    city: 'Париж',
                    country: 'Франция',
                    country_code: 'fr',
                },
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResults,
        });

        const { getByPlaceholderText, getByText } = render(
            <LocationSearchInput onLocationSelect={mockOnSelect} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'Эйфелева башня');

        await advanceSearchTimers();

        await waitFor(() => {
            expect(getByText('Эйфелева башня')).toBeTruthy();
        });

        const result = getByText('Эйфелева башня');
        fireEvent.press(result);

        expect(mockOnSelect).toHaveBeenCalledWith(mockResults[0]);
    });

    it('clears input and results when clear button is pressed', async () => {
        const mockResults = [
            {
                place_id: '1',
                display_name: 'Test Location',
                lat: '48.8582599',
                lon: '2.2945006',
                address: {},
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResults,
        });

        const { getByPlaceholderText, getAllByText, UNSAFE_getAllByType } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'test');

        await advanceSearchTimers();

        await waitFor(() => {
            expect(getAllByText('Test Location').length).toBeGreaterThan(0);
        });

        // Find and press clear button (x icon)
        const pressables = UNSAFE_getAllByType(require('react-native').Pressable);
        // Clear button should be the last pressable (search icon pressables come first)
        fireEvent.press(pressables[pressables.length - 1]);

        await waitFor(() => {
            expect(input.props.value).toBe('');
        });
    });

    it('aborts previous request when new query is entered', async () => {
        const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        const { getByPlaceholderText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');

        fireEvent.changeText(input, 'first query');
        await advanceSearchTimers();

        fireEvent.changeText(input, 'second query');
        await advanceSearchTimers();

        await waitFor(() => {
            expect(abortSpy).toHaveBeenCalled();
        });

        abortSpy.mockRestore();
    });

    it('formats address correctly for display', async () => {
        const mockResults = [
            {
                place_id: '1',
                display_name: 'Эйфелева башня, Avenue Anatole France, Paris, France',
                lat: '48.8582599',
                lon: '2.2945006',
                address: {
                    city: 'Paris',
                    state: 'Île-de-France',
                    country: 'France',
                },
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResults,
        });

        const { getByPlaceholderText, getByText } = render(
            <LocationSearchInput onLocationSelect={jest.fn()} />
        );

        const input = getByPlaceholderText('Поиск места на карте...');
        fireEvent.changeText(input, 'Эйфелева башня');

        await advanceSearchTimers();

        await waitFor(() => {
            // Should show formatted address: city, state, country
            expect(getByText('Paris, Île-de-France, France')).toBeTruthy();
        });
    });
});

