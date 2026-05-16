import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/ui/paper';

import MultiSelectField from '@/components/forms/MultiSelectField';
import LocationSearchInput from '@/components/travel/LocationSearchInput';
import TravelRouteFilesPanel from '@/components/travel/TravelRouteFilesPanel';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import type { TravelFilters } from '@/hooks/useTravelFilters';
import type { MarkerData, TravelFormData } from '@/types/types';
import { EXIF_IMAGE_INPUT_ACCEPT, extractGpsFromImageFile } from '@/utils/exifGps';
import { hasToastBeenShown } from '@/utils/errorHelpers';
import { buildAddressFromGeocode, matchCountryId } from '@/utils/geocodeHelpers';
import { registerPendingImageFile, removePendingImageFile } from '@/utils/pendingImageFiles';
import { showToastMessage } from '@/utils/toast';
import { validateStep } from '@/utils/travelWizardValidation';
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload';

const WebMapComponent = Platform.OS === 'web'
  ? React.lazy(() => import('@/components/travel/WebMapComponent'))
  : null;

interface StepMeta {
  title?: string;
  subtitle?: string;
  tipTitle?: string;
  tipBody?: string;
  nextLabel?: string;
}

interface TravelWizardStepRouteProps {
  currentStep: number;
  totalSteps: number;
  formData: TravelFormData;
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
  onManualSave?: (dataOverride?: TravelFormData) => Promise<TravelFormData | void>;
  isFiltersLoading?: boolean;
  stepMeta?: StepMeta;
  progress?: number;
  autosaveBadge?: string;
  focusAnchorId?: string | null;
  onAnchorHandled?: () => void;
  onStepSelect?: (step: number) => void;
  onPreview?: () => void;
  onOpenPublic?: () => void;
}

interface ManualPointState {
  coords: string;
  lat: string;
  lng: string;
  photoPreviewUrl: string | null;
}

interface ManualPointPanelProps {
  isVisible: boolean;
  state: ManualPointState;
  styles: Styles;
  fileInputRef: React.RefObject<any>;
  onToggle: () => void;
  onPhotoPick: () => void;
  onPhotoSelected: (event: any) => void;
  onClearPhoto: () => void;
  onCoordsChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

interface CountriesFieldProps {
  countries: TravelFilters['countries'];
  isFiltersLoading?: boolean;
  selectedCountryIds: string[];
  styles: Styles;
  onChange: (value: string | number | Array<string | number>) => void;
}

interface RouteMapCardProps {
  categoryTravelAddress: TravelFilters['categoryTravelAddress'];
  countries: TravelFilters['countries'];
  markers: MarkerData[];
  styles: Styles;
  isCompactLayout: boolean;
  anchorRef: React.RefObject<View | null>;
  onMarkersChange: (markers: MarkerData[]) => void;
  onCountrySelect: (countryId: string) => void;
  onCountryDeselect: (countryId: string) => void;
  onPhotoMarkerReady: (payload: { markers: MarkerData[]; derivedCountryId: number | null }) => void;
  onMarkerEditSave: (markers: MarkerData[]) => void;
}

type Styles = ReturnType<typeof createStyles>;

const MAP_COACHMARK_STORAGE_KEY = 'travelWizardRouteMapCoachmarkDismissed';
const ROUTE_MARKERS_ANCHOR_ID = 'markers-list-root';
const ROUTE_COUNTRIES_ANCHOR_ID = 'travelwizard-route-countries';
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const DEFAULT_TITLE = 'Маршрут путешествия';
const DEFAULT_NEXT_LABEL = 'К медиа';
const EMPTY_MANUAL_POINT: ManualPointState = {
  coords: '',
  lat: '',
  lng: '',
  photoPreviewUrl: null,
};

const toStringIds = (ids: unknown[] | undefined | null) => (ids || []).map(String).filter(Boolean);

const getProgressPercent = (progress: number) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  return Math.round(clampedProgress * 100);
};

