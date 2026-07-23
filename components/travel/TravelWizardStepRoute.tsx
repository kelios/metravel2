import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  KeyboardAvoidingView,
  findNodeHandle,
  Platform,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import LocationSearchInput from '@/components/travel/LocationSearchInput'
import TravelRouteFilesPanel from '@/components/travel/TravelRouteFilesPanel'
import TravelWizardHeader from '@/components/travel/TravelWizardHeader'
import { CollapsibleValidationSummary, ValidationSummary } from '@/components/travel/ValidationFeedback'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import type { MarkerData, TravelFormData } from '@/types/types'
import { extractGpsFromImageFile } from '@/utils/exifGps'
import { hasToastBeenShown } from '@/utils/errorHelpers'
import { buildAddressFromGeocode, matchCountryId } from '@/utils/geocodeHelpers'
import { registerPendingImageFile } from '@/utils/pendingImageFiles'
import { showToastMessage } from '@/utils/toast'
import { buildQuickDraftRoute } from '@/utils/travelQuickDraftNavigation'
import { validateStep } from '@/utils/travelWizardValidation'
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload'

import { CountriesField } from './stepRoute/CountriesField'
import {
  getDefaultNextLabel,
  getDefaultTitle,
  getMatchedCountry,
  getProgressPercent,
  getReverseGeocodeCountry,
  getSearchResultAddress,
  isValidCoordinate,
  KEYBOARD_BEHAVIOR,
  parseCoordinate,
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
import WizardStepFooter from '@/components/travel/upsert/WizardStepFooter'
import { createStyles } from './stepRoute/styles'
import type { TravelWizardStepRouteProps } from './stepRoute/types'
import { translate as i18nT } from '@/i18n'


function TravelWizardStepRoute({
  currentStep,
  totalSteps,
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
  isSaveInFlight,
  focusAnchorId,
  onAnchorHandled,
  onStepSelect,
  onPreview,
  onOpenPublic,
}: TravelWizardStepRouteProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const { isHydrated, isMobile } = useResponsive()
  const markersRef = useLatestRef(markers)
  const isMountedRef = useRef(true)
  const quickDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addPointSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualPanelAnchorRef = useRef<View | null>(null)
  const manualCoordsInputRef = useRef<TextInput | null>(null)
  // Текущее вертикальное смещение ScrollView — нужно LocationSearchInput, чтобы
  // из window-координат инпута вычислить абсолютную позицию в контенте и поднять
  // его над клавиатурой (F-13).
  const scrollOffsetRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (quickDraftTimeoutRef.current != null) {
        clearTimeout(quickDraftTimeoutRef.current)
        quickDraftTimeoutRef.current = null
      }
      if (addPointSaveTimeoutRef.current != null) {
        clearTimeout(addPointSaveTimeoutRef.current)
        addPointSaveTimeoutRef.current = null
      }
    }
  }, [])
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
    toggleLatSign: toggleManualLatSign,
    toggleLngSign: toggleManualLngSign,
    setPanelVisible: setManualPointVisible,
    setPhotoCoordinates: setManualPhotoCoordinates,
    setPhotoPreview: setManualPhotoPreview,
  } = useManualPointForm()
  const hasPoints = markers.length > 0
  const isCompactLayout = isHydrated && isMobile
  const styles = useMemo(() => createStyles(colors), [colors])
  const progressPercent = getProgressPercent(progress)
  const { isVisible: isCoachmarkVisible, dismiss: dismissCoachmark } = useRouteCoachmark(hasPoints)
  const { scrollRef, markersListAnchorRef, countriesAnchorRef } = useRouteAnchorScroll({
    focusAnchorId,
    onAnchorHandled,
  })

  useEffect(() => {
    if (!isManualPointVisible) return

    const focusCoordsInput = () => {
      manualCoordsInputRef.current?.focus?.()
    }

    const timer = setTimeout(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const el = document.getElementById('travelwizard-route-manual-panel')
        if (el && typeof (el as any).scrollIntoView === 'function') {
          ;(el as any).scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        focusCoordsInput()
        return
      }

      const scrollNode = scrollRef.current
      const anchorNode = manualPanelAnchorRef.current
      const scrollHandle = scrollNode ? findNodeHandle(scrollNode) : null
      const anchorHandle = anchorNode ? findNodeHandle(anchorNode) : null

      if (!scrollNode || !scrollHandle || !anchorHandle) {
        focusCoordsInput()
        return
      }

      UIManager.measureLayout(
        anchorHandle,
        scrollHandle,
        focusCoordsInput,
        (_x, y) => {
          scrollNode.scrollTo({ y: Math.max(y - DESIGN_TOKENS.spacing.md, 0), animated: true })
          focusCoordsInput()
        },
      )
    }, 80)

    return () => clearTimeout(timer)
  }, [isManualPointVisible, scrollRef])

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

  // Контракт save ≠ moderate (docs/TRAVEL_SAVE_MODERATION_CONTRACT.md): content-save
  // НИКОГДА не блокируется валидацией полноты. Бэк проверяет categories у точек РОВНО
  // один раз — при явной отправке на модерацию (enforce_moderation_validation=true,
  // intent='publish', api/misc.ts). На обычном add-point/edit-сейве enforce=false, и
  // бэк принимает точку без категории (проверено). Поэтому добавленную точку шлём на
  // сохранение СРАЗУ, даже без категории — иначе она не получит server-id и в окне
  // точки нельзя приложить фото (нужен id для /upload collection=travelImageAddress).

  const saveRoute = useCallback(async (updatedMarkers: MarkerData[], countryIds = selectedCountryIds) => {
    if (!onManualSave) return

    // Override сужен до реально изменяемых этим путём полей (маршрут/страны). Остальные
    // поля (текст/фото и т.п.) НЕ спредим из prop formData: отложенный scheduleAddPointSave
    // (800ms) иначе персистил бы устаревший снапшот и мог затереть свежую правку текста.
    // handleManualSave домержит недостающие поля из живого formDataRef
    // (mergeOverridePreservingUserInput).
    await onManualSave({
      countries: toStringIds(countryIds),
      coordsMeTravel: updatedMarkers,
    } as TravelFormData)
  }, [onManualSave, selectedCountryIds])

  // Добавление точки (поиск/клик по карте/ручной ввод) должно сохраняться сразу,
  // а не ждать 5-сек автосейв: при перезагрузке страницы в это окно свежая точка
  // без категории/фото иначе теряется (тикет #505). Лёгкий debounce схлопывает
  // серию быстрых добавлений в один запрос; сам save идёт тем же путём, что и
  // явное сохранение точки с категорией/фото (saveRoute → onManualSave).
  const scheduleAddPointSave = useCallback(
    (updatedMarkers: MarkerData[], countryIds = selectedCountryIds) => {
      if (!onManualSave) return

      if (addPointSaveTimeoutRef.current != null) {
        clearTimeout(addPointSaveTimeoutRef.current)
      }
      addPointSaveTimeoutRef.current = setTimeout(() => {
        addPointSaveTimeoutRef.current = null
        if (!isMountedRef.current) return
        void saveRoute(updatedMarkers, countryIds).catch((error: unknown) => {
          // Точка остаётся в стейте в любом случае — пользователь её видит и может
          // дозаполнить. Но провал фонового сейва (сеть/сервер) не должен быть
          // «немым» (тикет #505): handleManualSave уже показывает один тост ошибки
          // (toastShown), отмену запроса игнорируем. Здесь — только страховка от
          // повторного тоста; не ревокаем pending-фото.
          if (!isMountedRef.current) return
          const message = error instanceof Error ? error.message : ''
          if (message === 'Request aborted') return
          if (hasToastBeenShown(error)) return
          void showToastMessage({
            type: 'error',
            text1: i18nT('travel:components.travel.TravelWizardStepRoute.tochka_ne_sohranilas_c900f4d2'),
            text2: i18nT('travel:components.travel.TravelWizardStepRoute.proverte_soedinenie_izmenenie_sohranitsya_pr_1fc5501c'),
          })
        })
      }, 800)
    },
    [onManualSave, saveRoute, selectedCountryIds],
  )

  const handleQuickDraft = useCallback(async () => {
    if (!onManualSave) return

    try {
      const savedTravel = await onManualSave()
      void showToastMessage({
        type: 'success',
        text1: i18nT('travel:components.travel.TravelWizardStepRoute.chernovik_sohranen_e41a2f03'),
        text2: i18nT('travel:components.travel.TravelWizardStepRoute.vy_mozhete_vernutsya_k_nemu_pozzhe_6fb8edfd'),
      })

      if (quickDraftTimeoutRef.current != null) {
        clearTimeout(quickDraftTimeoutRef.current)
      }
      quickDraftTimeoutRef.current = setTimeout(() => {
        quickDraftTimeoutRef.current = null
        if (!isMountedRef.current) return
        router.push(buildQuickDraftRoute(savedTravel ?? null))
      }, 250)
    } catch (error) {
      if (!hasToastBeenShown(error)) {
        void showToastMessage({
          type: 'error',
          text1: i18nT('travel:components.travel.TravelWizardStepRoute.oshibka_sohraneniya_0aff33b4'),
          text2: i18nT('travel:components.travel.TravelWizardStepRoute.poprobuyte_esche_raz_89657291'),
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

  const handleMarkerAdded = useCallback((
    payload: { markers: MarkerData[]; derivedCountryId: number | null },
  ) => {
    const nextCountries = payload.derivedCountryId != null
      ? Array.from(new Set([...selectedCountryIds, String(payload.derivedCountryId)]))
      : selectedCountryIds

    scheduleAddPointSave(payload.markers, nextCountries)
  }, [scheduleAddPointSave, selectedCountryIds])

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

    let nextCountryIds = selectedCountryIds
    if (derivedCountryId !== null) {
      const countryId = String(derivedCountryId)
      if (!selectedCountryIds.includes(countryId)) {
        onCountrySelect(countryId)
        nextCountryIds = [...selectedCountryIds, countryId]
      }
    }

    scheduleAddPointSave(updatedMarkers, nextCountryIds)
  }, [countries, markersRef, onCountrySelect, scheduleAddPointSave, selectedCountryIds, updateMarkers])

  // Общий путь создания точки: обратный геокод → страна → адрес → добавление в
  // маршрут → автосохранение. Используется и ручным вводом координат, и тапом по
  // native-карте (#1040), чтобы результат был идентичным на всех поверхностях.
  const addPointAtCoords = useCallback(
    async (lat: number, lng: number, image: string | null = null) => {
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
        ...(markersRef.current || []),
        {
          id: null,
          lat,
          lng,
          address,
          categories: [],
          image,
          country: derivedCountryId ? Number(derivedCountryId) : null,
        },
      ]

      let nextCountryIds = selectedCountryIds
      if (derivedCountryId && !selectedCountryIds.includes(derivedCountryId)) {
        onCountrySelect(derivedCountryId)
        nextCountryIds = [...selectedCountryIds, derivedCountryId]
      }

      updateMarkers(updatedMarkers)
      scheduleAddPointSave(updatedMarkers, nextCountryIds)
    },
    [countries, markersRef, onCountrySelect, scheduleAddPointSave, selectedCountryIds, updateMarkers],
  )

  const handleAddManualPoint = useCallback(async () => {
    const parsedFromPair = parseCoordsPair(manualPointState.coords)
    const lat = parsedFromPair?.lat ?? parseCoordinate(manualPointState.lat)
    const lng = parsedFromPair?.lng ?? parseCoordinate(manualPointState.lng)

    if (!isValidCoordinate(lat, lng)) {
      void showToastMessage({
        type: 'error',
        text1: i18nT('travel:components.travel.TravelWizardStepRoute.nekorrektnye_koordinaty_9c2e14d8'),
        text2: i18nT('travel:components.travel.TravelWizardStepRoute.proverte_shirotu_90_90_i_dolgotu_180_180_8dd245e3'),
      })
      return
    }

    await addPointAtCoords(lat, lng, manualPointState.photoPreviewUrl)
    resetManualPoint({ preservePendingPhoto: Boolean(manualPointState.photoPreviewUrl) })
    setManualPointVisible(false)
  }, [
    addPointAtCoords,
    manualPointState.coords,
    manualPointState.lat,
    manualPointState.lng,
    manualPointState.photoPreviewUrl,
    resetManualPoint,
    setManualPointVisible,
  ])

  // Тап по native-карте — создать точку в этих координатах.
  const handleMapPointAdd = useCallback(
    (lat: number, lng: number) => {
      if (!isValidCoordinate(lat, lng)) return
      void addPointAtCoords(lat, lng, null)
    },
    [addPointAtCoords],
  )

  // Перетаскивание маркера на native-карте — обновить координаты точки и сохранить.
  const handleMapPointMove = useCallback(
    (index: number, lat: number, lng: number) => {
      if (!isValidCoordinate(lat, lng)) return
      const current = markersRef.current || []
      if (index < 0 || index >= current.length) return
      const next = current.map((marker, i) => (i === index ? { ...marker, lat, lng } : marker))
      updateMarkers(next)
      void handleMarkerEditSave(next)
    },
    [handleMarkerEditSave, markersRef, updateMarkers],
  )

  const handleManualPhotoPick = useCallback(() => {
    if (Platform.OS !== 'web') return
    manualPhotoInputRef.current?.click?.()
  }, [manualPhotoInputRef])

  const handleManualPointToggle = useCallback(() => {
    setManualPointVisible(!isManualPointVisible)
  }, [isManualPointVisible, setManualPointVisible])

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
    if (!isMountedRef.current) return
    if (!coords) {
      void showToastMessage({
        type: 'error',
        text1: i18nT('travel:components.travel.TravelWizardStepRoute.net_geolokatsii_v_foto_e5e30ddf'),
        text2: i18nT('travel:components.travel.TravelWizardStepRoute.v_etom_fayle_ne_nayden_gps_v_exif_poprobuyte_0c32ab0f'),
      })
      return
    }

    setManualPhotoCoordinates(coords.lat, coords.lng)

    try {
      const uploadableFile = await prepareWebImageFileForUpload(file)
      if (!isMountedRef.current) return
      const previewUrl = URL.createObjectURL(uploadableFile)
      if (!isMountedRef.current) {
        URL.revokeObjectURL(previewUrl)
        return
      }
      registerPendingImageFile(previewUrl, uploadableFile)
      setManualPhotoPreview(previewUrl)
    } catch {
      if (!isMountedRef.current) return
      void showToastMessage({
        type: 'error',
        text1: i18nT('travel:components.travel.TravelWizardStepRoute.ne_udalos_obrabotat_foto_57ec3f9c'),
        text2: i18nT('travel:components.travel.TravelWizardStepRoute.poprobuyte_jpg_ili_png_esli_heic_ne_udalos_p_72ad42f8'),
      })
      return
    }

    if (!isMountedRef.current) return
    void showToastMessage({
      type: 'success',
      text1: i18nT('travel:components.travel.TravelWizardStepRoute.koordinaty_zapolneny_d9650afe'),
      text2: i18nT('travel:components.travel.TravelWizardStepRoute.vzyali_gps_iz_exif_fotografii_81abe770'),
    })
  }, [setManualPhotoCoordinates, setManualPhotoPreview])

  return (
    <SafeAreaView style={styles.safeContainer} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={0}
      >
        <TravelWizardHeader
          canGoBack={true}
          onBack={onBack}
          title={stepMeta?.title ?? getDefaultTitle()}
          subtitle={stepMeta?.subtitle ?? i18nT('travel:common.stepProgress', { value1: currentStep, value2: totalSteps })}
          progressPercent={progressPercent}
          errorCount={validation.errors.length}
          warningCount={validation.warnings.length}
          autosaveBadge={autosaveBadge}
          isSaveInFlight={isSaveInFlight}
          onPrimary={onNext}
          primaryLabel={stepMeta?.nextLabel ?? getDefaultNextLabel()}
          onSave={onManualSave}
          onQuickDraft={onManualSave ? handleQuickDraft : undefined}
          quickDraftLabel={i18nT('travel:components.travel.TravelWizardStepRoute.bystryy_chernovik_35576f36')}
          tipTitle={stepMeta?.tipTitle}
          tipBody={stepMeta?.tipBody}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onStepSelect={onStepSelect}
          onPreview={onPreview}
          onOpenPublic={onOpenPublic}
        />

        {validation.errors.length > 0 && (!isCompactLayout || hasPoints) && (
          <View style={styles.validationSummaryWrapper}>
            {isCompactLayout ? (
              <CollapsibleValidationSummary
                errorCount={validation.errors.length}
                warningCount={validation.warnings.length}
                errorMessages={validationMessages.errorMessages}
                warningMessages={validationMessages.warningMessages}
              />
            ) : (
              <ValidationSummary
                errorCount={validation.errors.length}
                warningCount={validation.warnings.length}
                errorMessages={validationMessages.errorMessages}
                warningMessages={validationMessages.warningMessages}
              />
            )}
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          testID="travel-wizard.step-route.scroll"
        >
          <View style={styles.contentInner}>
            <View style={[styles.card, isCompactLayout && styles.cardCompact]}>
              <View style={[styles.mapHeader, isCompactLayout && styles.mapHeaderCompact]}>
                <View style={styles.flexFill}>
                  <Text style={styles.mapTitle}>{i18nT('travel:components.travel.TravelWizardStepRoute.klyuchevye_tochki_marshruta_50aec662')}</Text>
                  <Text style={styles.mapHint}>
                    {i18nT('travel:components.travel.TravelWizardStepRoute.dobavte_tochki_marshruta_na_karte_dlya_moder_a157e621')}</Text>
                </View>
                <Text style={styles.mapCount}>{i18nT('travel:components.travel.TravelWizardStepRoute.tochek_7455fcf5')}{markers.length}</Text>
              </View>

              {isCoachmarkVisible && !hasPoints && (
                <RouteCoachmark styles={styles} onDismiss={dismissCoachmark} />
              )}

              <TravelRouteFilesPanel travelId={travelId} allowUpload={true} />

              <LocationSearchInput
                onLocationSelect={handleLocationSelect}
                placeholder={isCompactLayout ? i18nT('travel:components.travel.TravelWizardStepRoute.poisk_mesta_b4562617') : i18nT('travel:components.travel.TravelWizardStepRoute.poisk_mesta_naprimer_eyfeleva_bashnya_parizh_69988db5')}
                scrollViewRef={scrollRef}
                scrollOffsetRef={scrollOffsetRef}
              />

              <ManualPointPanel
                isVisible={isManualPointVisible}
                state={manualPointState}
                styles={styles}
                fileInputRef={manualPhotoInputRef}
                panelRef={manualPanelAnchorRef}
                coordsInputRef={manualCoordsInputRef}
                onToggle={handleManualPointToggle}
                onPhotoPick={handleManualPhotoPick}
                onPhotoSelected={handleManualPhotoSelected}
                onClearPhoto={clearManualPhoto}
                onCoordsChange={setManualCoords}
                onLatChange={setManualLat}
                onLngChange={setManualLng}
                onLatSignToggle={toggleManualLatSign}
                onLngSignToggle={toggleManualLngSign}
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
                  />
                  {!isFiltersLoading && (
                    <Text style={styles.countriesHint}>
                      {i18nT('travel:components.travel.TravelWizardStepRoute.zapolnyaetsya_avtomaticheski_po_tochkam_mars_e1dd0ccc')}</Text>
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
              onMarkerAdded={handleMarkerAdded}
              onMapPointAdd={handleMapPointAdd}
              onMapPointMove={handleMapPointMove}
            />
          </View>
        </ScrollView>
        <WizardStepFooter
          onBack={onBack}
          onPrimary={onNext}
          primaryLabel={stepMeta?.nextLabel ?? getDefaultNextLabel()}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default React.memo(TravelWizardStepRoute)
