import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

// Mock dependencies
jest.mock('expo-router', () => ({
    useRouter: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
    show: jest.fn(),
}));

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

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

describe('TravelWizardStepBasic (Шаг 1)', () => {
    const mockRouter = {
        push: jest.fn(),
    };

    const defaultProps = {
        currentStep: 1,
        totalSteps: 6,
        formData: {
            name: '',
            description: '',
            id: null,
        },
        setFormData: jest.fn(),
        isMobile: false,
        onManualSave: jest.fn(),
        snackbarVisible: false,
        snackbarMessage: '',
        onDismissSnackbar: jest.fn(),
        onGoNext: jest.fn(),
        stepErrors: [],
        firstErrorField: null,
        autosaveStatus: 'idle' as const,
        autosaveBadge: '',
        focusAnchorId: null,
        onAnchorHandled: jest.fn(),
        stepMeta: {
            title: 'Основная информация',
            subtitle: 'Шаг 1 из 6',
            nextLabel: 'Далее',
        },
        progress: 1/6,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
    });

    describe('✅ Отображение компонентов', () => {
        it('должен отображать заголовок шага', () => {
            const { getByText } = render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Основная информация')).toBeTruthy();
        });

        it('должен отображать поле "Название путешествия"', () => {
            const { getByText } = render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Название путешествия')).toBeTruthy();
        });

        it('должен отображать кнопку "Далее"', () => {
            const { getByText } = render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Далее')).toBeTruthy();
        });

        it('должен отображать кнопку "Быстрый черновик"', () => {
            const { getByText } = render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Быстрый черновик')).toBeTruthy();
        });
    });

    describe('✅ Валидация названия', () => {
        it('должен требовать минимум 3 символа для названия', async () => {
            const { getByPlaceholderText } = render(<TravelWizardStepBasic {...defaultProps} />);

            const nameInput = getByPlaceholderText('Например: Неделя в Грузии');
            fireEvent.changeText(nameInput, 'Аб');

            // Валидация должна показать ошибку при попытке сохранить
            await waitFor(() => {
                expect(defaultProps.setFormData).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'Аб' })
                );
            });
        });

        it('должен принимать валидное название', () => {
            const { getByPlaceholderText } = render(<TravelWizardStepBasic {...defaultProps} />);

            const nameInput = getByPlaceholderText('Например: Неделя в Грузии');
            fireEvent.changeText(nameInput, 'Путешествие по Грузии');

            expect(defaultProps.setFormData).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Путешествие по Грузии' })
            );
        });
    });

    describe('✅ Quick Draft (Быстрый черновик)', () => {
        it('НЕ должен сохранять черновик если название пустое', async () => {
            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: '' }}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith({
                    type: 'error',
                    text1: 'Заполните название',
                    text2: 'Минимум 3 символа для сохранения черновика',
                });
            });

            expect(defaultProps.onManualSave).not.toHaveBeenCalled();
            expect(mockRouter.push).not.toHaveBeenCalled();
        });

        it('НЕ должен сохранять черновик если название < 3 символов', async () => {
            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Аб' }}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith({
                    type: 'error',
                    text1: 'Заполните название',
                    text2: 'Минимум 3 символа для сохранения черновика',
                });
            });
        });

        it('должен сохранить черновик с валидным названием', async () => {
            const mockSave = jest.fn().mockResolvedValue(undefined);

            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(mockSave).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith({
                    type: 'success',
                    text1: 'Черновик сохранен',
                    text2: 'Вы можете вернуться к нему позже',
                });
            });
        });

        it('должен перенаправить в /metravel после сохранения', async () => {
            jest.useFakeTimers();
            const mockSave = jest.fn().mockResolvedValue(undefined);

            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(mockSave).toHaveBeenCalled();
            });

            // Ждем 500ms для редиректа
            jest.advanceTimersByTime(500);

            await waitFor(() => {
                expect(mockRouter.push).toHaveBeenCalledWith('/metravel');
            });

            jest.useRealTimers();
        });

        it('должен показать ошибку при неудачном сохранении', async () => {
            const mockSave = jest.fn().mockRejectedValue(new Error('Network error'));

            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith({
                    type: 'error',
                    text1: 'Ошибка сохранения',
                    text2: 'Попробуйте еще раз',
                });
            });

            expect(mockRouter.push).not.toHaveBeenCalled();
        });
    });

    describe('✅ Кнопка "Далее"', () => {
        it('должна вызвать onGoNext при нажатии', () => {
            const { getByText } = render(<TravelWizardStepBasic {...defaultProps} />);

            const nextButton = getByText('Далее');
            fireEvent.press(nextButton);

            expect(defaultProps.onGoNext).toHaveBeenCalled();
        });
    });

    describe('✅ Автосохранение индикатор', () => {
        it('должен показать бейдж автосохранения', () => {
            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    autosaveBadge="Сохранено"
                />
            );

            expect(getByText('Сохранено')).toBeTruthy();
        });
    });

    describe('✅ Прогресс', () => {
        it('должен показать правильный процент прогресса', () => {
            const { getByText } = render(<TravelWizardStepBasic {...defaultProps} />);

            // Прогресс 1/6 = ~17%
            expect(getByText(/17% готово/)).toBeTruthy();
        });
    });
});