const parseCoordsPair = (raw: string): { lat: number; lng: number } | null => {
  const parts = String(raw || '')
    .trim()
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;

  return latOk && lngOk ? { lat, lng } : null;
};

const isValidCoordinate = (lat: number, lng: number) => (
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180
);

const getSearchResultAddress = (result: any) => {
  const displayName = typeof result?.display_name === 'string' ? result.display_name.trim() : '';
  if (displayName) return displayName;

  const address = result?.address ?? {};
  const locality = address.city || address.town || address.village;
  return [locality, address.state, address.country].filter(Boolean).join(', ');
};

const getMatchedCountry = (countryId: string | null, countries: TravelFilters['countries']) => {
  if (!countryId) return null;
  return (countries || []).find((country: any) => Number(country?.country_id) === Number(countryId)) ?? null;
};

const getReverseGeocodeCountry = (data: any) => ({
  name:
    data?.address?.country ||
    data?.countryName ||
    data?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name ||
    '',
  code:
    data?.address?.country_code ||
    data?.countryCode ||
    data?.address?.ISO3166_1_alpha2 ||
    null,
});

function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function revokeManualPreview(previewUrl: string | null) {
  if (!previewUrl) return;

  removePendingImageFile(previewUrl);
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previewUrl);
    }
  } catch {
    // noop
  }
}

