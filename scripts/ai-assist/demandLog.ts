/**
 * Серверный журнал спроса `logs/ai-demand.jsonl` (#2460, #2713): вопросы без
 * материалов, вопросы при недоступной модели и третий за день вопрос не по теме
 * (`offtopic_blocked`), закрывший ассистент для IP до полуночи. Форма строки — та
 * же, что у клиентского `api/aiAssist/demandLog.ts` (`{ts, q, locale, reason}`),
 * чтобы один отчёт читал оба журнала. IP в журнал не пишется.
 *
 * Журнал — вспомогательный: недоступная директория логируется, ответ не ломает.
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export const DEFAULT_DEMAND_LOG_PATH = 'logs/ai-demand.jsonl'
const DEMAND_QUESTION_MAX_LENGTH = 500

export type DemandReason = 'no_sources' | 'generator_unavailable' | 'offtopic_blocked'

export interface DemandEntry {
  ts: string
  q: string
  locale: string
  reason: DemandReason
}

export interface DemandLog {
  readonly path: string
  append(entry: Omit<DemandEntry, 'ts'>): Promise<void>
}

export interface DemandLogOptions {
  path?: string
  log?: (line: string) => void
  now?: () => Date
}

export function createDemandLog(options: DemandLogOptions = {}): DemandLog {
  const path = options.path ?? DEFAULT_DEMAND_LOG_PATH
  const log = options.log ?? (() => {})
  const now = options.now ?? (() => new Date())
  let directoryReady: Promise<void> | null = null
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
  return {
    path,
    async append(entry) {
      const record: DemandEntry = {
        ts: now().toISOString(),
        q: String(entry.q ?? '').replace(/\s+/g, ' ').trim().slice(0, DEMAND_QUESTION_MAX_LENGTH),
        locale: String(entry.locale ?? ''),
        reason: entry.reason,
      }
      if (!record.q) return
      try {
        await ensureDirectory()
        await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
      } catch (error) {
        log(`журнал спроса ${path}: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  }
}
