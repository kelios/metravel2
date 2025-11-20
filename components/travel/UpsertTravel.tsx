import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Snackbar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

import {
    fetchAllCountries,
    fetchFilters,
    fetchTravel,
    saveFormData,
} from '@/src/api/travels';
import { TravelFormData, MarkerData, Travel } from '@/src/types/types';
import { useAuth } from '@/context/AuthContext';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import ContentUpsertSection from '@/components/travel/ContentUpsertSection';
import GallerySection from '@/components/travel/GallerySection';
import { useAutoSaveForm } from '@/hooks/useAutoSaveForm';

export default function UpsertTravel() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { userId, isAuthenticated } = useAuth();
    const isNew = !id;
    const windowWidth = Dimensions.get('window').width;
    const isMobile = windowWidth <= 768;

    const [menuVisible, setMenuVisible] = useState(!isMobile);
    const [markers, setMarkers] = useState<MarkerData[]>([]);
    const [travelDataOld, setTravelDataOld] = useState<Travel | null>(null);
    const [filters, setFilters] = useState(initFilters());
    const [formData, setFormData] = useState<TravelFormData>(getEmptyFormData(isNew ? null : String(id)));
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    const saveFormDataWithId = async (data: TravelFormData) => {
        const cleanedData = cleanEmptyFields({ ...data, id: data.id || null });
        return await saveFormData(cleanedData);
    };

    const applySavedData = (savedData: TravelFormData) => {
        setFormData(savedData);
        setMarkers(savedData.coordsMeTravel || []);
        resetOriginalData(savedData);
    };

    const { resetOriginalData } = useAutoSaveForm(formData, {
        debounce: 5000,
        onSave: saveFormDataWithId,
        onSuccess: applySavedData,
        onError: () => showSnackbar('Ошибка автосохранения'),
    });

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const flag = await AsyncStorage.getItem('isSuperuser');
                if (isMounted) setIsSuperAdmin(flag === 'true');
                const [filtersData, countryData] = await Promise.all([
                    fetchFilters(),
                    fetchAllCountries(),
                ]);
                if (isMounted) {
                    setFilters({ ...filtersData, countries: countryData });
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
                setIsLoading(false);
            }
        }
        return () => {
            isMounted = false;
        };
    }, [id, isNew, isAuthenticated, userId, isSuperAdmin, router]);

    const handleManualSave = async () => {
        try {
            const savedData = await saveFormDataWithId(formData);
            applySavedData(savedData);
            if (isNew && savedData.id) router.replace(`/travel/${savedData.id}`);
            showSnackbar('Сохранено успешно!');
        } catch {
            showSnackbar('Ошибка сохранения');
        }
    };

    const loadTravelData = async (travelId: string) => {
        try {
            setIsLoading(true);
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
        setTravelDataOld(travelData);
        setFormData(transformed);
        setMarkers(transformed.coordsMeTravel || []);
        resetOriginalData(transformed);
        } catch (error) {
            console.error('Ошибка загрузки путешествия:', error);
            Toast.show({
                type: 'error',
                text1: 'Ошибка загрузки',
                text2: 'Не удалось загрузить путешествие',
            });
            router.replace('/');
        } finally {
            setIsLoading(false);
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

    // Показываем загрузку или блокируем доступ
    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeContainer}>
                <View style={styles.loadingContainer}>
                    <Button loading mode="text">Загрузка...</Button>
                </View>
            </SafeAreaView>
        );
    }

    if (!hasAccess) {
        return null; // Редирект уже произошел
    }

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={[styles.mainWrapper, isMobile && styles.mainWrapperMobile]}>
                <ScrollView style={styles.contentColumn}>
                    <ContentUpsertSection
                        formData={formData}
                        setFormData={setFormData}
                        markers={markers}
                        setMarkers={setMarkers}
                        filters={filters}
                        handleCountrySelect={handleCountrySelect}
                        handleCountryDeselect={handleCountryDeselect}
                    />
                    <GallerySection formData={formData} travelDataOld={travelDataOld} />
                </ScrollView>
                {isMobile ? (
                    <View style={styles.mobileFiltersWrapper}>
                        {menuVisible && (
                            <ScrollView style={styles.filtersScroll}>
                                <FiltersUpsertComponent
                                    filters={filters}
                                    formData={formData}
                                    setFormData={setFormData}
                                    travelDataOld={travelDataOld}
                                    onClose={() => setMenuVisible(false)}
                                    isSuperAdmin={isSuperAdmin}
                                    onSave={handleManualSave}
                                />
                            </ScrollView>
                        )}
                    </View>
                ) : (
                    <View style={styles.filtersColumn}>
                        <FiltersUpsertComponent
                            filters={filters}
                            formData={formData}
                            setFormData={setFormData}
                            travelDataOld={travelDataOld}
                            onClose={() => setMenuVisible(false)}
                            isSuperAdmin={isSuperAdmin}
                            onSave={handleManualSave}
                        />
                    </View>
                )}
            </View>
            {isMobile && (
                <View style={styles.mobileActionBar}>
                    <Button
                        mode="contained"
                        icon="content-save"
                        onPress={handleManualSave}
                        style={styles.saveButtonMobile}
                    >
                        Сохранить
                    </Button>
                    <Button
                        mode="outlined"
                        icon="filter-outline"
                        onPress={() => setMenuVisible(!menuVisible)}
                        style={styles.filterButton}
                    >
                        Боковая панель
                    </Button>
                </View>
            )}
            <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)}>
                {snackbarMessage}
            </Snackbar>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    mainWrapper: { flex: 1, flexDirection: 'row' },
    mainWrapperMobile: { flexDirection: 'column' },
    contentColumn: { flex: 1 },
    filtersColumn: { width: 320, borderLeftWidth: 1, padding: 12, borderColor: '#ddd' },
    filtersScroll: { maxHeight: '80vh' },
    mobileFiltersWrapper: { padding: 12 },
    mobileActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 12,
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
        alignItems: 'center',
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

function transformTravelToFormData(travel: Travel): TravelFormData {
    return {
        ...getEmptyFormData(String(travel.id)),
        ...travel,
        moderation: travel.moderation ?? false,
        publish: travel.publish ?? false,
        visa: travel.visa ?? false,
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
