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

import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { globalFocusStyles } from '@/styles/globalFocus'
import { openExternalUrl } from '@/utils/externalLinks'
import { hapticNotification } from '@/utils/haptics'
import { describeQuestAnswer, evaluateQuestAnswer } from '@/utils/questAnswerEvaluation'
import { recordQuestAnswerAttempt } from '@/utils/questAnswerTelemetry'

import QuestPointNavigator from './QuestPointNavigator'
import { copyQuestCoords, openQuestMap, type QuestMapApp } from './questWizardHelpers'
import { type QuestLegInfo } from './questStepDistance'
import type { QuestAnswerChecker, QuestPoiInfo } from './types'
import { formatDistance, formatTravelTime } from '@/utils/distanceCalculator'
import { translate as i18nT } from '@/i18n'


const SHOULD_USE_NATIVE_DRIVER = false

// #1428: пауза между неверными попытками на шагах с перебираемым ответом.
// Нарастает, но остаётся короткой — это не наказание, а стоп-кран для подбора:
// четыре варианта узкого диапазона больше не укладываются в 11 секунд.
// Последнее значение действует и для всех дальнейших попыток.
const WRONG_ATTEMPT_COOLDOWNS_MS = [3000, 5000, 8000, 12000, 15000]

// #1430: после скольких неверных попыток подряд игроку предлагается выход
// вперёд — пропустить шаг. Одна ошибка это ещё не тупик, поэтому не 1.
const SKIP_SUGGESTED_AFTER = 3

const cooldownForAttempt = (wrongAttemptNo: number): number =>
  WRONG_ATTEMPT_COOLDOWNS_MS[
    Math.min(Math.max(wrongAttemptNo, 1), WRONG_ATTEMPT_COOLDOWNS_MS.length) - 1
  ]

/**
 * Паузы переживают перемонтирование карточки: полоса шагов на том же экране
 * позволяет уйти на соседний шаг и вернуться в два тапа, и в локальном стейте
 * дедлайн на этом терялся — перебор продолжался без ожидания.
 *
 * Живёт в модуле, а не в снапшоте прогресса рядом с `attempts`, намеренно:
 * пауза — свойство текущего сеанса подбора, а не многодневного прогресса.
 * Игрок, ошибавшийся вчера, начинает сегодня с первой ступени лестницы, а не с
 * пятнадцати секунд.
 */
const stepCooldowns = new Map<string, { until: number; wrongAttempts: number }>()

const cooldownKey = (questNumericId: number | undefined, stepId: string): string =>
  `${questNumericId ?? 'quest'}:${stepId}`

/**
 * Сброс прогресса квеста должен уносить и паузы: иначе переигровка в той же
 * вкладке встречает игрока унаследованной ступенью лестницы (первая же ошибка —
 * 15 секунд вместо трёх). Заодно ограничивает рост карты.
 */
export const clearQuestCooldowns = (questNumericId?: number): void => {
  const prefix = `${questNumericId ?? 'quest'}:`
  for (const key of Array.from(stepCooldowns.keys())) {
    if (key.startsWith(prefix)) stepCooldowns.delete(key)
  }
}

type QuestStepLike = {
  id: string
  title: string
  location: string
  story: string
  task: string
  hint?: string
  answer: QuestAnswerChecker
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
  continueLabel: string
  onContinue: () => void
  onSubmit: (v: string) => void
  onWrongAttempt: () => void
  onToggleHint: () => void
  onSkip: () => void
  /** Пропуск далёкой точки: снимает её с гейта финала, в отличие от `onSkip`. */
  onSkipFarStep: () => void
  /** Уход со сломанного шага после серии неудач: тоже снимает шаг с гейта (#1430). */
  onSkipStuckStep: () => void
  /** Путь до этой точки от той, где игрок стоит (null — считать не от чего). */
  approachLeg?: QuestLegInfo | null
  /** Путь от пройденной точки к следующей — предупреждение до выхода. */
  nextLeg?: QuestLegInfo | null
  /** Точка за длинным перегоном: её можно не проходить. */
  isFarStep?: boolean
  /** Впереди остались только далёкие точки — можно закончить квест здесь. */
  canFinishHere?: boolean
  onFinishHere?: () => void
  showMap: boolean
  onToggleMap: () => void
  showLocationControls?: boolean
  /** Метаданные маршрута и раскрытие об ИИ в футере стартовой карточки (#1480). */
  introSlot?: React.ReactNode
  /** Числовой PK квеста — адрес батча попыток ответа (#1276). */
  questNumericId?: number
  /** Попытка ответа для продуктовой воронки: одна на каждое «Проверить» (#1498). */
  onAnswerAttempt?: (attempt: { isCorrect: boolean; attemptNo: number }) => void
  /** Поле ответа получило фокус — родитель доматывает его над клавиатурой. */
  onAnswerFocus?: (node: TextInput | null) => void
  onAnswerBlur?: () => void
}

