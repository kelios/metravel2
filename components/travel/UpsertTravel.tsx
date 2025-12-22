import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Dimensions, Platform, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import Toast from 'react-native-toast-message';

import { fetchTravel } from '@/src/api/travelsApi';
import { fetchFilters, saveFormData, fetchAllCountries } from '@/src/api/misc';
import { TravelFormData, MarkerData, Travel } from '@/src/types/types';
import { useAuth } from '@/context/AuthContext';
import { validateStep, type ValidationError, type ModerationIssue } from '@/utils/formValidation';
import { trackWizardEvent } from '@/src/utils/analytics';
import { useOptimizedFormState } from '@/hooks/useOptimizedFormState';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

type StepMeta = {
    id: number;
    title: string;
    subtitle: string;
    tipTitle: string;
    tipBody: string;
    nextLabel: string;
};

function normalizeCategoryTravelAddress(raw: any): Array<{ id: string; name: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, idx) => {
            if (item && typeof item === 'object') {
                const id =
                    item.id ??
                    item.value ??
                    item.category_id ??
                    idx;
                const name =
                    item.name ??
                    item.name_ru ??
                    item.title_ru ??
                    item.title_en ??
                    item.title ??
                    item.text ??
                    String(id);
                return { id: String(id), name: String(name) };
            }
            return { id: String(item), name: String(item) };
        })
        .filter(Boolean);
}

function normalizeCountries(raw: any): Array<{
    country_id: string;
    title_ru: string;
    title_en?: string;
    title?: string;
    name?: string;
    country_code?: string;
    code?: string;
    iso2?: string;
    iso?: string;
    alpha2?: string;
    alpha_2?: string;
    ISO3166_1_alpha2?: string;
}> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, idx) => {
            if (!item || typeof item !== 'object') {
                return {
                    country_id: String(idx),
                    title_ru: String(item ?? ''),
                };
            }
            const id =
                item.country_id ??
                item.id ??
                item.pk ??
                item.value ??
                idx;
            const titleRu =
                item.title_ru ??
                item.name_ru ??
                item.name ??
                item.title ??
                item.title_en ??
                item.text ??
                '';
            const titleEn =
                item.title_en ??
                item.title ??
                item.name_en ??
                item.name ??
                '';
            const countryCode =
                item.country_code ??
                item.code ??
                item.iso2 ??
                item.iso ??
                item.alpha2 ??
                item.alpha_2 ??
                item.ISO3166_1_alpha2 ??
                '';
            const normalizedCode = countryCode ? String(countryCode).trim().toUpperCase() : '';
            return {
                country_id: String(id),
                title_ru: String(titleRu),
                title_en: titleEn ? String(titleEn) : undefined,
                title: item.title ? String(item.title) : undefined,
                name: item.name ? String(item.name) : undefined,
                country_code: normalizedCode || undefined,
                code: normalizedCode || undefined,
                iso2: normalizedCode || undefined,
                iso: normalizedCode || undefined,
                alpha2: normalizedCode || undefined,
                alpha_2: normalizedCode || undefined,
                ISO3166_1_alpha2: normalizedCode || undefined,
            };
        })
        .filter(Boolean);
}

