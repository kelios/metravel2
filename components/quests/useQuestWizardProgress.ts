import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useMemo, useRef, useState } from 'react'

type QuestProgressStep = {
  id: string
}

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

  useEffect(() => {
    const loadProgress = async () => {
      try {
        suppressSave.current = true
        if (initialProgress) {
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

    const completed = steps.length > 0 && steps.every((step) => !!answers[step.id])
    onProgressChange?.({
      currentIndex,
      unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
      completed,
    })
  }, [answers, attempts, currentIndex, hints, onProgressChange, showMap, steps, storageKey, unlockedIndex])

  const completedSteps = useMemo(() => steps.filter((step) => answers[step.id]), [answers, steps])
  const progress = steps.length > 0 ? completedSteps.length / steps.length : 0
  const allCompleted = completedSteps.length === steps.length

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
    progress,
    allCompleted,
    resetProgress,
  }
}
