import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

// Mock dependencies
jest.mock('expo-router', () => ({
    useRouter: jest.fn(),
}));

jest.mock('@/hooks/useStepTransition', () => ({
    useStepTransition: () => ({ animatedStyle: {} }),
    createStaggeredAnimation: (items: any[]) => items.map(() => 0),
}));

jest.mock('@/hooks/useTravelPreview', () => ({
    useTravelPreview: () => ({
        isPreviewVisible: false,
        showPreview: jest.fn(),
        hidePreview: jest.fn(),
    }),
}));

jest.mock('@/utils/contextualTips', () => ({
    getContextualTips: () => [],
}));

// Lightweight component mocks to avoid animations/timers
jest.mock('@/components/travel/TravelWizardHeader', () => (props: any) => {
    const { Text, View, Pressable } = require('react-native');
    return (
        <View>
            <Text>{props.title}</Text>
            <Text>{props.subtitle} • {props.progressPercent}% готово</Text>
            {props.autosaveBadge ? <Text>{props.autosaveBadge}</Text> : null}
            <Pressable onPress={props.onPrimary}>
                <Text>{props.primaryLabel ?? 'Далее'}</Text>
            </Pressable>
            <Pressable onPress={props.onQuickDraft}>
                <Text>{props.quickDraftLabel ?? 'Быстрый черновик'}</Text>
            </Pressable>
            <Pressable onPress={props.onSave}>
                <Text>Сохранить</Text>
            </Pressable>
            <Pressable onPress={props.onPreview} testID="preview-btn" />
        </View>
    );
});

jest.mock('@/components/travel/TravelWizardFooter', () => (props: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
        <View>
            <Pressable onPress={props.onPrimary}>
                <Text>Далее</Text>
            </Pressable>
            <Pressable onPress={props.onQuickDraft}>
                <Text>Быстрый черновик</Text>
            </Pressable>
            <Pressable onPress={props.onSave}>
                <Text>Сохранить</Text>
            </Pressable>
        </View>
    );
});

jest.mock('@/components/travel/ContentUpsertSection', () => (_props: any) => {
    const { View, Text } = require('react-native');
    return (
        <View>
            <Text>ContentUpsertSection</Text>
        </View>
    );
});

jest.mock('@/components/travel/ValidationFeedback', () => ({
    ValidationSummary: (props: any) => {
        const { View, Text } = require('react-native');
        return (
            <View>
                <Text>errors:{props.errorCount}</Text>
                <Text>warnings:{props.warningCount}</Text>
            </View>
        );
    },
}));

jest.mock('@/components/travel/ValidatedTextInput', () => ({
    ValidatedTextInput: (props: any) => {
        const { View, TextInput, Text } = require('react-native');
        return (
            <View>
                <Text>{props.label}</Text>
                <TextInput
                    value={props.value}
                    onChangeText={(v: string) => props.onChange?.(v)}
                    placeholder={props.placeholder}
                />
            </View>
        );
    },
}));

jest.mock('@/components/travel/TravelPreviewModal', () => (props: any) => {
    const { View, Text } = require('react-native');
    if (!props.visible) return null;
    return (
        <View>
            <Text>Preview</Text>
        </View>
    );
});

jest.mock('@/components/travel/ContextualTipCard', () => (props: any) => {
    const { View, Text } = require('react-native');
    return (
        <View>
            <Text>{props.tip?.title ?? 'tip'}</Text>
        </View>
    );
});

jest.mock('react-native-paper', () => ({
    Snackbar: ({ children }: any) => children,
}));

jest.mock('react-native-toast-message', () => ({
    show: jest.fn(),
}));

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

const baseFormData = {
    id: null,
    slug: undefined,
    name: '',
    description: '',
    countries: [],
    cities: [],
    over_nights_stay: [],
    complexity: [],
    companions: [],
    plus: null,
    minus: null,
    recommendation: null,
    youtube_link: null,
    gallery: [],
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
    year: undefined,
    budget: undefined,
    number_peoples: undefined,
    number_days: undefined,
    visa: false,
    publish: false,
    moderation: undefined,
    travel_image_thumb_url: null,
    travel_image_thumb_small_url: null,
};

describe('TravelWizardStepBasic (Шаг 1)', () => {
    const mockRouter = {
        push: jest.fn(),
    };

    const defaultProps = {
        currentStep: 1,
        totalSteps: 6,
        formData: baseFormData,
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
                expect(defaultProps.setFormData).toHaveBeenCalled();
            });

            const updateArg = defaultProps.setFormData.mock.calls[0][0];
            const nextState = typeof updateArg === 'function' ? updateArg(defaultProps.formData) : updateArg;
            expect(nextState).toEqual(expect.objectContaining({ name: 'Аб' }));
        });

        it('должен принимать валидное название', () => {
            const { getByPlaceholderText } = render(<TravelWizardStepBasic {...defaultProps} />);

            const nameInput = getByPlaceholderText('Например: Неделя в Грузии');
            fireEvent.changeText(nameInput, 'Путешествие по Грузии');

            expect(defaultProps.setFormData).toHaveBeenCalled();
            const updateArg = defaultProps.setFormData.mock.calls[0][0];
            const nextState = typeof updateArg === 'function' ? updateArg(defaultProps.formData) : updateArg;
            expect(nextState).toEqual(expect.objectContaining({ name: 'Путешествие по Грузии' }));
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
                    redirectDelayMs={0}
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
            const mockSave = jest.fn().mockResolvedValue(undefined);

            const { getByText } = render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                    redirectDelayMs={0}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(mockSave).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(mockRouter.push).toHaveBeenCalledWith('/metravel');
            });
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
