/**
 * Серверный журнал спроса `logs/ai-demand.jsonl` (#2460, #2713, #3296).
 *
 * До #3296 журнал получал три строки: вопрос без материалов (`no_sources`), вопрос при недоступной
 * модели (`generator_unavailable`) и третий за день вопрос не по теме (`offtopic_blocked`). Успешный
 * ход не писался вовсе: из 20 ответов пробы 11.11.2026 неверны или бесполезны были 7, и в журнал не
 * попал бы ни один. Теперь в нём три вида записей — отчёт `npm run ai:demand:report` читает все:
 *
 *   - **спрос** `{ts, q, locale, reason}` — прежняя форма и прежние три причины;
 *   - **ход** `{ts, turn, locale, q, status, source_ids, answer_chars, guard}` — на каждый ход, который
 *     дошёл до ответа модели или справки: `status` — `done`, `partial_no_material` (в ответе есть
 *     признание «отдельного материала нет»), `fallback` (страж заменил ответ запасной фразой), `help`
 *     (ответила справка); `source_ids` — карточки подсказки (`quest:13`); `guard` — что вырезал страж
 *     (счётчики больше нуля). Ход без ответа — пустой подбор, пустая подсказка, недоступная модель —
 *     по-прежнему пишется записью спроса, а не хода: строка на ход одна. Ход с блоком «Ещё в мире»
 *     (#3357) несёт ещё `world_ids` — показанные маршруты мира идентификаторами Wikidata;
 *   - **голос** `{ts, turn, vote, reason?}` — оценка хода посетителем (`POST /ai/feedback`): `up` или
 *     `down`, причина — `place`, `facts`, `no_answer`. С ходом голос связывает `turn`;
 *   - **план** `{ts, plan, locale, q, days_requested, day_ids}` — план по дням (`POST /ai/plan`, #3298):
 *     `plan` — кто собрал (`model` или `code`), `day_ids` — материалы по дням ключами индекса. Отдельный вид
 *     записи: прежние виды и отчёт по ним не меняются.
 *
 * Чего в журнале нет: IP, идентификатора пользователя, текста ответа и истории диалога. `turn` — случайный
 * идентификатор хода, с посетителем он не связан. Вопрос обрезается до 300 знаков. Записи старше
 * `DEMAND_RETENTION_DAYS` удаляются при старте службы и раз в сутки (`prune`).
 *
 * Журнал — вспомогательный: недоступная директория логируется, ответ не ломает.
 */
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const DEFAULT_DEMAND_LOG_PATH = 'logs/ai-demand.jsonl'
/** Вопрос в журнале — не длиннее этого (#3296): хватает, чтобы понять тему, и не хранит длинный личный текст. */
export const DEMAND_QUESTION_MAX_LENGTH = 300
/** Срок хранения записи, дни (#3296). */
export const DEMAND_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export type DemandReason = 'no_sources' | 'generator_unavailable' | 'offtopic_blocked'

export interface DemandEntry {
  ts: string
  q: string
  locale: string
  reason: DemandReason
}

export type TurnStatus = 'done' | 'partial_no_material' | 'fallback' | 'help'

/** Что вырезал страж: только счётчики больше нуля. */
export type TurnGuard = Partial<Record<'removed_links' | 'relabeled' | 'dropped_descriptions' | 'ungrounded_numbers' | 'prompt_leaks' | 'counter_questions' | 'stray_admissions', number>>

export interface TurnEntry {
  ts: string
  turn: string
  locale: string
  q: string
  status: TurnStatus
  /** Карточки подсказки ключами индекса: `quest:13`, `travel:816`, `help:1`. */
  source_ids: string[]
  answer_chars: number
  guard: TurnGuard
  /**
   * Маршруты мира, показанные блоком «Ещё в мире» (#3357), идентификаторами Wikidata: `Q24777`. Отдельно от
   * `source_ids`: это не карточки подсказки. Поля нет, когда блока не было, — прежние записи не меняются.
   */
  world_ids?: string[]
}

export type FeedbackVote = 'up' | 'down'
export type FeedbackReason = 'place' | 'facts' | 'no_answer'
export const FEEDBACK_VOTES: readonly FeedbackVote[] = ['up', 'down']
export const FEEDBACK_REASONS: readonly FeedbackReason[] = ['place', 'facts', 'no_answer']

export interface VoteEntry {
  ts: string
  turn: string
  vote: FeedbackVote
  reason?: FeedbackReason
}

/** План по дням (#3298): кто собрал и какие материалы встали в какой день. */
export interface PlanEntry {
  ts: string
  plan: 'model' | 'code'
  locale: string
  q: string
  days_requested: number
  /** Материалы по дням ключами индекса: `[['quest:13', 'travel:816'], ['travel:297']]`. */
  day_ids: string[][]
}

export type DemandRecord = DemandEntry | TurnEntry | VoteEntry | PlanEntry

