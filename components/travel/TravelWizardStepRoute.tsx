import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, View, StyleSheet, Text, ScrollView, TextInput, Platform, findNodeHandle, UIManager } from 'react-native';
import { Button } from '@/src/ui/paper';
import { useRouter } from 'expo-router';

import LocationSearchInput from '@/components/travel/LocationSearchInput';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { MarkerData, TravelFormData } from '@/src/types/types';
import MultiSelectField from '@/components/MultiSelectField';
import { matchCountryId, buildAddressFromGeocode } from '@/components/travel/WebMapComponent';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import type { TravelFilters } from '@/hooks/useTravelFilters';
import { showToast } from '@/src/utils/toast';
import { extractGpsFromImageFile } from '@/src/utils/exifGps';
import { registerPendingImageFile, removePendingImageFile } from '@/src/utils/pendingImageFiles';

async function showToastMessage(payload: any) {
    await showToast(payload);
}

const WebMapComponent = Platform.OS === 'web'
    ? React.lazy(() => import('@/components/travel/WebMapComponent'))
    : null;

interface TravelWizardStepRouteProps {
    currentStep: number;
    totalSteps: number;
    markers: MarkerData[];
    setMarkers: (data: MarkerData[]) => void;
    categoryTravelAddress: TravelFilters['categoryTravelAddress'];
    countries: TravelFilters['countries'];
    travelId?: string | null;
    selectedCountryIds: string[];
    onCountrySelect: (countryId: string) => void;
    onCountryDeselect: (countryId: string) => void;
    onBack: () => void;
    onNext: () => void;
    onManualSave?: () => Promise<TravelFormData | void>;
    isFiltersLoading?: boolean;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    onStepSelect?: (step: number) => void;
    onPreview?: () => void;
    onOpenPublic?: () => void;
}

const MAP_COACHMARK_STORAGE_KEY = 'travelWizardRouteMapCoachmarkDismissed';

