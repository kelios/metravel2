// Очередь доставки прогресса квеста (#1922).
//
// Зачем очередь на диске, а не ref экрана: квест проходят на улице, часто без
// сети. До #1922 отложенный снапшот жил в `pendingDataRef` хука экрана —
// уход с квеста делал одну попытку отправки и чистил очередь. Прохождение без
// сети оставалось на телефоне: в «Пройденных» его не было, пока игрок не
// откроет ТОТ ЖЕ квест снова, будучи в сети и в аккаунте. Запись здесь
// переживает выгрузку приложения и уезжает из любого экрана — ровно так, как
// это уже сделано для телеметрии ответов (`utils/questAnswerTelemetry.ts`,
// #1276).
//
// Без авторизации очередь НЕ выбрасывается: потеря токена (#1921) не должна
// стоить игроку прохождения — запись ждёт входа и уезжает после него.

import AsyncStorage from '@react-native-async-storage/async-storage'

import { ApiError } from '@/api/clientErrors'
import { getActiveQueryClient } from '@/api/activeQueryClient'
import {
    updateProgress as apiUpdateProgress,
    withQuestProgress,
    type ApiQuestProgress,
} from '@/api/quests'
import { refreshQuestsCatalogCompletion } from '@/api/questsCatalogInvalidation'
import { useAuthStore } from '@/stores/authStore'
import { devWarn } from '@/utils/logger'
import {
    mergeQuestProgress,
    normalizeQuestProgressSnapshot,
    snapshotFromServerProgress,
    toQuestProgressServerPayload,
    type QuestProgressSnapshot,
} from '@/utils/questProgressMerge'

/**
 * v2 — в записи появился владелец (`ownerId`). Записи v1 не читаются намеренно:
 * без владельца очередь не может решить, в чьё прохождение их отправлять, а
 * наружу v1 не выпускался — он прожил один коммит.
 */
export const QUEST_PROGRESS_QUEUE_KEY = 'quest_progress_queue_v2'

/**
 * Потолок очереди: у записи ключ — квест, поэтому это число РАЗНЫХ квестов,
 * ждущих отправки, а не число сохранений. Переполнение снимает самую старую.
 */
export const QUEUE_MAX_QUESTS = 20

const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60 * 1000

export type QueuedQuestProgress = {
    questId: string
    /**
     * Владелец прохождения на момент постановки. Без него запись уехала бы в
     * строку того, кто вошёл следующим: ответы одного игрока попали бы в
     * прохождение другого — та же семья, из-за которой ключ локальной копии
     * содержит id владельца (#1456, `utils/questProgressStorage.ts`).
     */
    ownerId: string | null
    snapshot: QuestProgressSnapshot
    queuedAt: number
}

// Состояние модульное, а не хуковое: доставка обязана пережить размонтирование
// экрана квеста и работать из любого места приложения.
let queue: QueuedQuestProgress[] | null = null
let queueLoadPromise: Promise<QueuedQuestProgress[]> | null = null
let flushChain: Promise<void> | null = null
let retryAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<(questIds: string[]) => void>()

/** Кто сейчас за телефоном. `null` — гость: отправлять некому. */
const currentOwnerId = (): string | null => useAuthStore.getState().userId ?? null

const isQueuedProgress = (value: unknown): value is QueuedQuestProgress => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return (
        typeof record.questId === 'string' &&
        !!record.questId &&
        typeof record.ownerId === 'string' &&
        !!record.snapshot &&
        typeof record.snapshot === 'object'
    )
}

const loadQueue = async (): Promise<QueuedQuestProgress[]> => {
    if (queue) return queue
    if (!queueLoadPromise) {
        queueLoadPromise = (async () => {
            try {
                const raw = await AsyncStorage.getItem(QUEST_PROGRESS_QUEUE_KEY)
                const parsed = raw ? JSON.parse(raw) : []
                if (!Array.isArray(parsed)) return []
                return parsed.filter(isQueuedProgress).map((entry) => ({
                    questId: entry.questId,
                    ownerId: entry.ownerId,
                    snapshot: normalizeQuestProgressSnapshot(entry.snapshot),
                    queuedAt: Number(entry.queuedAt) || 0,
                }))
            } catch {
                // Повреждённый JSON или недоступное хранилище — пустая очередь.
                return []
            }
        })()
            .then((loaded) => {
                queue = loaded
                return loaded
            })
            .finally(() => {
                queueLoadPromise = null
            })
    }
    return queueLoadPromise
}

/**
 * Пометку «ещё не отправлено» видит владелец записи, а гостю показываем всё:
 * он же и есть тот, у кого пропал токен, и запись на его телефоне.
 */
