import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { fetchTravel } from '@/src/api/travelsApi';
import { fetchFilters, saveFormData } from '@/src/api/misc';
import { TravelFormData, MarkerData, Travel } from '@/src/types/types';
import { useAuth } from '@/context/AuthContext';
import { validateStep, type ValidationError } from '@/utils/formValidation';
import { trackWizardEvent } from '@/src/utils/analytics';

import TravelWizardStepBasic from '@/components/travel/TravelWizardStepBasic';
import TravelWizardStepRoute from '@/components/travel/TravelWizardStepRoute';
import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails';
import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { useAutoSaveForm } from '@/hooks/useAutoSaveForm';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export default function UpsertTravel() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { userId, isAuthenticated, isSuperuser } = useAuth();
    const isSuperAdmin = isSuperuser;
    const isNew = !id;
    const windowWidth = Dimensions.get('window').width;
    const isMobile = windowWidth <= 768;

    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 5; // 1 — Основное, 2 — Маршрут, 3 — Медиа, 4 — Детали и советы, 5 — Публикация

    const [menuVisible, setMenuVisible] = useState(!isMobile);
    const [markers, setMarkers] = useState<MarkerData[]>([]);
    const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
    const [filters, setFilters] = useState<ReturnType<typeof initFilters> | null>(null);
    const [formData, setFormData] = useState<TravelFormData>(getEmptyFormData(isNew ? null : String(id)));
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [step1Errors, setStep1Errors] = useState<string[]>([]);
    const [step1FirstErrorField, setStep1FirstErrorField] = useState<string | null>(null);

    const saveFormDataWithId = async (data: TravelFormData) => {
        const cleanedData = cleanEmptyFields({ ...data, id: data.id || null });
        return await saveFormData(cleanedData);
    };

    const applySavedData = (savedData: TravelFormData) => {
        const markersFromData = (savedData.coordsMeTravel as any) || [];
        const syncedCountries = syncCountriesFromMarkers(markersFromData, savedData.countries || []);

        setFormData({
            ...savedData,
            countries: syncedCountries,
        });
        setMarkers(markersFromData);
        resetOriginalData({
            ...savedData,
            countries: syncedCountries,
        });
    };

    const { resetOriginalData } = useAutoSaveForm(formData, {
        debounce: 5000,
        onSave: saveFormDataWithId,
        onStart: () => setAutosaveStatus('saving'),
        onSuccess: savedData => {
            applySavedData(savedData);
            setAutosaveStatus('saved');
        },
        onError: () => {
            setAutosaveStatus('error');
            showSnackbar('Ошибка автосохранения');
        },
    });

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

    const handleManualSave = async () => {
        try {
            await trackWizardEvent('wizard_manual_save', {
                step: currentStep,
                is_new: isNew,
                is_edit: !isNew,
                status: formData.moderation ? 'moderation' : 'draft',
            });

            const savedData = await saveFormDataWithId(formData);
            applySavedData(savedData);
            if (isNew && savedData.id) router.replace(`/travel/${savedData.id}`);
            showSnackbar('Сохранено успешно!');
        } catch {
            showSnackbar('Ошибка сохранения');
        }
    };

    const handleFinishWizard = async () => {
        await handleManualSave();
    };

    const loadTravelData = async (travelId: string) => {
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
            setFormData({
                ...transformed,
                countries: syncedCountries,
            });
            setMarkers(markersFromData);
            resetOriginalData({
                ...transformed,
                countries: syncedCountries,
            });
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

    const handleCountrySelect = (countryId: string) => {
        if (countryId) {
            setFormData(prevData =>
                prevData.countries.includes(countryId)
                    ? prevData
                    : { ...prevData, countries: [...prevData.countries, countryId] }
            );
        }
    };

    const handleCountryDeselect = (countryId: string) => {
        setFormData(prevData => ({
            ...prevData,
            countries: prevData.countries.filter(id => id !== countryId),
        }));
    };

    const showSnackbar = (message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
    };

    const handleNextFromBasic = () => {
        const result = validateStep(1, {
            name: formData.name ?? '',
            description: formData.description ?? '',
            countries: formData.countries ?? [],
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
            setStep1Errors(requiredMessages);
            setStep1FirstErrorField(result.errors[0]?.field ?? null);
            showSnackbar('Заполните обязательные поля на шаге "Основное", чтобы перейти дальше.');
            return;
        }

        setStep1Errors([]);
        setStep1FirstErrorField(null);
        setCurrentStep(2);
    };

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
                formData={formData}
                setFormData={setFormData}
                filters={filters}
                travelDataOld={travelDataOld}
                isSuperAdmin={isSuperAdmin}
                isMobile={isMobile}
                menuVisible={menuVisible}
                setMenuVisible={setMenuVisible}
                onManualSave={handleManualSave}
                snackbarVisible={snackbarVisible}
                snackbarMessage={snackbarMessage}
                onDismissSnackbar={() => setSnackbarVisible(false)}
                onGoNext={handleNextFromBasic}
                stepErrors={step1Errors}
                firstErrorField={step1FirstErrorField}
                autosaveStatus={autosaveStatus}
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
                    setFormData(prev => ({
                        ...prev,
                        coordsMeTravel: updatedMarkers as any,
                    }));
                }}
                categoryTravelAddress={filters?.categoryTravelAddress || []}
                countries={filters?.countries || []}
                isFiltersLoading={!filters}
                selectedCountryIds={formData.countries}
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
                    const validation = validateStep(2, { coordsMeTravel: (formData as any).coordsMeTravel } as any, markers);
                    const hadErrors = !validation.isValid;
                    trackWizardEvent('wizard_step_next_click', {
                        step_from: 2,
                        step_to: 3,
                        had_errors: hadErrors,
                        // На шаге 2 ошибок по полям нет, только общий маркер маршрута
                        error_fields: validation.errors.map((e: ValidationError) => e.field),
                    });
                    if (!validation.isValid) {
                        showSnackbar('Добавьте хотя бы одну точку маршрута, чтобы перейти к медиа');
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
                formData={formData}
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
                formData={formData}
                setFormData={setFormData}
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
            formData={formData}
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
    filtersScroll: { maxHeight: '80vh' },
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
        year: yearStr,
        number_days: daysStr,
        number_peoples: peoplesStr,
        moderation: (travel as any).moderation ?? false,
        publish: (travel as any).publish ?? false,
        visa: (travel as any).visa ?? false,
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
