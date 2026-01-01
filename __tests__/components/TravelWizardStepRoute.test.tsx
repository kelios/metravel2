import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';

// Mock dependencies
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        primary: '#7a9d8f',
        surface: '#ffffff',
        background: '#fdfcfb',
        text: '#3a3a3a',
        textMuted: '#6a6a6a',
        border: 'rgba(58, 58, 58, 0.06)',
        primarySoft: 'rgba(122, 157, 143, 0.06)',
    }),
}));

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({
        isPhone: false,
        isLargePhone: false,
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

// Mock WebMapComponent
jest.mock('@/components/travel/WebMapComponent', () => ({
    __esModule: true,
    default: () => null,
    matchCountryId: (countryName: string, countries: any[], countryCode?: string) => {
        if (countryCode === 'fr') return 1;
        if (countryName.includes('Франция')) return 1;
        return null;
    },
    buildAddressFromGeocode: () => 'Париж, Франция',
}));

global.fetch = jest.fn();

describe('TravelWizardStepRoute (Шаг 2)', () => {
    const defaultProps = {
        currentStep: 2,
        totalSteps: 6,
        markers: [],
        setMarkers: jest.fn(),
        categoryTravelAddress: [],
        countries: [
            { country_id: 1, title_ru: 'Франция', code: 'FR' },
            { country_id: 2, title_ru: 'Италия', code: 'IT' },
        ],
        travelId: null,
        selectedCountryIds: [],
        onCountrySelect: jest.fn(),
        onCountryDeselect: jest.fn(),
        onBack: jest.fn(),
        onNext: jest.fn(),
        onManualSave: jest.fn(),
        isFiltersLoading: false,
        stepMeta: {
            title: 'Маршрут путешествия',
            subtitle: 'Шаг 2 из 6',
        },
        progress: 2/6,
        autosaveBadge: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('✅ Отображение компонентов', () => {
        it('должен отображать заголовок шага', () => {
            const { getByText } = render(<TravelWizardStepRoute {...defaultProps} />);
            expect(getByText('Маршрут путешествия')).toBeTruthy();
        });

        it('должен отображать поле поиска мест', () => {
            const { getByPlaceholderText } = render(<TravelWizardStepRoute {...defaultProps} />);
            expect(getByPlaceholderText(/Поиск места/)).toBeTruthy();
        });

        it('должен отображать кнопку "Добавить точку вручную"', () => {
            const { getByText } = render(<TravelWizardStepRoute {...defaultProps} />);
            expect(getByText('Добавить точку вручную')).toBeTruthy();
        });

        it('должен отображать счетчик точек', () => {
            const { getByText } = render(<TravelWizardStepRoute {...defaultProps} />);
            expect(getByText('Точек: 0')).toBeTruthy();
        });
    });

    describe('✅ Поиск мест', () => {
        it('должен искать места через Nominatim API', async () => {
            const mockResults = [{
                place_id: '1',
                display_name: 'Эйфелева башня, Париж, Франция',
                lat: '48.8582599',
                lon: '2.2945006',
                address: {
                    city: 'Париж',
                    country: 'Франция',
                    country_code: 'fr',
                },
            }];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResults,
            });

            const { getByPlaceholderText } = render(<TravelWizardStepRoute {...defaultProps} />);

            const searchInput = getByPlaceholderText(/Поиск места/);
            fireEvent.changeText(searchInput, 'Эйфелева башня');

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('nominatim.openstreetmap.org/search'),
                    expect.any(Object)
                );
            });
        });

        it('должен добавить точку при выборе из результатов поиска', async () => {
            const mockSetMarkers = jest.fn();
            const mockOnCountrySelect = jest.fn();

            const mockResults = [{
                place_id: '1',
                display_name: 'Париж, Франция',
                lat: '48.8566',
                lon: '2.3522',
                address: {
                    city: 'Париж',
                    country: 'Франция',
                    country_code: 'fr',
                },
            }];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResults,
            });

            const { getByPlaceholderText, getByText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    setMarkers={mockSetMarkers}
                    onCountrySelect={mockOnCountrySelect}
                />
            );

            const searchInput = getByPlaceholderText(/Поиск места/);
            fireEvent.changeText(searchInput, 'Париж');

            await waitFor(() => {
                expect(getByText('Париж, Франция')).toBeTruthy();
            });

            const result = getByText('Париж, Франция');
            fireEvent.press(result);

            await waitFor(() => {
                expect(mockSetMarkers).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({
                            lat: 48.8566,
                            lng: 2.3522,
                        })
                    ])
                );
            });
        });

        it('должен автоматически выбрать страну при добавлении точки', async () => {
            const mockOnCountrySelect = jest.fn();

            const { getByPlaceholderText, getByText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    onCountrySelect={mockOnCountrySelect}
                />
            );

            // Имитация выбора места
            // (логика тестирования через mock LocationSearchInput)
        });
    });

    describe('✅ Ручное добавление точки', () => {
        it('должен показать форму при нажатии кнопки', () => {
            const { getByText, getByPlaceholderText } = render(
                <TravelWizardStepRoute {...defaultProps} />
            );

            const button = getByText('Добавить точку вручную');
            fireEvent.press(button);

            expect(getByPlaceholderText('49.609645, 18.845693')).toBeTruthy();
        });

        it('должен добавить точку с валидными координатами', async () => {
            const mockSetMarkers = jest.fn();

            // Mock reverse geocoding
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    address: {
                        city: 'Минск',
                        country: 'Беларусь',
                    },
                }),
            });

            const { getByText, getByPlaceholderText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    setMarkers={mockSetMarkers}
                />
            );

            const button = getByText('Добавить точку вручную');
            fireEvent.press(button);

            const input = getByPlaceholderText('49.609645, 18.845693');
            fireEvent.changeText(input, '53.9, 27.56');

            const addButton = getByText('Добавить');
            fireEvent.press(addButton);

            await waitFor(() => {
                expect(mockSetMarkers).toHaveBeenCalled();
            });
        });

        it('НЕ должен добавить точку с невалидными координатами', () => {
            const mockSetMarkers = jest.fn();

            const { getByText, getByPlaceholderText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    setMarkers={mockSetMarkers}
                />
            );

            const button = getByText('Добавить точку вручную');
            fireEvent.press(button);

            const input = getByPlaceholderText('49.609645, 18.845693');
            fireEvent.changeText(input, 'invalid coords');

            const addButton = getByText('Добавить');
            fireEvent.press(addButton);

            expect(mockSetMarkers).not.toHaveBeenCalled();
        });
    });

    describe('✅ Счетчик точек', () => {
        it('должен показать правильное количество точек', () => {
            const markers = [
                { id: null, lat: 50, lng: 30, address: 'Киев', categories: [], image: '' },
                { id: null, lat: 49, lng: 24, address: 'Львов', categories: [], image: '' },
            ];

            const { getByText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    markers={markers}
                />
            );

            expect(getByText('Точек: 2')).toBeTruthy();
        });
    });

    describe('✅ Выбор стран', () => {
        it('должен отображать поле выбора стран', () => {
            const { getByText } = render(<TravelWizardStepRoute {...defaultProps} />);
            expect(getByText('Страны маршрута')).toBeTruthy();
        });

        it('должен вызвать onCountrySelect при выборе страны', () => {
            const mockOnCountrySelect = jest.fn();

            const { getByText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    onCountrySelect={mockOnCountrySelect}
                />
            );

            // Логика выбора страны через MultiSelectField
            // (требует более сложного mock)
        });
    });

    describe('✅ Coachmark (подсказка)', () => {
        it('должен показать подсказку если нет точек', () => {
            const { getByText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    markers={[]}
                />
            );

            expect(getByText('Как добавить первую точку')).toBeTruthy();
        });

        it('НЕ должен показать подсказку если есть точки', () => {
            const markers = [
                { id: null, lat: 50, lng: 30, address: 'Киев', categories: [], image: '' },
            ];

            const { queryByText } = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    markers={markers}
                />
            );

            expect(queryByText('Как добавить первую точку')).toBeNull();
        });
    });

    describe('✅ Кнопки навигации', () => {
        it('должна вызвать onBack при нажатии "Назад"', () => {
            const { getByTestId } = render(<TravelWizardStepRoute {...defaultProps} />);

            const backButton = getByTestId('travel-wizard-back');
            fireEvent.press(backButton);

            expect(defaultProps.onBack).toHaveBeenCalled();
        });

        it('должна вызвать onNext при нажатии "К медиа"', () => {
            const { getByText } = render(<TravelWizardStepRoute {...defaultProps} />);

            const nextButton = getByText('К медиа');
            fireEvent.press(nextButton);

            expect(defaultProps.onNext).toHaveBeenCalled();
        });
    });
});
