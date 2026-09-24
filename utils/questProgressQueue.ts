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
import { queryKeys } from '@/api/queryKeys'
import {
    deleteProgress as apiDeleteProgress,
    updateProgress as apiUpdateProgress,
    withQuestProgress,
    type ApiQuestProgress,
} from '@/api/quests'
import {
    refreshQuestCompletionsCount,
    refreshQuestsCatalogCompletion,
    resetQuestsCatalogCompletion,
} from '@/api/questsCatalogInvalidation'
import { useAuthStore } from '@/stores/authStore'
import { devWarn } from '@/utils/logger'
import {
    QuestProgressLineageMismatch,
    isQuestProgressCoveredBy,
    isQuestProgressRunEnded,
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
 * Намерения удалить строку прохождения: «Сбросить» нажато, а сервер удаление
 * ещё не подтвердил (#2043). Ключ свой, а не запись в очереди снапшотов: те
 * сливаются по квесту и зажигают пометку «ещё не отправлено», а удаление не
 * сливается ни с чем и уходит раньше любого снапшота своего квеста.
 */
export const QUEST_PROGRESS_DELETIONS_KEY = 'quest_progress_deletions_v1'

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

export type QueuedQuestProgressDeletion = {
    questId: string
    /** Чьё прохождение сброшено: удаление уходит только в сессии этого игрока. */
    ownerId: string | null
    /**
     * `id` строки сброшенного прохождения. Удаляется ровно она: строку, созданную
     * после сброса (например, новое прохождение на другом устройстве), намерение
     * не трогает.
     */
    progressId: number
    queuedAt: number
}

// Состояние модульное, а не хуковое: доставка обязана пережить размонтирование
// экрана квеста и работать из любого места приложения.
let queue: QueuedQuestProgress[] | null = null
// Грузится вместе с `queue`: пока `queue` не загружена, список тоже пуст.
let deletions: QueuedQuestProgressDeletion[] = []
let queueLoadPromise: Promise<QueuedQuestProgress[]> | null = null
let flushChain: Promise<void> | null = null
let retryAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<(questIds: string[]) => void>()
type QuestProgressWriteListener = (
    questId: string,
    progress: ApiQuestProgress,
    /** Номер `beginQuestProgressWrite` на старте записи, не id строки (#2098). */
    writeEpoch?: number,
) => void
const progressWriteListeners = new Set<QuestProgressWriteListener>()
/**
 * Монотонный номер начатой записи. Не id строки: «Сбросить», нажатый до
 * появления id, сравнивает с ним ответ миграции, которая стартовала раньше (#2098).
 */
let questProgressWriteEpoch = 0
// Одна попытка на намерение: проход очереди, флаш экрана и чтение при открытии
// квеста ждут общий DELETE, а не шлют каждый свой.
const deletionAttempts = new Map<QueuedQuestProgressDeletion, Promise<boolean>>()

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

const isQueuedDeletion = (value: unknown): value is QueuedQuestProgressDeletion => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return (
        typeof record.questId === 'string' &&
        !!record.questId &&
        typeof record.ownerId === 'string' &&
        typeof record.progressId === 'number' &&
        Number.isSafeInteger(record.progressId) &&
        record.progressId > 0
    )
}

/** Список с диска. Повреждённый JSON или недоступное хранилище — пустой список. */
const readStoredList = async <T>(key: string, isEntry: (value: unknown) => value is T): Promise<T[]> => {
    try {
        const raw = await AsyncStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.filter(isEntry) : []
    } catch {
        return []
    }
}

const loadQueue = async (): Promise<QueuedQuestProgress[]> => {
    if (queue) return queue
    if (!queueLoadPromise) {
        queueLoadPromise = Promise.all([
            readStoredList(QUEST_PROGRESS_QUEUE_KEY, isQueuedProgress),
            readStoredList(QUEST_PROGRESS_DELETIONS_KEY, isQueuedDeletion),
        ])
            .then(([storedQueue, storedDeletions]) => {
                deletions = storedDeletions.map((entry) => ({
                    questId: entry.questId,
                    ownerId: entry.ownerId,
                    progressId: entry.progressId,
                    queuedAt: Number(entry.queuedAt) || 0,
                }))
                queue = storedQueue.map((entry) => ({
                    questId: entry.questId,
                    ownerId: entry.ownerId,
                    snapshot: normalizeQuestProgressSnapshot(entry.snapshot),
                    queuedAt: Number(entry.queuedAt) || 0,
                }))
                return queue
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

const persistDeletions = async (): Promise<void> => {
    try {
        await AsyncStorage.setItem(QUEST_PROGRESS_DELETIONS_KEY, JSON.stringify(deletions))
    } catch {
        // Best effort, как и у снапшотов: намерение живёт в памяти до выгрузки.
    }
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

/** Ответ сервера — только своему игроку: он мог прийти уже после смены аккаунта. */
const isSessionOwner = (ownerId: string | null): boolean => {
    const currentAuth = useAuthStore.getState()
    return !!ownerId && !!currentAuth.isAuthenticated && currentAuth.userId === ownerId
}

export const syncCatalogCompletion = (questId: string, ownerId: string | null, completed: boolean): void => {
    if (!isSessionOwner(ownerId)) return
    const client = getActiveQueryClient()
    if (!client) return
    if (completed) void refreshQuestsCatalogCompletion(client, questId)
    else resetQuestsCatalogCompletion(client, questId)
}

/** Номер записи, которую писатель только что начал. Сбрасывается вместе с очередью в тестах. */
export function beginQuestProgressWrite(): number {
    questProgressWriteEpoch += 1
    return questProgressWriteEpoch
}

/** Последний выданный номер. «Сбросить» без id строки запоминает его (#2098). */
export function currentQuestProgressWriteEpoch(): number {
    return questProgressWriteEpoch
}

/**
 * «Мои квесты» читает не `['quests']`. Точная инвалидация каталога компактный
 * срез не задевает, а список прохождений лежит под другим префиксом. Оба держат
 * staleTime 30 минут — «Пройден» переживал и сброс, и финиш (#2096).
 */
const invalidateOwnedQuestCollections = (ownerId: string): void => {
    const client = getActiveQueryClient()
    if (!client) return
    const userId = String(ownerId)
    void client.invalidateQueries({ queryKey: queryKeys.questProgressAll(userId), exact: true })
    void client.invalidateQueries({ queryKey: queryKeys.questsCompactCatalog(userId), exact: true })
}

/**
 * Сервер подтвердил запись прохождения: строку (`progress`) или её удаление
 * (`null`). Правило одно для всех писателей — флаш экрана, доставка очереди,
 * миграция гостя: читатели на открытом экране получают подтверждённое без
 * повторного маунта (#2092). Хук синхронизации — строку, каталог и бандл квеста —
 * отметку «Пройден» и `completions_count`. Профиль — оба своих ключа (#2096).
 * `writeEpoch` — номер старта записи, не id строки (#2098).
 */
export const syncQuestProgressReaders = (
    questId: string,
    ownerId: string | null,
    progress: ApiQuestProgress | null,
    writeEpoch?: number,
): void => {
    if (!isSessionOwner(ownerId)) return
    if (progress) {
        progressWriteListeners.forEach((listener) => {
            try {
                listener(questId, progress, writeEpoch)
            } catch {
                // Падение читателя не должно рвать доставку.
            }
        })
        if (progress.completed) syncCatalogCompletion(questId, ownerId, true)
    } else {
        syncCatalogCompletion(questId, ownerId, false)
        const client = getActiveQueryClient()
        if (client) void refreshQuestCompletionsCount(client, questId)
    }
    if (ownerId) invalidateOwnedQuestCollections(ownerId)
}

/** Подписка читателя прохождения на подтверждённые записи строк (#2092). */
export function subscribeQuestProgressWrites(
    listener: QuestProgressWriteListener,
): () => void {
    progressWriteListeners.add(listener)
    return () => {
        progressWriteListeners.delete(listener)
    }
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
 *
 * Снапшот с поколением пишется только в свою строку. Если её сбросили на
 * другом устройстве, летит `QuestProgressLineageMismatch`: снапшот доставлять
 * некуда, и вызывающий его выбрасывает, а не ставит на ретрай (#2033).
 *
 * Сброс квеста, не дошедший до сервера, писатель сначала доводит: слияние со
 * строкой сброшенного прохождения вернуло бы новому прохождению прежние ответы
 * и «Пройден». Пока удаление ждёт, снапшот падает обычной ошибкой и ждёт на
 * ретрае и в очереди, как ждёт сети (#2043).
 */
export async function pushQuestProgressSnapshot(
    questId: string,
    snapshot: QuestProgressSnapshot | Partial<QuestProgressSnapshot>,
): Promise<ApiQuestProgress> {
    // До первого await: «Сбросить» посреди записи видит, что она началась раньше (#2098).
    const writeEpoch = beginQuestProgressWrite()
    const ownerId = useAuthStore.getState().userId
    if (!(await settleQuestProgressDeletions(questId, ownerId))) {
        throw new Error(`Reset of quest progress ${questId} is not confirmed by the server yet`)
    }
    const local = normalizeQuestProgressSnapshot(snapshot)
    let updated: ApiQuestProgress
    try {
        updated = await withQuestProgress(
            questId,
            async (serverProgress) => {
                const { merged, serverNeedsPush } = mergeQuestProgress(
                    local,
                    snapshotFromServerProgress(serverProgress),
                )
                return serverNeedsPush
                    ? apiUpdateProgress(serverProgress.id, toQuestProgressServerPayload(merged))
                    : serverProgress
            },
            { lineageId: local.serverId },
        )
    } catch (error) {
        // Отметка «Пройден» в каталоге этого устройства могла прийти из копии
        // сброшенного прохождения — выравниваем её по серверу.
        if (error instanceof QuestProgressLineageMismatch) {
            syncCatalogCompletion(questId, ownerId, error.current?.completed === true)
        }
        throw error
    }
    syncQuestProgressReaders(questId, ownerId, updated, writeEpoch)
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
 *
 * `lineageId` сужает снятие до записи этого поколения: прохождение сброшено на
 * другом устройстве, а снапшот нового прохождения, если он уже лежит в очереди,
 * должен уехать (#2033).
 */
export async function dequeueQuestProgress(
    questId: string,
    ownerId: string | null = currentOwnerId(),
    lineageId?: number,
): Promise<void> {
    if (!questId) return
    await loadQueue()
    const entries = queue ?? []
    const next = entries.filter((entry) =>
        entry.questId !== questId ||
        entry.ownerId !== ownerId ||
        (lineageId !== undefined && entry.snapshot.serverId !== lineageId),
    )
    if (next.length === entries.length) return
    queue = next
    await persistQueue()
}

/**
 * Экран доставил свой снапшот, и сервер ответил строкой `delivered`. Запись
 * квеста снимается, только если эта строка её уже покрывает: запись — не всегда
 * подмножество снапшота экрана. В очередь уходит и упавшая миграция гостя
 * (#2048), а её ответов у экрана вошедшего нет — он стартует от сервера.
 * Непокрытую запись очередь дожимает сразу: сеть только что ответила.
 */
export async function dequeueDeliveredQuestProgress(
    questId: string,
    delivered: ApiQuestProgress,
    ownerId: string | null = currentOwnerId(),
): Promise<void> {
    if (!questId) return
    await loadQueue()
    const entries = queue ?? []
    const server = snapshotFromServerProgress(delivered)
    let uncovered = false
    const next = entries.filter((entry) => {
        if (entry.questId !== questId || entry.ownerId !== ownerId) return true
        const covered = isQuestProgressCoveredBy(entry.snapshot, server)
        if (!covered) uncovered = true
        return !covered
    })
    if (next.length !== entries.length) {
        queue = next
        await persistQueue()
    }
    if (uncovered) void flushQuestProgressQueue()
}

/**
 * Сервер подтвердил строку квеста при открытии (`id`, `null` — строки нет):
 * записи закончившихся поколений снимаются сразу, по тому же правилу, по
 * которому визард стирает копию. Пока такая запись лежит, новое офлайн-
 * прохождение сливается в неё, наследует её поколение и выбрасывается вместе с
 * ней, когда очередь узнает о сбросе (#2043, хвост #2033).
 */
export async function dropEndedQuestProgressRuns(
    questId: string,
    ownerId: string | null,
    serverId: number | null,
): Promise<void> {
    await loadQueue()
    const entries = queue ?? []
    const next = entries.filter((entry) =>
        entry.questId !== questId ||
        entry.ownerId !== ownerId ||
        !isQuestProgressRunEnded(entry.snapshot, serverId),
    )
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
        const updated = await pushQuestProgressSnapshot(questId, snapshot)
        await dequeueDeliveredQuestProgress(questId, updated, ownerId)
    } catch (error) {
        // Прохождение сброшено на другом устройстве: в очередь класть нечего, а
        // лежащая там запись того же прохождения тоже больше не нужна (#2033).
        if (error instanceof QuestProgressLineageMismatch) {
            await dequeueQuestProgress(questId, ownerId, error.lineageId)
            return
        }
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

/**
 * Одна попытка удалить строку. `true` — намерение закрыто: сервер подтвердил,
 * что строки нет (204; 404 — удаление дошло раньше, а ответ потерялся), либо
 * отказал навсегда. Держать такое намерение значило бы навсегда закрыть квест
 * для новых прохождений игрока — та же политика, что у снапшотов (#1922).
 */
const attemptDeletion = async (entry: QueuedQuestProgressDeletion): Promise<boolean> => {
    // Закрыто другим путём, пока этот ждал своей очереди.
    if (!deletions.includes(entry)) return true
    // В чужой сессии сервер ответил бы 404 про СВОИ строки, и намерение
    // закрылось бы, не удалив строку владельца. Оно ждёт его входа.
    if (entry.ownerId !== currentOwnerId()) return false
    try {
        await apiDeleteProgress(entry.progressId)
    } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined
        if (!isPermanentRejection(status)) {
            devWarn('Could not delete quest progress, will retry:', error)
            return false
        }
        if (status !== 404) devWarn('Server rejected quest progress deletion, dropping:', status)
    }
    deletions = deletions.filter((candidate) => candidate !== entry)
    await persistDeletions()
    // Каталог мог перечитаться, пока удаление ждало сети, и вернуть «Пройден»,
    // а число прохождений квеста сервер уже уменьшил.
    syncQuestProgressReaders(entry.questId, entry.ownerId, null)
    return true
}

const settleDeletion = (entry: QueuedQuestProgressDeletion): Promise<boolean> => {
    const inFlight = deletionAttempts.get(entry)
    if (inFlight) return inFlight
    const attempt = attemptDeletion(entry).finally(() => {
        deletionAttempts.delete(entry)
    })
    deletionAttempts.set(entry, attempt)
    return attempt
}

/**
 * «Сбросить»: удалить на сервере строку сброшенного прохождения. Намерение
 * ложится на диск ДО запроса: без сети, при ошибке сервера и при выгрузке
 * приложения посреди запроса оно не теряется и уходит при следующем
 * пробуждении очереди (#2043). `true` — удаление больше не ждёт.
 */
export async function deleteOrEnqueueQuestProgress(
    questId: string,
    progressId: number,
    ownerId: string | null = currentOwnerId(),
): Promise<boolean> {
    await loadQueue()
    const existing = deletions.find((entry) =>
        entry.questId === questId && entry.ownerId === ownerId && entry.progressId === progressId,
    )
    const entry = existing ?? { questId, ownerId, progressId, queuedAt: Date.now() }
    if (!existing) {
        deletions = [...deletions, entry]
        await persistDeletions()
    }
    if (await settleDeletion(entry)) return true
    scheduleRetry()
    return false
}

/**
 * Свободен ли путь к строке квеста: сброс этого квеста, не дошедший до сервера,
 * сначала доводится. `false` — удаление всё ещё ждёт, и писать в строку или
 * показывать её как состояние сервера нельзя: это прохождение, которое игрок
 * стёр (#2043).
 */
export async function settleQuestProgressDeletions(
    questId: string,
    ownerId: string | null = currentOwnerId(),
): Promise<boolean> {
    await loadQueue()
    const pending = deletions.filter((entry) => entry.questId === questId && entry.ownerId === ownerId)
    for (const entry of pending) {
        if (!(await settleDeletion(entry))) return false
    }
    return true
}

const drainQueue = async (): Promise<void> => {
    await loadQueue()
    if (!queue?.length && !deletions.length) return
    // Без аккаунта отправлять некуда, но очередь остаётся: она ждёт входа.
    const ownerId = currentOwnerId()
    if (!useAuthStore.getState().isAuthenticated || !ownerId) return

    clearRetryTimer()

    // Сначала сбросы: снапшот квеста со сбросом в пути ждёт удаления строки, а
    // сброс без новых снапшотов иначе не уехал бы вовсе (#2043).
    for (const entry of deletions.filter((candidate) => candidate.ownerId === ownerId)) {
        if (!(await settleDeletion(entry))) {
            scheduleRetry()
            return
        }
        retryAttempt = 0
    }

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
            if (error instanceof QuestProgressLineageMismatch) {
                // Прохождение сброшено на другом устройстве: запись не доставляется
                // никогда, как и при постоянном отказе, а очередь идёт дальше (#2033).
                devWarn('Queued quest progress belongs to a reset run, dropping:', entry.questId)
            } else if (!isPermanentRejection(status)) {
                devWarn('Could not deliver queued quest progress, will retry:', error)
                scheduleRetry()
                break
            } else {
                devWarn('Server rejected queued quest progress, dropping:', status)
            }
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
    deletions = []
    deletionAttempts.clear()
    queueLoadPromise = null
    flushChain = null
    retryAttempt = 0
    listeners.clear()
    progressWriteListeners.clear()
    questProgressWriteEpoch = 0
}
