import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { fetchTravel } from '@/src/api/travelsApi';
import { fetchFilters, saveFormData, fetchAllCountries } from '@/src/api/misc';
import { TravelFormData, MarkerData, Travel } from '@/src/types/types';
import { useAuth } from '@/context/AuthContext';
import { validateStep, type ValidationError } from '@/utils/formValidation';
import { trackWizardEvent } from '@/src/utils/analytics';
import { useOptimizedFormState } from '@/hooks/useOptimizedFormState';
import { useOptimizedValidation } from '@/hooks/useOptimizedValidation';
import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type StepMeta = {
    id: number;
    title: string;
    subtitle: string;
    tipTitle: string;
    tipBody: string;
    nextLabel: string;
};

const STEP_CONFIG: StepMeta[] = [
    {
        id: 1,
        title: 'Основная информация',
        subtitle: 'Опишите концепцию и базовые параметры путешествия',
        tipTitle: 'Совет',
        tipBody: 'Лучше всего заполнять описание в формате истории: зачем поехали, что понравилось, какие инсайты вынесли.',
        nextLabel: 'Далее: Маршрут (шаг 2 из 5)',
    },
    {
        id: 2,
        title: 'Маршрут на карте',
        subtitle: 'Добавьте ключевые точки и страны маршрута',
        tipTitle: 'Лайфхак',
        tipBody: 'Начните с основной географии: добавьте города, потом уточняйте отдельные точки. Это экономит время.',
        nextLabel: 'К медиа (шаг 3 из 5)',
    },
];

