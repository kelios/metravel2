// utils/questProgressMerge.ts
// Слияние прогресса квеста между устройствами без правок бэкенда.
//
// Прогресс монотонен: отвеченный шаг не может стать неотвеченным, открытый шаг —
// закрытым. Поэтому объединение не требует новой схемы на сервере:
//   answers        — объединение ключей (коллизия одного шага решается временем)
//   attempts       — max по ключу
//   hints          — логическое ИЛИ по ключу
//   unlockedIndex  — max
//   completed      — ИЛИ. Понижать нельзя: прогресс старого клиента или запись,
//                    созданная до серверных полей #1454, ещё может не содержать
//                    `skipped`; `completed: false` не должно отнять у игрока
//                    «Пройден» и единицу счётчика прохождений (#1451)
//   skipped        — логическое ИЛИ по ключу (с #1632 синхронизируется сервером)
//   earlyFinish    — ИЛИ (с #1632 синхронизируется сервером)
//   currentIndex, showMap — last-writer-wins (косметика: где курсор и включена ли
//                    карта; это не данные прохождения)
//
// Времена живут только на клиенте: `updatedAt` для снапшота и `answeredAt` по
// шагам. С сервера доступен лишь глобальный `updated_at`, поэтому у серверных
// ответов время шага = время серверной записи. При любом исходе «отвеченность»
// шага сохраняется — теряется максимум текст одного одновременно введённого
// ответа.
import type { ApiQuestProgress } from '@/api/quests'

export type QuestProgressSnapshot = {
    currentIndex: number
    unlockedIndex: number
    answers: Record<string, string>
    attempts: Record<string, number>
    hints: Record<string, boolean>
    showMap: boolean
    completed: boolean
    /**
     * Точки, которые игрок официально пропустил (далёкие, #1432). Бэкенд хранит
     * их с #1454 (`quest_progress.skipped`), поэтому поле входит и в payload, и
     * в отпечаток сервера: пропуск обязан пережить смену устройства, иначе
     * засчитанное прохождение выглядит незаконченным (#1632).
     */
    skipped: Record<string, boolean>
    /** Игрок закрыл квест на месте, не дойдя до далёких точек. Тоже на сервере. */
    earlyFinish: boolean
    /** epoch ms последнего изменения снапшота; 0 — время неизвестно (легаси-запись) */
    updatedAt: number
    /** epoch ms ответа по шагам; для серверных данных подставляется updatedAt записи */
    answeredAt: Record<string, number>
}

export type QuestProgressMergeResult = {
    merged: QuestProgressSnapshot
    /** Слитое отличается от локального — нужно обновить state и AsyncStorage */
    localChanged: boolean
    /** Слитое отличается от серверного — нужен PATCH */
    serverNeedsPush: boolean
}

/** Поля, которые реально хранит бэкенд (по ним считается serverNeedsPush) */
export type QuestProgressServerPayload = {
    current_index: number
    unlocked_index: number
    answers: Record<string, string>
    attempts: Record<string, number>
    hints: Record<string, boolean>
    show_map: boolean
    completed: boolean
    skipped: Record<string, boolean>
    early_finish: boolean
}

const asRecord = <T>(value: unknown): Record<string, T> =>
    value && typeof value === 'object' ? { ...(value as Record<string, T>) } : {}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

/** Сколько шагов отвечено — пустая строка ответом не считается. */
export const countAnsweredSteps = (answers: Record<string, string> | undefined): number =>
    answers ? Object.values(answers).filter(Boolean).length : 0

export const normalizeQuestProgressSnapshot = (
    raw: Partial<QuestProgressSnapshot> | null | undefined,
): QuestProgressSnapshot => ({
    currentIndex: toFiniteNumber(raw?.currentIndex),
    unlockedIndex: toFiniteNumber(raw?.unlockedIndex),
    answers: asRecord<string>(raw?.answers),
    attempts: asRecord<number>(raw?.attempts),
    hints: asRecord<boolean>(raw?.hints),
    showMap: raw?.showMap !== false,
    completed: Boolean(raw?.completed),
    skipped: asRecord<boolean>(raw?.skipped),
    earlyFinish: Boolean(raw?.earlyFinish),
    updatedAt: toFiniteNumber(raw?.updatedAt),
    answeredAt: asRecord<number>(raw?.answeredAt),
})

