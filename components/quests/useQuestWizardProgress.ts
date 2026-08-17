import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { questStepsMissingForCompletion } from '@/utils/questCompletionPolicy'
import {
  mergeQuestProgress,
  normalizeQuestProgressSnapshot,
  type QuestProgressSnapshot,
} from '@/utils/questProgressMerge'

type QuestProgressStep = {
  id: string
  answer?: (input: string) => boolean
}

// Необязательные точки-паузы (☕/✨) приходят с answer_pattern type='any' →
// checker помечается _isAny. У них нет проверяемого ответа, и они НЕ должны
// гейтить финал: иначе «пройдено N из M» недостижимо, пока игрок явно не
// нажмёт «Далее» на каждой такой точке (баг: финал заблокирован на 7/9).
const isOptionalStep = (step: QuestProgressStep): boolean =>
  (step.answer as unknown as { _isAny?: boolean } | undefined)?._isAny === true

type QuestWizardProgressPayload = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
  /** Время снапшота и ответов по шагам — нужно для слияния между устройствами */
  updatedAt?: number
  answeredAt?: Record<string, number>
}

type InitialQuestProgress = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
  updatedAt?: number
  answeredAt?: Record<string, number>
}

// AsyncStorage-запись прогресса. Ключи index/unlocked исторические; completed,
// updatedAt и answeredAt добавлены для слияния между устройствами и отсутствуют
// в записях, созданных до этого — такие читаются как «время неизвестно».
// skipped и earlyFinish полей на бэкенде не имеют и живут только здесь.
type StoredProgressRecord = {
  index: number
  unlocked: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
  skipped?: Record<string, boolean>
  earlyFinish?: boolean
  updatedAt?: number
  answeredAt?: Record<string, number>
}

const snapshotFromRecord = (record: Partial<StoredProgressRecord> | null | undefined): QuestProgressSnapshot =>
  normalizeQuestProgressSnapshot({
    currentIndex: record?.index,
    unlockedIndex: record?.unlocked,
    answers: record?.answers,
    attempts: record?.attempts,
    hints: record?.hints,
    showMap: record?.showMap,
    completed: record?.completed,
    skipped: record?.skipped,
    earlyFinish: record?.earlyFinish,
    updatedAt: record?.updatedAt,
    answeredAt: record?.answeredAt,
  })

const serializeRecord = (snapshot: QuestProgressSnapshot): string => JSON.stringify({
  index: snapshot.currentIndex,
  unlocked: snapshot.unlockedIndex,
  answers: snapshot.answers,
  attempts: snapshot.attempts,
  hints: snapshot.hints,
  showMap: snapshot.showMap,
  completed: snapshot.completed,
  skipped: snapshot.skipped,
  earlyFinish: snapshot.earlyFinish,
  updatedAt: snapshot.updatedAt,
  answeredAt: snapshot.answeredAt,
})

// Ключ, по которому save-эффект узнаёт состояние, засеянное самим хуком. Только
// поля, живущие в React-state: времена в state не хранятся.
const stateFingerprint = (state: {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  skipped: Record<string, boolean>
  earlyFinish: boolean
}): string => JSON.stringify({
  index: state.currentIndex,
  unlocked: state.unlockedIndex,
  answers: state.answers,
  attempts: state.attempts,
  hints: state.hints,
  showMap: state.showMap,
  skipped: state.skipped,
  earlyFinish: state.earlyFinish,
})

const readStoredProgress = async (storageKey: string): Promise<QuestProgressSnapshot> => {
  const saved = await AsyncStorage.getItem(storageKey)
  if (!saved) return snapshotFromRecord(null)
  const { safeJsonParseString } = require('@/utils/safeJsonParse')
  const parsed = safeJsonParseString(saved, null) as Partial<StoredProgressRecord> | null
  return snapshotFromRecord(parsed)
}

type UseQuestWizardProgressParams = {
  allSteps: QuestProgressStep[]
  steps: QuestProgressStep[]
  storageKey: string
  initialProgress?: InitialQuestProgress
  onProgressChange?: (data: QuestWizardProgressPayload) => void
  onProgressReset?: () => void
}

