import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { globalFocusStyles } from '@/styles/globalFocus'
import { openExternalUrl } from '@/utils/externalLinks'
import { hapticNotification } from '@/utils/haptics'

import QuestPointNavigator from './QuestPointNavigator'
import { copyQuestCoords, openQuestMap, type QuestMapApp } from './questWizardHelpers'
import type { QuestPoiInfo } from './types'

const SHOULD_USE_NATIVE_DRIVER = false

type QuestStepLike = {
  id: string
  title: string
  location: string
  story: string
  task: string
  hint?: string
  answer: (input: string) => boolean
  lat: number
  lng: number
  image?: any
  inputType?: 'number' | 'text'
  poiInfo?: QuestPoiInfo | null
}

type StepCardProps = {
  colors: any
  styles: any
  step: QuestStepLike
  index: number
  attempts: number
  hintVisible: boolean
  savedAnswer?: string
  onSubmit: (v: string) => void
  onWrongAttempt: () => void
  onToggleHint: () => void
  onSkip: () => void
  showMap: boolean
  onToggleMap: () => void
  showLocationControls?: boolean
}

const normalizeVisitorWebsiteUrl = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

function ImageZoomModal({
  styles,
  image,
  visible,
  onClose,
}: {
  styles: any
  image: any
  visible: boolean
  onClose: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current
  const shouldUseNativeDriver = false
  // @ts-ignore -- Animated.event nativeEvent type narrowing requires explicit cast for pinch gesture
  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], { useNativeDriver: shouldUseNativeDriver })
  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: shouldUseNativeDriver }).start()
    }
  }

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <GestureHandlerRootView style={styles.gestureContainer}>
          <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
            <Animated.View style={styles.animatedContainer}>
              <Animated.Image source={image} style={[styles.zoomedImage, { transform: [{ scale }] }]} resizeMode="contain" />
            </Animated.View>
          </PinchGestureHandler>
        </GestureHandlerRootView>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Закрыть просмотр фото">
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
        {Platform.OS !== 'web' && (
          <View style={styles.zoomHintContainer}>
            <Text style={styles.zoomHint}>Используйте два пальца, чтобы увеличить фото</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

export const QuestStepCard = memo(function QuestStepCard(props: StepCardProps) {
  const {
    colors,
    styles,
    step,
    index,
    attempts,
    hintVisible,
    savedAnswer,
    onSubmit,
    onWrongAttempt,
    onToggleHint,
    onSkip,
    showMap,
    onToggleMap,
    showLocationControls = true,
  } = props

  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [navExpanded, setNavExpanded] = useState(false)
  const shakeAnim = useRef(new Animated.Value(0)).current

  const flip = useRef(new Animated.Value(0)).current
  const [isFlipping, setIsFlipping] = useState(false)
  const rotation = useMemo(
    () => flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '180deg', '360deg'] }),
    [flip],
  )

  const triggerFlip = useCallback(() => {
    flip.setValue(0)
    setIsFlipping(true)
    Animated.timing(flip, { toValue: 1, duration: 600, useNativeDriver: SHOULD_USE_NATIVE_DRIVER }).start(() => {
      flip.setValue(0)
      setIsFlipping(false)
    })
  }, [flip])

  useEffect(() => {
    setValue('')
    setError('')
  }, [step.id])

  const openInMap = useCallback(
    (app: QuestMapApp) => openQuestMap(step, app),
    [step],
  )
  const openDefaultMap = useCallback(() => {
    void openInMap(Platform.OS === 'ios' ? 'apple' : 'google')
  }, [openInMap])
  const copyCoords = useCallback(() => {
    void copyQuestCoords(step)
  }, [step])
  const toggleNavigationOptions = useCallback(() => {
    setNavExpanded((expanded) => !expanded)
  }, [])
  const closeImageModal = useCallback(() => {
    setImageModalVisible(false)
  }, [])
  const openImageModal = useCallback(() => {
    setImageModalVisible(true)
  }, [])
  const openNavigationOption = useCallback((app: QuestMapApp) => {
    void openInMap(app)
    setNavExpanded(false)
  }, [openInMap])

  const shake = useCallback(() => {
    shakeAnim.setValue(0)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: SHOULD_USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: SHOULD_USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: SHOULD_USE_NATIVE_DRIVER }),
    ]).start()
  }, [shakeAnim])

  const isAutoPassStep = useMemo(
    () => (step.answer as any)._isAny === true || /\(\)\s*=>\s*true/.test(step.answer.toString()),
    [step.answer],
  )
  const isPassed = !!savedAnswer && step.id !== 'intro'
  const hintSuggestedAfter = 1
  const hintSuggested = hintVisible || attempts >= hintSuggestedAfter
  const hasMapPaneContent = showLocationControls || (showMap && !!step.image)
  const hasLocationContent = isPassed || hasMapPaneContent
  const imageSource = useMemo(
    () => (typeof step.image === 'string' ? { uri: step.image } : step.image),
    [step.image],
  )

  const hasValidCoords =
    Number.isFinite(step.lat) &&
    Number.isFinite(step.lng) &&
    !(step.lat === 0 && step.lng === 0)
  const showPointNavigator = step.id !== 'intro' && !isPassed && hasValidCoords
  const visitorWebsiteUrl = useMemo(() => normalizeVisitorWebsiteUrl(step.poiInfo?.website), [step.poiInfo?.website])
  const visitorInfoRows = useMemo(() => {
    const poiInfo = step.poiInfo
    if (!poiInfo) return []
    return [
      poiInfo.isMuseum ? { key: 'type', label: 'Тип', value: 'Музей' } : null,
      poiInfo.openingHours ? { key: 'hours', label: 'Часы работы', value: poiInfo.openingHours } : null,
      poiInfo.ticketPrice ? { key: 'price', label: 'Билеты', value: poiInfo.ticketPrice } : null,
    ].filter((row): row is { key: string; label: string; value: string } => Boolean(row))
  }, [step.poiInfo])
  const showVisitorInfo = visitorInfoRows.length > 0 || Boolean(visitorWebsiteUrl)
  const openVisitorWebsite = useCallback(() => {
    if (!visitorWebsiteUrl) return
    void openExternalUrl(visitorWebsiteUrl, { allowedProtocols: ['http:', 'https:'] })
  }, [visitorWebsiteUrl])

  const handleCheck = useCallback(() => {
    const trimmed = value.trim()
    if (step.id === 'intro') {
      onSubmit('start')
      return
    }
    if (!trimmed) {
      setError('Введите ответ')
      shake()
      hapticNotification('warning')
      return
    }
    const normalized = step.inputType === 'number'
      ? trimmed.replace(',', '.').trim()
      : trimmed.toLowerCase().replace(/\s+/g, ' ').trim()
    const ok = step.answer(normalized)
    if (ok) {
      setError('')
      hapticNotification('success')
      triggerFlip()
      setTimeout(() => {
        onSubmit(trimmed)
        Keyboard.dismiss()
      }, 200)
    } else {
      setError('Неверный ответ')
      onWrongAttempt()
      shake()
      hapticNotification('error')
    }
  }, [onSubmit, onWrongAttempt, shake, step, triggerFlip, value])

  return (
    <Animated.View style={[styles.card, isFlipping && { transform: [{ perspective: 800 }, { rotateY: rotation }] }]}>
      <View style={styles.cardHeader}>
        {step.id !== 'intro' && (
          <View style={[styles.stepNumber, isPassed && styles.stepNumberCompleted]}>
            <Text style={styles.stepNumberText}>{index}</Text>
          </View>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Pressable
            onPress={openDefaultMap}
            accessibilityRole="button"
            accessibilityLabel={`Открыть в картах: ${step.location}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            hitSlop={6}
          >
            <Feather name="map-pin" size={13} color={colors.brandText} />
            <Text style={[styles.location, { flexShrink: 1 }]} numberOfLines={2}>{step.location}</Text>
            <Feather name="external-link" size={12} color={colors.brandText} />
          </Pressable>
          {showPointNavigator && (
            <QuestPointNavigator targetLat={step.lat} targetLng={step.lng} colors={colors} />
          )}
        </View>
        {isPassed && (<View style={styles.completedBadge}><Text style={styles.completedText}>✓</Text></View>)}
      </View>

      <View style={styles.section}><Text style={styles.storyText}>{step.story}</Text></View>

      {showVisitorInfo && (
        <View style={[styles.section, styles.visitorInfoCard]} testID="quest-step-visitor-info">
          <View style={styles.visitorInfoHeader}>
            <Feather name="info" size={16} color={colors.brandText} />
            <Text style={styles.visitorInfoTitle}>Информация для посетителей</Text>
          </View>
          {visitorInfoRows.map((row) => (
            <View key={row.key} style={styles.visitorInfoRow}>
              <Text style={styles.visitorInfoLabel}>{row.label}</Text>
              <Text style={styles.visitorInfoValue}>{row.value}</Text>
            </View>
          ))}
          {visitorWebsiteUrl && (
            <Pressable
              style={styles.visitorInfoLink}
              onPress={openVisitorWebsite}
              accessibilityRole="link"
              accessibilityLabel="Открыть сайт места"
              hitSlop={6}
            >
              <Feather name="external-link" size={14} color={colors.brandText} />
              <Text style={styles.visitorInfoLinkText}>Сайт места</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.taskText}>{step.task}</Text>

        {step.id !== 'intro' && !isPassed && (
          isAutoPassStep
            ? (
              <Pressable style={styles.primaryButton} onPress={() => onSubmit('ok')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Далее">
                <Text style={styles.buttonText}>Далее</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.inputRow}>
                  <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: shakeAnim }] }]}>
                    <TextInput
                      style={[styles.input, error ? styles.inputError : null, globalFocusStyles.focusable]}
                      placeholder="Ваш ответ..."
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={setValue}
                      onSubmitEditing={handleCheck}
                      returnKeyType="done"
                      keyboardType={step.inputType === 'number' ? (Platform.OS === 'ios' ? 'number-pad' : 'numeric') : 'default'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </Animated.View>
                  <Pressable style={styles.checkButton} onPress={handleCheck} hitSlop={6} accessibilityRole="button" accessibilityLabel="Проверить ответ">
                    <Feather name="arrow-right" size={24} color={colors.textOnPrimary} />
                  </Pressable>
                </View>
                {!!error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <View style={styles.inlineActions}>
                  {step.hint && (
                    <Pressable onPress={onToggleHint} hitSlop={8} accessibilityRole="button" accessibilityLabel={hintVisible ? 'Скрыть подсказку' : 'Показать подсказку'}>
                      <Text style={styles.linkText}>{hintVisible ? 'Скрыть подсказку' : 'Подсказка'}</Text>
                    </Pressable>
                  )}
                  {step.hint && (<Text style={styles.linkSeparator}>·</Text>)}
                  <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel="Пропустить шаг">
                    <Text style={styles.linkText}>Пропустить</Text>
                  </Pressable>
                </View>
                {step.hint && !hintVisible && hintSuggested && (
                  <Text style={styles.hintPrompt}>
                    Застряли? Откройте подсказку выше.
                  </Text>
                )}
              </>
            )
        )}

        {step.hint && (
          <View style={[styles.hintContainer, !hintVisible && Platform.select({ web: { visibility: 'hidden' } as any, default: { display: 'none' } })]}>
            <Text style={styles.hintText}>Подсказка: {step.hint}</Text>
          </View>
        )}
      </View>

      {step.id !== 'intro' && hasLocationContent && (
        <View style={styles.section}>
          <View style={[styles.answerMapSplit, isPassed && hasMapPaneContent && styles.answerMapSplitWithAnswer]}>
            {isPassed && (
              <View style={[styles.answerMapPane, styles.answerPane]}>
                <View style={styles.answerContainer}>
                  <Text style={styles.answerLabel}>Ваш ответ:</Text>
                  <Text style={styles.answerValue} numberOfLines={3}>{savedAnswer}</Text>
                </View>
              </View>
            )}

            {hasMapPaneContent && (
              <View style={[styles.answerMapPane, styles.mapPane]}>
                {showLocationControls && (
                  <>
                    <View style={styles.navRow}>
                      <Pressable style={styles.navButton} onPress={openDefaultMap} hitSlop={6} accessibilityRole="button" accessibilityLabel="Открыть навигацию">
                        <Text style={styles.navButtonText}>Навигация</Text>
                      </Pressable>
                      <Pressable style={styles.navToggle} onPress={toggleNavigationOptions} hitSlop={6} accessibilityRole="button" accessibilityLabel={navExpanded ? 'Скрыть варианты навигации' : 'Показать варианты навигации'}>
                        <Text style={styles.navToggleText}>{navExpanded ? '▲' : '▼'}</Text>
                      </Pressable>
                      <Pressable style={styles.coordsButton} onPress={copyCoords} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Копировать координаты ${step.lat.toFixed(4)}, ${step.lng.toFixed(4)}`}>
                        <Text style={styles.coordsButtonText}>{step.lat.toFixed(4)}, {step.lng.toFixed(4)}</Text>
                      </Pressable>
                      {step.image && (
                        <Pressable style={styles.photoToggle} onPress={onToggleMap} hitSlop={8} accessibilityRole="button" accessibilityLabel={showMap ? 'Скрыть фото' : 'Показать фото'}>
                          <Text style={styles.photoToggleText}>{showMap ? 'Скрыть фото' : 'Фото'}</Text>
                        </Pressable>
                      )}
                    </View>
                    {navExpanded && (
                      <View style={styles.navDropdown}>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('google')}><Text style={styles.navOptionText}>Google Maps</Text></Pressable>
                        {Platform.OS === 'ios' && (<Pressable style={styles.navOption} onPress={() => openNavigationOption('apple')}><Text style={styles.navOptionText}>Apple Maps</Text></Pressable>)}
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('organic')}><Text style={styles.navOptionText}>Organic Maps</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('waze')}><Text style={styles.navOptionText}>Waze</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('yandex')}><Text style={styles.navOptionText}>Яндекс.Навигатор</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('mapsme')}><Text style={styles.navOptionText}>MAPS.ME</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('osm')}><Text style={styles.navOptionText}>OpenStreetMap</Text></Pressable>
                      </View>
                    )}
                  </>
                )}

                {showMap && step.image && (
                  <>
                    <Text style={styles.photoHint}>Это статичное фото-подсказка, не интерактивная карта.</Text>
                    <Pressable style={styles.imagePreview} onPress={openImageModal}>
                      <ImageCardMedia
                        source={imageSource}
                        fit="contain"
                        blurBackground
                        allowCriticalWebBlur
                        blurRadius={16}
                        alt={step.title ? `Фото-подсказка для шага ${step.title}` : 'Фото-подсказка'}
                        style={styles.previewImage}
                      />
                      <View style={styles.imageOverlay}><Text style={styles.overlayText}>Нажмите для увеличения</Text></View>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>

          <ImageZoomModal
            styles={styles}
            image={imageSource}
            visible={imageModalVisible}
            onClose={closeImageModal}
          />
        </View>
      )}

      {step.id === 'intro' && (
        <Pressable style={styles.startButton} onPress={handleCheck} hitSlop={6}>
          <Text style={styles.startButtonText}>Начать квест</Text>
        </Pressable>
      )}

      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
          {
            alignItems: 'center',
            justifyContent: 'center',
            opacity: flip.interpolate({ inputRange: [0.35, 0.5, 0.65], outputRange: [0, 1, 0] }),
          },
          { pointerEvents: 'none' } as any,
        ]}
      >
        <View style={styles.flipBadge}><Text style={styles.flipText}>✓ Правильно!</Text></View>
      </Animated.View>
    </Animated.View>
  )
})