/** ISO-время серверной записи → epoch ms (0, если разобрать не удалось). */
export const parseServerUpdatedAt = (isoDate: string | null | undefined): number => {
    if (!isoDate) return 0
    const parsed = Date.parse(isoDate)
    return Number.isFinite(parsed) ? parsed : 0
}

export const snapshotFromServerProgress = (
    progress: Pick<
        ApiQuestProgress,
        'current_index' | 'unlocked_index' | 'answers' | 'attempts' | 'hints' | 'show_map' | 'completed'
    > & {
        updated_at?: string | null
        // Сервер старше #1454 полей не отдаёт: читаем их как «пропусков нет».
        skipped?: ApiQuestProgress['skipped'] | null
        early_finish?: ApiQuestProgress['early_finish'] | null
    },
): QuestProgressSnapshot => {
    const updatedAt = parseServerUpdatedAt(progress.updated_at)
    const answers = asRecord<string>(progress.answers)
    // У сервера нет per-step времени: считаем, что все его ответы записаны
    // временем самой записи.
    const answeredAt: Record<string, number> = {}
    if (updatedAt > 0) {
        for (const stepId of Object.keys(answers)) {
            if (answers[stepId]) answeredAt[stepId] = updatedAt
        }
    }

    return normalizeQuestProgressSnapshot({
        currentIndex: progress.current_index,
        unlockedIndex: progress.unlocked_index,
        answers,
        attempts: progress.attempts,
        hints: progress.hints,
        showMap: progress.show_map,
        completed: progress.completed,
        skipped: progress.skipped ?? undefined,
        earlyFinish: progress.early_finish ?? undefined,
        updatedAt,
        answeredAt,
    })
}

export const toQuestProgressServerPayload = (
    snapshot: QuestProgressSnapshot,
): QuestProgressServerPayload => ({
    current_index: snapshot.currentIndex,
    unlocked_index: snapshot.unlockedIndex,
    answers: snapshot.answers,
    attempts: snapshot.attempts,
    hints: snapshot.hints,
    show_map: snapshot.showMap,
    completed: snapshot.completed,
    skipped: snapshot.skipped,
    early_finish: snapshot.earlyFinish,
})

const answeredTime = (snapshot: QuestProgressSnapshot, stepId: string): number =>
    toFiniteNumber(snapshot.answeredAt[stepId], snapshot.updatedAt) || snapshot.updatedAt

/**
 * Кому принадлежит курсор (currentIndex/showMap). Обычный LWW по времени, но у
 * записей, сделанных до появления `updatedAt`, времени нет — тогда курсор отдаём
 * тому, кто прошёл дальше, иначе после обновления приложения игрока выбрасывало
 * бы на нулевой шаг.
 */
const localOwnsCursor = (local: QuestProgressSnapshot, server: QuestProgressSnapshot): boolean => {
    if (local.updatedAt > 0 && server.updatedAt > 0) return local.updatedAt >= server.updatedAt
    const localAnswered = countAnsweredSteps(local.answers)
    const serverAnswered = countAnsweredSteps(server.answers)
    if (localAnswered !== serverAnswered) return localAnswered > serverAnswered
    return true
}

const mergeAnswers = (
    local: QuestProgressSnapshot,
    server: QuestProgressSnapshot,
): Record<string, string> => {
    const merged: Record<string, string> = {}
    const stepIds = new Set([...Object.keys(local.answers), ...Object.keys(server.answers)])

    for (const stepId of stepIds) {
        const localAnswer = local.answers[stepId]
        const serverAnswer = server.answers[stepId]

        // Монотонность: если одна сторона шаг не отвечала (или ответ пустой),
        // берём непустой ответ другой стороны.
        if (!localAnswer) {
            if (serverAnswer) merged[stepId] = serverAnswer
            continue
        }
        if (!serverAnswer || localAnswer === serverAnswer) {
            merged[stepId] = localAnswer
            continue
        }

        // Один и тот же шаг отвечен по-разному — решает время ответа.
        merged[stepId] =
            answeredTime(local, stepId) >= answeredTime(server, stepId) ? localAnswer : serverAnswer
    }

    return merged
}

