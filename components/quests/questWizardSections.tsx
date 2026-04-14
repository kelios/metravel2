import React, { Suspense } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors } from '@/hooks/useTheme'

import {
  BelkrajWidgetLazy,
  NativeQuestVideoLazy,
  QuestFullMapLazy,
  QuestWebVideo,
} from './questWizardMedia'

type MapApp = 'google' | 'apple' | 'yandex' | 'organic' | 'mapsme'

type PointLike = {
  id?: string
  title?: string
  image?: unknown
  lat: number
  lng: number
}

type CityLike = {
  name?: string
  lat: number
  lng: number
  countryCode?: string
}

type FinaleLike = {
  text: string
  video?: any
  poster?: any
}

type SharedProps = {
  colors: any
  styles: any
}

export function QuestDesktopMapPanel({
  colors: _colors,
  styles,
  currentStep,
  steps,
  compactDesktopLayout,
  useWideInlineLayout,
  desktopNavExpanded,
  setDesktopNavExpanded,
  desktopHasOrganic,
  desktopHasMapsme,
  showMap,
  toggleMap,
  openCurrentStepInMap,
  copyCurrentStepCoords,
  activeStepIndex,
}: SharedProps & {
  currentStep: PointLike
  steps: PointLike[]
  compactDesktopLayout: boolean
  useWideInlineLayout: boolean
  desktopNavExpanded: boolean
  setDesktopNavExpanded: React.Dispatch<React.SetStateAction<boolean>>
  desktopHasOrganic: boolean
  desktopHasMapsme: boolean
  showMap: boolean
  toggleMap: () => void
  openCurrentStepInMap: (app: MapApp) => void
  copyCurrentStepCoords: () => void
  activeStepIndex?: number
}) {
  return (
    <View
      style={[
        styles.fullMapSection,
        useWideInlineLayout && (compactDesktopLayout ? styles.compactDesktopSide : styles.desktopSide),
      ]}
    >
      {useWideInlineLayout && currentStep.id !== 'intro' && (
        <View style={styles.mapTopControls}>
          <View style={styles.navRow}>
            <Pressable
              style={styles.navButton}
              onPress={() => openCurrentStepInMap(Platform.OS === 'ios' ? 'apple' : 'google')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Открыть навигацию"
            >
              <Text style={styles.navButtonText}>Навигация</Text>
            </Pressable>
            <Pressable
              style={styles.navToggle}
              onPress={() => setDesktopNavExpanded((value) => !value)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={desktopNavExpanded ? 'Скрыть варианты навигации' : 'Показать варианты навигации'}
            >
              <Text style={styles.navToggleText}>{desktopNavExpanded ? '▲' : '▼'}</Text>
            </Pressable>
            <Pressable
              style={styles.coordsButton}
              onPress={copyCurrentStepCoords}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Копировать координаты ${currentStep.lat.toFixed(4)}, ${currentStep.lng.toFixed(4)}`}
            >
              <Text style={styles.coordsButtonText}>{currentStep.lat.toFixed(4)}, {currentStep.lng.toFixed(4)}</Text>
            </Pressable>
            {Boolean(currentStep.image) && (
              <Pressable
                style={styles.photoToggle}
                onPress={toggleMap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showMap ? 'Скрыть фото' : 'Показать фото'}
              >
                <Text style={styles.photoToggleText}>{showMap ? 'Скрыть фото' : 'Фото'}</Text>
              </Pressable>
            )}
          </View>
          {desktopNavExpanded && (
            <View style={styles.navDropdown}>
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('google'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>Google Maps</Text></Pressable>
              {Platform.OS === 'ios' && (<Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('apple'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>Apple Maps</Text></Pressable>)}
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('yandex'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>Yandex Maps</Text></Pressable>
              {desktopHasOrganic && (<Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('organic'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>Organic Maps</Text></Pressable>)}
              {desktopHasMapsme && (<Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('mapsme'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>MAPS.ME</Text></Pressable>)}
            </View>
          )}
        </View>
      )}

      <Suspense fallback={<QuestMapSkeleton />}>
        <QuestFullMapLazy
          steps={steps}
          height={useWideInlineLayout ? (compactDesktopLayout ? 460 : 520) : 360}
          title="Карта квеста"
          activeStepIndex={activeStepIndex}
        />
      </Suspense>
    </View>
  )
}

export function QuestExcursionsInline({
  styles,
  city,
  title,
}: SharedProps & {
  city: CityLike
  title: string
}) {
  return (
    <View style={styles.excursionsSection}>
      <View style={styles.excursionsDivider} />
      <View style={styles.excursionsCard}>
        <View style={styles.excursionsHeader}>
          <Text style={styles.excursionsTitle}>Экскурсии рядом</Text>
          <Text style={styles.excursionsSubtitle}>Откройте больше с местными гидами</Text>
        </View>
        <Suspense fallback={null}>
          <BelkrajWidgetLazy
            points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
            countryCode={city.countryCode}
            className="belkraj-slot"
          />
        </Suspense>
      </View>
    </View>
  )
}

export function QuestExcursionsSidebar({
  styles,
  city,
  title,
}: SharedProps & {
  city: CityLike
  title: string
}) {
  return (
    <View style={styles.excursionsSidebar}>
      <View style={styles.excursionsSidebarInner}>
        <Text style={styles.excursionsTitle}>Экскурсии рядом</Text>
        <Text style={styles.excursionsSubtitle}>Откройте больше с местными гидами</Text>
        <View style={styles.excursionsSidebarWidget}>
          <Suspense fallback={null}>
            <BelkrajWidgetLazy
              points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
              countryCode={city.countryCode}
              className="belkraj-slot"
            />
          </Suspense>
        </View>
      </View>
    </View>
  )
}

export function QuestCompactExcursions({
  styles,
  city,
  title,
}: SharedProps & {
  city: CityLike
  title: string
}) {
  return (
    <View style={styles.compactExcursionsSection}>
      <View style={styles.compactExcursionsHeader}>
        <Text style={styles.excursionsTitle}>Экскурсии рядом</Text>
        <Text style={styles.excursionsSubtitle}>Откройте больше с местными гидами</Text>
      </View>
      <Suspense fallback={null}>
        <BelkrajWidgetLazy
          points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
          countryCode={city.countryCode}
          className="belkraj-slot"
        />
      </Suspense>
    </View>
  )
}

export function QuestFinalePanel({
  colors: _colors,
  styles,
  finale,
  allCompleted,
  completedCount,
  stepsCount,
  frameW,
  youtubeEmbedUri,
  videoOk,
  videoUri,
  posterUri,
  handleVideoError,
  handleVideoRetry,
  setVideoOk,
}: SharedProps & {
  finale: FinaleLike
  allCompleted: boolean
  completedCount: number
  stepsCount: number
  frameW: number
  youtubeEmbedUri?: string
  videoOk: boolean
  videoUri?: string
  posterUri?: string
  handleVideoError: () => void
  handleVideoRetry: () => void
  setVideoOk: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
    <View style={styles.completionScreen}>
      {allCompleted ? (
        <>
          <Text style={styles.completionTitle}>Квест завершен!</Text>

          {finale.video && (
            <View
              style={[
                styles.videoFrame,
                {
                  width: '100%',
                  maxWidth: frameW,
                  aspectRatio: 16 / 9,
                },
              ]}
            >
              {Platform.OS === 'web' ? (
                youtubeEmbedUri ? (
                  <iframe
                    src={youtubeEmbedUri}
                    width="100%"
                    height="100%"
                    style={{ border: 'none', display: 'block' }}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title="Видео квеста"
                  />
                ) : videoOk ? (
                  <QuestWebVideo src={videoUri} poster={posterUri} onError={handleVideoError} />
                ) : (
                  <>
                    {posterUri ? (
                      <ImageCardMedia
                        src={posterUri}
                        fit="contain"
                        blurBackground
                        allowCriticalWebBlur
                        blurRadius={18}
                        style={StyleSheet.absoluteFillObject as any}
                        alt="Постер видео квеста"
                      />
                    ) : null}
                    <View style={styles.videoFallbackOverlay}>
                      <Text style={styles.videoFallbackText}>Не удалось воспроизвести видео. Попробуйте ещё раз.</Text>
                      <Pressable onPress={handleVideoRetry} style={styles.videoRetryBtn} hitSlop={8}>
                        <Text style={styles.videoRetryText}>Повторить</Text>
                      </Pressable>
                    </View>
                  </>
                )
              ) : (
                <Suspense fallback={null}>
                  <NativeQuestVideoLazy
                    source={typeof finale.video === 'string' ? { uri: finale.video } : finale.video}
                    posterSource={typeof finale.poster === 'string' ? { uri: finale.poster } : finale.poster}
                    usePoster={!!finale.poster}
                    style={StyleSheet.absoluteFill}
                    useNativeControls
                    shouldPlay={false}
                    isLooping={false}
                    onError={() => setVideoOk(false)}
                  />
                </Suspense>
              )}
            </View>
          )}

          <Text style={styles.completionText}>{finale.text}</Text>
        </>
      ) : (
        <Text style={[styles.completionText, { opacity: 0.8 }]}>
          Чтобы открыть приз/видео — завершите все шаги ({completedCount} из {stepsCount}).
        </Text>
      )}
    </View>
  )
}

function QuestMapSkeleton() {
  const colors = useThemedColors()
  return (
    <View style={{ height: 300, borderRadius: 16, backgroundColor: colors.backgroundSecondary, overflow: 'hidden' }}>
      <View style={{ flex: 1, opacity: 0.6, backgroundColor: colors.borderLight }} />
    </View>
  )
}
