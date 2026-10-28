import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { i18n } from '@/i18n';

// Mock dependencies
jest.mock('expo-router', () => ({
  usePreventRemove: () => jest.fn(),
    useRouter: jest.fn(),
    useFocusEffect: require('react').useEffect,
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

let mockResponsiveState = {
    isHydrated: true,
    isMobile: false,
};

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => mockResponsiveState,
}));

// Lightweight component mocks to avoid animations/timers
jest.mock('@/components/travel/TravelWizardHeader', () => (props: any) => {
    const { Text, View, Pressable } = require('react-native');
    return (
        <View>
            <Text>{props.title}</Text>
            <Text>{props.subtitle} • {props.progressPercent}% готово</Text>
            {props.autosaveBadge ? <Text>{props.autosaveBadge}</Text> : null}
            {props.canGoBack ? (
                <Pressable onPress={props.onBack} testID="travel-wizard-back">
                    <Text>Назад</Text>
                </Pressable>
            ) : null}
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
    CollapsibleValidationSummary: (props: any) => {
        const { View, Text } = require('react-native');
        return (
            <View>
                <Text>collapsible-errors:{props.errorCount}</Text>
                <Text>collapsible-warnings:{props.warningCount}</Text>
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
        mockResponsiveState = {
            isHydrated: true,
            isMobile: false,
        };
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
    });

    describe('Создание из статьи', () => {
        const shareTripCountryField = {
            countries: [
                { country_id: '3', title_ru: 'Беларусь' },
                { country_id: '5', title_ru: 'Польша' },
            ],
            isLoading: false,
        };

        it('keeps the ordinary first step without the contextual country selector', async () => {
            const screen = await render(<TravelWizardStepBasic {...defaultProps} />);
            expect(screen.queryByTestId('travel-wizard.step-basic.countries')).toBeNull();
        });

        it('shows the prefilled place and country, then edits both through the existing form', async () => {
            const formData = { ...baseFormData, name: 'Гродно', countries: ['3'] };
            const screen = await render(
                <TravelWizardStepBasic {...defaultProps} formData={formData} shareTripCountryField={shareTripCountryField} />,
            );

            expect(screen.getByDisplayValue('Гродно')).toBeTruthy();
            expect(screen.getByText('Беларусь')).toBeTruthy();
            expect(defaultProps.setFormData).not.toHaveBeenCalled();
            expect(defaultProps.onManualSave).not.toHaveBeenCalled();

            await fireEvent.changeText(screen.getByDisplayValue('Гродно'), 'Моя поездка в Гродно');
            const nameUpdate = defaultProps.setFormData.mock.calls[0][0];
            expect(nameUpdate(formData)).toEqual({ ...formData, name: 'Моя поездка в Гродно' });

            await fireEvent.press(screen.getByLabelText('Открыть выбор'));
            await fireEvent.press(screen.getByTestId('simple-multiselect.item.5'));
            const countryUpdate = defaultProps.setFormData.mock.calls[1][0];
            expect(countryUpdate(formData)).toEqual({ ...formData, countries: ['3', '5'] });
            expect(defaultProps.onManualSave).not.toHaveBeenCalled();
        });

        it('allows clearing the transferred country without changing the place name', async () => {
            const formData = { ...baseFormData, name: 'Гродно', countries: ['3'] };
            const screen = await render(
                <TravelWizardStepBasic {...defaultProps} formData={formData} shareTripCountryField={shareTripCountryField} />,
            );

            await fireEvent.press(screen.getByLabelText('Удалить Беларусь из выбранных'));

            const update = defaultProps.setFormData.mock.calls[0][0];
            expect(update(formData)).toEqual({ ...formData, countries: [] });
        });

        it('retains the country selection while a retry refreshes the catalog', async () => {
            const formData = { ...baseFormData, name: 'Гродно', countries: ['3'] };
            const screen = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={formData}
                    shareTripCountryField={{ ...shareTripCountryField, isLoading: true }}
                />,
            );

            expect(screen.getByDisplayValue('Гродно')).toBeTruthy();
            expect(screen.getByText('Беларусь')).toBeTruthy();
            await fireEvent.press(screen.getByLabelText('Открыть выбор'));
            expect(screen.queryByTestId('simple-multiselect.item.5')).toBeNull();
            expect(defaultProps.setFormData).not.toHaveBeenCalled();
        });

        it('reacts to locale changes for the new country label', async () => {
            const screen = await render(
                <TravelWizardStepBasic {...defaultProps} shareTripCountryField={shareTripCountryField} />,
            );

            try {
                for (const locale of ['be', 'uk', 'pl', 'en', 'ru']) {
                    await act(async () => { await i18n.changeLanguage(locale); });
                    expect(screen.getByText(i18n.t('travel:articleShareTrip.countryLabel'))).toBeTruthy();
                }
            } finally {
                await act(async () => { await i18n.changeLanguage('ru'); });
            }
        });
    });

    describe('✅ Отображение компонентов', () => {
        it('должен отображать заголовок шага', async () => {
            const { getByText } = await render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Основная информация')).toBeTruthy();
        });

        it('должен отображать поле "Название путешествия"', async () => {
            const { getByText } = await render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Название путешествия')).toBeTruthy();
        });

        it('должен отображать кнопку "Далее"', async () => {
            const { getByText } = await render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Далее')).toBeTruthy();
        });

        it('должен отображать кнопку "Быстрый черновик"', async () => {
            const { getByText } = await render(<TravelWizardStepBasic {...defaultProps} />);
            expect(getByText('Быстрый черновик')).toBeTruthy();
        });
    });

    describe('✅ Валидация названия', () => {
        it('должен требовать минимум 3 символа для названия', async () => {
            const { getByPlaceholderText } = await render(<TravelWizardStepBasic {...defaultProps} />);

            const nameInput = getByPlaceholderText('Например: Неделя в Грузии');
            await fireEvent.changeText(nameInput, 'Аб');

            // Валидация должна показать ошибку при попытке сохранить
            await waitFor(() => {
                expect(defaultProps.setFormData).toHaveBeenCalled();
            });

            const updateArg = defaultProps.setFormData.mock.calls[0][0];
            const nextState = typeof updateArg === 'function' ? updateArg(defaultProps.formData) : updateArg;
            expect(nextState).toEqual(expect.objectContaining({ name: 'Аб' }));
        });

        it('должен принимать валидное название', async () => {
            const { getByPlaceholderText } = await render(<TravelWizardStepBasic {...defaultProps} />);

            const nameInput = getByPlaceholderText('Например: Неделя в Грузии');
            await fireEvent.changeText(nameInput, 'Путешествие по Грузии');

            expect(defaultProps.setFormData).toHaveBeenCalled();
            const updateArg = defaultProps.setFormData.mock.calls[0][0];
            const nextState = typeof updateArg === 'function' ? updateArg(defaultProps.formData) : updateArg;
            expect(nextState).toEqual(expect.objectContaining({ name: 'Путешествие по Грузии' }));
        });
    });

    describe('✅ Quick Draft (Быстрый черновик)', () => {
        it('НЕ должен сохранять черновик если название пустое', async () => {
            const { getByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: '' }}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            await fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'error',
                    text1: 'Заполните название',
                    text2: 'Минимум 3 символа для сохранения черновика',
                }));
            });

            expect(defaultProps.onManualSave).not.toHaveBeenCalled();
            expect(mockRouter.push).not.toHaveBeenCalled();
        });

        it('НЕ должен сохранять черновик если название < 3 символов', async () => {
            const { getByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Аб' }}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            await fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'error',
                    text1: 'Заполните название',
                    text2: 'Минимум 3 символа для сохранения черновика',
                }));
            });
        });

        it('должен сохранить черновик с валидным названием', async () => {
            const mockSave = jest.fn().mockResolvedValue({
                ...defaultProps.formData,
                id: '123',
            });

            const { getByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                    redirectDelayMs={0}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            await fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(mockSave).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'success',
                    text1: 'Черновик сохранен',
                    text2: 'Вы можете вернуться к нему позже',
                }));
            });
        });

        it('должен открыть сохраненный черновик после сохранения', async () => {
            const mockSave = jest.fn().mockResolvedValue({
                ...defaultProps.formData,
                id: '123',
            });

            const { getByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                    redirectDelayMs={0}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            await fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(mockSave).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(mockRouter.push).toHaveBeenCalledWith('/travel/123');
            });
        });

        it('должен показать ошибку при неудачном сохранении', async () => {
            const mockSave = jest.fn().mockRejectedValue(new Error('Network error'));

            const { getByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    formData={{ ...defaultProps.formData, name: 'Грузия 2026' }}
                    onManualSave={mockSave}
                />
            );

            const quickDraftButton = getByText('Быстрый черновик');
            await fireEvent.press(quickDraftButton);

            await waitFor(() => {
                expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'error',
                    text1: 'Ошибка сохранения',
                    text2: 'Попробуйте еще раз',
                }));
            });

            expect(mockRouter.push).not.toHaveBeenCalled();
        });
    });

    describe('✅ Кнопка "Далее"', () => {
        it('должна вызвать onGoNext при нажатии', async () => {
            const { getByText } = await render(<TravelWizardStepBasic {...defaultProps} />);

            const nextButton = getByText('Далее');
            await fireEvent.press(nextButton);

            expect(defaultProps.onGoNext).toHaveBeenCalled();
        });
    });

    // Regression: #528 — editor opened from search must offer a way back.
    describe('✅ Кнопка "Назад"/выход (#528)', () => {
        it('показывает кнопку "Назад" на шаге 1, когда передан onExit', async () => {
            const { getByTestId } = await render(
                <TravelWizardStepBasic {...defaultProps} onExit={jest.fn()} />
            );
            expect(getByTestId('travel-wizard-back')).toBeTruthy();
        });

        it('вызывает onExit при нажатии на "Назад"', async () => {
            const onExit = jest.fn();
            const { getByTestId } = await render(
                <TravelWizardStepBasic {...defaultProps} onExit={onExit} />
            );
            await fireEvent.press(getByTestId('travel-wizard-back'));
            expect(onExit).toHaveBeenCalledTimes(1);
        });

        it('не показывает кнопку "Назад", если onExit не передан', async () => {
            const { queryByTestId } = await render(<TravelWizardStepBasic {...defaultProps} />);
            expect(queryByTestId('travel-wizard-back')).toBeNull();
        });
    });

    describe('✅ Сводка ошибок', () => {
        it('должен сохранить desktop summary после submit-attempt', async () => {
            const { getByText, queryByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    stepErrors={['Название путешествия обязательно для заполнения']}
                />
            );

            expect(getByText('errors:2')).toBeTruthy();
            expect(queryByText('collapsible-errors:2')).toBeNull();
        });

        it('должен показать collapsible mobile summary после submit-attempt', async () => {
            mockResponsiveState = {
                isHydrated: true,
                isMobile: true,
            };

            const { getByText, queryByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    stepErrors={['Название путешествия обязательно для заполнения']}
                />
            );

            expect(getByText('collapsible-errors:2')).toBeTruthy();
            expect(queryByText('errors:2')).toBeNull();
        });

        it('не должен показывать mobile summary до submit-attempt', async () => {
            mockResponsiveState = {
                isHydrated: true,
                isMobile: true,
            };

            const { queryByText } = await render(<TravelWizardStepBasic {...defaultProps} />);

            expect(queryByText('collapsible-errors:2')).toBeNull();
            expect(queryByText('errors:2')).toBeNull();
        });
    });

    describe('✅ Автосохранение индикатор', () => {
        it('должен показать бейдж автосохранения', async () => {
            const { getByText } = await render(
                <TravelWizardStepBasic
                    {...defaultProps}
                    autosaveBadge="Сохранено"
                />
            );

            expect(getByText('Сохранено')).toBeTruthy();
        });
    });

    describe('✅ Прогресс', () => {
        it('должен показать правильный процент прогресса', async () => {
            const { getByText } = await render(<TravelWizardStepBasic {...defaultProps} />);

            // Прогресс 1/6 = ~17%
            expect(getByText(/17% готово/)).toBeTruthy();
        });
    });
});