/** «1,0 км · примерно 12 мин пешком» — расстояние и время через i18n-форматтеры. */
const legSummaryText = (leg: QuestLegInfo): string => {
  const params = { value1: formatDistance(leg.km), value2: formatTravelTime(leg.walkMinutes) }
  return leg.mode === 'bike'
    ? i18nT('quests:components.quests.questWizardStepCard.legSummaryBike', params)
    : i18nT('quests:components.quests.questWizardStepCard.legSummaryFoot', params)
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
    continueLabel,
    onContinue,
    onSubmit,
    onWrongAttempt,
    onToggleHint,
    onSkip,
    onSkipFarStep,
    onSkipStuckStep,
    approachLeg = null,
    nextLeg = null,
    isFarStep = false,
    canFinishHere = false,
    onFinishHere,
    showMap,
    onToggleMap,
    showLocationControls = true,
    introSlot,
    questNumericId,
    onAnswerAttempt,
    onAnswerFocus,
    onAnswerBlur,
  } = props

  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  // Момент, до которого проверка ответа на паузе (#1428), и остаток в секундах
  // для игрока: без видимого счётчика пауза читается как сломанная кнопка.
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [navExpanded, setNavExpanded] = useState(false)
  const shakeAnim = useRef(new Animated.Value(0)).current
  const answerInputRef = useRef<TextInput>(null)

  const handleAnswerFocus = useCallback(() => {
    onAnswerFocus?.(answerInputRef.current)
  }, [onAnswerFocus])

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

  // Момент показа шага — база для `elapsed_ms` в телеметрии попыток.
  const stepShownAtRef = useRef(Date.now())

  useEffect(() => {
    setValue('')
    setError('')
    // Не «сбросить паузу», а «поднять ту, что осталась от этого шага»: иначе
    // переход на соседний шаг и обратно снимал бы её (#1428).
    const pending = stepCooldowns.get(cooldownKey(questNumericId, step.id))
    setCooldownUntil(pending && pending.until > Date.now() ? pending.until : 0)
    setCooldownSecondsLeft(0)
    stepShownAtRef.current = Date.now()
  }, [questNumericId, step.id])

  // Тик обратного отсчёта живёт только пока пауза активна: на шаге без паузы
  // таймеров не заводим вовсе.
  useEffect(() => {
    if (!cooldownUntil) return undefined

    const tick = () => {
      const leftMs = cooldownUntil - Date.now()
      if (leftMs <= 0) {
        setCooldownSecondsLeft(0)
        setCooldownUntil(0)
        return
      }
      setCooldownSecondsLeft(Math.ceil(leftMs / 1000))
    }

    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [cooldownUntil])

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

  // Что за ответ у шага, карточка узнаёт у модуля оценки: правила проверки
  // живут там же, где вердикт, и вью их не дублирует.
  const answerDescription = useMemo(() => describeQuestAnswer(step), [step])
  const isAutoPassStep = answerDescription.isAutoPass
  // Шаг со свободным ответом (`any_text`): правильного варианта нет, проверяется
  // только длина — порог показываем игроку, а не отвечаем «Неверный ответ» на
  // короткий текст.
  const freeTextMinLength = answerDescription.freeTextMinLength
  // Ответ, который можно подобрать перебором, а не решить: между неверными
  // попытками на таком шаге держим паузу (#1428).
  const isBruteForceable = answerDescription.isBruteForceable
  const isPassed = !!savedAnswer && step.id !== 'intro'
  const isCoolingDown = cooldownSecondsLeft > 0
  const hintSuggestedAfter = 1
  const hintSuggested = hintVisible || attempts >= hintSuggestedAfter
  const hasMapPaneContent = showLocationControls || (showMap && !!step.image)
  const hasLocationContent = isPassed || hasMapPaneContent
  const imageSource = useMemo(
    () => (typeof step.image === 'string' ? { uri: step.image } : step.image),
    [step.image],
  )

  // Далёкую точку показываем блоком с действиями, обычный длинный перегон —
  // одной честной строкой: расстояние игрок узнаёт до того, как выйдет.
  const showFarStepBlock = step.id !== 'intro' && !isPassed && isFarStep && !!approachLeg
  // #1430: серия неудач подряд — это тупик, а не повод ещё раз предложить
  // подсказку. У далёкой точки официальный пропуск уже стоит кнопкой в блоке о
  // расстоянии, так что второй раз звать туда же не нужно. Свободный ответ из
  // приглашения исключён: там отказ означает «слишком коротко», а не тупик, и
  // уводить игрока со шага, который проходится любым текстом, незачем.
  const showSkipPrompt =
    !isPassed && !showFarStepBlock && !freeTextMinLength && attempts >= SKIP_SUGGESTED_AFTER
  const showApproachNote =
    step.id !== 'intro' && !isPassed && !showFarStepBlock && !!approachLeg?.notable
  const showNextLegNote = isPassed && !!nextLeg?.notable

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
    // Кнопка на паузе уже отключена, но Enter в поле ввода идёт сюда же —
    // иначе перебор продолжался бы с клавиатуры (#1428). Источник правды здесь
    // сама карта, а не стейт: после перемонтирования существует один рендер, где
    // стейт ещё нулевой, а запись о паузе уже жива.
    const pendingUntil = stepCooldowns.get(cooldownKey(questNumericId, step.id))?.until ?? 0
    if (pendingUntil > Date.now()) {
      shake()
      return
    }
    if (!trimmed) {
      setError(i18nT('quests:components.quests.questWizardStepCard.vvedite_otvet_a0ee4604'))
      shake()
      hapticNotification('warning')
      return
    }
    const { ok, normalized, isFreeText } = evaluateQuestAnswer(step, trimmed)

    void recordQuestAnswerAttempt({
      questNumericId,
      stepId: step.id,
      verdict: ok ? 'accepted' : 'rejected',
      normalized,
      isFreeText,
      // `attempts` — число прежних отклонённых попыток на этом шаге, поэтому
      // текущая идёт следующим номером.
      attemptNo: attempts + 1,
      hintShown: hintVisible,
      elapsedMs: Date.now() - stepShownAtRef.current,
    })
    // Тот же факт во внешнюю воронку: серверная очередь отвечает на «что игрок
    // писал», GA4 — на «на каком шаге сыплются попытки» (#1498).
    onAnswerAttempt?.({ isCorrect: ok, attemptNo: attempts + 1 })

    if (ok) {
      setError('')
      hapticNotification('success')
      triggerFlip()
      setTimeout(() => {
        onSubmit(trimmed)
        Keyboard.dismiss()
      }, 200)
    } else {
      // У свободного ответа проверяется ТОЛЬКО длина, поэтому единственная
      // причина отказа — слишком короткий текст. Говорим об этом прямо:
      // «Неверный ответ» здесь врёт, правильного варианта не существует.
      setError(freeTextMinLength
        ? i18nT('quests:components.quests.questWizardStepCard.slishkom_korotko_value1_3c7f91ab', { value1: freeTextMinLength })
        : i18nT('quests:components.quests.questWizardStepCard.nevernyy_otvet_22371740'))
      onWrongAttempt()
      if (isBruteForceable) {
        // Ступень лестницы считается по неверным попыткам ТЕКУЩЕГО сеанса, а не
        // по `attempts` из снапшота: восстановленный прогресс иначе встречал бы
        // игрока сразу пятнадцатью секундами.
        const key = cooldownKey(questNumericId, step.id)
        const wrongAttempts = (stepCooldowns.get(key)?.wrongAttempts ?? 0) + 1
        const until = Date.now() + cooldownForAttempt(wrongAttempts)
        stepCooldowns.set(key, { until, wrongAttempts })
        setCooldownUntil(until)
      }
      shake()
      hapticNotification('error')
    }
  }, [attempts, freeTextMinLength, hintVisible, isBruteForceable, onAnswerAttempt, onSubmit, onWrongAttempt, questNumericId, shake, step, triggerFlip, value])

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
            // Высота строки адреса зависит от длины названия (одна строка или
            // две), поэтому она не объявлена нигде и статический гард её не
            // видит — на устройстве вышло 42,3dp. Задаём таргет явно (#1274).
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}
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

      {step.id === 'intro' && (
        <Pressable
          style={[styles.startButton, styles.section]}
          onPress={handleCheck}
          hitSlop={6}
          accessibilityRole="button"
          testID="quest-intro-start"
        >
          <Text style={styles.startButtonText}>{i18nT('quests:components.quests.questWizardStepCard.nachat_kvest_2847e749')}</Text>
        </Pressable>
      )}

      {showApproachNote && approachLeg && (
        <Text style={styles.legNote} testID="quest-step-approach-note">
          {i18nT('quests:components.quests.questWizardStepCard.approachNote', { value1: legSummaryText(approachLeg) })}
        </Text>
      )}

      {showFarStepBlock && approachLeg && (
        <View style={[styles.section, styles.farStepCard]} testID="quest-step-far-notice">
          <View style={styles.farStepHeader}>
            <Feather name="navigation" size={16} color={colors.brandText} />
            <Text style={styles.farStepTitle}>{i18nT('quests:components.quests.questWizardStepCard.farStep.title')}</Text>
          </View>
          <Text style={styles.farStepText}>
            {i18nT('quests:components.quests.questWizardStepCard.farStep.approach', { value1: legSummaryText(approachLeg) })}
          </Text>
          <Text style={styles.farStepText}>{i18nT('quests:components.quests.questWizardStepCard.farStep.optional')}</Text>
          <View style={styles.farStepActions}>
            <Button
              label={i18nT('quests:components.quests.questWizardStepCard.farStep.skip')}
              onPress={onSkipFarStep}
              variant="outline"
              size="md"
              icon={<Feather name="skip-forward" size={16} color={colors.primaryText} />}
              testID="quest-step-far-skip"
            />
            {canFinishHere && onFinishHere && (
              <Button
                label={i18nT('quests:components.quests.questWizardStepCard.farStep.finish')}
                onPress={onFinishHere}
                variant="primary"
                size="md"
                icon={<Feather name="flag" size={16} color={colors.textOnPrimary} />}
                testID="quest-step-finish-here"
              />
            )}
          </View>
        </View>
      )}

      <View style={styles.section} testID={step.id === 'intro' ? 'quest-intro-story' : undefined}>
        <Text style={styles.storyText}>{step.story}</Text>
      </View>

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

      <View style={styles.section} testID={step.id === 'intro' ? 'quest-intro-task' : undefined}>
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
                      ref={answerInputRef}
                      style={[styles.input, error ? styles.inputError : null, globalFocusStyles.focusable]}
                      placeholder={freeTextMinLength
                        ? i18nT('quests:components.quests.questWizardStepCard.opishi_svoimi_slovami_5b1e07d2')
                        : i18nT('quests:components.quests.questWizardStepCard.vash_otvet_21a01dd5')}
                      placeholderTextColor={colors.textMuted}
                      value={value}
                      onChangeText={setValue}
                      onFocus={handleAnswerFocus}
                      onBlur={onAnswerBlur}
                      onSubmitEditing={handleCheck}
                      returnKeyType="done"
                      keyboardType={step.inputType === 'number' ? (Platform.OS === 'ios' ? 'number-pad' : 'numeric') : 'default'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      // Без этого react-native-web ставит DOM autocomplete="on", и
                      // выпадашка автозаполнения браузера перехватывает Enter: он
                      // выбирает подсказку и делает preventDefault, поэтому
                      // onSubmitEditing не срабатывает и ответ не отправляется (#1483).
                      autoComplete="off"
                    />
                  </Animated.View>
                  <Pressable
                    style={[styles.checkButton, isCoolingDown && styles.checkButtonCooldown]}
                    onPress={handleCheck}
                    disabled={isCoolingDown}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isCoolingDown }}
                    accessibilityLabel={isCoolingDown
                      ? i18nT('quests:components.quests.questWizardStepCard.cooldown.wait', { value1: cooldownSecondsLeft })
                      : i18nT('quests:components.quests.questWizardStepCard.proverit_otvet_76814505')}
                    testID="quest-step-check"
                  >
                    {isCoolingDown
                      ? <Text style={styles.checkButtonCountdown} testID="quest-step-cooldown-countdown">{cooldownSecondsLeft}</Text>
                      : <Feather name="arrow-right" size={24} color={colors.textOnPrimary} />}
                  </Pressable>
                </View>
                {isCoolingDown && (
                  <Text style={styles.cooldownNote} testID="quest-step-cooldown-note">
                    {i18nT('quests:components.quests.questWizardStepCard.cooldown.note', { value1: cooldownSecondsLeft })}
                  </Text>
                )}
                {!!freeTextMinLength && !error && (
                  <Text style={styles.freeTextNote}>
                    {i18nT('quests:components.quests.questWizardStepCard.svobodnyy_otvet_value1_9d4a2f10', { value1: freeTextMinLength })}
                  </Text>
                )}
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
                  {/* У далёкой точки то же действие уже есть кнопкой в блоке о
                      расстоянии — второй ссылкой его не дублируем. */}
                  {/* Пока внизу висит приглашение уйти со шага, серая ссылка
                      рядом с подсказкой — второй экземпляр того же действия. */}
                  {step.hint && !showFarStepBlock && !showSkipPrompt && (<Text style={styles.linkSeparator}>·</Text>)}
                  {!showFarStepBlock && !showSkipPrompt && (
                    <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.propustit_shag_1965c65e')}>
                      <Text style={styles.linkText}>{i18nT('quests:components.quests.questWizardStepCard.propustit_0358f4b6')}</Text>
                    </Pressable>
                  )}
                </View>
                {showSkipPrompt ? (
                  <Pressable
                    onPress={onSkipStuckStep}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.skipPrompt')}
                    testID="quest-step-skip-prompt"
                  >
                    <Text style={[styles.linkText, styles.skipPrompt]}>
                      {i18nT('quests:components.quests.questWizardStepCard.skipPrompt')}
                    </Text>
                  </Pressable>
                ) : (step.hint && !hintVisible && hintSuggested && (
                  <Text style={styles.hintPrompt}>
                    {i18nT('quests:components.quests.questWizardStepCard.zastryali_otkroyte_podskazku_vyshe_128fae28')}</Text>
                ))}
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
                {showNextLegNote && nextLeg && (
                  <Text style={styles.legNote} testID="quest-step-next-leg-note">
                    {i18nT('quests:components.quests.questWizardStepCard.nextLegNote', { value1: legSummaryText(nextLeg) })}
                  </Text>
                )}
                <Button
                  label={continueLabel}
                  onPress={onContinue}
                  size="lg"
                  fullWidth
                  trailingIcon={<Feather name="arrow-right" size={20} color={colors.textOnPrimary} />}
                  style={styles.completedContinueButton}
                  testID="quest-step-continue"
                />
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

      {step.id === 'intro' && introSlot ? <View style={styles.section}>{introSlot}</View> : null}

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
