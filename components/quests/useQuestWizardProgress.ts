import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { questStepsMissingForCompletion } from '@/utils/questCompletionPolicy'
import {
  GUEST_QUEST_STORAGE_PREFIX,
  QUEST_PROGRESS_PENDING_USER,
  QUEST_PROGRESS_USER_SUFFIX,
  questKeyFromProgressStorageKey,
} from '@/utils/questProgressStorage'
import {
  buildQuestCountModel,
  getQuestProgressSteps,
  getQuestRouteGateSteps,
  type QuestCountModel,
  type QuestPointRole,
} from '@/utils/questCountModel'
import {
  isQuestProgressRunEnded,
  hasQuestProgressStarted,
  mergeQuestProgress,
  normalizeQuestProgressSnapshot,
  type QuestProgressSnapshot,
} from '@/utils/questProgressMerge'

type QuestProgressStep = {
  id: string
  pointRole?: QuestPointRole
}

type QuestWizardProgressPayload = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
  skipped?: Record<string, boolean>
  earlyFinish?: boolean
  /** Время снапшота и ответов по шагам — нужно для слияния между устройствами */
  updatedAt?: number
  answeredAt?: Record<string, number>
  /** Поколение: `id` строки, с которой копия согласована (#2033). 0 — ещё нет. */
  serverId?: number
}

type InitialQuestProgress = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
  skipped?: Record<string, boolean>
  earlyFinish?: boolean
  updatedAt?: number
  answeredAt?: Record<string, number>
  /**
   * `id` серверной строки. `null` — сервер подтвердил, что строки нет;
   * 0/нет поля — неизвестно (чтение упало, гость). Разница решает, можно ли
   * стереть копию прохождения, сброшенного на другом устройстве (#2033).
   */
  serverId?: number | null
}

// AsyncStorage-запись прогресса. Ключи index/unlocked исторические; completed,
// updatedAt и answeredAt добавлены для слияния между устройствами и отсутствуют
// в записях, созданных до этого — такие читаются как «время неизвестно».
// skipped и earlyFinish с #1632 уходят и на сервер (`quest_progress.skipped`,
// `early_finish`, добавлены бэкендом в #1454); в локальной записи они остаются,
// чтобы пропуск переживал офлайн до ближайшего PATCH. serverId — поколение
// копии (#2033): `id` строки, с которой она согласована; в записях до #2033 его
// нет, и они доливаются по-старому.
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
  serverId?: number
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
    serverId: record?.serverId,
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
  serverId: snapshot.serverId,
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

type ProgressOwner = 'guest' | 'pending' | 'unknown' | `user:${string}`
type ProgressIdentity = { storageKey: string; questKey: string; owner: ProgressOwner }

const progressIdentity = (storageKey: string): ProgressIdentity => {
  const questKey = questKeyFromProgressStorageKey(storageKey)
  const suffix = storageKey.slice(questKey.length)
  const user = new RegExp(`^${QUEST_PROGRESS_USER_SUFFIX}(\\d+)$`).exec(suffix)
  const owner: ProgressOwner = storageKey === `${GUEST_QUEST_STORAGE_PREFIX}${questKey}` ? 'guest'
    : suffix === `${QUEST_PROGRESS_USER_SUFFIX}:${QUEST_PROGRESS_PENDING_USER}` ? 'pending'
      : user ? `user:${user[1]}` : 'unknown'
  return { storageKey, questKey, owner }
}

const identityScope = ({ storageKey, questKey, owner }: ProgressIdentity): string =>
  JSON.stringify([questKey, owner === 'unknown' ? storageKey : owner])

const answerTimes = (
  answers: Record<string, string>,
  previous: Record<string, string>,
  timestamps: Record<string, number>,
  now: number,
): Record<string, number> => {
  const result = { ...timestamps }
  for (const [stepId, value] of Object.entries(answers)) {
    if (value && previous[stepId] !== value) result[stepId] = now
  }
  for (const stepId of Object.keys(result)) if (!answers[stepId]) delete result[stepId]
  return result
}