const STEP_CONFIG: StepMeta[] = [
    {
        id: 1,
        title: 'Основная информация',
        subtitle: 'Название и описание путешествия',
        tipTitle: 'Совет',
        tipBody: 'Начните с названия и короткого описания. Остальные поля можно заполнить позже — они нужны только для модерации.',
        nextLabel: 'Далее: Маршрут (шаг 2 из 6)',
    },
    {
        id: 2,
        title: 'Маршрут на карте',
        subtitle: 'Добавьте ключевые точки и страны маршрута',
        tipTitle: 'Лайфхак',
        tipBody: '',
        nextLabel: 'К медиа (шаг 3 из 6)',
    },
    {
        id: 3,
        title: 'Медиа путешествия',
        subtitle: 'Добавьте обложку, фотографии и видео — это повышает доверие и конверсию',
        tipTitle: 'Подсказка',
        tipBody: 'Если есть выбор, начните с обложки: горизонтальный кадр без коллажей обычно смотрится лучше в списках.',
        nextLabel: 'К деталям (шаг 4 из 6)',
    },
    {
        id: 4,
        title: 'Детали и советы',
        subtitle: 'Плюсы/минусы, рекомендации и бюджет — чтобы маршрут был полезнее',
        tipTitle: 'Подсказка',
        tipBody: 'Короткие списки и конкретика работают лучше, чем общий текст. Пишите так, как советовали бы другу.',
        nextLabel: 'К доп. параметрам (шаг 5 из 6)',
    },
    {
        id: 5,
        title: 'Дополнительные параметры',
        subtitle: 'Транспорт, сложность, сезонность, виза и другие настройки',
        tipTitle: 'Подсказка',
        tipBody: 'Эти поля не обязательны для перехода по шагам, но помогают читателям лучше понять условия маршрута.',
        nextLabel: 'К публикации (шаг 6 из 6)',
    },
    {
        id: 6,
        title: 'Публикация путешествия',
        subtitle: 'Проверьте готовность и выберите статус — черновик или модерация',
        tipTitle: 'Подсказка',
        tipBody: 'Перед модерацией убедитесь, что есть описание, страны, минимум одна точка маршрута и обложка/фото.',
        nextLabel: 'Завершить',
    },
];

export { normalizeCategoryTravelAddress, normalizeCountries, initFilters };

