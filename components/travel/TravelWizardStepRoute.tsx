import React, { useCallback, useMemo } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import LocationSearchInput from '@/components/travel/LocationSearchInput'
import TravelRouteFilesPanel from '@/components/travel/TravelRouteFilesPanel'
import TravelWizardHeader from '@/components/travel/TravelWizardHeader'
import { ValidationSummary } from '@/components/travel/ValidationFeedback'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import type { MarkerData } from '@/types/types'
import { extractGpsFromImageFile } from '@/utils/exifGps'
import { hasToastBeenShown } from '@/utils/errorHelpers'
import { buildAddressFromGeocode, matchCountryId } from '@/utils/geocodeHelpers'
import { registerPendingImageFile } from '@/utils/pendingImageFiles'
import { showToastMessage } from '@/utils/toast'
import { validateStep } from '@/utils/travelWizardValidation'
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload'

import { CountriesField } from './stepRoute/CountriesField'
import {
  DEFAULT_NEXT_LABEL,
  DEFAULT_TITLE,
  getMatchedCountry,
  getProgressPercent,
  getReverseGeocodeCountry,
  getSearchResultAddress,
  isValidCoordinate,
  KEYBOARD_BEHAVIOR,
  parseCoordsPair,
  reverseGeocode,
  ROUTE_COUNTRIES_ANCHOR_ID,
  toStringIds,
} from './stepRoute/helpers'
import {
  useLatestRef,
  useManualPointForm,
  useRouteAnchorScroll,
  useRouteCoachmark,
} from './stepRoute/hooks'
import { ManualPointPanel } from './stepRoute/ManualPointPanel'
import { RouteCoachmark } from './stepRoute/RouteCoachmark'
import { RouteMapCard } from './stepRoute/RouteMapCard'
import { createStyles } from './stepRoute/styles'
import type { TravelWizardStepRouteProps } from './stepRoute/types'

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
  const colors = useThemedColors()
  const router = useRouter()
  const { isPhone, isLargePhone } = useResponsive()
  const markersRef = useLatestRef(markers)
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
  } = useManualPointForm()
  const hasPoints = markers.length > 0
  const isCompactLayout = isPhone || isLargePhone
  const styles = useMemo(() => createStyles(colors), [colors])
  const progressPercent = getProgressPercent(progress)
  const { isVisible: isCoachmarkVisible, dismiss: dismissCoachmark } = useRouteCoachmark(hasPoints)
  const { scrollRef, markersListAnchorRef, countriesAnchorRef } = useRouteAnchorScroll({
    focusAnchorId,
    onAnchorHandled,
  })

  const validation = useMemo(() => validateStep(2, {
    coordsMeTravel: markers,
    countries: selectedCountryIds,
  } as any), [markers, selectedCountryIds])

  const validationMessages = useMemo(
    () => ({
      errorMessages: validation.errors.map((error) => error.message),
      warningMessages: validation.warnings.map((warning) => warning.message),
    }),
    [validation],
  )

  const updateMarkers = useCallback((updatedMarkers: MarkerData[]) => {
    setMarkers(updatedMarkers)
  }, [setMarkers])

  const saveRoute = useCallback(async (updatedMarkers: MarkerData[], countryIds = selectedCountryIds) => {
    if (!onManualSave) return

    await onManualSave({
      ...formData,
      countries: toStringIds(countryIds),
      coordsMeTravel: updatedMarkers,
    })
  }, [formData, onManualSave, selectedCountryIds])

  const handleQuickDraft = useCallback(async () => {
    if (!onManualSave) return

    try {
      await onManualSave()
      void showToastMessage({
        type: 'success',
        text1: 'Черновик сохранен',
        text2: 'Вы можете вернуться к нему позже',
      })

      setTimeout(() => {
        router.push('/metravel')
      }, 250)
    } catch (error) {
      if (!hasToastBeenShown(error)) {
        void showToastMessage({
          type: 'error',
          text1: 'Ошибка сохранения',
          text2: 'Попробуйте еще раз',
        })
      }
    }
  }, [onManualSave, router])

  const handlePhotoMarkerReady = useCallback(async (
    payload: { markers: MarkerData[]; derivedCountryId: number | null },
  ) => {
    updateMarkers(payload.markers)

    const nextCountries = payload.derivedCountryId != null
      ? Array.from(new Set([...toStringIds(selectedCountryIds), String(payload.derivedCountryId)]))
      : toStringIds(selectedCountryIds)

    await saveRoute(payload.markers, nextCountries)
  }, [saveRoute, selectedCountryIds, updateMarkers])

  const handleMarkerEditSave = useCallback(async (updatedMarkers: MarkerData[]) => {
    updateMarkers(updatedMarkers)
    await saveRoute(updatedMarkers)
  }, [saveRoute, updateMarkers])

  const handleLocationSelect = useCallback((result: any) => {
    const lat = Number(result?.lat)
    const lng = Number(result?.lon)
    if (!isValidCoordinate(lat, lng)) return

    const countryName = result?.address?.country
    const countryCode = result?.address?.country_code
    const derivedCountryId = countryName || countryCode
      ? matchCountryId(countryName || '', countries || [], countryCode)
      : null

    const newMarker: MarkerData = {
      id: null,
      lat,
      lng,
      address: getSearchResultAddress(result),
      country: derivedCountryId,
      categories: [],
      image: null,
    }
    const updatedMarkers = [...(markersRef.current || []), newMarker]

    updateMarkers(updatedMarkers)

    if (derivedCountryId !== null) {
      const countryId = String(derivedCountryId)
      if (!selectedCountryIds.includes(countryId)) {
        onCountrySelect(countryId)
      }
    }
  }, [countries, markersRef, onCountrySelect, selectedCountryIds, updateMarkers])

  const handleAddManualPoint = useCallback(async () => {
    const parsedFromPair = parseCoordsPair(manualPointState.coords)
    const lat = parsedFromPair?.lat ?? Number(manualPointState.lat)
    const lng = parsedFromPair?.lng ?? Number(manualPointState.lng)

    if (!isValidCoordinate(lat, lng)) {
      void showToastMessage({
        type: 'error',
        text1: 'Некорректные координаты',
        text2: 'Проверьте широту (-90..90) и долготу (-180..180)',
      })
      return
    }

    let derivedCountryId: string | null = null
    let address = ''

    try {
      const data = await reverseGeocode(lat, lng)
      const { name: countryName, code: countryCode } = getReverseGeocodeCountry(data)
      if (countryName || countryCode) {
        const matchedId = matchCountryId(countryName || '', countries || [], countryCode)
        if (matchedId != null) derivedCountryId = String(matchedId)
      }

      address = buildAddressFromGeocode(
        data,
        { lat, lng },
        getMatchedCountry(derivedCountryId, countries),
      )
    } catch {
      address = `${lat}, ${lng}`
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
    ]

    if (derivedCountryId && !selectedCountryIds.includes(derivedCountryId)) {
      onCountrySelect(derivedCountryId)
    }

    updateMarkers(updatedMarkers)
    resetManualPoint({ preservePendingPhoto: Boolean(manualPointState.photoPreviewUrl) })
    setManualPointVisible(false)
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
  ])

  const handleManualPhotoPick = useCallback(() => {
    if (Platform.OS !== 'web') return
    manualPhotoInputRef.current?.click?.()
  }, [manualPhotoInputRef])

  const handleManualPhotoSelected = useCallback(async (event: any) => {
    if (Platform.OS !== 'web') return

    const file: File | null = event?.target?.files?.[0] ?? null
    try {
      if (event?.target) event.target.value = ''
    } catch {
      // noop
    }
    if (!file) return

    const coords = await extractGpsFromImageFile(file)
    if (!coords) {
      void showToastMessage({
        type: 'error',
        text1: 'Нет геолокации в фото',
        text2: 'В этом файле не найден GPS в EXIF. Попробуйте другое фото или введите координаты вручную.',
      })
      return
    }

    setManualPhotoCoordinates(coords.lat, coords.lng)

    try {
      const uploadableFile = await prepareWebImageFileForUpload(file)
      const previewUrl = URL.createObjectURL(uploadableFile)
      registerPendingImageFile(previewUrl, uploadableFile)
      setManualPhotoPreview(previewUrl)
    } catch {
      void showToastMessage({
        type: 'error',
        text1: 'Не удалось обработать фото',
        text2: 'Попробуйте JPG или PNG, если HEIC не удалось преобразовать в браузере.',
      })
      return
    }

    void showToastMessage({
      type: 'success',
      text1: 'Координаты заполнены',
      text2: 'Взяли GPS из EXIF фотографии.',
    })
  }, [setManualPhotoCoordinates, setManualPhotoPreview])

  const handleCountriesFilterChange = useCallback((value: string | number | Array<string | number>) => {
    const previousIds = toStringIds(selectedCountryIds)
    const nextIds = toStringIds(Array.isArray(value) ? value : [value])
    const addedIds = nextIds.filter((id) => !previousIds.includes(id))
    const removedIds = previousIds.filter((id) => !nextIds.includes(id))

    addedIds.forEach(onCountrySelect)

    if (removedIds.length) {
      const removedSet = new Set(removedIds)
      const filteredMarkers = (markers || []).filter((marker: any) => {
        if (marker?.country == null) return true
        return !removedSet.has(String(marker.country))
      })

      if (filteredMarkers.length !== markers.length) {
        updateMarkers(filteredMarkers)
      }
    }

    removedIds.forEach(onCountryDeselect)
  }, [markers, onCountryDeselect, onCountrySelect, selectedCountryIds, updateMarkers])

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
                  {!isFiltersLoading && (
                    <Text style={styles.countriesHint}>
                      Заполняется автоматически по точкам маршрута на карте
                    </Text>
                  )}
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
  )
}

export default React.memo(TravelWizardStepRoute)
