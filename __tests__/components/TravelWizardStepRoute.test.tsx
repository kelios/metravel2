import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import { EXIF_IMAGE_INPUT_ACCEPT } from '@/utils/exifGps';
import { getPendingImageFile, removePendingImageFile } from '@/utils/pendingImageFiles';
import { Platform } from 'react-native';

const ORIGINAL_PLATFORM_OS = Platform.OS;

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
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockMultiSelectField: jest.Mock<any, any> = jest.fn();
jest.mock('@/components/forms/MultiSelectField', () => {
    return {
        __esModule: true,
        default: (props: any) => {
            mockMultiSelectField(props);
            return null;
        },
    };
});

jest.mock('@/utils/exifGps', () => {
    const actual = jest.requireActual('@/utils/exifGps');
    return {
        ...actual,
        extractGpsFromImageFile: jest.fn(async () => ({ lat: 53.9, lng: 27.56 })),
    };
});

jest.mock('@/utils/webImageUpload', () => ({
    prepareWebImageFileForUpload: jest.fn(async (file: File) => file),
}));

// Mock WebMapComponent
jest.mock('@/components/travel/WebMapComponent', () => ({
    __esModule: true,
    default: (props: any) => {
        const React = require('react');
        return React.createElement(
            'button',
            {
                onClick: () => props.onPhotoMarkerReady?.({
                    markers: [
                        {
                            id: null,
                            lat: 48.8566,
                            lng: 2.3522,
                            address: 'Париж, Франция',
                            country: 1,
                            categories: [],
                            image: 'blob:https://example.com/preview',
                        },
                    ],
                    derivedCountryId: 1,
                }),
            },
            'mock-photo-marker-ready'
        );
    },
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
        formData: {
            id: '2677',
            countries: [],
            cities: [],
            over_nights_stay: [],
            complexity: [],
            companions: [],
            categories: [],
            countryIds: [],
            travelAddressIds: [],
            travelAddressCity: [],
            travelAddressCountry: [],
            travelAddressAdress: [],
            travelAddressCategory: [],
            coordsMeTravel: [],
            thumbs200ForCollectionArr: [],
            travelImageThumbUrlArr: [],
            travelImageAddress: [],
            categoriesIds: [],
            transports: [],
            month: [],
            visa: false,
            publish: false,
        },
        markers: [],
        setMarkers: jest.fn(),
        categoryTravelAddress: [],
        countries: [
            { country_id: '1', title_ru: 'Франция', code: 'FR' },
            { country_id: '2', title_ru: 'Италия', code: 'IT' },
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
        mockMultiSelectField.mockClear();
        Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS });
        removePendingImageFile('blob:https://example.com/manual-point');
        Object.defineProperty(global.URL, 'createObjectURL', {
            configurable: true,
            value: jest.fn(() => 'blob:https://example.com/manual-point'),
        });
        Object.defineProperty(global.URL, 'revokeObjectURL', {
            configurable: true,
            value: jest.fn(),
        });
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS });
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

        it('countries multiselect is read-only (disabled): countries are derived from markers only', () => {
            render(<TravelWizardStepRoute {...defaultProps} />);

            const calls: any[] = mockMultiSelectField.mock.calls.map((c: any[]) => c[0]);
            const countriesCall = calls.find((props: any) => props?.label === 'Страны маршрута') as any;
            expect(countriesCall).toBeTruthy();
            expect(Boolean(countriesCall.disabled)).toBe(true);
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

            render(
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

        it('на web разрешает выбирать HEIC и HEIF для точки из фото', () => {
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const screen = render(<TravelWizardStepRoute {...defaultProps} />);

            fireEvent.press(screen.getByText('Добавить точку вручную'));

            const fileInputs = screen.UNSAFE_queryAllByType?.('input' as any) ?? [];
            const fileInput = fileInputs.find((node: any) => node?.props?.type === 'file');

            expect(fileInput).toBeTruthy();
            expect(fileInput.props.accept).toBe(EXIF_IMAGE_INPUT_ACCEPT);
            expect(fileInput.props.accept).toContain('.heic');
            expect(fileInput.props.accept).toContain('.heif');
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

        it('сохраняет pending-файл фото после переноса preview в маркер', async () => {
            Object.defineProperty(Platform, 'OS', { value: 'web' });
            const mockSetMarkers = jest.fn();
            const file = new File(['image'], 'gps-photo.jpg', { type: 'image/jpeg' });

            const screen = render(
                <TravelWizardStepRoute
                    {...defaultProps}
                    setMarkers={mockSetMarkers}
                />
            );

            fireEvent.press(screen.getByText('Добавить точку вручную'));
            const fileInputs = screen.UNSAFE_queryAllByType?.('input' as any) ?? [];
            const fileInput = fileInputs.find((node: any) => node?.props?.type === 'file');
            expect(fileInput).toBeTruthy();

            await waitFor(() => {
                fireEvent(fileInput, 'change', { target: { files: [file], value: 'gps-photo.jpg' } });
            });

            await waitFor(() => {
                expect(getPendingImageFile('blob:https://example.com/manual-point')).toBe(file);
            });

            fireEvent.press(screen.getByTestId('travel-wizard.step-route.manual.add'));

            await waitFor(() => {
                expect(mockSetMarkers).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({
                            image: 'blob:https://example.com/manual-point',
                        }),
                    ])
                );
            });
            expect(getPendingImageFile('blob:https://example.com/manual-point')).toBe(file);
            expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:https://example.com/manual-point');
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
                { id: null, lat: 50, lng: 30, address: 'Киев', country: 1, categories: [], image: '' },
                { id: null, lat: 49, lng: 24, address: 'Львов', country: 1, categories: [], image: '' },
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
                { id: null, lat: 50, lng: 30, address: 'Киев', country: 1, categories: [], image: '' },
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