export function useQuestWizardProgress({
  allSteps,
  steps,
  storageKey,
  initialProgress,
  onProgressChange,
  onProgressReset,
}: UseQuestWizardProgressParams) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [unlockedIndex, setUnlockedIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [hints, setHints] = useState<Record<string, boolean>>({})
  const [showMap, setShowMap] = useState(true)
  // Точки, которые игрок официально пропустил на карточке «эта точка далеко».
  // Пропуск обязан снимать точку с гейта финала: иначе обещание «квест
  // засчитается и без неё» не выполняется, а далёкая точка в СЕРЕДИНЕ маршрута
  // закрывает финал навсегда.
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  // Игрок закончил квест, не дойдя до точек за длинным перегоном. Хранится
  // отдельно от `completed`: `completed` монотонен и приходит в том числе с
  // сервера, и если в квест добавят шаг (#1431), прежний финишер иначе получил
  // бы форс-редирект в финал и чужую строку «дальние вы отложили».
  const [earlyFinish, setEarlyFinish] = useState(false)
  // Отпечаток состояния, которое хук засеял сам (слияние, AsyncStorage, сброс).
  // Save-эффект пропускает ровно его — без прежней гонки `suppressSave` с
  // `setTimeout(0)`, где лишний await в load-эффекте решал, сработает гейт или
  // нет. Стартовое значение гасит сейв дефолтов на первом рендере.
  const seededSnapshotRef = useRef<string | null>(stateFingerprint({
    currentIndex: 0,
    unlockedIndex: 0,
    answers: {},
    attempts: {},
    hints: {},
    showMap: true,
    skipped: {},
    earlyFinish: false,
  }))
  // Какой storageKey уже засеян бэкенд-прогрессом. initialProgress пересоздаётся
  // в роуте через useMemo на каждое setProgress (эхо нашего же debounced-сейва),
  // поэтому без этого гейта load-эффект перезапускался на каждое эхо и откатывал
  // currentIndex/answers к серверным значениям — отсюда «тап по ответу иногда
  // игнорируется и возвращает на тот же шаг».
  const backendSeededKey = useRef<string | null>(null)
  // Времена живут вне React-state: на рендер не влияют, а нужны только слиянию.
  const answeredAtRef = useRef<Record<string, number>>({})
  const lastAnswersRef = useRef<Record<string, string>>({})
  const updatedAtRef = useRef(0)
  // Живое состояние для слияния серверных обновлений, пришедших во время сессии:
  // load-эффект асинхронный, замыкание успевает устареть.
  const liveSnapshotRef = useRef<QuestProgressSnapshot>(normalizeQuestProgressSnapshot(null))

  const applyProgressState = (snapshot: QuestProgressSnapshot) => {
    setSkipped(snapshot.skipped)
    setEarlyFinish(snapshot.earlyFinish)
    setCurrentIndex(snapshot.currentIndex)
    setUnlockedIndex(snapshot.unlockedIndex)
    setAnswers(snapshot.answers)
    setAttempts(snapshot.attempts)
    setHints(snapshot.hints)
    setShowMap(snapshot.showMap)
  }

  /**
   * Применить снапшот как собственный сид хука.
   * `markSeeded` = данные уже согласованы с источником (сервером/хранилищем) и
   * их не надо гнать обратно; иначе save-эффект отправит слитое на сервер.
   */
  const seedProgressState = useCallback((snapshot: QuestProgressSnapshot, markSeeded: boolean): Promise<void> => {
    answeredAtRef.current = snapshot.answeredAt
    lastAnswersRef.current = snapshot.answers
    updatedAtRef.current = snapshot.updatedAt
    seededSnapshotRef.current = markSeeded ? stateFingerprint(snapshot) : null
    applyProgressState(snapshot)
    return AsyncStorage.setItem(storageKey, serializeRecord(snapshot)).catch(() => {})
  }, [storageKey])

  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (!initialProgress) {
          // Бэкенд-прогресс ещё не загружен — даём ему засеять состояние, когда придёт.
          backendSeededKey.current = null
          seedProgressState(await readStoredProgress(storageKey), true)
          return
        }

        const server = normalizeQuestProgressSnapshot(initialProgress)

        if (backendSeededKey.current === storageKey) {
          // Квест уже засеян: это либо эхо собственного сейва, либо ответы
          // другого устройства, прилетевшие в ответе сервера. Сливаем аддитивно,
          // но курсор и карту не двигаем — игрок смотрит на этот экран.
          const live = liveSnapshotRef.current
          const { merged, localChanged } = mergeQuestProgress(live, server)
          if (!localChanged) return
          seedProgressState(
            { ...merged, currentIndex: live.currentIndex, showMap: live.showMap },
            true,
          )
          return
        }

        backendSeededKey.current = storageKey

        // Серверный прогресс мог отстать (ответы без сети до него не долетают,
        // баг 2026-07-28), а локальный — не знать про другое устройство. Поэтому
        // не выбираем победителя, а сливаем: ни один ответ не теряется.
        const local = await readStoredProgress(storageKey)
        const { merged, serverNeedsPush } = mergeQuestProgress(local, server)
        // Если серверу чего-то не хватает — не гасим save-эффект, он дольёт.
        seedProgressState(merged, !serverNeedsPush)
      } catch (error) {
        const { devError } = require('@/utils/logger')
        devError('Error loading quest progress:', error)
      }
    }

    loadProgress()
  }, [initialProgress, seedProgressState, storageKey])

  // Только обязательные (проверяемые) шаги гейтят финал и считаются в прогрессе.
  const requiredSteps = useMemo(() => steps.filter((step) => !isOptionalStep(step)), [steps])
  // Пропущенная далёкая точка из гейта финала выпадает, но из знаменателя
  // «пройдено N из M» — нет: счётчик остаётся честным.
  const gatingSteps = useMemo(
    () => requiredSteps.filter((step) => !skipped[step.id]),
    [requiredSteps, skipped],
  )

  const completedSteps = useMemo(() => requiredSteps.filter((step) => answers[step.id]), [answers, requiredSteps])
  const requiredCount = requiredSteps.length
  const progress = requiredCount > 0 ? completedSteps.length / requiredCount : 0
  // Гейт маршрута закрыт: на каждой точке, которую игрок не пропустил, есть
  // ответ. Пропуск гейт сужает, поэтому гейт МОЖЕТ опуститься до пустого —
  // `[].every(...) === true`, и сам по себе он ничего о пройденном не говорит.
  const allCompleted = requiredCount > 0 && gatingSteps.every((step) => !!answers[step.id])
  // Квест закончен: либо пройдены все точки, которые игрок не пропустил, либо он
  // закрыл квест на месте, оставив за спиной только далёкие. Ноль ответов финалом
  // не считается: пропустить подряд весь маршрут — это не прохождение, даже
  // частичное, и такому игроку показывать финальное видео незачем.
  const questFinished = requiredCount > 0 && completedSteps.length > 0 && (allCompleted || earlyFinish)
  // Сколько точек не хватает до засчитанного прохождения (#1443): порог живёт в
  // `utils/questCompletionPolicy.ts` вместе с обоснованием.
  const stepsMissingForCompletion = questStepsMissingForCompletion(requiredCount, completedSteps.length)
  // Прохождение засчитано: маршрут закончен И пройдено не меньше двух третей
  // точек. Именно этот флаг даёт значок, «первопроходца» и `completed: true` на
  // бэкенде — раньше для всего этого хватало одного ответа и пропуска остальных
  // точек приглашением «Не сходится? Пропустить шаг и идти дальше» (#1430).
  const questCompleted = questFinished && stepsMissingForCompletion === 0
  // Финал есть, но прохождение не засчитано: игрок пропустил слишком много.
  // Прогресс при этом сохраняется, и вернуться к пропущенным точкам можно —
  // порог перестаёт быть недобранным, как только на них появятся ответы.
  const partiallyCompleted = questFinished && !questCompleted
  // Прохождение неполное по воле игрока: пропущенная далёкая точка или финиш на
  // месте. Не то же самое, что «отвечено меньше, чем шагов»: в квест могли
  // добавить шаг уже после прохождения (#1431).
  const finishedEarly = earlyFinish || requiredSteps.some((step) => skipped[step.id] && !answers[step.id])

  useEffect(() => {
    const fingerprint = stateFingerprint({ currentIndex, unlockedIndex, answers, attempts, hints, showMap, skipped, earlyFinish })
    // Наш собственный сид уже лежит и в состоянии, и в хранилище — не гоняем
    // его обратно на сервер эхом.
    if (seededSnapshotRef.current === fingerprint) {
      seededSnapshotRef.current = null
      return
    }
    seededSnapshotRef.current = null

    // Штампуем время ответа по каждому новому/изменившемуся шагу: без него
    // слияние с другим устройством не сможет разрешить коллизию одного шага.
    const now = Date.now()
    const answeredAt: Record<string, number> = { ...answeredAtRef.current }
    for (const [stepId, value] of Object.entries(answers)) {
      if (value && lastAnswersRef.current[stepId] !== value) answeredAt[stepId] = now
    }
    for (const stepId of Object.keys(answeredAt)) {
      if (!answers[stepId]) delete answeredAt[stepId]
    }
    answeredAtRef.current = answeredAt
    lastAnswersRef.current = answers
    updatedAtRef.current = now

    AsyncStorage.setItem(storageKey, serializeRecord({
      currentIndex,
      unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
      completed: questCompleted,
      skipped,
      earlyFinish,
      updatedAt: now,
      answeredAt,
    })).catch((error) => console.error('Error saving progress:', error))

    onProgressChange?.({
      currentIndex,
      unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
      completed: questCompleted,
      updatedAt: now,
      answeredAt,
    })
  }, [answers, attempts, currentIndex, earlyFinish, hints, onProgressChange, questCompleted, showMap, skipped, storageKey, unlockedIndex])

  // Живой снимок для слияния серверных обновлений, прилетевших во время сессии.
  liveSnapshotRef.current = normalizeQuestProgressSnapshot({
    currentIndex,
    unlockedIndex,
    answers,
    attempts,
    hints,
    showMap,
    completed: questCompleted,
    skipped,
    earlyFinish,
    updatedAt: updatedAtRef.current,
    answeredAt: answeredAtRef.current,
  })

  const maxAnsweredIndex = useMemo(() => {
    let maxIdx = -1
    for (let i = 0; i < allSteps.length; i += 1) {
      const step = allSteps[i]
      if (step.id !== 'intro' && answers[step.id]) maxIdx = Math.max(maxIdx, i)
    }
    return maxIdx
  }, [allSteps, answers])

  useEffect(() => {
    const nextReachable = Math.min(maxAnsweredIndex + 1, allSteps.length - 1)
    setUnlockedIndex((prev) => Math.max(prev, nextReachable))
  }, [allSteps.length, maxAnsweredIndex])

  const finishEarly = useCallback(() => {
    setEarlyFinish(true)
  }, [])

  // Пропуск далёкой точки. Монотонен, как и всё остальное в прогрессе: снять
  // отметку нельзя, но вернуться и ответить — можно, ответ и счётчик от этого
  // не страдают.
  const markStepSkipped = useCallback((stepId: string) => {
    setSkipped((prev) => (prev[stepId] ? prev : { ...prev, [stepId]: true }))
  }, [])

  const resetProgress = async () => {
    await AsyncStorage.removeItem(storageKey)
    // Сброс — единственная немонотонная операция: слияние её бы отменило,
    // поэтому чистим и локальные времена, чтобы старые ответы не «воскресли».
    const emptyState = normalizeQuestProgressSnapshot({ updatedAt: Date.now() })
    await seedProgressState(emptyState, true)
    onProgressReset?.()
  }

  return {
    currentIndex,
    setCurrentIndex,
    unlockedIndex,
    setUnlockedIndex,
    answers,
    setAnswers,
    attempts,
    setAttempts,
    hints,
    setHints,
    showMap,
    setShowMap,
    completedSteps,
    requiredCount,
    progress,
    allCompleted,
    questFinished,
    questCompleted,
    partiallyCompleted,
    stepsMissingForCompletion,
    finishedEarly,
    finishEarly,
    markStepSkipped,
    resetProgress,
  }
}