export default function UpsertTravel() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { userId, isAuthenticated, isSuperuser } = useAuth();
    const isSuperAdmin = isSuperuser;
    const isNew = !id;
    
    // Responsive design with memoization
    const windowWidth = useMemo(() => Dimensions.get('window').width, []);
    const isMobile = useMemo(() => windowWidth <= 768, [windowWidth]);

    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 5;

    const [menuVisible, setMenuVisible] = useState(!isMobile);
    const [markers, setMarkers] = useState<MarkerData[]>([]);
    const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
    const markersUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [filters, setFilters] = useState<ReturnType<typeof initFilters> | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    
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

    // Debug: trace renders and form state changes
    console.log('[UpsertTravel] render', { currentStep, isNew, id, hasAccess, isInitialLoading });
    
    // Optimized validation
    const validation = useOptimizedValidation(formState.data, {
        debounce: 300,
        validateOnChange: true,
    });
    
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
    
    // Improved autosave with stable callbacks
    const autosave = useImprovedAutoSave(
        formState.data,
        initialFormData,
        {
            debounce: 5000,
            onSave: async (data) => {
                const cleanedData = cleanEmptyFields({ ...data, id: data.id || null });
                return await saveFormData(cleanedData);
            },
            onSuccess: handleSaveSuccess,
            onError: handleSaveError,
        }
    );
    
    // Apply saved data with markers synchronization
    const applySavedData = useCallback((savedData: TravelFormData) => {
        const markersFromData = (savedData.coordsMeTravel as any) || [];
        const syncedCountries = syncCountriesFromMarkers(markersFromData, savedData.countries || []);

        formState.updateFields({
            ...savedData,
            countries: syncedCountries,
        });
        setMarkers(markersFromData);
    }, []); // formState.updateFields is stable, no need to include it

    // Load travel data from server
    const loadTravelData = useCallback(async (travelId: string) => {
        console.log('Loading travel data for ID:', travelId, typeof travelId);
        try {
            const travelData = await fetchTravel(Number(travelId));
            console.log('Loaded travel data:', travelData?.id, travelData?.name);

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
                // Для нового путешествия проверяем авторизацию
                if (!isAuthenticated) {
                    Toast.show({
                        type: 'error',
                        text1: 'Требуется авторизация',
                        text2: 'Войдите в систему для создания путешествия',
                    });
                    router.replace('/login');
                    return;
                }
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
    }, [isNew, isAuthenticated, userId, isSuperAdmin, router, autosave.updateBaseline]); // Added dependencies for useCallback

    useEffect(() => {
        console.log('[UpsertTravel] useEffect load filters & travel', { id, isNew });
        let isMounted = true;
        (async () => {
            try {
                const [filtersData, countryData] = await Promise.all([
                    fetchFilters(),
                    fetchAllCountries(),
                ]);
                if (isMounted) {
                    setFilters({ ...filtersData, countries: countryData } as any);
                }
            } catch (error) {
                console.error('Ошибка загрузки фильтров:', error);
                if (isMounted) {
                    setFilters(initFilters());
                }
            }
        })();
        if (!isNew && id) {
            loadTravelData(id as string);
        } else if (isNew) {
            // Для нового путешествия проверяем авторизацию
            if (!isAuthenticated) {
                Toast.show({
                    type: 'error',
                    text1: 'Требуется авторизация',
                    text2: 'Войдите в систему для создания путешествия',
                });
                router.replace('/login');
            } else {
                setHasAccess(true);
                setIsInitialLoading(false);
            }
        }
        return () => {
            isMounted = false;
        };
    }, [id, isNew, isAuthenticated, userId, router, loadTravelData]);

    const handleManualSave = useCallback(async () => {
        console.log('[UpsertTravel] handleManualSave start', { currentStep });
        try {
            await trackWizardEvent('wizard_manual_save', {
                step: currentStep,
                is_new: isNew,
                is_edit: !isNew,
                status: formState.data.moderation ? 'moderation' : 'draft',
            });

            const savedData = await autosave.saveNow();
            console.log('[UpsertTravel] handleManualSave saved', { id: (savedData as any)?.id });
            applySavedData(savedData);
        } catch (error) {
            showToast('Ошибка сохранения', 'error');
            console.error('Manual save error:', error);
        }
    }, [currentStep, isNew, formState.data.moderation, autosave.saveNow, applySavedData, showToast]);

    const handleFinishWizard = useCallback(async () => {
        await handleManualSave();
    }, [handleManualSave]);

    // Track step views in a dedicated effect instead of inside render
    useEffect(() => {
        console.log('[UpsertTravel] step view', { step: currentStep });
        trackWizardEvent('wizard_step_view', {
            step: currentStep,
        });
    }, [currentStep]);

    const handleCountrySelect = useCallback((countryId: string) => {
        if (countryId && !formState.data.countries.includes(countryId)) {
            formState.updateField('countries', [...formState.data.countries, countryId]);
        }
    }, [formState.data.countries]); // Only depend on the data we read

    const handleCountryDeselect = useCallback((countryId: string) => {
        formState.updateField('countries', formState.data.countries.filter(id => id !== countryId));
    }, [formState.data.countries]); // Only depend on the data we read

    // Create a stable wrapper for setFormData that works with all wizard steps
    // Uses ref to access current data without causing recreations
    const setFormData = useCallback<React.Dispatch<React.SetStateAction<TravelFormData>>>((updater) => {
        if (typeof updater === 'function') {
            const next = updater(formDataRef.current);
            formState.updateFields(next);
        } else {
            formState.updateFields(updater as Partial<TravelFormData>);
        }
    }, []); // No dependencies - uses ref for current data

    const handleNextFromBasic = useCallback(() => {
        const result = validateStep(1, {
            name: formState.data.name ?? '',
            description: formState.data.description ?? '',
            countries: formState.data.countries ?? [],
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
            const requiredMessages = result.errors.map((e: ValidationError) => e.message);
            showToast('Заполните обязательные поля на шаге "Основное", чтобы перейти дальше.', 'error');
            return;
        }

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

    const stepMeta = STEP_CONFIG.find((step) => step.id === currentStep);
    const progressValue = currentStep / totalSteps;
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
        return (
            <TravelWizardStepBasic
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={setFormData}
                filters={filters}
                travelDataOld={travelDataOld}
                isSuperAdmin={isSuperAdmin}
                isMobile={isMobile}
                menuVisible={menuVisible}
                setMenuVisible={setMenuVisible}
                onManualSave={handleManualSave}
                snackbarVisible={autosave.status === 'error'}
                snackbarMessage={autosave.error?.message || ''}
                onDismissSnackbar={autosave.clearError}
                onGoNext={handleNextFromBasic}
                stepErrors={validation.errors.map(e => e.message)}
                firstErrorField={validation.errors[0]?.field}
                autosaveStatus={autosave.status as 'idle' | 'saving' | 'saved' | 'error'}
                autosaveBadge={autosaveBadge}
                stepMeta={stepMeta}
                progress={progressValue}
            />
        );
    }

    if (currentStep === 2) {
        // Debounced marker update to prevent constant autosave
        const handleMarkersUpdate = (updatedMarkers: MarkerData[]) => {
            // Update UI immediately
            setMarkers(updatedMarkers);
            
            // Clear previous timeout
            if (markersUpdateTimeoutRef.current) {
                clearTimeout(markersUpdateTimeoutRef.current);
            }
            
            // Update formState after 1 second of inactivity to prevent constant autosave
            markersUpdateTimeoutRef.current = setTimeout(() => {
                formState.updateField('coordsMeTravel', updatedMarkers as any);
            }, 1000);
        };
        
        return (
            <TravelWizardStepRoute
                currentStep={currentStep}
                totalSteps={totalSteps}
                markers={markers}
                setMarkers={handleMarkersUpdate}
                travelId={formState.data.id ?? null}
                categoryTravelAddress={filters?.categoryTravelAddress || []}
                countries={filters?.countries || []}
                isFiltersLoading={!filters}
                selectedCountryIds={formState.data.countries}
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
                    const stepValidation = validateStep(2, { coordsMeTravel: (formState.data as any).coordsMeTravel } as any, markers);
                    const hadErrors = !stepValidation.isValid;
                    trackWizardEvent('wizard_step_next_click', {
                        step_from: 2,
                        step_to: 3,
                        had_errors: hadErrors,
                        error_fields: stepValidation.errors.map((e: ValidationError) => e.field),
                    });
                    if (!stepValidation.isValid) {
                        showToast('Добавьте хотя бы одну точку маршрута, чтобы перейти к медиа', 'error');
                        return;
                    }
                    setCurrentStep(3);
                }}
                onManualSave={handleManualSave}
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
            onGoBack={() => setCurrentStep(4)}
            onFinish={handleFinishWizard}
        />
    );
}

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    mainWrapper: { flex: 1, flexDirection: 'row' },
    mainWrapperMobile: { flexDirection: 'column' },
    contentColumn: { flex: 1 },
    filtersColumn: { width: 320, borderLeftWidth: 1, padding: DESIGN_TOKENS.spacing.md, borderColor: '#ddd' },
    filtersScroll: { maxHeight: '80%' },
    mobileFiltersWrapper: { padding: DESIGN_TOKENS.spacing.md },
    mobileActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: DESIGN_TOKENS.spacing.md,
        borderTopWidth: 1,
        borderColor: '#ddd',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    saveButtonMobile: {
        backgroundColor: '#f5a623',
        borderRadius: 50,
        minWidth: 150,
    },
    filterButton: {
        borderColor: '#007AFF',
        borderRadius: 50,
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
        backgroundColor: '#e5e7eb',
        marginBottom: 4,
    },
    loadingSkeletonSubheader: {
        height: 14,
        borderRadius: 6,
        backgroundColor: '#e5e7eb',
        width: '70%',
        marginBottom: 12,
    },
    loadingSkeletonBlock: {
        height: 160,
        borderRadius: 10,
        backgroundColor: '#e5e7eb',
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
