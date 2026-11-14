/**
 * POST /ai/feedback (#3296): оценка ответа ассистента посетителем — «Помогло» или «Не помогло» с
 * необязательной причиной. До неё полезность ответа мерил только судья на вопросах, которые придумали мы
 * сами; журнал не знал даже о том, что вопрос был задан, если на него ответили.
 *
 * Тело `{turn_id, vote: 'up'|'down', reason?: 'place'|'facts'|'no_answer'}`. Ответы:
 *   204 — голос принят (повтор того же голоса — тоже 204, в журнал второй раз не пишется);
 *   400 bad_request — кривое тело; 404 not_found — ход неизвестен (чужой IP, ход старше суток, служба
 *   перезапускалась); 429 limit — голосов с IP больше, чем вопросов за день.
 *
 * Один голос на ход. После «Не помогло» посетитель может один раз уточнить причину — это тот же голос с
 * причиной, а не второй. Ходы живут в памяти процесса (`TurnRegistry`): идентификатор выдаётся в событии
 * `done` потока `/ai/ask`, IP хода в журнал не пишется и нужен только здесь — чужой ход оценить нельзя.
 */
import { randomUUID } from 'node:crypto'
import type http from 'node:http'

import { clientIp } from './ask.ts'
import { type DemandLog, FEEDBACK_REASONS, FEEDBACK_VOTES, type FeedbackReason, type FeedbackVote } from './demandLog.ts'
import type { AskLimits } from './limits.ts'
import { HttpError } from './params.ts'

/** Сколько ходов помнит служба и как долго: голос за ответ ставят сразу, а не через день. */
export const TURN_REGISTRY_CAPACITY = 5000
export const TURN_TTL_MS = 24 * 60 * 60 * 1000
const TURN_ID_RE = /^[0-9a-f-]{36}$/i

type TurnState = { ip: string; at: number; vote: FeedbackVote | null; reason: FeedbackReason | null }

export type VoteVerdict = 'recorded' | 'repeated' | 'unknown'

/** Ходы, которые можно оценить: идентификатор → чей ход и какой голос уже отдан. Только в памяти. */
export class TurnRegistry {
  private readonly turns = new Map<string, TurnState>()
  private readonly capacity: number
  private readonly ttlMs: number

  // Поля объявлены явно: служба грузится через `node --experimental-strip-types`, а свойства-параметры
  // конструктора в этом режиме не поддерживаются.
  constructor(options: { capacity?: number; ttlMs?: number } = {}) {
    this.capacity = options.capacity ?? TURN_REGISTRY_CAPACITY
    this.ttlMs = options.ttlMs ?? TURN_TTL_MS
  }

  /** Новый ход: случайный идентификатор, с посетителем не связан. */
  open(ip: string, now: Date): string {
    const id = randomUUID()
    this.turns.set(id, { ip, at: now.getTime(), vote: null, reason: null })
    // Map хранит порядок вставки: лишнее снимается с начала — самые старые ходы.
    while (this.turns.size > this.capacity) this.turns.delete(this.turns.keys().next().value as string)
    return id
  }

  /**
   * Голос за ход. `recorded` — голос или уточнение причины принято; `repeated` — на ход уже проголосовали
   * (второй голос не меняет первый); `unknown` — такого хода у этого IP нет либо он устарел.
   */
  vote(id: string, ip: string, vote: FeedbackVote, reason: FeedbackReason | null, now: Date): VoteVerdict {
    const turn = this.turns.get(id)
    if (!turn || turn.ip !== ip) return 'unknown'
    if (now.getTime() - turn.at > this.ttlMs) {
      this.turns.delete(id)
      return 'unknown'
    }
    if (turn.vote === null) {
      turn.vote = vote
      turn.reason = vote === 'down' ? reason : null
      return 'recorded'
    }
    // Уточнение причины после «Не помогло» — один раз.
    if (turn.vote === 'down' && vote === 'down' && turn.reason === null && reason !== null) {
      turn.reason = reason
      return 'recorded'
    }
    return 'repeated'
  }

  get size(): number {
    return this.turns.size
  }
}

export interface FeedbackDeps {
  turns: TurnRegistry
  demandLog: DemandLog
  /** Счётчик голосов на IP — то же хранилище и те же сутки, что у вопросов; свой префикс ключей. */
  limits: AskLimits
  trustProxy: boolean
  now?: () => Date
}

export const FEEDBACK_LIMITS_PREFIX = 'ai-feedback'
/** Голос и уточнение причины — два запроса на вопрос. */
export const FEEDBACK_REQUESTS_PER_QUESTION = 2

export type FeedbackHandler = (request: http.IncomingMessage, body: unknown) => Promise<void>

export function createFeedbackHandler(deps: FeedbackDeps): FeedbackHandler {
  const nowFn = deps.now ?? (() => new Date())
  return async (request, body) => {
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const turnId = input.turn_id
    const vote = input.vote
    const reason = input.reason
    if (typeof turnId !== 'string' || !TURN_ID_RE.test(turnId)) throw new HttpError(400, 'bad_request', 'turn_id: идентификатор хода из события done')
    if (!FEEDBACK_VOTES.includes(vote as FeedbackVote)) throw new HttpError(400, 'bad_request', `vote: одно из ${FEEDBACK_VOTES.join(', ')}`)
    if (reason !== undefined && reason !== null && !FEEDBACK_REASONS.includes(reason as FeedbackReason)) {
      throw new HttpError(400, 'bad_request', `reason: одно из ${FEEDBACK_REASONS.join(', ')}`)
    }
    if (vote === 'up' && reason) throw new HttpError(400, 'bad_request', 'reason: причина есть только у vote=down')

    const now = nowFn()
    const ip = clientIp(request, deps.trustProxy)
    const quota = await deps.limits.consumeQuestion(ip, now)
    if (quota.exceeded) {
      await deps.limits.refundQuestion(ip, now)
      throw new HttpError(429, 'limit', {
        detail: 'слишком много оценок за день',
        retryAfterSec: deps.limits.retryAfterSeconds(now),
        extra: { retry_after_sec: deps.limits.retryAfterSeconds(now) },
      })
    }
    const verdict = deps.turns.vote(turnId, ip, vote as FeedbackVote, (reason ?? null) as FeedbackReason | null, now)
    if (verdict === 'unknown') throw new HttpError(404, 'not_found', 'ход неизвестен или устарел')
    if (verdict === 'recorded') {
      await deps.demandLog.appendVote({ turn: turnId, vote: vote as FeedbackVote, ...(vote === 'down' && reason ? { reason: reason as FeedbackReason } : {}) })
    }
  }
}