const mergeAnsweredAt = (
    local: QuestProgressSnapshot,
    server: QuestProgressSnapshot,
    mergedAnswers: Record<string, string>,
): Record<string, number> => {
    const merged: Record<string, number> = {}
    for (const stepId of Object.keys(mergedAnswers)) {
        const stamp = Math.max(
            toFiniteNumber(local.answeredAt[stepId]),
            toFiniteNumber(server.answeredAt[stepId]),
        )
        if (stamp > 0) merged[stepId] = stamp
    }
    return merged
}

const mergeNumberRecords = (
    left: Record<string, number>,
    right: Record<string, number>,
): Record<string, number> => {
    const merged: Record<string, number> = {}
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        merged[key] = Math.max(toFiniteNumber(left[key]), toFiniteNumber(right[key]))
    }
    return merged
}

const mergeBooleanRecords = (
    left: Record<string, boolean>,
    right: Record<string, boolean>,
): Record<string, boolean> => {
    const merged: Record<string, boolean> = {}
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        merged[key] = Boolean(left[key]) || Boolean(right[key])
    }
    return merged
}

const sortRecord = <T>(record: Record<string, T>): Record<string, T> => {
    const sorted: Record<string, T> = {}
    for (const key of Object.keys(record).sort()) sorted[key] = record[key]
    return sorted
}

// Порядок ключей фиксирован литералом, вложенные записи предварительно
// отсортированы — сравнение отпечатков не зависит от порядка вставки.
const serverFingerprint = (snapshot: QuestProgressSnapshot): string =>
    JSON.stringify({
        currentIndex: snapshot.currentIndex,
        unlockedIndex: snapshot.unlockedIndex,
        answers: sortRecord(snapshot.answers),
        attempts: sortRecord(snapshot.attempts),
        hints: sortRecord(snapshot.hints),
        showMap: snapshot.showMap,
        completed: snapshot.completed,
        skipped: sortRecord(snapshot.skipped),
        earlyFinish: snapshot.earlyFinish,
    })

// `skipped`/`earlyFinish` ушли в отпечаток сервера (#1632) и здесь больше не
// дублируются: локальный отпечаток добавляет к серверному только то, чего на
// сервере нет, — поштучные времена ответов.
const localFingerprint = (snapshot: QuestProgressSnapshot): string =>
    [
        serverFingerprint(snapshot),
        JSON.stringify(sortRecord(snapshot.answeredAt)),
    ].join('|')

/**
 * Слияние локального и серверного прогресса без потери ответов.
 *
 * Оба аргумента — снапшоты одного квеста. `localChanged` говорит, что слитое
 * надо применить на устройстве, `serverNeedsPush` — что его надо отправить
 * PATCH-ем (если оба false, стороны уже согласованы и делать нечего).
 */
export function mergeQuestProgress(
    localRaw: Partial<QuestProgressSnapshot> | null | undefined,
    serverRaw: Partial<QuestProgressSnapshot> | null | undefined,
): QuestProgressMergeResult {
    const local = normalizeQuestProgressSnapshot(localRaw)
    const server = normalizeQuestProgressSnapshot(serverRaw)

    const answers = mergeAnswers(local, server)
    const cursorSource = localOwnsCursor(local, server) ? local : server

    const merged: QuestProgressSnapshot = {
        currentIndex: cursorSource.currentIndex,
        unlockedIndex: Math.max(local.unlockedIndex, server.unlockedIndex),
        answers,
        attempts: mergeNumberRecords(local.attempts, server.attempts),
        hints: mergeBooleanRecords(local.hints, server.hints),
        showMap: cursorSource.showMap,
        completed: local.completed || server.completed,
        skipped: mergeBooleanRecords(local.skipped, server.skipped),
        earlyFinish: local.earlyFinish || server.earlyFinish,
        updatedAt: Math.max(local.updatedAt, server.updatedAt),
        answeredAt: mergeAnsweredAt(local, server, answers),
    }

    return {
        merged,
        localChanged: localFingerprint(merged) !== localFingerprint(local),
        serverNeedsPush: serverFingerprint(merged) !== serverFingerprint(server),
    }
}
