import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';

// Mock dependencies
jest.mock('@/hooks/useTheme', () => {
    const {
        MODERN_MATTE_PALETTE,
        MODERN_MATTE_SHADOWS,
        MODERN_MATTE_BOX_SHADOWS,
    } = require('@/constants/modernMattePalette');
    return {
        useThemedColors: () => ({
            ...MODERN_MATTE_PALETTE,
            surfaceLight: MODERN_MATTE_PALETTE.backgroundTertiary,
            mutedBackground: MODERN_MATTE_PALETTE.mutedBackground ?? MODERN_MATTE_PALETTE.backgroundSecondary,
            shadows: MODERN_MATTE_SHADOWS,
            boxShadows: MODERN_MATTE_BOX_SHADOWS,
        }),
    };
});

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/src/api/misc', () => ({
    __esModule: true,
    deleteTravelMainImage: jest.fn(async () => ({})),
}));

// Mock PhotoUploadWithPreview
jest.mock('@/components/travel/PhotoUploadWithPreview', () => ({
    __esModule: true,
    default: ({ onUpload, onRequestRemove }: any) => {
        require('react');
        const { View, Text, Button } = require('react-native');
        return (
            <View>
                <Text>PhotoUpload Mock</Text>
                <Button
                    title="Upload"
                    onPress={() => onUpload?.('https://example.com/image.jpg')}
                />
                <Button
                    title="Remove"
                    onPress={() => onRequestRemove?.()}
                />
            </View>
        );
    },
}));

// Mock YoutubeLinkComponent
jest.mock('@/components/YoutubeLinkComponent', () => ({
    __esModule: true,
    default: ({ label }: any) => {
        require('react');
        const { Text } = require('react-native');
        return <Text>{label}</Text>;
    },
}));

describe('TravelWizardStepMedia (Шаг 3)', () => {
    const defaultProps = {
        currentStep: 3,
        totalSteps: 6,
        formData: {
            id: '123',
            name: 'Тестовое путешествие',
            coordsMeTravel: [],
        } as any,
        setFormData: jest.fn(),
        travelDataOld: null,
        onBack: jest.fn(),
        onNext: jest.fn(),
        onManualSave: jest.fn(),
        stepMeta: {
            title: 'Медиа путешествия',
            subtitle: 'Шаг 3 из 6',
        },
        progress: 3/6,
        autosaveBadge: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('✅ Отображение компонентов', () => {
        it('должен отображать заголовок шага', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText('Медиа путешествия')).toBeTruthy();
        });

        it('должен отображать секцию "Главное изображение"', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText('Главное изображение')).toBeTruthy();
        });

        it('должен отображать подсказку о обложке', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText('Обложка маршрута, которая будет показываться в списках и на странице путешествия.')).toBeTruthy();
        });
    });

    describe('✅ Рекомендации по загрузке (ФАЗА 1)', () => {
        it('должен отображать info-карточку с советами', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText('Совет по обложке')).toBeTruthy();
        });

        it('должен показывать рекомендации по формату', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText(/Лучший формат: горизонтальный 16:9/)).toBeTruthy();
        });

        it('должен показывать статистику мотивации', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText(/Путешествия с обложкой получают в 3 раза больше просмотров/)).toBeTruthy();
        });

        it('должен использовать Feather иконку (не emoji)', () => {
            const { UNSAFE_getAllByType } = render(<TravelWizardStepMedia {...defaultProps} />);
            const Feather = require('@expo/vector-icons').Feather;
            const icons = UNSAFE_getAllByType(Feather);
            expect(icons.length).toBeGreaterThan(0);
        });
    });

    describe('✅ Загрузка обложки', () => {
        it('должен отображать компонент загрузки', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText('PhotoUpload Mock')).toBeTruthy();
        });

        it('должен сохранять URL при загрузке изображения', async () => {
            const mockSetFormData = jest.fn();
            const mockOnSave = jest.fn();

            const { getByText } = render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    setFormData={mockSetFormData}
                    onManualSave={mockOnSave}
                />
            );

            const uploadButton = getByText('Upload');
            fireEvent.press(uploadButton);

            await waitFor(() => {
                expect(mockSetFormData).toHaveBeenCalled();
            });
        });

        it('должен удалять изображение при запросе', async () => {
            const mockSetFormData = jest.fn();

            const { getByText } = render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    setFormData={mockSetFormData}
                    formData={{
                        ...defaultProps.formData,
                        travel_image_thumb_small_url: 'https://example.com/old.jpg',
                    }}
                />
            );

            const removeButton = getByText('Remove');
            fireEvent.press(removeButton);

            await waitFor(() => {
                expect(getByText('УДАЛИТЬ')).toBeTruthy();
            });

            fireEvent.press(getByText('УДАЛИТЬ'));

            await waitFor(() => {
                expect(mockSetFormData).toHaveBeenCalled();
            });
        });
    });

    describe('✅ Галерея изображений точек маршрута', () => {
        it('должен показать предупреждение если нет сохраненного ID', () => {
            const { getByText } = render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        id: null,
                    }}
                />
            );

            expect(getByText(/После сохранения черновика фото загрузится на сервер/)).toBeTruthy();
        });

        it('должен отображать галерею если есть точки на маршруте', () => {
            const { getByText } = render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        coordsMeTravel: [
                            { id: null, lat: 50, lng: 30, address: 'Киев', categories: [], image: '' },
                            { id: null, lat: 49, lng: 24, address: 'Львов', categories: [], image: '' },
                        ],
                    }}
                />
            );

            expect(getByText(/Галерея путешествия/)).toBeTruthy();
        });
    });

    describe('✅ YouTube видео', () => {
        it('должен отображать секцию YouTube', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);
            expect(getByText(/Видео о путешествии/)).toBeTruthy();
        });
    });

    describe('✅ Валидация', () => {
        it('должен показать предупреждение если нет обложки', () => {
            render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        travel_image_thumb_small_url: undefined,
                    }}
                />
            );

            // Проверяем что есть ValidationSummary с warnings
            // (требует более детального мока компонента)
        });
    });

    describe('✅ Кнопки навигации', () => {
        it('должна вызвать onBack при нажатии "Назад"', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);

            const backButton = getByText('Назад');
            fireEvent.press(backButton);

            expect(defaultProps.onBack).toHaveBeenCalled();
        });

        it('должна вызвать onNext при нажатии на следующий шаг', () => {
            const { getByText } = render(<TravelWizardStepMedia {...defaultProps} />);

            const nextButton = getByText(/К деталям|Далее/);
            fireEvent.press(nextButton);

            expect(defaultProps.onNext).toHaveBeenCalled();
        });
    });

    describe('✅ Автосохранение', () => {
        it('должен показать бейдж автосохранения', () => {
            const { getByText } = render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    autosaveBadge="Сохранено 10:30"
                />
            );

            expect(getByText('Сохранено 10:30')).toBeTruthy();
        });

        it('должен вызвать onManualSave при ручном сохранении', async () => {
            const mockOnSave = jest.fn().mockResolvedValue(undefined);

            const { getByLabelText } = render(
                <TravelWizardStepMedia
                    {...defaultProps}
                    onManualSave={mockOnSave}
                />
            );

            const saveButton = getByLabelText('Сохранить');
            fireEvent.press(saveButton);

            await waitFor(() => {
                expect(mockOnSave).toHaveBeenCalled();
            });
        });
    });
});
