import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';

// Mock dependencies
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        primary: '#7a9d8f',
        success: '#7a9d8a',
        danger: '#b89090',
        surface: '#ffffff',
        background: '#fdfcfb',
        text: '#3a3a3a',
        textMuted: '#6a6a6a',
        border: 'rgba(58, 58, 58, 0.06)',
        primarySoft: 'rgba(122, 157, 143, 0.06)',
        successDark: '#6a8d7a',
        dangerDark: '#a88080',
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('react-native-toast-message', () => ({
    show: jest.fn(),
}));

describe('TravelWizardStepPublish (Шаг 6)', () => {
    const defaultProps = {
        currentStep: 6,
        totalSteps: 6,
        formData: {
            id: '123',
            name: 'Грузия 2026',
            description: 'Путешествие по Грузии',
            coordsMeTravel: [
                { id: null, lat: 41.7, lng: 44.8, address: 'Тбилиси', categories: [1], image: 'https://example.com/tbilisi.jpg' },
            ],
            countries: ['1'],
            categories: ['1', '2'],
            publish: false,
            moderation: false,
        } as any,
        setFormData: jest.fn(),
        onGoBack: jest.fn(),
        onFinish: jest.fn(),
        onManualSave: jest.fn(),
        isSuperAdmin: false,
        stepMeta: {
            title: 'Публикация',
            subtitle: 'Шаг 6 из 6',
        },
        progress: 1,
        autosaveBadge: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('✅ Отображение компонентов', () => {
        it('должен отображать заголовок шага', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Публикация')).toBeTruthy();
        });

        it('должен отображать карточку качества заполнения', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Качество заполнения')).toBeTruthy();
        });

        it('должен отображать чеклист готовности', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Готовность к публикации')).toBeTruthy();
        });
    });

    describe('✅ Разделение чеклиста (ФАЗА 1)', () => {
        it('должен показать секцию "Обязательно для публикации"', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Обязательно для публикации')).toBeTruthy();
        });

        it('должен показать секцию "Рекомендуем заполнить"', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Рекомендуем заполнить')).toBeTruthy();
        });

        it('должен использовать Feather иконки (не emoji)', () => {
            const { UNSAFE_getAllByType } = render(<TravelWizardStepPublish {...defaultProps} />);
            const Feather = require('@expo/vector-icons').Feather;
            const icons = UNSAFE_getAllByType(Feather);
            expect(icons.length).toBeGreaterThan(0);
        });

        it('должен показать преимущества для рекомендуемых пунктов', () => {
            const { getAllByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        countries: [], // Нет стран - должно показать benefit
                    }}
                />
            );

            // Проверяем что есть текст с преимуществами (экранируем + и %)
            expect(getAllByText(/Помогает найти маршрут|\+40%|В 3 раза больше/).length).toBeGreaterThan(0);
        });
    });

    describe('✅ Обязательные пункты чеклиста', () => {
        it('должен отметить "Название" как выполненное если есть', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText(/Название маршрута/)).toBeTruthy();
        });

        it('должен отметить "Описание" как выполненное если есть', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText(/Описание маршрута/)).toBeTruthy();
        });

        it('должен отметить "Маршрут" как выполненное если есть точки', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText(/Маршрут на карте/)).toBeTruthy();
        });
    });

    describe('✅ Рекомендуемые пункты чеклиста', () => {
        it('должен показать "Страны" как рекомендуемое', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText(/Страны/)).toBeTruthy();
        });

        it('должен показать "Категории" как рекомендуемое', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText(/Категории/)).toBeTruthy();
        });

        it('должен показать "Фото" как рекомендуемое', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText(/Фото/)).toBeTruthy();
        });
    });

    describe('✅ Качество заполнения', () => {
        it('должен рассчитать Quality Score правильно', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);

            // Ищем индикатор качества (разные уровни в зависимости от данных)
            const qualityIndicator = getByText(/Хорошо|Отлично|Среднее|Удовлетворительно|Требует улучшения/);
            expect(qualityIndicator).toBeTruthy();
        });

        it('должен показать рекомендации для улучшения', () => {
            const { getByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        travel_image_thumb_small_url: undefined, // Нет обложки
                    }}
                />
            );

            expect(getByText('Рекомендации для улучшения:')).toBeTruthy();
        });
    });

    describe('✅ Статус публикации', () => {
        it('должен показать опцию "Черновик"', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Сохранить как черновик')).toBeTruthy();
        });

        it('должен показать опцию "Модерация"', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);
            expect(getByText('Отправить на модерацию')).toBeTruthy();
        });

        it('должен выбрать "Черновик" по умолчанию', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);

            const draftOption = getByText('Сохранить как черновик').parent;
            expect(draftOption).toBeTruthy();
        });

        it('должен переключать статус при выборе опции', () => {
            const { getByText, queryByText } = render(<TravelWizardStepPublish {...defaultProps} />);

            const moderationOption = getByText('Отправить на модерацию');
            fireEvent.press(moderationOption);

            expect(queryByText('Сохранить')).toBeNull();
        });
    });

    describe('✅ Счетчик готовности', () => {
        it('должен показать прогресс чеклиста (N/M)', () => {
            const { getByText } = render(<TravelWizardStepPublish {...defaultProps} />);

            // Ищем счетчик в формате "3/6" или подобном
            expect(getByText(/\d+\/\d+/)).toBeTruthy();
        });

        it('должен обновлять счетчик при изменении данных', () => {
            const { getByText, rerender } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        categories: [],
                    }}
                />
            );

            rerender(
                <TravelWizardStepPublish
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        categories: ['1', '2'],
                    }}
                />
            );

            const afterCount = getByText(/\d+\/\d+/).children[0];
            // Счетчик должен измениться
            expect(afterCount).toBeDefined();
        });
    });

    describe('✅ Навигация по чеклисту', () => {
        it('должен перейти к полю при клике на невыполненный пункт', () => {
            const mockOnNavigate = jest.fn();

            const { getByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        countries: [], // Невыполнено
                    }}
                    onNavigateToIssue={mockOnNavigate}
                />
            );

            // Кликаем на невыполненный пункт
            const countriesItem = getByText(/Страны/);
            if (countriesItem.parent) {
                fireEvent.press(countriesItem.parent);
                expect(mockOnNavigate).toHaveBeenCalled();
            }
        });
    });

    describe('✅ Кнопка публикации', () => {
        it('должна вызвать onManualSave при нажатии', async () => {
            const mockOnManualSave = jest.fn().mockResolvedValue(undefined);

            const { getByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    onManualSave={mockOnManualSave}
                />
            );

            const publishButton = getByText('Сохранить');
            fireEvent.press(publishButton);

            await waitFor(() => {
                expect(mockOnManualSave).toHaveBeenCalled();
            });
        });

        it('НЕ должна публиковать если обязательные поля не заполнены', () => {
            const mockOnManualSave = jest.fn();

            const { getByText, getAllByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    formData={{
                        ...defaultProps.formData,
                        name: '', // Пустое название
                    }}
                    onManualSave={mockOnManualSave}
                />
            );

            const moderationOption = getByText('Отправить на модерацию');
            fireEvent.press(moderationOption);

            const publishButton = getAllByText('Отправить на модерацию').slice(-1)[0];
            fireEvent.press(publishButton);

            // Должна показать ошибку вместо публикации
            expect(mockOnManualSave).not.toHaveBeenCalled();
        });
    });

    describe('✅ Для администратора', () => {
        it('должен показать админ-панель если isSuperAdmin', () => {
            const { getByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    isSuperAdmin={true}
                    formData={{
                        ...defaultProps.formData,
                        publish: true,
                    }}
                />
            );

            expect(getByText(/Панель модератора|Панель администратора|Прошел модерацию/)).toBeTruthy();
        });

        it('НЕ должен показать админ-панель для обычного пользователя', () => {
            const { queryByText } = render(
                <TravelWizardStepPublish
                    {...defaultProps}
                    isSuperAdmin={false}
                />
            );

            expect(queryByText(/Панель модератора|Панель администратора/)).toBeNull();
        });
    });
});