const isVisibleToViewer = (entry: QueuedQuestProgress): boolean => {
    const viewer = currentOwnerId()
    return viewer == null || entry.ownerId == null || entry.ownerId === viewer
}

const notify = () => {
    const questIds = (queue ?? []).filter(isVisibleToViewer).map((entry) => entry.questId)
    listeners.forEach((listener) => {
        try {
            listener(questIds)
        } catch {
            // Слушатель — это UI-пометка: его падение не должно рвать доставку.
        }
    })
}

const persistQueue = async (): Promise<void> => {
    try {
        await AsyncStorage.setItem(QUEST_PROGRESS_QUEUE_KEY, JSON.stringify(queue ?? []))
    } catch {
        // Best effort: недоступное хранилище не должно ронять прохождение.
    }
    notify()
}

const clearRetryTimer = () => {
    if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
    }
}

const scheduleRetry = () => {
    clearRetryTimer()
    const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS)
    retryAttempt += 1
    retryTimer = setTimeout(() => {
        retryTimer = null
        void flushQuestProgressQueue()
    }, delay)
}

/**
 * Отправка снапшота с защитой от затирания параллельного устройства: перед
 * PATCH забираем текущее серверное состояние и шлём слитое. Иначе телефон,
 * вернувшийся из офлайна, стёр бы ответы, записанные другим устройством.
 * Возвращает актуальную серверную запись (PATCH пропускается, если серверу
 * добавлять нечего).
 *
 * Чтение, слияние и PATCH идут одним писателем на квест (`withQuestProgress`):
 * после логина этот флаш и миграция гостевого прогресса стартуют вместе, а
 * `answers` заменяет серверный словарь целиком — считать слияние от общей
 * устаревшей базы значит потерять чужие ответы (#1905).
 */
export async function pushQuestProgressSnapshot(
    questId: string,
    snapshot: QuestProgressSnapshot | Partial<QuestProgressSnapshot>,
): Promise<ApiQuestProgress> {
    const ownerId = useAuthStore.getState().userId
    const updated = await withQuestProgress(questId, async (serverProgress) => {
        const { merged, serverNeedsPush } = mergeQuestProgress(
            normalizeQuestProgressSnapshot(snapshot),
            snapshotFromServerProgress(serverProgress),
        )
        return serverNeedsPush
            ? apiUpdateProgress(serverProgress.id, toQuestProgressServerPayload(merged))
            : serverProgress
    })
    const currentAuth = useAuthStore.getState()
    if (updated.completed && ownerId && currentAuth.isAuthenticated && currentAuth.userId === ownerId) {
        const client = getActiveQueryClient()
        if (client) void refreshQuestsCatalogCompletion(client, questId)
    }
    return updated
}

/**
 * Кладёт снапшот в очередь. Запись адресуется квестом: снапшот накопительный,
 * поэтому повторная постановка того же квеста не плодит записи, а сливается с
 * уже лежащей — ни один ответ при этом не теряется.
 */
export async function enqueueQuestProgress(
    questId: string,
    snapshot: QuestProgressSnapshot | Partial<QuestProgressSnapshot>,
    ownerId: string | null = currentOwnerId(),
): Promise<void> {
    if (!questId) return

    await loadQueue()
    // Ссылку читаем ПОСЛЕ await: параллельный флаш пересобирает `queue` новым
    // массивом, и запись в захваченный до await была бы потеряна.
    const entries = queue ?? (queue = [])
    const normalized = normalizeQuestProgressSnapshot(snapshot)
    // Ключ записи — квест И владелец: два человека с одного телефона могут
    // ждать отправки одного и того же квеста, и сливать их прохождения нельзя.
    const existingIndex = entries.findIndex(
        (entry) => entry.questId === questId && entry.ownerId === ownerId,
    )

    if (existingIndex >= 0) {
        const existing = entries[existingIndex]
        const { merged } = mergeQuestProgress(normalized, existing.snapshot)
        entries[existingIndex] = { questId, ownerId, snapshot: merged, queuedAt: Date.now() }
    } else {
        entries.push({ questId, ownerId, snapshot: normalized, queuedAt: Date.now() })
        if (entries.length > QUEUE_MAX_QUESTS) entries.splice(0, entries.length - QUEUE_MAX_QUESTS)
    }

    await persistQueue()
}

/**
 * Снимает квест с очереди — его снапшот уже доехал другим путём или прохождение
 * удалено. Запись чужого владельца при этом не трогается.
 */
export async function dequeueQuestProgress(
    questId: string,
    ownerId: string | null = currentOwnerId(),
): Promise<void> {
    if (!questId) return
    await loadQueue()
    const entries = queue ?? []
    const next = entries.filter((entry) => entry.questId !== questId || entry.ownerId !== ownerId)
    if (next.length === entries.length) return
    queue = next
    await persistQueue()
}

