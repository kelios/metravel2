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

type StoredProgressState = {
  index: number
  unlocked: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
}

const normalizeStoredProgress = (raw: Partial<StoredProgressState> | null | undefined): StoredProgressState => ({
  index: raw?.index ?? 0,
  unlocked: raw?.unlocked ?? 0,
  answers: raw?.answers ?? {},
  attempts: raw?.attempts ?? {},
  hints: raw?.hints ?? {},
  showMap: raw?.showMap !== undefined ? raw.showMap : true,
})

// Единый вид снимка прогресса: и то, что уходит в AsyncStorage, и ключ, по
// которому save-эффект узнаёт собственный сид.
const buildProgressSnapshot = (state: StoredProgressState): string => JSON.stringify({
  index: state.index,
  unlocked: state.unlocked,
  answers: state.answers,
  attempts: state.attempts,
  hints: state.hints,
  showMap: state.showMap,
})

const readStoredProgress = async (storageKey: string): Promise<StoredProgressState | null> => {
  const saved = await AsyncStorage.getItem(storageKey)
  if (!saved) return null
  const { safeJsonParseString } = require('@/utils/safeJsonParse')
  const parsed = safeJsonParseString(saved, null) as Partial<StoredProgressState> | null
  return parsed ? normalizeStoredProgress(parsed) : null
}

// Сколько шагов реально отвечено — тем же критерием, что и completedSteps
// (пустая строка ответом не считается).
const countAnsweredSteps = (answers: Record<string, string> | undefined): number =>
  answers ? Object.values(answers).filter(Boolean).length : 0

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
  // Снимок состояния, которое хук засеял сам (бэкенд, AsyncStorage, сброс).
  // Save-эффект пропускает ровно его — без прежней гонки `suppressSave` с
  // `setTimeout(0)`, где лишний await в load-эффекте решал, сработает гейт или
  // нет. Стартовое значение гасит сейв дефолтов на первом рендере.
  const seededSnapshotRef = useRef<string | null>(buildProgressSnapshot(normalizeStoredProgress(null)))
  // Какой storageKey уже засеян бэкенд-прогрессом. initialProgress пересоздаётся
  // в роуте через useMemo на каждое setProgress (эхо нашего же debounced-сейва),
  // поэтому без этого гейта load-эффект перезапускался на каждое эхо и откатывал
  // currentIndex/answers к серверным значениям — отсюда «тап по ответу иногда
  // игнорируется и возвращает на тот же шаг».
  const backendSeededKey = useRef<string | null>(null)

  const applyProgressState = (state: StoredProgressState) => {
    setCurrentIndex(state.index)
    setUnlockedIndex(state.unlocked)
    setAnswers(state.answers)
    setAttempts(state.attempts)
    setHints(state.hints)
    setShowMap(state.showMap)
  }

  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (initialProgress) {
          // Применяем бэкенд-прогресс один раз на квест. Последующие изменения
          // identity initialProgress — это эхо собственных сейвов, не новые данные.
          if (backendSeededKey.current === storageKey) return
          backendSeededKey.current = storageKey

          // Серверный прогресс мог отстать: ответы, данные без сети, до сервера
          // не долетают (баг 2026-07-28 — после полного прохождения офлайн на
          // сервере остался только intro). Сравниваем, где ответов больше, и
          // локальный прогресс серверным больше безусловно не затираем.
          const localState = await readStoredProgress(storageKey)
          const serverState = normalizeStoredProgress({
            index: initialProgress.currentIndex,
            unlocked: initialProgress.unlockedIndex,
            answers: initialProgress.answers,
            attempts: initialProgress.attempts,
            hints: initialProgress.hints,
            showMap: initialProgress.showMap,
          })

          if (localState && countAnsweredSteps(localState.answers) > countAnsweredSteps(serverState.answers)) {
            // Локальный прогресс полнее — сеем его и НЕ помечаем как свой сид:
            // save-эффект сразу дольёт разницу на сервер (как гостевая миграция
            // в useGuestQuestFlow).
            seededSnapshotRef.current = null
            applyProgressState(localState)
            return
          }

          const snapshot = buildProgressSnapshot(serverState)
          seededSnapshotRef.current = snapshot
          applyProgressState(serverState)
          await AsyncStorage.setItem(storageKey, snapshot).catch(() => {})
        } else {
          // Бэкенд-прогресс ещё не загружен — даём ему засеять состояние, когда придёт.
          backendSeededKey.current = null
          const stored = (await readStoredProgress(storageKey)) ?? normalizeStoredProgress(null)
          seededSnapshotRef.current = buildProgressSnapshot(stored)
          applyProgressState(stored)
        }
      } catch (error) {
        const { devError } = require('@/utils/logger')
        devError('Error loading quest progress:', error)
      }
    }

    loadProgress()
  }, [initialProgress, storageKey])

  // Только обязательные (проверяемые) шаги гейтят финал и считаются в прогрессе.
  const requiredSteps = useMemo(() => steps.filter((step) => !isOptionalStep(step)), [steps])

  useEffect(() => {
    const snapshot = buildProgressSnapshot({
      index: currentIndex,
      unlocked: unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
    })
    // Наш собственный сид уже лежит и в состоянии, и в хранилище — не гоняем
    // его обратно на сервер эхом.
    if (seededSnapshotRef.current === snapshot) {
      seededSnapshotRef.current = null
      return
    }
    seededSnapshotRef.current = null

    AsyncStorage.setItem(storageKey, snapshot)
      .catch((error) => console.error('Error saving progress:', error))

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
    await AsyncStorage.removeItem(storageKey)
    const emptyState = normalizeStoredProgress(null)
    seededSnapshotRef.current = buildProgressSnapshot(emptyState)
    applyProgressState(emptyState)
    await AsyncStorage.setItem(storageKey, buildProgressSnapshot(emptyState))
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
    resetProgress,
  }
}
