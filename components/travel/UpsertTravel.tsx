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
    const [filters, setFilters] = useState<ReturnType<typeof initFilters> | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    
    // Optimized form state management
    const initialFormData = useMemo(() => getEmptyFormData(isNew ? null : String(id)), [isNew, id]);
    const formState = useOptimizedFormState(initialFormData, {
        debounce: 5000,
        validateOnChange: true,
        validationDebounce: 300,
    });
    
    // Optimized validation
    const validation = useOptimizedValidation(formState.data, {
        debounce: 300,
        validateOnChange: true,
    });
    
    // Improved autosave
    const autosave = useImprovedAutoSave(
        formState.data,
        initialFormData,
        {
            debounce: 5000,
            onSave: async (data) => {
                const cleanedData = cleanEmptyFields({ ...data, id: data.id || null });
                return await saveFormData(cleanedData);
            },
            onSuccess: (savedData) => {
                if (isNew && savedData.id) {
                    router.replace(`/travel/${savedData.id}`);
                }
                showToast('Сохранено успешно!');
            },
            onError: (error) => {
                showToast('Ошибка автосохранения');
                console.error('Autosave error:', error);
            },
            onStart: () => {
                // Show saving indicator
            },
        }
    );

    // Optimized toast notification
    const showToast = useCallback((message: string) => {
        Toast.show({
            type: autosave.hasError ? 'error' : 'success',
            text1: message,
        });
    }, [autosave.hasError]);
    
    // Apply saved data with markers synchronization
    const applySavedData = useCallback((savedData: TravelFormData) => {
        const markersFromData = (savedData.coordsMeTravel as any) || [];
        const syncedCountries = syncCountriesFromMarkers(markersFromData, savedData.countries || []);

        formState.updateFields({
            ...savedData,
            countries: syncedCountries,
        });
        setMarkers(markersFromData);
    }, [formState]);

    useEffect(() => {
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
    }, [id, isNew, isAuthenticated, userId, router]);

    const handleManualSave = useCallback(async () => {
        try {
            await trackWizardEvent('wizard_manual_save', {
                step: currentStep,
                is_new: isNew,
                is_edit: !isNew,
                status: formState.data.moderation ? 'moderation' : 'draft',
            });

            const savedData = await autosave.saveNow();
            applySavedData(savedData);
        } catch (error) {
            showToast('Ошибка сохранения');
            console.error('Manual save error:', error);
        }
    }, [currentStep, isNew, formState.data.moderation, autosave, applySavedData, showToast]);

    const handleFinishWizard = useCallback(async () => {
        await handleManualSave();
    }, [handleManualSave]);

    const loadTravelData = async (travelId: string) => {
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

            setTravelDataOld(travelData);
            formState.updateFields({
                ...transformed,
                countries: syncedCountries,
            });
            setMarkers(markersFromData);
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
    };

    const handleCountrySelect = useCallback((countryId: string) => {
        if (countryId && !formState.data.countries.includes(countryId)) {
            formState.updateField('countries', [...formState.data.countries, countryId]);
        }
    }, [formState]);

    const handleCountryDeselect = useCallback((countryId: string) => {
        formState.updateField('countries', formState.data.countries.filter(id => id !== countryId));
    }, [formState]);

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
            showToast('Заполните обязательные поля на шаге "Основное", чтобы перейти дальше.');
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

    if (currentStep === 1) {
        trackWizardEvent('wizard_step_view', {
            step: 1,
        });
        return (
            <TravelWizardStepBasic
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={formState.updateFields}
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
            />
        );
    }

    if (currentStep === 2) {
        trackWizardEvent('wizard_step_view', {
            step: 2,
        });
        return (
            <TravelWizardStepRoute
                currentStep={currentStep}
                totalSteps={totalSteps}
                markers={markers}
                setMarkers={(updatedMarkers) => {
                    setMarkers(updatedMarkers);
                    formState.updateField('coordsMeTravel', updatedMarkers as any);
                }}
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
                        showToast('Добавьте хотя бы одну точку маршрута, чтобы перейти к медиа');
                        return;
                    }
                    setCurrentStep(3);
                }}
            />
        );
    }

    if (currentStep === 3) {
        trackWizardEvent('wizard_step_view', {
            step: 3,
        });
        return (
            <TravelWizardStepMedia
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={formState.updateFields}
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
            />
        );
    }

    if (currentStep === 4) {
        trackWizardEvent('wizard_step_view', {
            step: 4,
        });
        return (
            <TravelWizardStepDetails
                currentStep={currentStep}
                totalSteps={totalSteps}
                formData={formState.data}
                setFormData={formState.updateFields}
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
            setFormData={formState.updateFields}
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
