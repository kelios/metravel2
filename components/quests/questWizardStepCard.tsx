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
import { translate as i18nT } from '@/i18n'


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
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.zakryt_prosmotr_foto_ce5e2b00')}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
        {Platform.OS !== 'web' && (
          <View style={styles.zoomHintContainer}>
            <Text style={styles.zoomHint}>{i18nT('quests:components.quests.questWizardStepCard.ispolzuyte_dva_paltsa_chtoby_uvelichit_foto_03ee3a2e')}</Text>
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
      poiInfo.isMuseum ? { key: 'type', label: i18nT('quests:components.quests.questWizardStepCard.tip_bbadeb50'), value: i18nT('quests:components.quests.questWizardStepCard.poiType.museum') } : null,
      poiInfo.openingHours ? { key: 'hours', label: i18nT('quests:components.quests.questWizardStepCard.chasy_raboty_64c942b8'), value: poiInfo.openingHours } : null,
      poiInfo.ticketPrice ? { key: 'price', label: i18nT('quests:components.quests.questWizardStepCard.bilety_e9c72fb2'), value: poiInfo.ticketPrice } : null,
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
      setError(i18nT('quests:components.quests.questWizardStepCard.vvedite_otvet_a0ee4604'))
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
      setError(i18nT('quests:components.quests.questWizardStepCard.nevernyy_otvet_22371740'))
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
            accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.otkryt_v_kartah_value1_6472f175', { value1: step.location })}
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
            <Text style={styles.visitorInfoTitle}>{i18nT('quests:components.quests.questWizardStepCard.informatsiya_dlya_posetiteley_051342b6')}</Text>
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
              accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.otkryt_sayt_mesta_3b99f2eb')}
              hitSlop={6}
            >
              <Feather name="external-link" size={14} color={colors.brandText} />
              <Text style={styles.visitorInfoLinkText}>{i18nT('quests:components.quests.questWizardStepCard.sayt_mesta_9e0f7d94')}</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.taskText}>{step.task}</Text>

        {step.id !== 'intro' && !isPassed && (
          isAutoPassStep
            ? (
              <Pressable style={styles.primaryButton} onPress={() => onSubmit('ok')} hitSlop={6} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.dalee_74add698')}>
                <Text style={styles.buttonText}>{i18nT('quests:components.quests.questWizardStepCard.dalee_74add698')}</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.inputRow}>
                  <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: shakeAnim }] }]}>
                    <TextInput
                      style={[styles.input, error ? styles.inputError : null, globalFocusStyles.focusable]}
                      placeholder={i18nT('quests:components.quests.questWizardStepCard.vash_otvet_21a01dd5')}
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
                  <Pressable style={styles.checkButton} onPress={handleCheck} hitSlop={6} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.proverit_otvet_76814505')}>
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
                    <Pressable onPress={onToggleHint} hitSlop={8} accessibilityRole="button" accessibilityLabel={hintVisible ? i18nT('quests:components.quests.questWizardStepCard.skryt_podskazku_57f34c03') : i18nT('quests:components.quests.questWizardStepCard.pokazat_podskazku_fea5f2bc')}>
                      <Text style={styles.linkText}>{hintVisible ? i18nT('quests:components.quests.questWizardStepCard.skryt_podskazku_57f34c03') : i18nT('quests:components.quests.questWizardStepCard.podskazka_e3530449')}</Text>
                    </Pressable>
                  )}
                  {step.hint && (<Text style={styles.linkSeparator}>·</Text>)}
                  <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.propustit_shag_1965c65e')}>
                    <Text style={styles.linkText}>{i18nT('quests:components.quests.questWizardStepCard.propustit_0358f4b6')}</Text>
                  </Pressable>
                </View>
                {step.hint && !hintVisible && hintSuggested && (
                  <Text style={styles.hintPrompt}>
                    {i18nT('quests:components.quests.questWizardStepCard.zastryali_otkroyte_podskazku_vyshe_128fae28')}</Text>
                )}
              </>
            )
        )}

        {step.hint && (
          <View style={[styles.hintContainer, !hintVisible && Platform.select({ web: { visibility: 'hidden' } as any, default: { display: 'none' } })]}>
            <Text style={styles.hintText}>{i18nT('quests:components.quests.questWizardStepCard.podskazka_5453c538')}{step.hint}</Text>
          </View>
        )}
      </View>

      {step.id !== 'intro' && hasLocationContent && (
        <View style={styles.section}>
          <View style={[styles.answerMapSplit, isPassed && hasMapPaneContent && styles.answerMapSplitWithAnswer]}>
            {isPassed && (
              <View style={[styles.answerMapPane, styles.answerPane]}>
                <View style={styles.answerContainer}>
                  <Text style={styles.answerLabel}>{i18nT('quests:components.quests.questWizardStepCard.vash_otvet_540d4fc8')}</Text>
                  <Text style={styles.answerValue} numberOfLines={3}>{savedAnswer}</Text>
                </View>
              </View>
            )}

            {hasMapPaneContent && (
              <View style={[styles.answerMapPane, styles.mapPane]}>
                {showLocationControls && (
                  <>
                    <View style={styles.navRow}>
                      <Pressable style={styles.navButton} onPress={openDefaultMap} hitSlop={6} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.otkryt_navigatsiyu_4d8f628e')}>
                        <Text style={styles.navButtonText}>{i18nT('quests:components.quests.questWizardStepCard.navigatsiya_01b17385')}</Text>
                      </Pressable>
                      <Pressable style={styles.navToggle} onPress={toggleNavigationOptions} hitSlop={6} accessibilityRole="button" accessibilityLabel={navExpanded ? i18nT('quests:components.quests.questWizardStepCard.skryt_varianty_navigatsii_6ab5fa55') : i18nT('quests:components.quests.questWizardStepCard.pokazat_varianty_navigatsii_1872f9c6')}>
                        <Text style={styles.navToggleText}>{navExpanded ? '▲' : '▼'}</Text>
                      </Pressable>
                      <Pressable style={styles.coordsButton} onPress={copyCoords} hitSlop={6} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.kopirovat_koordinaty_value1_value2_6750202e', { value1: step.lat.toFixed(4), value2: step.lng.toFixed(4) })}>
                        <Text style={styles.coordsButtonText}>{step.lat.toFixed(4)}, {step.lng.toFixed(4)}</Text>
                      </Pressable>
                      {step.image && (
                        <Pressable style={styles.photoToggle} onPress={onToggleMap} hitSlop={8} accessibilityRole="button" accessibilityLabel={showMap ? i18nT('quests:components.quests.questWizardStepCard.skryt_foto_3ae447b6') : i18nT('quests:components.quests.questWizardStepCard.pokazat_foto_5729b6d2')}>
                          <Text style={styles.photoToggleText}>{showMap ? i18nT('quests:components.quests.questWizardStepCard.skryt_foto_3ae447b6') : i18nT('quests:components.quests.questWizardStepCard.foto_39b57795')}</Text>
                        </Pressable>
                      )}
                    </View>
                    {navExpanded && (
                      <View style={styles.navDropdown}>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('google')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.google_maps_5202efe6')}</Text></Pressable>
                        {Platform.OS === 'ios' && (<Pressable style={styles.navOption} onPress={() => openNavigationOption('apple')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.apple_maps_7e7eb0fd')}</Text></Pressable>)}
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('organic')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.organic_maps_85e3792b')}</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('waze')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.waze_219962a9')}</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('yandex')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.yandeks_navigator_889d6713')}</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('mapsme')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.maps_me_e3d32aec')}</Text></Pressable>
                        <Pressable style={styles.navOption} onPress={() => openNavigationOption('osm')}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardStepCard.openstreetmap_94cca6ca')}</Text></Pressable>
                      </View>
                    )}
                  </>
                )}

                {showMap && step.image && (
                  <>
                    <Text style={styles.photoHint}>{i18nT('quests:components.quests.questWizardStepCard.eto_statichnoe_foto_podskazka_ne_interaktivn_290925e0')}</Text>
                    <Pressable style={styles.imagePreview} onPress={openImageModal}>
                      <ImageCardMedia
                        source={imageSource}
                        fit="contain"
                        blurBackground
                        allowCriticalWebBlur
                        blurRadius={16}
                        alt={step.title ? i18nT('quests:components.quests.questWizardStepCard.foto_podskazka_dlya_shaga_value1_1956118e', { value1: step.title }) : i18nT('quests:components.quests.questWizardStepCard.foto_podskazka_ef3dfff5')}
                        style={styles.previewImage}
                      />
                      <View style={styles.imageOverlay}><Text style={styles.overlayText}>{i18nT('quests:components.quests.questWizardStepCard.nazhmite_dlya_uvelicheniya_55e02b7a')}</Text></View>
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
          <Text style={styles.startButtonText}>{i18nT('quests:components.quests.questWizardStepCard.nachat_kvest_2847e749')}</Text>
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
        <View style={styles.flipBadge}><Text style={styles.flipText}>{i18nT('quests:components.quests.questWizardStepCard.pravilno_2f264674')}</Text></View>
      </Animated.View>
    </Animated.View>
  )
})
