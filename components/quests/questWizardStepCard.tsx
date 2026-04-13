import React, { memo, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native'
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { globalFocusStyles } from '@/styles/globalFocus'

import { copyQuestCoords, detectQuestMapApps, openQuestMap } from './questWizardHelpers'

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
        <View style={styles.zoomHintContainer}>
          <Text style={styles.zoomHint}>Используйте два пальца, чтобы увеличить фото</Text>
        </View>
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
  const [hasOrganic, setHasOrganic] = useState(false)
  const [hasMapsme, setHasMapsme] = useState(false)
  const [navExpanded, setNavExpanded] = useState(false)
  const shakeAnim = useRef(new Animated.Value(0)).current
  const shouldUseNativeDriver = false

  const flip = useRef(new Animated.Value(0)).current
  const triggerFlip = () => {
    flip.setValue(0)
    Animated.timing(flip, { toValue: 1, duration: 600, useNativeDriver: shouldUseNativeDriver }).start(() => flip.setValue(0))
  }
  const rot = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '180deg', '360deg'] })

  useEffect(() => {
    setValue('')
    setError('')
  }, [step.id])

  useEffect(() => {
    ;(async () => {
      const detected = await detectQuestMapApps()
      setHasOrganic(detected.hasOrganic)
      setHasMapsme(detected.hasMapsme)
    })()
  }, [step.id])

  const openInMap = async (app: 'google' | 'apple' | 'yandex' | 'organic' | 'mapsme') => openQuestMap(step, app)
  const copyCoords = async () => copyQuestCoords(step)

  const shake = () => {
    shakeAnim.setValue(0)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: shouldUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: shouldUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: shouldUseNativeDriver }),
    ]).start()
  }

  const handleCheck = () => {
    const trimmed = value.trim()
    if (step.id === 'intro') {
      onSubmit('start')
      return
    }
    if (!trimmed) {
      setError('Введите ответ')
      shake()
      Vibration.vibrate(50)
      return
    }
    const normalized = step.inputType === 'number'
      ? trimmed.replace(',', '.').trim()
      : trimmed.toLowerCase().replace(/\s+/g, ' ').trim()
    const ok = step.answer(normalized)
    if (ok) {
      setError('')
      Vibration.vibrate(60)
      triggerFlip()
      setTimeout(() => {
        onSubmit(trimmed)
        Keyboard.dismiss()
      }, 520)
    } else {
      setError('Неверный ответ')
      onWrongAttempt()
      shake()
      Vibration.vibrate(200)
    }
  }

  const isPassed = !!savedAnswer && step.id !== 'intro'
  const showHintAfter = 2
  const hasMapPaneContent = showLocationControls || (showMap && !!step.image)
  const hasLocationContent = isPassed || hasMapPaneContent

  return (
    <Animated.View style={[styles.card, { transform: [{ perspective: 800 }, { rotateY: rot }] }]}>
      <View style={styles.cardHeader}>
        {step.id !== 'intro' && (
          <View style={[styles.stepNumber, isPassed && styles.stepNumberCompleted]}>
            <Text style={styles.stepNumberText}>{index}</Text>
          </View>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Pressable onPress={() => openInMap(Platform.OS === 'ios' ? 'apple' : 'google')} accessibilityRole="button" accessibilityLabel={`Открыть в картах: ${step.location}`}>
            <Text style={styles.location} numberOfLines={2}>{step.location}</Text>
          </Pressable>
        </View>
        {isPassed && (<View style={styles.completedBadge}><Text style={styles.completedText}>✓</Text></View>)}
      </View>

      <View style={styles.section}><Text style={styles.storyText}>{step.story}</Text></View>

      <View style={styles.section}>
        <Text style={styles.taskText}>{step.task}</Text>

        {step.id !== 'intro' && !isPassed && (
          ((step.answer as any)._isAny === true || /\(\)\s*=>\s*true/.test(step.answer.toString()))
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
                    <Text style={styles.checkButtonText}>→</Text>
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
                {step.hint && attempts < showHintAfter && !hintVisible && (
                  <Text style={styles.hintPrompt}>Подсказка доступна после {showHintAfter - attempts} попыток</Text>
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
                      <Pressable style={styles.navButton} onPress={() => openInMap(Platform.OS === 'ios' ? 'apple' : 'google')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Открыть навигацию">
                        <Text style={styles.navButtonText}>Навигация</Text>
                      </Pressable>
                      <Pressable style={styles.navToggle} onPress={() => setNavExpanded((value) => !value)} hitSlop={6} accessibilityRole="button" accessibilityLabel={navExpanded ? 'Скрыть варианты навигации' : 'Показать варианты навигации'}>
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
                        <Pressable style={styles.navOption} onPress={() => { openInMap('google'); setNavExpanded(false) }}><Text style={styles.navOptionText}>Google Maps</Text></Pressable>
                        {Platform.OS === 'ios' && (<Pressable style={styles.navOption} onPress={() => { openInMap('apple'); setNavExpanded(false) }}><Text style={styles.navOptionText}>Apple Maps</Text></Pressable>)}
                        <Pressable style={styles.navOption} onPress={() => { openInMap('yandex'); setNavExpanded(false) }}><Text style={styles.navOptionText}>Yandex Maps</Text></Pressable>
                        {hasOrganic && (<Pressable style={styles.navOption} onPress={() => { openInMap('organic'); setNavExpanded(false) }}><Text style={styles.navOptionText}>Organic Maps</Text></Pressable>)}
                        {hasMapsme && (<Pressable style={styles.navOption} onPress={() => { openInMap('mapsme'); setNavExpanded(false) }}><Text style={styles.navOptionText}>MAPS.ME</Text></Pressable>)}
                      </View>
                    )}
                  </>
                )}

                {showMap && step.image && (
                  <>
                    <Text style={styles.photoHint}>Это статичное фото-подсказка, не интерактивная карта.</Text>
                    <Pressable style={styles.imagePreview} onPress={() => setImageModalVisible(true)}>
                      <ImageCardMedia
                        source={typeof step.image === 'string' ? { uri: step.image } : step.image}
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
            image={typeof step.image === 'string' ? { uri: step.image } : step.image}
            visible={imageModalVisible}
            onClose={() => setImageModalVisible(false)}
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