function useRouteAnchorScroll({
  focusAnchorId,
  onAnchorHandled,
}: {
  focusAnchorId?: string | null;
  onAnchorHandled?: () => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const markersListAnchorRef = useRef<View | null>(null);
  const countriesAnchorRef = useRef<View | null>(null);

  useEffect(() => {
    if (!focusAnchorId) return;
    if (focusAnchorId !== ROUTE_MARKERS_ANCHOR_ID && focusAnchorId !== ROUTE_COUNTRIES_ANCHOR_ID) return;

    if (Platform.OS === 'web') {
      onAnchorHandled?.();
      return;
    }

    const scrollNode = scrollRef.current;
    const anchorNode = focusAnchorId === ROUTE_COUNTRIES_ANCHOR_ID
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

    const timeoutId = setTimeout(() => {
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

    return () => clearTimeout(timeoutId);
  }, [focusAnchorId, onAnchorHandled]);

  return { scrollRef, markersListAnchorRef, countriesAnchorRef };
}

function useRouteCoachmark(hasPoints: boolean) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (hasPoints) {
      setIsVisible(false);
      return;
    }

    if (typeof window === 'undefined') {
      setIsVisible(true);
      return;
    }

    try {
      setIsVisible(window.localStorage.getItem(MAP_COACHMARK_STORAGE_KEY) !== '1');
    } catch {
      setIsVisible(true);
    }
  }, [hasPoints]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(MAP_COACHMARK_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  return { isVisible, dismiss };
}

function useManualPointForm() {
  const [isPanelVisible, setPanelVisible] = useState(false);
  const [state, setState] = useState<ManualPointState>(EMPTY_MANUAL_POINT);
  const fileInputRef = useRef<any>(null);
  const latestPreviewRef = useLatestRef(state.photoPreviewUrl);

  const clearPhoto = useCallback(() => {
    setState((current) => {
      revokeManualPreview(current.photoPreviewUrl);
      return { ...current, photoPreviewUrl: null };
    });
  }, []);

  const reset = useCallback(() => {
    setState((current) => {
      revokeManualPreview(current.photoPreviewUrl);
      return EMPTY_MANUAL_POINT;
    });
  }, []);

  const hidePanel = useCallback(() => {
    reset();
    setPanelVisible(false);
  }, [reset]);

  const togglePanel = useCallback(() => {
    setPanelVisible((current) => {
      if (current) reset();
      return !current;
    });
  }, [reset]);

  const setCoords = useCallback((coords: string) => {
    const parsed = parseCoordsPair(coords);
    setState((current) => ({
      ...current,
      coords,
      lat: parsed ? String(parsed.lat) : current.lat,
      lng: parsed ? String(parsed.lng) : current.lng,
    }));
  }, []);

  const setLat = useCallback((lat: string) => {
    setState((current) => ({ ...current, lat }));
  }, []);

  const setLng = useCallback((lng: string) => {
    setState((current) => ({ ...current, lng }));
  }, []);

  const setPhotoPreview = useCallback((photoPreviewUrl: string | null) => {
    setState((current) => {
      revokeManualPreview(current.photoPreviewUrl);
      return { ...current, photoPreviewUrl };
    });
  }, []);

  const setPhotoCoordinates = useCallback((lat: number, lng: number) => {
    setState((current) => ({
      ...current,
      lat: String(lat),
      lng: String(lng),
      coords: `${lat}, ${lng}`,
    }));
  }, []);

  useEffect(() => () => {
    revokeManualPreview(latestPreviewRef.current);
  }, [latestPreviewRef]);

  return {
    fileInputRef,
    isPanelVisible,
    state,
    clearPhoto,
    hidePanel,
    reset,
    setCoords,
    setLat,
    setLng,
    setPanelVisible,
    setPhotoCoordinates,
    setPhotoPreview,
    togglePanel,
  };
}

async function reverseGeocode(lat: number, lng: number) {
  if (Platform.OS === 'web') return null;

  try {
    const primary = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ru`,
    );
    if (primary.ok) return await primary.json();
  } catch {
    // ignore and fall back
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`,
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

const RouteCoachmark = React.memo(function RouteCoachmark({
  styles,
  onDismiss,
}: {
  styles: Styles;
  onDismiss: () => void;
}) {
  return (
    <View
      style={styles.coachmark}
      testID="travel-wizard.step-route.coachmark"
      accessibilityLabel="travel-wizard.step-route.coachmark"
    >
      <View style={styles.flexFill}>
        <Text style={styles.coachmarkTitle}>Как добавить первую точку</Text>
        <Text style={styles.coachmarkBody}>Кликните по карте — точка добавится автоматически.</Text>
      </View>
      <Button
        mode="text"
        onPress={onDismiss}
        compact
        testID="travel-wizard.step-route.coachmark.dismiss"
        accessibilityLabel="travel-wizard.step-route.coachmark.dismiss"
      >
        Понятно
      </Button>
    </View>
  );
});

const ManualPointPanel = React.memo(function ManualPointPanel({
  isVisible,
  state,
  styles,
  fileInputRef,
  onToggle,
  onPhotoPick,
  onPhotoSelected,
  onClearPhoto,
  onCoordsChange,
  onLatChange,
  onLngChange,
  onAdd,
  onCancel,
}: ManualPointPanelProps) {
  return (
    <>
      <View style={styles.manualPointRow}>
        <Button
          mode={isVisible ? 'contained' : 'outlined'}
          onPress={onToggle}
          compact
          testID="travel-wizard.step-route.manual.toggle"
          accessibilityLabel="travel-wizard.step-route.manual.toggle"
        >
          Добавить точку вручную
        </Button>
      </View>

      {isVisible && (
        <View
          style={styles.manualPointCard}
          testID="travel-wizard.step-route.manual.panel"
          accessibilityLabel="travel-wizard.step-route.manual.panel"
        >
          {Platform.OS === 'web' && (
            <View style={styles.manualPhotoRow}>
              <Button
                mode="outlined"
                onPress={onPhotoPick}
                compact
                testID="travel-wizard.step-route.manual.photo.pick"
                accessibilityLabel="travel-wizard.step-route.manual.photo.pick"
              >
                Координаты из фото
              </Button>
              {state.photoPreviewUrl ? (
                <Button
                  mode="text"
                  onPress={onClearPhoto}
                  compact
                  testID="travel-wizard.step-route.manual.photo.clear"
                  accessibilityLabel="travel-wizard.step-route.manual.photo.clear"
                >
                  Убрать фото
                </Button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept={EXIF_IMAGE_INPUT_ACCEPT}
                onChange={onPhotoSelected}
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
              value={state.coords}
              onChangeText={onCoordsChange}
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
                value={state.lat}
                onChangeText={onLatChange}
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
                value={state.lng}
                onChangeText={onLngChange}
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
              onPress={onAdd}
              compact
              testID="travel-wizard.step-route.manual.add"
              accessibilityLabel="travel-wizard.step-route.manual.add"
            >
              Добавить
            </Button>
            <Button
              mode="text"
              onPress={onCancel}
              compact
              testID="travel-wizard.step-route.manual.cancel"
              accessibilityLabel="travel-wizard.step-route.manual.cancel"
            >
              Отмена
            </Button>
          </View>
        </View>
      )}
    </>
  );
});

const CountriesField = React.memo(function CountriesField({
  countries,
  isFiltersLoading,
  selectedCountryIds,
  styles,
  onChange,
}: CountriesFieldProps) {
  if (isFiltersLoading) {
    return (
      <View style={styles.filtersSkeleton}>
        <View style={styles.filtersSkeletonLabel} />
        <View style={styles.filtersSkeletonInput} />
      </View>
    );
  }

  return (
    <MultiSelectField
      label="Страны маршрута"
      items={countries}
      value={selectedCountryIds}
      onChange={onChange}
      labelField="title_ru"
      valueField="country_id"
      disabled={true}
      testID="travel-wizard.step-route.countries"
      accessibilityLabel="travel-wizard.step-route.countries"
    />
  );
});

const NativeMapPlaceholder = React.memo(function NativeMapPlaceholder({ styles }: { styles: Styles }) {
  return (
    <View style={styles.nativeMapPlaceholder}>
      <Text style={styles.nativeMapTitle}>Карта доступна в браузере</Text>
      <Text style={styles.nativeMapBody}>
        На мобильном приложении добавьте точки вручную (кнопка выше) и сохраните маршрут.
      </Text>
    </View>
  );
});

const RouteMapCard = React.memo(function RouteMapCard({
  categoryTravelAddress,
  countries,
  markers,
  styles,
  isCompactLayout,
  anchorRef,
  onMarkersChange,
  onCountrySelect,
  onCountryDeselect,
  onPhotoMarkerReady,
  onMarkerEditSave,
}: RouteMapCardProps) {
  return (
    <View style={styles.card}>
      <View ref={anchorRef} nativeID={ROUTE_MARKERS_ANCHOR_ID} />
      <View style={[styles.mapContainer, isCompactLayout && styles.mapContainerCompact]}>
        {Platform.OS === 'web' && WebMapComponent ? (
          <Suspense
            fallback={
              <View style={styles.lazyFallback}>
                <Text style={styles.lazyFallbackText}>Загрузка карты…</Text>
              </View>
            }
          >
            <WebMapComponent
              markers={markers}
              onMarkersChange={onMarkersChange}
              categoryTravelAddress={categoryTravelAddress}
              countrylist={countries}
              onCountrySelect={onCountrySelect}
              onCountryDeselect={onCountryDeselect}
              onPhotoMarkerReady={onPhotoMarkerReady}
              onMarkerEditSave={onMarkerEditSave}
            />
          </Suspense>
        ) : (
          <NativeMapPlaceholder styles={styles} />
        )}
      </View>
    </View>
  );
});

function TravelWizardStepRoute({
  currentStep,
  totalSteps,
  formData,
  markers,
  setMarkers,
  categoryTravelAddress,
  countries,
  travelId,
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
}: TravelWizardStepRouteProps) {
  const colors = useThemedColors();
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const markersRef = useLatestRef(markers);
  const {
    fileInputRef: manualPhotoInputRef,
    isPanelVisible: isManualPointVisible,
    state: manualPointState,
    clearPhoto: clearManualPhoto,
    hidePanel: hideManualPointPanel,
    reset: resetManualPoint,
    setCoords: setManualCoords,
    setLat: setManualLat,
    setLng: setManualLng,
    setPanelVisible: setManualPointVisible,
    setPhotoCoordinates: setManualPhotoCoordinates,
    setPhotoPreview: setManualPhotoPreview,
    togglePanel: toggleManualPointPanel,
  } = useManualPointForm();
  const hasPoints = markers.length > 0;
  const isCompactLayout = isPhone || isLargePhone;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progressPercent = getProgressPercent(progress);
  const { isVisible: isCoachmarkVisible, dismiss: dismissCoachmark } = useRouteCoachmark(hasPoints);
  const { scrollRef, markersListAnchorRef, countriesAnchorRef } = useRouteAnchorScroll({
    focusAnchorId,
    onAnchorHandled,
  });

  const validation = useMemo(() => validateStep(2, {
    coordsMeTravel: markers,
    countries: selectedCountryIds,
  } as any), [markers, selectedCountryIds]);

  const validationMessages = useMemo(
    () => ({
      errorMessages: validation.errors.map((error) => error.message),
      warningMessages: validation.warnings.map((warning) => warning.message),
    }),
    [validation],
  );

  const updateMarkers = useCallback((updatedMarkers: MarkerData[]) => {
    setMarkers(updatedMarkers);
  }, [setMarkers]);

  const saveRoute = useCallback(async (updatedMarkers: MarkerData[], countryIds = selectedCountryIds) => {
    if (!onManualSave) return;

    await onManualSave({
      ...formData,
      countries: toStringIds(countryIds),
      coordsMeTravel: updatedMarkers,
    });
  }, [formData, onManualSave, selectedCountryIds]);

  const handleQuickDraft = useCallback(async () => {
    if (!onManualSave) return;

    try {
      await onManualSave();
      void showToastMessage({
        type: 'success',
        text1: 'Черновик сохранен',
        text2: 'Вы можете вернуться к нему позже',
      });

      setTimeout(() => {
        router.push('/metravel');
      }, 250);
    } catch (error) {
      if (!hasToastBeenShown(error)) {
        void showToastMessage({
          type: 'error',
          text1: 'Ошибка сохранения',
          text2: 'Попробуйте еще раз',
        });
      }
    }
  }, [onManualSave, router]);

  const handlePhotoMarkerReady = useCallback(async (
    payload: { markers: MarkerData[]; derivedCountryId: number | null },
  ) => {
    updateMarkers(payload.markers);

    const nextCountries = payload.derivedCountryId != null
      ? Array.from(new Set([...toStringIds(selectedCountryIds), String(payload.derivedCountryId)]))
      : toStringIds(selectedCountryIds);

    await saveRoute(payload.markers, nextCountries);
  }, [saveRoute, selectedCountryIds, updateMarkers]);

  const handleMarkerEditSave = useCallback(async (updatedMarkers: MarkerData[]) => {
    updateMarkers(updatedMarkers);
    await saveRoute(updatedMarkers);
  }, [saveRoute, updateMarkers]);

  const handleLocationSelect = useCallback((result: any) => {
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!isValidCoordinate(lat, lng)) return;

    const countryName = result?.address?.country;
    const countryCode = result?.address?.country_code;
    const derivedCountryId = countryName || countryCode
      ? matchCountryId(countryName || '', countries || [], countryCode)
      : null;

    const newMarker: MarkerData = {
      id: null,
      lat,
      lng,
      address: getSearchResultAddress(result),
      country: derivedCountryId,
      categories: [],
      image: null,
    };
    const updatedMarkers = [...(markersRef.current || []), newMarker];

    updateMarkers(updatedMarkers);

    if (derivedCountryId !== null) {
      const countryId = String(derivedCountryId);
      if (!selectedCountryIds.includes(countryId)) {
        onCountrySelect(countryId);
      }
    }
  }, [countries, markersRef, onCountrySelect, selectedCountryIds, updateMarkers]);

  const handleAddManualPoint = useCallback(async () => {
    const parsedFromPair = parseCoordsPair(manualPointState.coords);
    const lat = parsedFromPair?.lat ?? Number(manualPointState.lat);
    const lng = parsedFromPair?.lng ?? Number(manualPointState.lng);

    if (!isValidCoordinate(lat, lng)) {
      void showToastMessage({
        type: 'error',
        text1: 'Некорректные координаты',
        text2: 'Проверьте широту (-90..90) и долготу (-180..180)',
      });
      return;
    }

    let derivedCountryId: string | null = null;
    let address = '';

    try {
      const data = await reverseGeocode(lat, lng);
      const { name: countryName, code: countryCode } = getReverseGeocodeCountry(data);
      if (countryName || countryCode) {
        const matchedId = matchCountryId(countryName || '', countries || [], countryCode);
        if (matchedId != null) derivedCountryId = String(matchedId);
      }

      address = buildAddressFromGeocode(
        data,
        { lat, lng },
        getMatchedCountry(derivedCountryId, countries),
      );
    } catch {
      address = `${lat}, ${lng}`;
    }

    const updatedMarkers = [
      ...(markers || []),
      {
        id: null,
        lat,
        lng,
        address,
        categories: [],
        image: manualPointState.photoPreviewUrl,
        country: derivedCountryId ? Number(derivedCountryId) : null,
      },
    ];

    if (derivedCountryId && !selectedCountryIds.includes(derivedCountryId)) {
      onCountrySelect(derivedCountryId);
    }

    updateMarkers(updatedMarkers);
    resetManualPoint();
    setManualPointVisible(false);
  }, [
    countries,
    manualPointState.coords,
    manualPointState.lat,
    manualPointState.lng,
    manualPointState.photoPreviewUrl,
    markers,
    onCountrySelect,
    resetManualPoint,
    selectedCountryIds,
    setManualPointVisible,
    updateMarkers,
  ]);

  const handleManualPhotoPick = useCallback(() => {
    if (Platform.OS !== 'web') return;
    manualPhotoInputRef.current?.click?.();
  }, [manualPhotoInputRef]);

  const handleManualPhotoSelected = useCallback(async (event: any) => {
    if (Platform.OS !== 'web') return;

    const file: File | null = event?.target?.files?.[0] ?? null;
    try {
      if (event?.target) event.target.value = '';
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

    setManualPhotoCoordinates(coords.lat, coords.lng);

    try {
      const uploadableFile = await prepareWebImageFileForUpload(file);
      const previewUrl = URL.createObjectURL(uploadableFile);
      registerPendingImageFile(previewUrl, uploadableFile);
      setManualPhotoPreview(previewUrl);
    } catch {
      void showToastMessage({
        type: 'error',
        text1: 'Не удалось обработать фото',
        text2: 'Попробуйте JPG или PNG, если HEIC не удалось преобразовать в браузере.',
      });
      return;
    }

    void showToastMessage({
      type: 'success',
      text1: 'Координаты заполнены',
      text2: 'Взяли GPS из EXIF фотографии.',
    });
  }, [setManualPhotoCoordinates, setManualPhotoPreview]);

  const handleCountriesFilterChange = useCallback((value: string | number | Array<string | number>) => {
    const previousIds = toStringIds(selectedCountryIds);
    const nextIds = toStringIds(Array.isArray(value) ? value : [value]);
    const addedIds = nextIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !nextIds.includes(id));

    addedIds.forEach(onCountrySelect);

    if (removedIds.length) {
      const removedSet = new Set(removedIds);
      const filteredMarkers = (markers || []).filter((marker: any) => {
        if (marker?.country == null) return true;
        return !removedSet.has(String(marker.country));
      });

      if (filteredMarkers.length !== markers.length) {
        updateMarkers(filteredMarkers);
      }
    }

    removedIds.forEach(onCountryDeselect);
  }, [markers, onCountryDeselect, onCountrySelect, selectedCountryIds, updateMarkers]);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={0}
      >
        <TravelWizardHeader
          canGoBack={true}
          onBack={onBack}
          title={stepMeta?.title ?? DEFAULT_TITLE}
          subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
          progressPercent={progressPercent}
          warningCount={validation.warnings.length}
          autosaveBadge={autosaveBadge}
          onPrimary={onNext}
          primaryLabel={stepMeta?.nextLabel ?? DEFAULT_NEXT_LABEL}
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

        {!isCompactLayout && validation.errors.length > 0 && (
          <View style={styles.validationSummaryWrapper}>
            <ValidationSummary
              errorCount={validation.errors.length}
              warningCount={validation.warnings.length}
              errorMessages={validationMessages.errorMessages}
              warningMessages={validationMessages.warningMessages}
            />
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          testID="travel-wizard.step-route.scroll"
          accessibilityLabel="travel-wizard.step-route.scroll"
        >
          <View style={styles.contentInner}>
            <View style={styles.card}>
              <View style={[styles.mapHeader, isCompactLayout && styles.mapHeaderCompact]}>
                <View style={styles.flexFill}>
                  <Text style={styles.mapTitle}>Ключевые точки маршрута</Text>
                  <Text style={styles.mapHint}>
                    Добавьте точки маршрута на карте. Для модерации потребуется минимум одна точка.
                  </Text>
                </View>
                <Text style={styles.mapCount}>Точек: {markers.length}</Text>
              </View>

              {isCoachmarkVisible && !hasPoints && (
                <RouteCoachmark styles={styles} onDismiss={dismissCoachmark} />
              )}

              <TravelRouteFilesPanel travelId={travelId} allowUpload={true} />

              <LocationSearchInput
                onLocationSelect={handleLocationSelect}
                placeholder="Поиск места (например: Эйфелева башня, Париж)"
              />

              <ManualPointPanel
                isVisible={isManualPointVisible}
                state={manualPointState}
                styles={styles}
                fileInputRef={manualPhotoInputRef}
                onToggle={toggleManualPointPanel}
                onPhotoPick={handleManualPhotoPick}
                onPhotoSelected={handleManualPhotoSelected}
                onClearPhoto={clearManualPhoto}
                onCoordsChange={setManualCoords}
                onLatChange={setManualLat}
                onLngChange={setManualLng}
                onAdd={handleAddManualPoint}
                onCancel={hideManualPointPanel}
              />

              <View style={styles.filtersRow}>
                <View ref={countriesAnchorRef} nativeID={ROUTE_COUNTRIES_ANCHOR_ID} />
                <View style={styles.filterItem}>
                  <CountriesField
                    countries={countries}
                    isFiltersLoading={isFiltersLoading}
                    selectedCountryIds={selectedCountryIds}
                    styles={styles}
                    onChange={handleCountriesFilterChange}
                  />
                </View>
              </View>
            </View>

            <RouteMapCard
              categoryTravelAddress={categoryTravelAddress}
              countries={countries}
              markers={markers}
              styles={styles}
              isCompactLayout={isCompactLayout}
              anchorRef={markersListAnchorRef}
              onMarkersChange={updateMarkers}
              onCountrySelect={onCountrySelect}
              onCountryDeselect={onCountryDeselect}
              onPhotoMarkerReady={handlePhotoMarkerReady}
              onMarkerEditSave={handleMarkerEditSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web'
      ? ({ height: '100dvh', overflow: 'hidden' } as any)
      : null),
  },
  keyboardAvoid: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  validationSummaryWrapper: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  contentContainer: {
    paddingTop: DESIGN_TOKENS.spacing.sm,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
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
    gap: DESIGN_TOKENS.spacing.sm,
  },
  mapHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingTop: DESIGN_TOKENS.spacing.xs,
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
    color: colors.primaryText,
  },
  coachmark: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
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
    paddingBottom: DESIGN_TOKENS.spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  manualPointCard: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
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
    borderRadius: DESIGN_TOKENS.radii.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: 10,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  manualPointActionsRow: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  filtersRow: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.xs,
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
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.borderLight,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  filtersSkeletonInput: {
    width: '100%',
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.borderLight,
  },
  mapContainer: {
    marginTop: DESIGN_TOKENS.spacing.xxs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },
  mapContainerCompact: {
    marginTop: DESIGN_TOKENS.spacing.xs,
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
});

export default React.memo(TravelWizardStepRoute);