/**
 * Отправляет снапшот сразу, а при неудаче кладёт в очередь. Точка ухода с
 * квеста: попытка одна, но её провал больше не стоит игроку прохождения.
 */
export async function deliverOrEnqueueQuestProgress(
    questId: string,
    snapshot: QuestProgressSnapshot | Partial<QuestProgressSnapshot>,
    ownerId: string | null = currentOwnerId(),
): Promise<void> {
    if (!questId) return
    // Авторизацию проверяет вызывающий: на экране квеста её знает сам хук, и
    // сверяться тут со стором значит спорить с ним о состоянии сессии.
    try {
        await pushQuestProgressSnapshot(questId, snapshot)
        await dequeueQuestProgress(questId, ownerId)
    } catch (error) {
        devWarn('Could not deliver quest progress, queued for later:', error)
        await enqueueQuestProgress(questId, snapshot, ownerId)
    }
}

/**
 * 4xx, кроме «повтори позже» и «войди»: серверу такой снапшот не подойдёт
 * никогда, и держать его в очереди значит навсегда заткнуть ею доставку
 * остальных квестов.
 */
const isPermanentRejection = (status: number | undefined): boolean =>
    typeof status === 'number' && status >= 400 && status < 500 && status !== 429 && status !== 401 && status !== 403

const drainQueue = async (): Promise<void> => {
    await loadQueue()
    if (!queue?.length) return
    // Без аккаунта отправлять некуда, но очередь остаётся: она ждёт входа.
    const ownerId = currentOwnerId()
    if (!useAuthStore.getState().isAuthenticated || !ownerId) return

    clearRetryTimer()

    // Квест за заход берём один раз: пока шёл запрос, экран мог положить более
    // свежий снапшот того же квеста, и без этого набора цикл вернулся бы к нему
    // снова. Записи ЧУЖИХ владельцев не трогаем — они ждут своего входа.
    const processed = new Set<string>()

    // Первый неуспех останавливает заход: долбить недоступный сервер остальными
    // квестами смысла нет, их заберёт ретрай.
    for (;;) {
        const entry = (queue ?? []).find(
            (candidate) => candidate.ownerId === ownerId && !processed.has(candidate.questId),
        )
        if (!entry) break
        processed.add(entry.questId)

        try {
            await pushQuestProgressSnapshot(entry.questId, entry.snapshot)
            retryAttempt = 0
        } catch (error) {
            const status = error instanceof ApiError ? error.status : undefined
            if (!isPermanentRejection(status)) {
                devWarn('Could not deliver queued quest progress, will retry:', error)
                scheduleRetry()
                break
            }
            devWarn('Server rejected queued quest progress, dropping:', status)
        }

        // Снимаем запись ПО ССЫЛКЕ: если её уже заменили более свежим снапшотом,
        // ссылки в массиве нет — та запись остаётся и уедет следующим заходом.
        const current = queue ?? []
        const index = current.indexOf(entry)
        if (index >= 0) {
            current.splice(index, 1)
            await persistQueue()
        }
    }
}

/**
 * Отправляет накопленное. Вызовы сериализуются в одну цепочку: параллельный
 * флаш не шлёт дубль, а `await` дожидается именно доставки.
 */
export function flushQuestProgressQueue(): Promise<void> {
    const next = (flushChain ?? Promise.resolve()).then(drainQueue, drainQueue)
    // Цепочка не должна оставаться отклонённой: следующий вызов встанет за ней.
    flushChain = next.catch(() => {})
    return flushChain
}

/**
 * Пересчитать видимость пометки. Смена аккаунта не трогает состав очереди, и
 * без этого вызова вошедший видел бы чип от записи предыдущего игрока.
 */
export function refreshQuestProgressQueueVisibility(): void {
    notify()
}

/** Квесты, снапшот которых ещё не доехал. Синхронно — только загруженное. */
export function getQueuedQuestIds(): string[] {
    return (queue ?? []).filter(isVisibleToViewer).map((entry) => entry.questId)
}

/**
 * Подписка на состав очереди — для пометки «прохождение ещё не отправлено».
 * Слушатель получает текущий состав сразу, в том числе после чтения с диска.
 */
export function subscribeQuestProgressQueue(listener: (questIds: string[]) => void): () => void {
    listeners.add(listener)
    if (queue) {
        listener(getQueuedQuestIds())
    } else {
        void loadQueue().then(() => listener(getQueuedQuestIds()))
    }
    return () => {
        listeners.delete(listener)
    }
}

/** Только для тестов: сбрасывает модульное состояние очереди. */
export function __resetQuestProgressQueue(): void {
    clearRetryTimer()
    queue = null
    queueLoadPromise = null
    flushChain = null
    retryAttempt = 0
    listeners.clear()
}
