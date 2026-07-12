import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useMemo, useRef, useState } from 'react'

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
}

type InitialQuestProgress = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
}

const DEFAULT_PROGRESS_STATE = {
  index: 0,
  unlocked: 0,
  answers: {},
  attempts: {},
  hints: {},
  showMap: true,
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
  const suppressSave = useRef(false)
  // Какой storageKey уже засеян бэкенд-прогрессом. initialProgress пересоздаётся
  // в роуте через useMemo на каждое setProgress (эхо нашего же debounced-сейва),
  // поэтому без этого гейта load-эффект перезапускался на каждое эхо: ставил
  // suppressSave=true и откатывал currentIndex/answers к серверным значениям —
  // отсюда «тап по ответу иногда игнорируется и возвращает на тот же шаг».
  const backendSeededKey = useRef<string | null>(null)

  useEffect(() => {
    const loadProgress = async () => {
      try {
        suppressSave.current = true
        if (initialProgress) {
          // Применяем бэкенд-прогресс один раз на квест. Последующие изменения
          // identity initialProgress — это эхо собственных сейвов, не новые данные.
          if (backendSeededKey.current === storageKey) {
            suppressSave.current = false
            return
          }
          backendSeededKey.current = storageKey
          setCurrentIndex(initialProgress.currentIndex ?? 0)
          setUnlockedIndex(initialProgress.unlockedIndex ?? 0)
          setAnswers(initialProgress.answers ?? {})
          setAttempts(initialProgress.attempts ?? {})
          setHints(initialProgress.hints ?? {})
          setShowMap(initialProgress.showMap !== undefined ? initialProgress.showMap : true)

          await AsyncStorage.setItem(storageKey, JSON.stringify({
            index: initialProgress.currentIndex ?? 0,
            unlocked: initialProgress.unlockedIndex ?? 0,
            answers: initialProgress.answers ?? {},
            attempts: initialProgress.attempts ?? {},
            hints: initialProgress.hints ?? {},
            showMap: initialProgress.showMap !== undefined ? initialProgress.showMap : true,
          })).catch(() => {})
        } else {
          // Бэкенд-прогресс ещё не загружен — даём ему засеять состояние, когда придёт.
          backendSeededKey.current = null
          const saved = await AsyncStorage.getItem(storageKey)
          if (saved) {
            const { safeJsonParseString } = require('@/utils/safeJsonParse')
            const data = safeJsonParseString(saved, DEFAULT_PROGRESS_STATE)
            setCurrentIndex(data.index ?? 0)
            setUnlockedIndex(data.unlocked ?? 0)
            setAnswers(data.answers ?? {})
            setAttempts(data.attempts ?? {})
            setHints(data.hints ?? {})
            setShowMap(data.showMap !== undefined ? data.showMap : true)
          } else {
            setCurrentIndex(0)
            setUnlockedIndex(0)
            setAnswers({})
            setAttempts({})
            setHints({})
            setShowMap(true)
          }
        }
      } catch (error) {
        const { devError } = require('@/utils/logger')
        devError('Error loading quest progress:', error)
      } finally {
        setTimeout(() => {
          suppressSave.current = false
        }, 0)
      }
    }

    loadProgress()
  }, [initialProgress, storageKey])

  // Только обязательные (проверяемые) шаги гейтят финал и считаются в прогрессе.
  const requiredSteps = useMemo(() => steps.filter((step) => !isOptionalStep(step)), [steps])

  useEffect(() => {
    if (suppressSave.current) return

    AsyncStorage.setItem(storageKey, JSON.stringify({
      index: currentIndex,
      unlocked: unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
    })).catch((error) => console.error('Error saving progress:', error))

    const completed = requiredSteps.length > 0 && requiredSteps.every((step) => !!answers[step.id])
    onProgressChange?.({
      currentIndex,
      unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
      completed,
    })
  }, [answers, attempts, currentIndex, hints, onProgressChange, requiredSteps, showMap, storageKey, unlockedIndex])

  const completedSteps = useMemo(() => requiredSteps.filter((step) => answers[step.id]), [answers, requiredSteps])
  const requiredCount = requiredSteps.length
  const progress = requiredCount > 0 ? completedSteps.length / requiredCount : 0
  const allCompleted = requiredCount > 0 && completedSteps.length === requiredCount

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

  const resetProgress = async () => {
    try {
      suppressSave.current = true
      await AsyncStorage.removeItem(storageKey)
      setCurrentIndex(0)
      setUnlockedIndex(0)
      setAnswers({})
      setAttempts({})
      setHints({})
      setShowMap(true)
      await AsyncStorage.setItem(storageKey, JSON.stringify(DEFAULT_PROGRESS_STATE))
      onProgressReset?.()
    } finally {
      setTimeout(() => {
        suppressSave.current = false
      }, 0)
    }
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
    resetProgress,
  }
}