export interface DemandLog {
  readonly path: string
  append(entry: Omit<DemandEntry, 'ts'>): Promise<void>
  /** Запись хода, дошедшего до ответа (#3296). */
  appendTurn(entry: Omit<TurnEntry, 'ts'>): Promise<void>
  /** Запись голоса посетителя (#3296). */
  appendVote(entry: Omit<VoteEntry, 'ts'>): Promise<void>
  /** Запись плана по дням (#3298). */
  appendPlan(entry: Omit<PlanEntry, 'ts'>): Promise<void>
  /** Удалить записи старше срока хранения; возвращает, сколько удалено. Не чаще раза в сутки, если не `force`. */
  prune(force?: boolean): Promise<number>
}

export interface DemandLogOptions {
  path?: string
  log?: (line: string) => void
  now?: () => Date
  retentionDays?: number
}

const cleanQuestion = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, DEMAND_QUESTION_MAX_LENGTH)

/** Запись старше срока; строку без даты и не-JSON срок не трогает — её читает человек. */
export const isExpired = (line: string, now: Date, retentionDays: number): boolean => {
  try {
    const ts = Date.parse(String((JSON.parse(line) as { ts?: unknown }).ts ?? ''))
    return Number.isFinite(ts) && now.getTime() - ts > retentionDays * DAY_MS
  } catch {
    return false
  }
}

export function createDemandLog(options: DemandLogOptions = {}): DemandLog {
  const path = options.path ?? DEFAULT_DEMAND_LOG_PATH
  const log = options.log ?? (() => {})
  const now = options.now ?? (() => new Date())
  const retentionDays = options.retentionDays ?? DEMAND_RETENTION_DAYS
  let directoryReady: Promise<void> | null = null
  let prunedAt = 0
  // Запись и чистка идут по очереди: чистка переписывает файл целиком и не должна потерять строку,
  // дописанную в этот момент.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task)
    queue = next.catch(() => undefined)
    return next
  }
  const ensureDirectory = () => {
    if (!directoryReady) {
      directoryReady = mkdir(dirname(path), { recursive: true }).then(
        () => undefined,
        (error) => {
          directoryReady = null
          throw error
        },
      )
    }
    return directoryReady
  }
  const write = (record: DemandRecord): Promise<void> =>
    serial(async () => {
      try {
        await ensureDirectory()
        await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
      } catch (error) {
        log(`журнал спроса ${path}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  return {
    path,
    async append(entry) {
      const record: DemandEntry = { ts: now().toISOString(), q: cleanQuestion(entry.q), locale: String(entry.locale ?? ''), reason: entry.reason }
      if (!record.q) return
      await write(record)
    },
    async appendTurn(entry) {
      const q = cleanQuestion(entry.q)
      if (!q || !entry.turn) return
      const guard = Object.fromEntries(Object.entries(entry.guard ?? {}).filter(([, count]) => typeof count === 'number' && count > 0)) as TurnGuard
      await write({
        ts: now().toISOString(),
        turn: entry.turn,
        locale: String(entry.locale ?? ''),
        q,
        status: entry.status,
        source_ids: [...entry.source_ids],
        answer_chars: Math.max(0, Math.round(entry.answer_chars)),
        guard,
        ...(entry.world_ids?.length ? { world_ids: [...entry.world_ids] } : {}),
      })
    },
    async appendVote(entry) {
      if (!entry.turn) return
      await write({ ts: now().toISOString(), turn: entry.turn, vote: entry.vote, ...(entry.reason ? { reason: entry.reason } : {}) })
    },
    async appendPlan(entry) {
      const q = cleanQuestion(entry.q)
      if (!q) return
      await write({
        ts: now().toISOString(),
        plan: entry.plan,
        locale: String(entry.locale ?? ''),
        q,
        days_requested: Math.max(1, Math.round(entry.days_requested)),
        day_ids: entry.day_ids.map((day) => [...day]),
      })
    },
    prune(force = false) {
      const at = now()
      if (!force && at.getTime() - prunedAt < DAY_MS) return Promise.resolve(0)
      prunedAt = at.getTime()
      return serial(async () => {
        let text: string
        try {
          text = await readFile(path, 'utf8')
        } catch {
          // Журнала ещё нет — чистить нечего.
          return 0
        }
        const lines = text.split('\n').filter((line) => line.trim())
        const kept = lines.filter((line) => !isExpired(line, at, retentionDays))
        const removed = lines.length - kept.length
        if (!removed) return 0
        try {
          // Запись во временный файл и rename: обрыв посреди чистки не оставляет журнал наполовину записанным.
          const temp = `${path}.prune`
          await writeFile(temp, kept.length ? `${kept.join('\n')}\n` : '', 'utf8')
          await rename(temp, path)
          log(`журнал спроса ${path}: удалено записей старше ${retentionDays} дней — ${removed}`)
          return removed
        } catch (error) {
          log(`журнал спроса ${path}: чистка не удалась: ${error instanceof Error ? error.message : String(error)}`)
          return 0
        }
      })
    },
  }
}