export default function UpsertTravel() {
    const router = useRouter();
    const navigation = useNavigation();
    const { id } = useLocalSearchParams();
    const { userId, isAuthenticated, isSuperuser } = useAuth();
    const isSuperAdmin = isSuperuser;
    const isNew = !id;
    
    // Responsive design with memoization
    const windowWidth = useMemo(() => Dimensions.get('window').width, []);
    const isMobile = useMemo(() => windowWidth <= METRICS.breakpoints.tablet, [windowWidth]);

    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 6;
    const [markers, setMarkers] = useState<MarkerData[]>([]);
    const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
    const [filters, setFilters] = useState<ReturnType<typeof initFilters>>(initFilters());
    const [isFiltersLoading, setIsFiltersLoading] = useState(true);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    const [step1SubmitErrors, setStep1SubmitErrors] = useState<ValidationError[]>([]);

    const pendingIssueNavRef = useRef<{ step: number; anchorId?: string } | null>(null);
    const [focusAnchorId, setFocusAnchorId] = useState<string | null>(null);

    const handleStepSelect = useCallback(
        (step: number) => {
            if (step < 1 || step > totalSteps || step === currentStep) return;
            trackWizardEvent('wizard_step_jump', { step_from: currentStep, step_to: step });
            setCurrentStep(step);
        },
        [currentStep, totalSteps],
    );
    
    // Optimized form state management
    const initialFormData = useMemo(() => getEmptyFormData(isNew ? null : String(id)), [isNew, id]);
    
    // Ref to track current form data without causing re-renders
    const formDataRef = useRef<TravelFormData>(initialFormData);
    const formState = useOptimizedFormState(initialFormData, {
        debounce: 5000,
        validateOnChange: true,
        validationDebounce: 300,
    });
    
    // Keep ref in sync with form data
    useEffect(() => {
        formDataRef.current = formState.data as TravelFormData;
    }, [formState.data]);

    useEffect(() => {
        const pending = pendingIssueNavRef.current;
        if (!pending) {
            if (focusAnchorId) setFocusAnchorId(null);
            return;
        }
        if (pending.step !== currentStep) return;

        const anchorId = pending.anchorId;
        setFocusAnchorId(anchorId ?? null);

        if (!anchorId) return;
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;

        // Wait a tick to ensure the new step has mounted
        setTimeout(() => {
            const el = document.getElementById(anchorId);
            if (el && typeof (el as any).scrollIntoView === 'function') {
                (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            pendingIssueNavRef.current = null;
            setFocusAnchorId(null);
        }, 50);
    }, [currentStep, focusAnchorId]);

    const handleNavigateToIssue = useCallback((issue: ModerationIssue) => {
        pendingIssueNavRef.current = { step: issue.targetStep, anchorId: issue.anchorId };
        setCurrentStep(issue.targetStep);
    }, []);

    const handleAnchorHandled = useCallback(() => {
        pendingIssueNavRef.current = null;
        setFocusAnchorId(null);
    }, []);
    
    // Stable toast notification (no dependencies on autosave)
    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        Toast.show({
            type,
            text1: message,
        });
    }, []);
    
    // Stable callbacks for autosave
    const handleSaveSuccess = useCallback((savedData: TravelFormData) => {
        if (isNew && savedData.id) {
            router.replace(`/travel/${savedData.id}`);
        }
        // Don't show success toast on autosave to avoid annoying notifications
        // Toast will still show on manual save
    }, [isNew, router]);
    
    const handleSaveError = useCallback((error: Error) => {
        showToast('Ошибка автосохранения', 'error');
        console.error('Autosave error:', error);
    }, [showToast]);
    
    // Apply saved data with markers synchronization
    const applySavedData = useCallback((savedData: TravelFormData) => {
        const markersFromData = (savedData.coordsMeTravel as any) || [];
        const syncedCountries = syncCountriesFromMarkers(markersFromData, savedData.countries || []);

        formState.updateFields({
            ...savedData,
            countries: syncedCountries,
        });
        setMarkers(markersFromData);
    }, [formState, setMarkers]);

    // Improved autosave with stable callbacks
    const autosave = useImprovedAutoSave(
        formState.data,
        initialFormData,
        {
            debounce: 5000,
            onSave: async (data) => {
                const cleanedData = cleanEmptyFields({
                    ...data,
                    id: normalizeTravelId(data.id),
                });
                return await saveFormData(cleanedData);
            },
            onSuccess: handleSaveSuccess,
            onError: handleSaveError,
            enabled: isAuthenticated && hasAccess,
        }
    );

    const exitGuardPromptVisibleRef = useRef(false);

    const confirmLeaveWizard = useCallback(
        async (onDiscard: () => void, onSavedAndLeave?: () => void) => {
            if (exitGuardPromptVisibleRef.current) return;
            exitGuardPromptVisibleRef.current = true;

            const reset = () => {
                exitGuardPromptVisibleRef.current = false;
            };

            const canSaveNow = autosave.canSave;
            const hasUnsaved = autosave.hasUnsavedChanges;

            if (!hasUnsaved) {
                reset();
                onDiscard();
                return;
            }

            Alert.alert(
                'Есть несохранённые изменения',
                canSaveNow
                    ? 'Сохранить черновик перед выходом?'
                    : 'Сейчас сохранить нельзя (нет интернета или идёт сохранение). Выйти без сохранения?'
                ,
                [
                    {
                        text: 'Остаться',
                        style: 'cancel',
                        onPress: reset,
                    },
                    ...(canSaveNow
                        ? [
                              {
                                  text: 'Сохранить и выйти',
                                  onPress: async () => {
                                      try {
                                          await autosave.saveNow();
                                          reset();
                                          onSavedAndLeave?.();
                                      } catch (e: any) {
                                          reset();
                                          Toast.show({
                                              type: 'error',
                                              text1: 'Не удалось сохранить',
                                              text2: e?.message || 'Попробуйте ещё раз',
                                          });
                                      }
                                  },
                              },
                          ]
                        : []),
                    {
                        text: 'Выйти без сохранения',
                        style: 'destructive',
                        onPress: () => {
                            reset();
                            onDiscard();
                        },
                    },
                ],
            );
        },
        [autosave, exitGuardPromptVisibleRef],
    );

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (typeof window === 'undefined') return;

        const handler = (e: BeforeUnloadEvent) => {
            if (!autosave.hasUnsavedChanges) return;
            e.preventDefault();
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [autosave.hasUnsavedChanges]);

    useEffect(() => {
        if (Platform.OS === 'web') return;
        if (!navigation?.addListener) return;

        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (!autosave.hasUnsavedChanges) return;
            e.preventDefault();

            void confirmLeaveWizard(
                () => navigation.dispatch(e.data.action),
                () => navigation.dispatch(e.data.action),
            );
        });

        return unsubscribe;
    }, [autosave.hasUnsavedChanges, confirmLeaveWizard, navigation]);

    useEffect(() => {
        if (Platform.OS === 'web') return;

        const onHardwareBack = () => {
            if (!autosave.hasUnsavedChanges) return false;
            void confirmLeaveWizard(
                () => router.back(),
                () => router.back(),
            );
            return true;
        };

        const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
        return () => sub.remove();
    }, [autosave.hasUnsavedChanges, confirmLeaveWizard, router]);
    
    const handleManualSave = useCallback(async () => {
        try {
            const savedData = await autosave.saveNow();
            applySavedData(savedData);
            showToast('Сохранено');
            return savedData;
        } catch (error) {
            showToast('Ошибка сохранения', 'error');
            console.error('Manual save error:', error);
            return;
        }
    }, [applySavedData, autosave, showToast]);

    // Load travel data from server
    const loadTravelData = useCallback(async (travelId: string) => {
        try {
            const travelData = await fetchTravel(Number(travelId));

            // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверка прав доступа при редактировании
            if (!isNew && travelData) {
                const travelUserId = travelData.userIds || travelData.user?.id?.toString() || '';
                const currentUserIdStr = userId?.toString() || '';

                // Проверяем, что пользователь является владельцем или супер-админом
                const isOwner = travelUserId === currentUserIdStr;
                const canEdit = isOwner || isSuperAdmin;

                if (!canEdit) {
                    Toast.show({
                        type: 'error',
                        text1: 'Нет доступа',
                        text2: 'Вы можете редактировать только свои путешествия',
                    });
                    router.replace('/');
                    return;
                }

                setHasAccess(true);
            } else if (isNew) {
                // Для нового путешествия: доступ к мастеру требует авторизации.
                // Вместо редиректа показываем гостевой экран с CTA.
                setHasAccess(true);
            }

            const transformed = transformTravelToFormData(travelData);
            const markersFromData = (transformed.coordsMeTravel as any) || [];
            const syncedCountries = syncCountriesFromMarkers(markersFromData, transformed.countries || []);

            const finalData = {
                ...transformed,
                countries: syncedCountries,
            };

            setTravelDataOld(travelData);
            formState.updateFields(finalData);
            setMarkers(markersFromData);
            
            // Update autosave baseline to prevent immediate autosave after loading
            autosave.updateBaseline(finalData);
        } catch (error) {
            console.error('Ошибка загрузки путешествия:', error);
            Toast.show({
                type: 'error',
                text1: 'Ошибка загрузки',
                text2: 'Не удалось загрузить путешествие',
            });
            router.replace('/');
        } finally {
            setIsInitialLoading(false);
        }
    }, [autosave, formState, isNew, router, setMarkers, userId, isSuperAdmin]); // Added dependencies for useCallback

    // Загружаем фильтры и данные путешествия только один раз на конкретный id,
    // чтобы исключить повторные запросы (/countries, /getFiltersTravel, /travels/:id)
    const initialLoadKeyRef = useRef<string | null>(null);
    useEffect(() => {
        const loadKey = String(id ?? 'new');
        if (initialLoadKeyRef.current === loadKey) return;
        initialLoadKeyRef.current = loadKey;

        let isMounted = true;
        (async () => {
            try {
                const [filtersData, countryData] = await Promise.all([
                    fetchFilters(),
                    fetchAllCountries(),
                ]);
                if (!isMounted) return;
                setFilters((prev) => {
                    // Всегда обновляем категории точек, даже если страны уже были загружены ранее
                    const base = prev && Array.isArray(prev.countries) && prev.countries.length > 0
                        ? { ...prev }
                        : {} as any;

                    console.info('Raw filtersData:', filtersData);
                    console.info('Raw categoryTravelAddress:', filtersData?.categoryTravelAddress);

                    let normalizedCategoryTravelAddress = normalizeCategoryTravelAddress(filtersData?.categoryTravelAddress);

                    // Если бэкенд вернул категории точек в поле categories (а categoryTravelAddress пуст),
                    // используем их как источник категорий точек.
                    if (
                        (!normalizedCategoryTravelAddress || normalizedCategoryTravelAddress.length === 0) &&
                        Array.isArray((filtersData as any)?.categories) &&
                        (filtersData as any).categories.length > 0
                    ) {
                        normalizedCategoryTravelAddress = normalizeCategoryTravelAddress((filtersData as any).categories);
                    }

                    // Fallback: если API не вернул категории точек, используем дефолтные
                    if (!normalizedCategoryTravelAddress || normalizedCategoryTravelAddress.length === 0) {
                        console.warn('API returned empty categoryTravelAddress, using fallback values');
                        normalizedCategoryTravelAddress = [
                            { id: '1', name: 'Парковка' },
                            { id: '2', name: 'Отель' },
                            { id: '3', name: 'Ресторан' },
                            { id: '4', name: 'Достопримечательность' },
                            { id: '5', name: 'Смотровая площадка' },
                            { id: '6', name: 'Заправка' },
                            { id: '7', name: 'Магазин' },
                            { id: '8', name: 'Кафе' }
                        ];
                    }

                    console.info('Normalized categoryTravelAddress:', normalizedCategoryTravelAddress);

                    const normalizedCountries = (base.countries && base.countries.length > 0)
                        ? base.countries
                        : normalizeCountries(countryData);

                    return {
                        ...base,
                        ...filtersData,
                        categoryTravelAddress: normalizedCategoryTravelAddress,
                        countries: normalizedCountries,
                    } as any;
                });
                setIsFiltersLoading(false);
            } catch (error) {
                console.error('Ошибка загрузки фильтров:', error);
                if (isMounted) {
                    setFilters(initFilters());
                    setIsFiltersLoading(false);
                }
            }
        })();
        if (!isNew && id) {
            loadTravelData(id as string);
        } else if (isNew) {
            // Для нового путешествия не редиректим гостя — покажем гостевой экран.
            setHasAccess(true);
            setIsInitialLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [id, isNew, loadTravelData]);

    // Повторная загрузка стран, если список пуст при переходе на шаг 2
    useEffect(() => {
        const needCountries = currentStep === 2 && (!filters?.countries || filters.countries.length === 0);
        if (!needCountries) return;
        let cancelled = false;
        const loadCountries = async () => {
            try {
                setIsFiltersLoading(true);
                const countryData = await fetchAllCountries();
                if (cancelled) return;
                setFilters((prev) => {
                    const normalizedCountries = normalizeCountries(countryData);
                    const base = prev || initFilters();
                    return {
                        ...base,
                        countries: normalizedCountries,
                    } as any;
                });
            } catch (error) {
                console.error('Ошибка повторной загрузки стран:', error);
                if (!cancelled) {
                    setFilters((prev) => prev || initFilters());
                }
            } finally {
                if (!cancelled) setIsFiltersLoading(false);
            }
        };
        loadCountries();
        return () => {
            cancelled = true;
        };
    }, [currentStep, filters?.countries]);

    const handleFinishWizard = useCallback(async () => {
        await handleManualSave();
    }, [handleManualSave]);

    // Track step views in a dedicated effect instead of inside render
    useEffect(() => {
        trackWizardEvent('wizard_step_view', {
            step: currentStep,
        });
    }, [currentStep]);

    const handleCountrySelect = useCallback((countryId: string) => {
        const id = String(countryId);
        const current = (formState.data.countries || []).map(String);
        if (id && !current.includes(id)) {
            formState.updateField('countries', [...current, id]);
        }
    }, [formState]);

    const handleCountryDeselect = useCallback((countryId: string) => {
        const id = String(countryId);
        const current = (formState.data.countries || []).map(String);
        formState.updateField('countries', current.filter(c => c !== id));
    }, [formState]); // Only depend on the data we read

    // Create a stable wrapper for setFormData that works with all wizard steps
    // Uses ref to access current data without causing recreations
    const setFormData = useCallback<React.Dispatch<React.SetStateAction<TravelFormData>>>((updater) => {
        if (typeof updater === 'function') {
            const next = updater(formDataRef.current);
            formState.updateFields(next);
        } else {
            formState.updateFields(updater as Partial<TravelFormData>);
        }
    }, [formState]); // stable on formState

    const handleNextFromBasic = useCallback(() => {
        const result = validateStep(1, {
            name: formState.data.name ?? '',
        } as any);

        const hadErrors = !result.isValid;
        const errorFields = result.errors.map((e: ValidationError) => e.field);
        trackWizardEvent('wizard_step_next_click', {
            step_from: 1,
            step_to: 2,
            had_errors: hadErrors,
            error_fields: errorFields,
        });

        if (!result.isValid) {
            setStep1SubmitErrors(result.errors);
            showToast('Заполните обязательные поля, чтобы перейти дальше.', 'error');
            return;
        }

        setStep1SubmitErrors([]);

        setCurrentStep(2);
    }, [formState.data, showToast]);

    // Показываем загрузку или блокируем доступ
    if (isInitialLoading) {
        return (
            <SafeAreaView style={styles.safeContainer}>
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingSkeletonHeader} />
                    <View style={styles.loadingSkeletonSubheader} />
                    <View style={styles.loadingSkeletonBlock} />
                </View>
            </SafeAreaView>
        );
    }

    if (!hasAccess) {
        return null; // Редирект уже произошел
    }

    if (isNew && !isAuthenticated) {
        const redirect = encodeURIComponent('/travel/new');
        return (
            <SafeAreaView style={styles.safeContainer}>
                <View style={[styles.loadingContainer, { justifyContent: 'center' }]}>
                    <Button
                        mode="contained"
                        onPress={() => router.push(`/login?redirect=${redirect}` as any)}
                        style={styles.saveButtonMobile}
                    >
                        Войти, чтобы создать маршрут
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={() => router.push(`/registration?redirect=${redirect}` as any)}
                        style={styles.filterButton}
                    >
                        Регистрация
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    const stepMeta = STEP_CONFIG.find((step) => step.id === currentStep);
    const progressValue = currentStep / totalSteps;
    const countries = (filters?.countries ?? []) as any[];
    const selectedCountryIds = (formState.data.countries ?? []) as any[];
    const autosaveBadge = (() => {
        if (autosave.status === 'saving' || autosave.status === 'debouncing') {
            return 'Сохраняем черновик…';
        }
        if (autosave.status === 'error') {
            return 'Ошибка сохранения — повторите';
        }
        if (autosave.lastSaved) {
            return `Черновик сохранён ${autosave.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return 'Изменения пока не сохранены';
    })();

    if (currentStep === 1) {
        const firstErrorFieldForContent = (() => {
            const field = step1SubmitErrors[0]?.field;
            if (field === 'name') {
                return field;
            }
            return null;
        })();

        return (
            <TravelWizardStepBasic
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={setFormData}
                isMobile={isMobile}
                onManualSave={handleManualSave}
                snackbarVisible={autosave.status === 'error'}
                snackbarMessage={autosave.error?.message || ''}
                onDismissSnackbar={autosave.clearError}
                onGoNext={handleNextFromBasic}
                stepErrors={step1SubmitErrors.map(e => e.message)}
                firstErrorField={firstErrorFieldForContent}
                autosaveStatus={autosave.status as 'idle' | 'saving' | 'saved' | 'error'}
                autosaveBadge={autosaveBadge}
                stepMeta={stepMeta}
                progress={progressValue}
                focusAnchorId={focusAnchorId}
                onAnchorHandled={handleAnchorHandled}
                onStepSelect={handleStepSelect}
            />
        );
    }

    if (currentStep === 2) {
        // Немедленное сохранение при изменении маркеров (add/edit/delete)
        const handleMarkersUpdate = (updatedMarkers: MarkerData[]) => {
            setMarkers(updatedMarkers);
            formState.updateField('coordsMeTravel', updatedMarkers as any);
        };

        return (
            <TravelWizardStepRoute
                currentStep={currentStep}
                totalSteps={totalSteps}
                markers={markers}
                setMarkers={handleMarkersUpdate}
                categoryTravelAddress={filters?.categoryTravelAddress ?? []}
                countries={countries}
                isFiltersLoading={isFiltersLoading}
                travelId={formState.data.id}
                selectedCountryIds={selectedCountryIds}
                onCountrySelect={handleCountrySelect}
                onCountryDeselect={handleCountryDeselect}
                onBack={() => {
                    trackWizardEvent('wizard_step_back_click', {
                        step_from: 2,
                        step_to: 1,
                    });
                    setCurrentStep(1);
                }}
                onNext={() => {
                    trackWizardEvent('wizard_step_next_click', {
                        step_from: 2,
                        step_to: 3,
                        had_errors: false,
                        error_fields: [],
                    });
                    setCurrentStep(3);
                }}
                onManualSave={handleManualSave}
                stepMeta={stepMeta}
                progress={progressValue}
                autosaveBadge={autosaveBadge}
                focusAnchorId={focusAnchorId}
                onAnchorHandled={handleAnchorHandled}
                onStepSelect={handleStepSelect}
            />
        );
    }

    if (currentStep === 3) {
        return (
            <TravelWizardStepMedia
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={setFormData}
                travelDataOld={travelDataOld}
                onManualSave={handleManualSave}
                onBack={() => {
                    trackWizardEvent('wizard_step_back_click', {
                        step_from: 3,
                        step_to: 2,
                    });
                    setCurrentStep(2);
                }}
                onNext={() => {
                    trackWizardEvent('wizard_step_next_click', {
                        step_from: 3,
                        step_to: 4,
                        had_errors: false,
                        error_fields: [],
                    });
                    setCurrentStep(4);
                }}
                stepMeta={stepMeta}
                progress={progressValue}
                autosaveBadge={autosaveBadge}
                focusAnchorId={focusAnchorId}
                onAnchorHandled={handleAnchorHandled}
                onStepSelect={handleStepSelect}
            />
        );
    }

    if (currentStep === 4) {
        return (
            <TravelWizardStepDetails
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={setFormData}
                onManualSave={handleManualSave}
                onBack={() => {
                    trackWizardEvent('wizard_step_back_click', {
                        step_from: 4,
                        step_to: 3,
                    });
                    setCurrentStep(3);
                }}
                onNext={() => {
                    trackWizardEvent('wizard_step_next_click', {
                        step_from: 4,
                        step_to: 5,
                        had_errors: false,
                        error_fields: [],
                    });
                    setCurrentStep(5);
                }}
                stepMeta={stepMeta}
                progress={progressValue}
                autosaveBadge={autosaveBadge}
            />
        );
    }

    if (currentStep === 5) {
        return (
            <TravelWizardStepExtras
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={setFormData}
                filters={filters}
                travelDataOld={travelDataOld}
                isSuperAdmin={isSuperAdmin}
                onManualSave={handleManualSave}
                onBack={() => {
                    trackWizardEvent('wizard_step_back_click', {
                        step_from: 5,
                        step_to: 4,
                    });
                    setCurrentStep(4);
                }}
                onNext={() => {
                    trackWizardEvent('wizard_step_next_click', {
                        step_from: 5,
                        step_to: 6,
                        had_errors: false,
                        error_fields: [],
                    });
                    setCurrentStep(6);
                }}
                stepMeta={stepMeta}
                progress={progressValue}
                autosaveBadge={autosaveBadge}
                focusAnchorId={focusAnchorId}
                onAnchorHandled={handleAnchorHandled}
                onStepSelect={handleStepSelect}
            />
        );
    }

    return (
        <TravelWizardStepPublish
            currentStep={currentStep}
            totalSteps={totalSteps}
            formData={formState.data}
            setFormData={setFormData}
            filters={filters}
            travelDataOld={travelDataOld}
            isSuperAdmin={isSuperAdmin}
            onManualSave={handleManualSave}
            onGoBack={() => setCurrentStep(5)}
            onFinish={handleFinishWizard}
            onNavigateToIssue={handleNavigateToIssue}
            stepMeta={stepMeta}
            progress={progressValue}
            autosaveBadge={autosaveBadge}
        />
    );
}

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    mainWrapper: { flex: 1, flexDirection: 'row' },
    mainWrapperMobile: { flexDirection: 'column' },
    contentColumn: { flex: 1 },
    filtersColumn: {
        width: 320,
        borderLeftWidth: 1,
        padding: DESIGN_TOKENS.spacing.md,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    filtersScroll: { maxHeight: '80%' },
    mobileFiltersWrapper: { padding: DESIGN_TOKENS.spacing.md },
    saveButtonMobile: {
        backgroundColor: DESIGN_TOKENS.colors.primary,
        borderRadius: DESIGN_TOKENS.radii.pill,
        minWidth: 150,
    },
    filterButton: {
        borderColor: DESIGN_TOKENS.colors.primary,
        borderRadius: DESIGN_TOKENS.radii.pill,
        minWidth: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'stretch',
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        gap: DESIGN_TOKENS.spacing.md,
    },
    loadingSkeletonHeader: {
        height: 20,
        borderRadius: 6,
        backgroundColor: DESIGN_TOKENS.colors.border,
        marginBottom: 4,
    },
    loadingSkeletonSubheader: {
        height: 14,
        borderRadius: 6,
        backgroundColor: DESIGN_TOKENS.colors.border,
        width: '70%',
        marginBottom: 12,
    },
    loadingSkeletonBlock: {
        height: 160,
        borderRadius: 10,
        backgroundColor: DESIGN_TOKENS.colors.border,
    },
});

function initFilters() {
    return {
        countries: [],
        categories: [],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        transports: [],
        categoryTravelAddress: [],
    };
}

function getEmptyFormData(id: string | null): TravelFormData {
    return {
        id: id || null,
        name: '',
        categories: [],
        transports: [],
        month: [],
        complexity: [],
        over_nights_stay: [],
        cities: [],
        countries: [],
        budget: '',
        year: '',
        number_peoples: '',
        number_days: '',
        minus: '',
        plus: '',
        recommendation: '',
        description: '',
        publish: false,
        moderation: false,
        visa: false,
        coordsMeTravel: [],
        thumbs200ForCollectionArr: [],
        travelImageThumbUrlArr: [],
        travelImageAddress: [],
        gallery: [],
        youtube_link: '',
        companions: [],
        countryIds: [],
        travelAddressIds: [],
        travelAddressCity: [],
        travelAddressCountry: [],
        travelAddressAdress: [],
        travelAddressCategory: [],
        categoriesIds: [],
    };
}

// Синхронизация списка стран путешествия с выбранными на карте точками
function syncCountriesFromMarkers(markers: MarkerData[], existingCountries: string[]): string[] {
    const markerCountryIds = Array.from(
        new Set(
            (markers || [])
                .map(m => (m.country != null ? String(m.country) : null))
                .filter((id): id is string => !!id),
        ),
    );

    const result = new Set<string>([...existingCountries, ...markerCountryIds]);
    return Array.from(result);
}

function transformTravelToFormData(travel: Travel): TravelFormData {
    const yearStr = travel.year != null ? String(travel.year) : '';
    const daysStr = (travel as any).number_days != null ? String((travel as any).number_days) : '';
    const peoplesStr = (travel as any).number_peoples != null ? String((travel as any).number_peoples) : '';

    return {
        ...getEmptyFormData(String(travel.id)),
        ...travel,
        // Нормализуем числовые поля к строкам для формы
        id: String(travel.id),
        year: yearStr,
        number_days: daysStr,
        number_peoples: peoplesStr,
        moderation: (travel as any).moderation ?? false,
        publish: (travel as any).publish ?? false,
        visa: (travel as any).visa ?? false,
        companions: (travel.companions || []).map(c => String(c)),
    };
}

function cleanEmptyFields(obj: any): any {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
            if (value === '') return [key, null];
            if (value === false) return [key, false];
            return [key, value];
        }),
    );
}

function normalizeTravelId(id: unknown): number | null {
    if (id == null) return null;
    if (typeof id === 'number') return Number.isFinite(id) ? id : null;
    if (typeof id === 'string') {
        const trimmed = id.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