const TravelWizardStepRoute: React.FC<TravelWizardStepRouteProps> = ({
    currentStep,
    totalSteps,
    markers,
    setMarkers,
    categoryTravelAddress,
    countries,
    travelId: _travelId,
    selectedCountryIds,
    onCountrySelect,
    onCountryDeselect,
    onBack,
    onNext,
    onManualSave,
    isFiltersLoading,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
    onStepSelect,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const router = useRouter();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);

    const scrollRef = useRef<ScrollView | null>(null);
    const markersListAnchorRef = useRef<View | null>(null);
    const countriesAnchorRef = useRef<View | null>(null);
    const markersRef = useRef<MarkerData[]>(markers || []);

    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const hasAtLeastOnePoint = useMemo(() => markers && markers.length > 0, [markers]);

    useEffect(() => {
        markersRef.current = markers || [];
    }, [markers]);

    // Валидация шага 2
    const validation = useMemo(() => {
        return validateStep(2, {
            coordsMeTravel: markers,
            countries: selectedCountryIds,
        } as any);
    }, [markers, selectedCountryIds]);

    const [isCoachmarkVisible, setIsCoachmarkVisible] = useState(false);
    const [isManualPointVisible, setIsManualPointVisible] = useState(false);
    const [manualCoords, setManualCoords] = useState('');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [manualPhotoPreviewUrl, setManualPhotoPreviewUrl] = useState<string | null>(null);
    const manualPhotoInputRef = useRef<any>(null);

    const handleQuickDraft = useCallback(async () => {
        if (!onManualSave) return;

        try {
            const saved = await onManualSave();
            const resolvedId = (saved as any)?.id ?? null;
            if (!resolvedId) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
                return;
            }
            void showToastMessage({
                type: 'success',
                text1: 'Черновик сохранен',
                text2: 'Вы можете вернуться к нему позже',
            });

            setTimeout(() => {
                router.push('/metravel');
            }, 400);
        } catch {
            void showToastMessage({
                type: 'error',
                text1: 'Ошибка сохранения',
                text2: 'Попробуйте еще раз',
            });
        }
    }, [onManualSave, router]);

    useEffect(() => {
        if (!focusAnchorId) return;
        if (focusAnchorId !== 'markers-list-root' && focusAnchorId !== 'travelwizard-route-countries') return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = focusAnchorId === 'travelwizard-route-countries'
            ? countriesAnchorRef.current
            : markersListAnchorRef.current;
        if (!scrollNode || !anchorNode) {
            onAnchorHandled?.();
            return;
        }

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) {
            onAnchorHandled?.();
            return;
        }

        setTimeout(() => {
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => onAnchorHandled?.(),
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                    onAnchorHandled?.();
                },
            );
        }, 50);
    }, [focusAnchorId, onAnchorHandled]);

    const parseCoordsPair = useCallback((raw: string): { lat: number; lng: number } | null => {
        // Accept common copy/paste formats:
        // - "49.609645, 18.845693"
        // - "49.609645 18.845693"
        // - "49.609645;18.845693"
        const normalized = String(raw || '').trim();
        if (!normalized) return null;

        const parts = normalized
            .split(/[\s,;]+/)
            .map(p => p.trim())
            .filter(Boolean);

        if (parts.length < 2) return null;

        const lat = Number(parts[0]);
        const lng = Number(parts[1]);

        const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
        if (!latOk || !lngOk) return null;

        return { lat, lng };
    }, []);

    useEffect(() => {
        if (hasAtLeastOnePoint) {
            setIsCoachmarkVisible(false);
            return;
        }

        if (typeof window === 'undefined') {
            setIsCoachmarkVisible(true);
            return;
        }

        try {
            const dismissed = window.localStorage.getItem(MAP_COACHMARK_STORAGE_KEY) === '1';
            setIsCoachmarkVisible(!dismissed);
        } catch {
            setIsCoachmarkVisible(true);
        }
    }, [hasAtLeastOnePoint]);

    const handleMarkersChange = useCallback(
        (updated: MarkerData[]) => {
            setMarkers(updated);
        },
        [setMarkers],
    );

    // ✅ ФАЗА 2: Handler для выбора места из поиска
    const handleLocationSelect = useCallback(async (result: any) => {
        const lat = Number(result.lat);
        const lng = Number(result.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        // Определяем страну из результата поиска
        let derivedCountryId: number | null = null;
        const countryCode = result.address?.country_code;
        const countryName = result.address?.country;

        if (countryCode || countryName) {
            derivedCountryId = matchCountryId(
                countryName || '',
                countries || [],
                countryCode
            );
        }

        // Форматируем адрес
        // Nominatim возвращает `display_name` уже с объектом (например, "Эйфелева башня, ..."),
        // поэтому сохраняем его. Фолбэк — более короткое представление.
        const fullDisplayName = typeof result.display_name === 'string' ? result.display_name.trim() : '';
        const fallbackParts: string[] = [];
        if (result.address) {
            const { city, town, village, state, country } = result.address;
            const locality = city || town || village;
            if (locality) fallbackParts.push(locality);
            if (state && state !== locality) fallbackParts.push(state);
            if (country) fallbackParts.push(country);
        }
        const fallbackAddress = fallbackParts.length > 0 ? fallbackParts.join(', ') : '';
        const address = fullDisplayName || fallbackAddress;

        // Создаем новый маркер
        const newMarker: MarkerData = {
            id: null,
            lat,
            lng,
            address,
            country: derivedCountryId,
            categories: [],
            image: null,
        };

        // Добавляем маркер
        const updated = [...(markersRef.current || []), newMarker];
        setMarkers(updated);

        // Автоматически добавляем страну в выбранные
        if (derivedCountryId !== null) {
            const countryIdStr = String(derivedCountryId);
            if (!selectedCountryIds.includes(countryIdStr)) {
                onCountrySelect(countryIdStr);
            }
        }
    }, [setMarkers, countries, selectedCountryIds, onCountrySelect]);

    const dismissCoachmark = useCallback(() => {
        setIsCoachmarkVisible(false);
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(MAP_COACHMARK_STORAGE_KEY, '1');
        } catch {
            // ignore
        }
    }, []);

    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        // Use a CORS-friendly provider first, then fall back to Nominatim
        try {
            const primary = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ru`
            );
            if (primary.ok) {
                return await primary.json();
            }
        } catch {
            // ignore and fall back
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`
            );
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }, []);

    const handleAddManualPoint = useCallback(async () => {
        const parsedFromPair = parseCoordsPair(manualCoords);
        const lat = parsedFromPair?.lat ?? Number(manualLat);
        const lng = parsedFromPair?.lng ?? Number(manualLng);

        const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
        
        if (!latOk || !lngOk) {
            void showToastMessage({
                type: 'error',
                text1: 'Некорректные координаты',
                text2: 'Проверьте широту (-90..90) и долготу (-180..180)',
            });
            return;
        }

        let address = '';
        let derivedCountryId: string | null = null;

        try {
            const data = await reverseGeocode(lat, lng);
            const countryName =
                data?.address?.country ||
                data?.countryName ||
                data?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name ||
                '';
            const countryCode =
                data?.address?.country_code ||
                data?.countryCode ||
                data?.address?.ISO3166_1_alpha2 ||
                null;
            
            let matchedCountry = null;
            if (countryName || countryCode) {
                const matchedId = matchCountryId(countryName || '', countries || [], countryCode);
                if (matchedId != null) {
                    derivedCountryId = String(matchedId);
                    matchedCountry = countries.find((c: any) => Number(c?.country_id) === matchedId);
                }
            }
            
            // Use buildAddressFromGeocode to get properly formatted address
            address = buildAddressFromGeocode(data, { lat, lng }, matchedCountry);
        } catch {
            // ignore
        }

        const newMarker: MarkerData = {
            id: null,
            lat,
            lng,
            address,
            categories: [],
            image: manualPhotoPreviewUrl,
            country: derivedCountryId ? Number(derivedCountryId) : null,
        };

        if (derivedCountryId && !selectedCountryIds.includes(derivedCountryId)) {
            onCountrySelect(derivedCountryId);
        }

        handleMarkersChange([...(markers || []), newMarker]);
        setManualCoords('');
        setManualLat('');
        setManualLng('');
        setManualPhotoPreviewUrl(null);
        setIsManualPointVisible(false);
        if (manualPhotoPreviewUrl && onManualSave) {
            setTimeout(() => {
                try {
                    const res = onManualSave();
                    if (res && typeof (res as any).catch === 'function') {
                        (res as any).catch(() => null);
                    }
                } catch {
                    // ignore
                }
            }, 0);
        }
    }, [countries, handleMarkersChange, manualCoords, manualLat, manualLng, manualPhotoPreviewUrl, onManualSave, parseCoordsPair, reverseGeocode, selectedCountryIds, onCountrySelect, markers]);

    const cleanupManualPhotoPreview = useCallback(() => {
        if (!manualPhotoPreviewUrl) return;
        removePendingImageFile(manualPhotoPreviewUrl);
        try {
            if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
                URL.revokeObjectURL(manualPhotoPreviewUrl);
            }
        } catch {
            // noop
        }
        setManualPhotoPreviewUrl(null);
    }, [manualPhotoPreviewUrl]);

    const handleManualPhotoPick = useCallback(() => {
        if (Platform.OS !== 'web') return;
        manualPhotoInputRef.current?.click?.();
    }, []);

    const handleManualPhotoSelected = useCallback(async (e: any) => {
        if (Platform.OS !== 'web') return;
        const file: File | null = e?.target?.files?.[0] ?? null;
        try {
            if (e?.target) e.target.value = '';
        } catch {
            // noop
        }
        if (!file) return;

        const coords = await extractGpsFromImageFile(file);
        if (!coords) {
            void showToastMessage({
                type: 'error',
                text1: 'Нет геолокации в фото',
                text2: 'В этом файле не найден GPS в EXIF. Попробуйте другое фото или введите координаты вручную.',
            });
            return;
        }

        cleanupManualPhotoPreview();

        setManualLat(String(coords.lat));
        setManualLng(String(coords.lng));
        setManualCoords(`${coords.lat}, ${coords.lng}`);

        try {
            const previewUrl = URL.createObjectURL(file);
            registerPendingImageFile(previewUrl, file);
            setManualPhotoPreviewUrl(previewUrl);
        } catch {
            // ignore preview
        }

        void showToastMessage({
            type: 'success',
            text1: 'Координаты заполнены',
            text2: 'Взяли GPS из EXIF фотографии.',
        });
    }, [cleanupManualPhotoPreview]);

    const handleCountriesFilterChange = useCallback((value: string | number | Array<string | number>) => {
        const prev = selectedCountryIds || [];
        const next = (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);

        const added = next.filter(id => !prev.includes(id));
        const removed = prev.filter(id => !next.includes(id));

        added.forEach(onCountrySelect);

        if (removed.length) {
            const removedSet = new Set(removed.map(String));
            const updatedMarkers = (markers || []).filter((m: any) => {
                const markerCountry = m?.country;
                if (markerCountry == null) return true;
                return !removedSet.has(String(markerCountry));
            });

            if (updatedMarkers.length !== (markers || []).length) {
                setMarkers(updatedMarkers);
            }
        }

        removed.forEach(onCountryDeselect);
    }, [markers, onCountryDeselect, onCountrySelect, selectedCountryIds, setMarkers]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? 'Маршрут путешествия'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    warningCount={validation.warnings.length}
                    autosaveBadge={autosaveBadge}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'К медиа'}
                    onSave={onManualSave}
                    onQuickDraft={onManualSave ? handleQuickDraft : undefined}
                    quickDraftLabel="Быстрый черновик"
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                />

                {!isMobile && validation.errors.length > 0 && (
                    <View style={styles.validationSummaryWrapper}>
                        <ValidationSummary
                            errorCount={validation.errors.length}
                            warningCount={validation.warnings.length}
                        />
                    </View>
                )}

                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                    testID="travel-wizard.step-route.scroll"
                    accessibilityLabel="travel-wizard.step-route.scroll"
                >
                    <View style={styles.contentInner}>
                        <View style={styles.card}>
                            <View style={[styles.mapHeader, isMobile && styles.mapHeaderMobile]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.mapTitle}>Ключевые точки маршрута</Text>
                                    <Text style={styles.mapHint}>
                                        Добавьте точки маршрута на карте. Для модерации потребуется минимум одна точка.
                                    </Text>
                                </View>
                                <Text style={styles.mapCount}>Точек: {markers?.length ?? 0}</Text>
                            </View>

                            {isCoachmarkVisible && !hasAtLeastOnePoint && (
                                <View
                                    style={styles.coachmark}
                                    testID="travel-wizard.step-route.coachmark"
                                    accessibilityLabel="travel-wizard.step-route.coachmark"
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.coachmarkTitle}>Как добавить первую точку</Text>
                                        <Text style={styles.coachmarkBody}>
                                            Кликните по карте — точка добавится автоматически.
                                        </Text>
                                    </View>
                                    <Button
                                        mode="text"
                                        onPress={dismissCoachmark}
                                        compact
                                        testID="travel-wizard.step-route.coachmark.dismiss"
                                        accessibilityLabel="travel-wizard.step-route.coachmark.dismiss"
                                    >
                                        Понятно
                                    </Button>
                                </View>
                            )}

                            {/* ✅ ФАЗА 2: Поиск мест на карте */}
                            <LocationSearchInput
                                onLocationSelect={handleLocationSelect}
                                placeholder="Поиск места (например: Эйфелева башня, Париж)"
                            />

                            <View style={[styles.manualPointRow, isMobile && styles.manualPointRowMobile]}>
                                <Button
                                    mode={isManualPointVisible ? 'contained' : 'outlined'}
                                    onPress={() => {
                                        setIsManualPointVisible((v) => {
                                            const next = !v;
                                            if (!next) cleanupManualPhotoPreview();
                                            return next;
                                        });
                                    }}
                                    compact
                                    testID="travel-wizard.step-route.manual.toggle"
                                    accessibilityLabel="travel-wizard.step-route.manual.toggle"
                                >
                                    Добавить точку вручную
                                </Button>
                            </View>

                            {isManualPointVisible && (
                                <View
                                    style={styles.manualPointCard}
                                    testID="travel-wizard.step-route.manual.panel"
                                    accessibilityLabel="travel-wizard.step-route.manual.panel"
                                >
                                    {Platform.OS === 'web' && (
                                        <View style={styles.manualPhotoRow}>
                                            <Button
                                                mode="outlined"
                                                onPress={handleManualPhotoPick}
                                                compact
                                                testID="travel-wizard.step-route.manual.photo.pick"
                                                accessibilityLabel="travel-wizard.step-route.manual.photo.pick"
                                            >
                                                Координаты из фото
                                            </Button>
                                            {manualPhotoPreviewUrl ? (
                                                <Button
                                                    mode="text"
                                                    onPress={cleanupManualPhotoPreview}
                                                    compact
                                                    testID="travel-wizard.step-route.manual.photo.clear"
                                                    accessibilityLabel="travel-wizard.step-route.manual.photo.clear"
                                                >
                                                    Убрать фото
                                                </Button>
                                            ) : null}
                                            <input
                                                ref={manualPhotoInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleManualPhotoSelected}
                                                style={styles.manualHiddenInput as any}
                                            />
                                            <Text style={styles.manualPhotoHint}>
                                                Фото прикрепится к точке и загрузится после автосохранения.
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.manualCoordsWrapper}>
                                        <Text style={styles.manualPointLabel}>Координаты (lat, lng)</Text>
                                        <TextInput
                                            value={manualCoords}
                                            onChangeText={(value) => {
                                                setManualCoords(value);
                                                const parsed = parseCoordsPair(value);
                                                if (parsed) {
                                                    setManualLat(String(parsed.lat));
                                                    setManualLng(String(parsed.lng));
                                                }
                                            }}
                                            placeholder="49.609645, 18.845693"
                                            style={styles.manualPointInput}
                                            inputMode="text"
                                            testID="travel-wizard.step-route.manual.coords"
                                            accessibilityLabel="travel-wizard.step-route.manual.coords"
                                        />
                                    </View>

                                    <View style={styles.manualPointInputsRow}>
                                        <View style={styles.manualPointInputWrapper}>
                                            <Text style={styles.manualPointLabel}>Широта</Text>
                                            <TextInput
                                                value={manualLat}
                                                onChangeText={setManualLat}
                                                placeholder="например 53.90"
                                                style={styles.manualPointInput}
                                                inputMode="decimal"
                                                testID="travel-wizard.step-route.manual.lat"
                                                accessibilityLabel="travel-wizard.step-route.manual.lat"
                                            />
                                        </View>
                                        <View style={styles.manualPointInputWrapper}>
                                            <Text style={styles.manualPointLabel}>Долгота</Text>
                                            <TextInput
                                                value={manualLng}
                                                onChangeText={setManualLng}
                                                placeholder="например 27.56"
                                                style={styles.manualPointInput}
                                                inputMode="decimal"
                                                testID="travel-wizard.step-route.manual.lng"
                                                accessibilityLabel="travel-wizard.step-route.manual.lng"
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.manualPointActionsRow}>
                                        <Button
                                            mode="contained"
                                            onPress={handleAddManualPoint}
                                            compact
                                            testID="travel-wizard.step-route.manual.add"
                                            accessibilityLabel="travel-wizard.step-route.manual.add"
                                        >
                                            Добавить
                                        </Button>
                                        <Button
                                            mode="text"
                                            onPress={() => {
                                                cleanupManualPhotoPreview();
                                                setIsManualPointVisible(false);
                                            }}
                                            compact
                                            testID="travel-wizard.step-route.manual.cancel"
                                            accessibilityLabel="travel-wizard.step-route.manual.cancel"
                                        >
                                            Отмена
                                        </Button>
                                    </View>
                                </View>
                            )}

                            <View style={[styles.filtersRow, isMobile && styles.filtersRowMobile]}>
                                <View ref={countriesAnchorRef} nativeID="travelwizard-route-countries" />
                                <View style={styles.filterItem}>
                                    {isFiltersLoading ? (
                                        <View style={styles.filtersSkeleton}>
                                            <View style={styles.filtersSkeletonLabel} />
                                            <View style={styles.filtersSkeletonInput} />
                                        </View>
                                    ) : (
                                        <MultiSelectField
                                            label="Страны маршрута"
                                            items={countries}
                                            value={selectedCountryIds}
                                            onChange={handleCountriesFilterChange}
                                            labelField="title_ru"
                                            valueField="country_id"
                                            disabled={true}
                                            testID="travel-wizard.step-route.countries"
                                            accessibilityLabel="travel-wizard.step-route.countries"
                                        />
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* карта и список точек */}
                        <View style={styles.card}>
                            <View ref={markersListAnchorRef} nativeID="markers-list-root" />
                            <View style={[styles.mapContainer, isMobile && styles.mapContainerMobile]}>
                                {Platform.OS === 'web' && WebMapComponent ? (
                                    <Suspense
                                        fallback={
                                            <View style={styles.lazyFallback}>
                                                <Text style={styles.lazyFallbackText}>Загрузка карты…</Text>
                                            </View>
                                        }
                                    >
                                        <WebMapComponent
                                            markers={markers || []}
                                            onMarkersChange={handleMarkersChange}
                                            categoryTravelAddress={categoryTravelAddress}
                                            countrylist={countries}
                                            onCountrySelect={onCountrySelect}
                                            onCountryDeselect={onCountryDeselect}
                                            onRequestSaveDraft={onManualSave}
                                        />
                                    </Suspense>
                                ) : (
                                    <View style={styles.nativeMapPlaceholder}>
                                        <Text style={styles.nativeMapTitle}>Карта доступна в браузере</Text>
                                        <Text style={styles.nativeMapBody}>
                                            На мобильном приложении добавьте точки вручную (кнопка выше) и сохраните маршрут.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: colors.background,
        ...(Platform.OS === 'web'
            ? ({ height: '100vh', overflow: 'hidden' } as any)
            : null),
    },
    keyboardAvoid: { flex: 1 },
    validationSummaryWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    syncBadge: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: colors.successSoft,
        borderWidth: 1,
        borderColor: colors.successLight,
    },
    syncBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.successDark,
        fontWeight: '700',
    },
    headerActions: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    content: {
        flex: 1,
        paddingHorizontal: 8,
    },
    contentContainer: {
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    card: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: colors.boxShadows?.card ?? '0 2px 8px rgba(0,0,0,0.08)' } as any)
            : ((colors.shadows?.light ?? {}) as any)),
        overflow: 'hidden',
    },
    mapHeader: {
        paddingTop: 2,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mapHeaderMobile: {
        paddingTop: 10,
        paddingBottom: 8,
        alignItems: 'flex-start',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    coachmark: {
        marginBottom: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.infoSoft,
        borderWidth: 1,
        borderColor: colors.infoLight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    coachmarkTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.infoDark,
        marginBottom: 2,
    },
    coachmarkBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
    },
    manualPointRow: {
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    manualPointRowMobile: {
        paddingBottom: 10,
    },
    manualPointCard: {
        marginBottom: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    manualPhotoRow: {
        marginBottom: DESIGN_TOKENS.spacing.sm,
        gap: DESIGN_TOKENS.spacing.xs,
        ...(Platform.OS === 'web'
            ? ({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' } as any)
            : null),
    },
    manualHiddenInput: {
        display: 'none',
    },
    manualPhotoHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        ...(Platform.OS === 'web' ? ({ width: '100%' } as any) : null),
    },
    manualCoordsWrapper: {
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    manualPointInputsRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    manualPointInputWrapper: {
        flex: 1,
    },
    manualPointLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 6,
        fontWeight: '600',
    },
    manualPointInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: 10,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        backgroundColor: colors.surface,
    },
    manualPointActionsRow: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    mapTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    mapHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    mapCount: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
        color: colors.primary,
    },
    mapContainer: {
        marginTop: 4,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    mapContainerMobile: {
        marginTop: 6,
        paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    lazyFallback: {
        padding: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
    },
    lazyFallbackText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: '600',
    },
    nativeMapPlaceholder: {
        padding: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    nativeMapTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 6,
    },
    nativeMapBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        lineHeight: 18,
    },
    filtersRow: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingBottom: 8,
    },
    filtersRowMobile: {
        paddingBottom: 10,
    },
    filterItem: {
        flex: 1,
    },
    filtersSkeleton: {
        marginTop: 4,
        paddingVertical: 4,
    },
    filtersSkeletonLabel: {
        width: 120,
        height: 12,
        borderRadius: 4,
        backgroundColor: colors.borderLight,
        marginBottom: 8,
    },
    filtersSkeletonInput: {
        width: '100%',
        height: 40,
        borderRadius: 8,
        backgroundColor: colors.borderLight,
    },
});

export default React.memo(TravelWizardStepRoute);