type UseQuestWizardProgressParams = {
  allSteps: QuestProgressStep[]
  steps: QuestProgressStep[]
  countModel?: QuestCountModel
  storageKey: string
  initialProgress?: InitialQuestProgress
  onProgressChange?: (data: QuestWizardProgressPayload) => void
  /**
   * `serverId` — поколение стёртой копии: экран без прочитанной строки удаляет
   * на сервере её. `true` в ответе — удаление там ещё ждёт сети (#2043).
   */
  onProgressReset?: (serverId: number) => Promise<boolean> | void
}

export function useQuestWizardProgress({
  allSteps,
  steps,
  countModel,
  storageKey,
  initialProgress,
  onProgressChange,
  onProgressReset,
}: UseQuestWizardProgressParams) {
  const identity = progressIdentity(storageKey)
  const pendingOwner = identity.owner === 'pending'
  // Первый кадр рисуется уже по известному прогрессу: роут монтирует визард,
  // только когда гостевой или серверный прогресс прочитан. С дефолтами первый
  // кадр показывал интро, а через кадр load-эффект переводил на сохранённый
  // шаг — карточка шага прыгала при перезагрузке (CLS до 0,17, #2270).
  // Load-эффект по-прежнему сливает его с локальной копией.
  const [initialSnapshot] = useState(() => normalizeQuestProgressSnapshot(
    initialProgress && !pendingOwner ? { ...initialProgress, serverId: initialProgress.serverId ?? undefined } : null,
  ))
  const [currentIndex, setCurrentIndex] = useState(initialSnapshot.currentIndex)
  const [unlockedIndex, setUnlockedIndex] = useState(initialSnapshot.unlockedIndex)
  const [answers, setAnswers] = useState<Record<string, string>>(initialSnapshot.answers)
  const [attempts, setAttempts] = useState<Record<string, number>>(initialSnapshot.attempts)
  const [hints, setHints] = useState<Record<string, boolean>>(initialSnapshot.hints)
  const [showMap, setShowMap] = useState(initialSnapshot.showMap)
  // Точки, которые игрок официально пропустил на карточке «эта точка далеко».
  // Пропуск обязан снимать точку с гейта финала: иначе обещание «квест
  // засчитается и без неё» не выполняется, а далёкая точка в СЕРЕДИНЕ маршрута
  // закрывает финал навсегда.
  const [skipped, setSkipped] = useState<Record<string, boolean>>(initialSnapshot.skipped)
  // Игрок закончил квест, не дойдя до точек за длинным перегоном. Хранится
  // отдельно от `completed`: `completed` монотонен и приходит в том числе с
  // сервера, и если в квест добавят шаг (#1431), прежний финишер иначе получил
  // бы форс-редирект в финал и чужую строку «дальние вы отложили».
  const [earlyFinish, setEarlyFinish] = useState(initialSnapshot.earlyFinish)
  // Timestamp существует только для перехода incomplete → completed в текущей
  // смонтированной сессии. Гидратация уже завершённого прогресса его не ставит,
  // поэтому повторное открытие финала не создаёт новый retention-цикл.
  const [completionFinishedAt, setCompletionFinishedAt] = useState<number | null>(null)
  const resolvedCountModel = useMemo(
    () => countModel ?? buildQuestCountModel(steps, allSteps.find((step) => step.id === 'intro')),
    [allSteps, countModel, steps],
  )
  // Отпечаток состояния, которое хук засеял сам (слияние, AsyncStorage, сброс).
  // Save-эффект пропускает ровно его — без прежней гонки `suppressSave` с
  // `setTimeout(0)`, где лишний await в load-эффекте решал, сработает гейт или
  // нет. Стартовое значение гасит сейв стартового состояния на первом рендере.
  const seededSnapshotRef = useRef<string | null>(stateFingerprint(initialSnapshot))
  // Какой storageKey уже засеян бэкенд-прогрессом. initialProgress пересоздаётся
  // в роуте через useMemo на каждое setProgress (эхо нашего же debounced-сейва),
  // поэтому без этого гейта load-эффект перезапускался на каждое эхо и откатывал
  // currentIndex/answers к серверным значениям — отсюда «тап по ответу иногда
  // игнорируется и возвращает на тот же шаг».
  const backendSeededKey = useRef<string | null>(null)
  // Времена живут вне React-state: на рендер не влияют, а нужны только слиянию.
  const answeredAtRef = useRef<Record<string, number>>(initialSnapshot.answeredAt)
  const lastAnswersRef = useRef<Record<string, string>>(initialSnapshot.answers)
  const updatedAtRef = useRef(initialSnapshot.updatedAt)
  // Поколение копии (#2033) тоже не рендерится: оно едет в хранилище и в
  // отложенный снапшот, чтобы писатель не отдал его чужой строке.
  const serverIdRef = useRef(initialSnapshot.serverId)
  // Живое состояние для слияния серверных обновлений, пришедших во время сессии:
  // load-эффект асинхронный, замыкание успевает устареть.
  const liveSnapshotRef = useRef<QuestProgressSnapshot>(initialSnapshot)
  // Уже подтверждённое прохождение (сервер или прежняя сессия этого устройства).
  // До #1632 `skipped`/`earlyFinish` на сервер не уходили, и второе устройство
  // пересчитывало засчитанный квест как незаконченный: без этой отметки оно
  // отправило бы `completed: false`, отняв у игрока «Пройден» и единицу из
  // счётчика прохождений. Отметка остаётся и после #1632 — она страхует от
  // прогресса, записанного клиентом старой версии, у которого пропусков нет. Отметка живёт в ref, а не в state: на рендер она не
  // влияет и намеренно НЕ поднимает `questCompleted` — форсить прежнего финишера
  // в финал нельзя (#1431).
  const confirmedCompletedRef = useRef(initialSnapshot.completed)
  const hydrationVersionRef = useRef(0)
  const resetVersionRef = useRef(0)
  const mountedRef = useRef(true)
  const contextRef = useRef({ identity, provenance: pendingOwner ? 'unknown' : identity.owner })
  const quarantinedRef = useRef<{
    scope: string
    snapshot: QuestProgressSnapshot
    finishedAt: number | null
  } | null>(null)
  const initialOwnersRef = useRef(new WeakMap<InitialQuestProgress, string>())
  const serverOwnersRef = useRef(new Map<number, string>())
  const resetInputsRef = useRef(new WeakSet<InitialQuestProgress>())
  const resetRowsRef = useRef(new Set<number>())

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      resetVersionRef.current += 1
    }
  }, [])

  const applyProgressState = useCallback((snapshot: QuestProgressSnapshot) => {
    setSkipped(snapshot.skipped)
    setEarlyFinish(snapshot.earlyFinish)
    setCurrentIndex(snapshot.currentIndex)
    setUnlockedIndex(snapshot.unlockedIndex)
    setAnswers(snapshot.answers)
    setAttempts(snapshot.attempts)
    setHints(snapshot.hints)
    setShowMap(snapshot.showMap)
  }, [])

  const applySnapshot = useCallback((snapshot: QuestProgressSnapshot, markSeeded: boolean) => {
    answeredAtRef.current = snapshot.answeredAt
    lastAnswersRef.current = snapshot.answers
    updatedAtRef.current = snapshot.updatedAt
    serverIdRef.current = snapshot.serverId
    confirmedCompletedRef.current = snapshot.completed
    seededSnapshotRef.current = markSeeded ? stateFingerprint(snapshot) : null
    applyProgressState(snapshot)
  }, [applyProgressState])

  // Состояние принадлежит квесту, а не хуку: на другом квесте оно обнуляется
  // тем же рендером, ДО save-эффекта. Иначе эффект успевал отправить ответы
  // прошлого квеста уже под новым ключом, а монотонный `completed` дарил новому
  // квесту чужой «Пройден» (#1906). Вход продолжает только текущую анонимную
  // сессию; pending не превращает известного владельца в нового гостя (#2850).
  const previousContext = contextRef.current
  const sameQuest = previousContext.identity.questKey === identity.questKey
  const claimAnonymous = previousContext.identity.storageKey !== storageKey && sameQuest
    && previousContext.provenance === 'guest' && identity.owner.startsWith('user:')

  // Старый server input может пережить pending и остаться тем же объектом при
  // новом аккаунте. Положительный id строки тоже адресован только своему owner.
  const scope = identityScope(identity)
  let acceptedInitial = pendingOwner ? undefined : initialProgress
  if (acceptedInitial) {
    const objectOwner = initialOwnersRef.current.get(acceptedInitial)
    const rowOwner = serverOwnersRef.current.get(Number(acceptedInitial.serverId))
    const anonymousScope = identityScope({ ...identity, owner: 'guest' })
    const permits = (owner: string | undefined) => !owner || owner === scope || (claimAnonymous && owner === anonymousScope)
    if (resetInputsRef.current.has(acceptedInitial) || resetRowsRef.current.has(Number(acceptedInitial.serverId))
      || !permits(objectOwner) || !permits(rowOwner)) acceptedInitial = undefined
    else {
      initialOwnersRef.current.set(acceptedInitial, scope)
      if (Number(acceptedInitial.serverId) > 0) serverOwnersRef.current.set(Number(acceptedInitial.serverId), scope)
    }
  }

  if (previousContext.identity.storageKey !== storageKey) {
    const continueAnonymous = sameQuest && previousContext.provenance === 'guest'
      && (identity.owner === 'guest' || pendingOwner || claimAnonymous)
    const restore = sameQuest && identity.owner.startsWith('user:')
      && quarantinedRef.current?.scope === identityScope(identity) ? quarantinedRef.current : null

    if (sameQuest && previousContext.identity.owner.startsWith('user:') && pendingOwner) {
      const now = Date.now()
      const currentState = { currentIndex, unlockedIndex, answers, attempts, hints, showMap, skipped, earlyFinish }
      const changed = stateFingerprint(currentState) !== stateFingerprint(liveSnapshotRef.current)
      quarantinedRef.current = {
        scope: identityScope(previousContext.identity),
        snapshot: normalizeQuestProgressSnapshot({
          ...currentState,
          completed: confirmedCompletedRef.current || liveSnapshotRef.current.completed,
          updatedAt: changed ? now : updatedAtRef.current,
          answeredAt: answerTimes(answers, lastAnswersRef.current, answeredAtRef.current, now),
          serverId: serverIdRef.current,
        }),
        finishedAt: completionFinishedAt,
      }
    } else if (!pendingOwner || !sameQuest) quarantinedRef.current = null

    hydrationVersionRef.current += 1
    resetVersionRef.current += 1
    backendSeededKey.current = null
    if (!continueAnonymous) {
      applySnapshot(restore?.snapshot ?? normalizeQuestProgressSnapshot(null), true)
      setCompletionFinishedAt(restore?.finishedAt ?? null)
    }
    contextRef.current = {
      identity,
      provenance: pendingOwner && sameQuest ? previousContext.provenance : identity.owner,
    }
  }

  // Подтверждённый reset сильнее quarantine даже до завершения storage-чтения.
  if (acceptedInitial && isQuestProgressRunEnded(
    { serverId: serverIdRef.current },
    acceptedInitial.serverId === null ? null : acceptedInitial.serverId ?? 0,
  )) {
    hydrationVersionRef.current += 1
    resetVersionRef.current += 1
    backendSeededKey.current = null
    applySnapshot(normalizeQuestProgressSnapshot({ ...acceptedInitial, serverId: acceptedInitial.serverId ?? undefined }), true)
    setCompletionFinishedAt(null)
  }

  /**
   * Применить снапшот как собственный сид хука.
   * `markSeeded` = данные уже согласованы с источником (сервером/хранилищем) и
   * их не надо гнать обратно; иначе save-эффект отправит слитое на сервер.
   */
  const seedProgressState = useCallback((snapshot: QuestProgressSnapshot, markSeeded: boolean): Promise<void> => {
    applySnapshot(snapshot, markSeeded)
    return AsyncStorage.setItem(storageKey, serializeRecord(snapshot)).catch(() => {})
  }, [applySnapshot, storageKey])

  useEffect(() => {
    const version = ++hydrationVersionRef.current
    let cancelled = false
    const active = () => !cancelled && hydrationVersionRef.current === version
      && contextRef.current.identity.storageKey === storageKey
    const liveSnapshot = () => normalizeQuestProgressSnapshot({
      ...liveSnapshotRef.current,
      answeredAt: answeredAtRef.current,
      updatedAt: updatedAtRef.current,
      serverId: serverIdRef.current,
    })
    const loadProgress = async () => {
      try {
        if (pendingOwner) return
        if (!acceptedInitial) {
          // Бэкенд-прогресс ещё не загружен — даём ему засеять состояние, когда придёт.
          backendSeededKey.current = null
          const local = await readStoredProgress(storageKey)
          if (!active()) return
          seedProgressState(mergeQuestProgress(liveSnapshot(), local).merged, true)
          return
        }

        const server = normalizeQuestProgressSnapshot({
          ...acceptedInitial,
          serverId: acceptedInitial.serverId ?? undefined,
        })
        // Что сервер подтвердил (#2033): `id` строки, `null` — строки нет, 0 —
        // ничего (чтение упало, гость). Стирать копию можно только по первым двум.
        const confirmedServerId = acceptedInitial.serverId === null ? null : server.serverId

        if (backendSeededKey.current === storageKey) {
          const live = liveSnapshot()
          // Прохождение сброшено на другом устройстве, пока квест открыт здесь:
          // экран узнал об этом от сервера. Берём сервер целиком, с курсором —
          // курсор закончившегося прохождения к новому не относится.
          if (isQuestProgressRunEnded(live, confirmedServerId)) {
            setCompletionFinishedAt(null)
            seedProgressState(server, true)
            return
          }
          // Квест уже засеян: это либо эхо собственного сейва, либо ответы
          // другого устройства, прилетевшие в ответе сервера. Сливаем аддитивно,
          // но курсор и карту не двигаем — игрок смотрит на этот экран.
          const { merged, localChanged } = mergeQuestProgress(live, server)
          if (!localChanged) return
          seedProgressState(
            { ...merged, currentIndex: live.currentIndex, showMap: live.showMap },
            true,
          )
          return
        }

        // Серверный прогресс мог отстать (ответы без сети до него не долетают,
        // баг 2026-07-28), а локальный — не знать про другое устройство. Поэтому
        // не выбираем победителя, а сливаем: ни один ответ не теряется.
        const local = await readStoredProgress(storageKey)
        if (!active()) return
        backendSeededKey.current = storageKey
        // Кроме копии прохождения, которое сброшено на другом устройстве: её
        // строки больше нет или на её месте новая. Долить её значит отменить
        // чужой сброс — копия стирается, остаётся то, что на сервере (#2033).
        const live = liveSnapshot()
        // Первый кадр уже засеян этим же server input. Его derived `completed`
        // не является отдельным действием игрока: слияние с ним помечает
        // серверный снимок «нужен push» и шлёт эхо (#2850). Живую сессию
        // сливаем только когда она отличается от этого сида — гостевой вход.
        const liveIsServerSeed = stateFingerprint(live) === stateFingerprint(server)
          && live.serverId === server.serverId
        const liveEnded = !liveIsServerSeed && isQuestProgressRunEnded(live, confirmedServerId)
        const localEnded = isQuestProgressRunEnded(local, confirmedServerId)
        if (liveEnded) setCompletionFinishedAt(null)
        const compatible = mergeQuestProgress(
          liveEnded || liveIsServerSeed ? null : live,
          localEnded ? null : local,
        ).merged
        const { merged, serverNeedsPush } = mergeQuestProgress(compatible, server)
        // Если серверу чего-то не хватает — не гасим save-эффект, он дольёт.
        seedProgressState(merged, !serverNeedsPush)
      } catch (error) {
        if (!active()) return
        const { devError } = require('@/utils/logger')
        devError('Error loading quest progress:', error)
      }
    }

    loadProgress()
    return () => { cancelled = true }
  }, [acceptedInitial, pendingOwner, seedProgressState, storageKey])

  // Explicit backend roles own the denominator. An incomplete role contract
  // falls back to every numbered step without inspecting answer behavior.
  const requiredSteps = useMemo(
    () => getQuestProgressSteps(steps, resolvedCountModel),
    [resolvedCountModel, steps],
  )
  const routeGateSteps = useMemo(
    () => getQuestRouteGateSteps(steps, resolvedCountModel),
    [resolvedCountModel, steps],
  )
  // Пропущенная далёкая точка из гейта финала выпадает, но из знаменателя
  // «пройдено N из M» — нет: счётчик остаётся честным.
  const gatingSteps = useMemo(
    () => routeGateSteps.filter((step) => !skipped[step.id]),
    [routeGateSteps, skipped],
  )

  const completedSteps = useMemo(() => requiredSteps.filter((step) => answers[step.id]), [answers, requiredSteps])
  // Точки, которые ещё держат гейт финала: обязательные/финальная, без ответа и без
  // официального пропуска. Ссылка «Пропустить» (#1633) переносит игрока вперёд,
  // но точку с гейта не снимает — и до этого списка игрок никак не мог узнать,
  // что именно осталось за спиной и почему финал не открывается.
  const pendingSteps = useMemo(
    () => gatingSteps.filter((step) => !answers[step.id]),
    [answers, gatingSteps],
  )
  const requiredCount = requiredSteps.length
  const progress = requiredCount > 0 ? completedSteps.length / requiredCount : 0
  // Гейт маршрута закрыт: на каждой точке, которую игрок не пропустил, есть
  // ответ. Пропуск гейт сужает, поэтому гейт МОЖЕТ опуститься до пустого —
  // `[].every(...) === true`. Само по себе это НЕ означает пройденного квеста:
  // «пропустил всё подряд» тоже закрывает гейт при нуле ответов, поэтому
  // наружу отдаётся не эта величина, а `questFinished`/`questCompleted`.
  const routeGateClosed = requiredCount > 0 && gatingSteps.every((step) => !!answers[step.id])
  // Квест закончен: либо пройдены все точки, которые игрок не пропустил, либо он
  // закрыл квест на месте, оставив за спиной только далёкие. Ноль ответов финалом
  // не считается: пропустить подряд весь маршрут — это не прохождение, даже
  // частичное, и такому игроку показывать финальное видео незачем.
  const questFinished = requiredCount > 0 && completedSteps.length > 0 && (routeGateClosed || earlyFinish)
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
  const finishedEarly = earlyFinish || routeGateSteps.some((step) => skipped[step.id] && !answers[step.id])

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
    const answeredAt = answerTimes(answers, lastAnswersRef.current, answeredAtRef.current, now)
    answeredAtRef.current = answeredAt
    lastAnswersRef.current = answers
    updatedAtRef.current = now

    // Наружу (в хранилище и на сервер) `completed` монотонен: пересчёт на
    // устройстве, не знающем про пропуски, не должен отменять уже засчитанное
    // прохождение (#1451).
    const wasCompleted = confirmedCompletedRef.current
    const reportedCompleted = questCompleted || wasCompleted
    confirmedCompletedRef.current = reportedCompleted
    if (!wasCompleted && questCompleted) setCompletionFinishedAt(now)

    // Pending не адресован известному аккаунту. Анонимная сессия живёт в памяти;
    // private quarantine никогда не показывается и не записывается под этим key.
    if (pendingOwner) return

    AsyncStorage.setItem(storageKey, serializeRecord({
      currentIndex,
      unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
      completed: reportedCompleted,
      skipped,
      earlyFinish,
      updatedAt: now,
      answeredAt,
      serverId: serverIdRef.current,
    })).catch((error) => console.error('Error saving progress:', error))

    onProgressChange?.({
      currentIndex,
      unlockedIndex,
      answers,
      attempts,
      hints,
      showMap,
      completed: reportedCompleted,
      skipped,
      earlyFinish,
      updatedAt: now,
      answeredAt,
      serverId: serverIdRef.current,
    })
  }, [answers, attempts, currentIndex, earlyFinish, hints, onProgressChange, pendingOwner, questCompleted, showMap, skipped, storageKey, unlockedIndex])

  // Живой снимок для слияния серверных обновлений, прилетевших во время сессии.
  liveSnapshotRef.current = normalizeQuestProgressSnapshot({
    currentIndex,
    unlockedIndex,
    answers,
    attempts,
    hints,
    showMap,
    completed: questCompleted || confirmedCompletedRef.current,
    skipped,
    earlyFinish,
    updatedAt: updatedAtRef.current,
    answeredAt: answeredAtRef.current,
    serverId: serverIdRef.current,
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

  // Экран сбрасывается сразу, а исход удаления строки на сервере приходит
  // отдельным промисом: без сети запрос висит до таймаута, и ждать его значило
  // бы держать на экране прежнее прохождение (#2043).
  const resetProgress = async (): Promise<{ serverDeletionPending: Promise<boolean> }> => {
    if (!mountedRef.current || contextRef.current.identity.storageKey !== storageKey) {
      return { serverDeletionPending: Promise.resolve(false) }
    }
    const resetVersion = ++resetVersionRef.current
    hydrationVersionRef.current += 1
    quarantinedRef.current = null
    const resetRunServerId = serverIdRef.current
    if (resetRunServerId > 0) resetRowsRef.current.add(resetRunServerId)
    if (initialProgress && hasQuestProgressStarted(initialProgress)) resetInputsRef.current.add(initialProgress)
    // Consumer захватывает auth owner ПРИ ВЫЗОВЕ, а не после нашего storage await.
    // Намерение A должно дойти A, даже если экран к моменту remove уже принадлежит B.
    let serverDeletionPending: Promise<boolean>
    try {
      serverDeletionPending = Promise.resolve(onProgressReset?.(resetRunServerId)).then((pending) => pending === true)
    } catch (error) {
      serverDeletionPending = Promise.reject(error)
    }
    // Наблюдаем ранний отказ, пока local IO ждёт; возвращаем исходный rejecting Promise.
    void serverDeletionPending.catch(() => {})
    await AsyncStorage.removeItem(storageKey)
    if (!mountedRef.current || resetVersionRef.current !== resetVersion
      || contextRef.current.identity.storageKey !== storageKey) return { serverDeletionPending }
    // Сброс — единственная немонотонная операция: слияние её бы отменило,
    // поэтому чистим и локальные времена, чтобы старые ответы не «воскресли».
    const emptyState = normalizeQuestProgressSnapshot({ updatedAt: Date.now() })
    setCompletionFinishedAt(null)
    await seedProgressState(emptyState, true)
    return { serverDeletionPending }
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
    skipped,
    earlyFinish,
    completedSteps,
    /** Гейтящие точки без ответа и без официального пропуска (#1633). */
    pendingSteps,
    requiredCount,
    progress,
    /** Гейт маршрута закрыт. Не «квест пройден» — см. комментарий у вычисления. */
    routeGateClosed,
    questFinished,
    questCompleted,
    partiallyCompleted,
    stepsMissingForCompletion,
    finishedEarly,
    completionFinishedAt,
    finishEarly,
    markStepSkipped,
    resetProgress,
  }
}
