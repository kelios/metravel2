/**
 * POST /ai/ask (#2713; серверная часть ассистента #2460): вопрос посетителя →
 * фильтр тем → лимиты на IP → подбор по индексу → промпт → metravel-llm → страж
 * ссылок, ответ одним SSE-потоком `sources → text* → done`. Правила фильтра,
 * опора уточнений, промпт, страж и клиент модели — те же модули, что у экрана `/assistant`
 * (`api/aiAssist/*`): сервер и клиент не расходятся, а блок «третий вопрос не по
 * теме — до полуночи» держится на сервере, что бы ни делал клиент.
 *
 * Отказы ДО потока — JSON `{error, detail, …}`:
 *   400 bad_request · 429 offtopic_blocked и 429 limit (`Retry-After` — до полуночи
 *   Europe/Minsk, `retry_after_sec`) · 429 busy (очередь к модели) ·
 *   503 generator_unavailable (модель не ответила до первого токена) · 503 busy
 *   (очередь к эмбеддингу подбора).
 * Отказы В потоке — событие `done` со `status`:
 *   off_topic (`reason: offtopic_warning`, `strikes`, `strikes_to_block` — 1-й и 2-й
 *   вопрос не по теме; `reason: model_refusal` — отказ самой модели, в счётчик не
 *   идёт) · no_sources · unavailable (модель оборвалась посреди ответа) · error.
 * Событие `text` несёт накопленный текст после стража (`{text}`), не дельту:
 * страж может убрать уже показанный чужой адрес.
 *
 * Страж содержания (#3291, `api/aiAssist/answerGuard.ts`) работает по готовому ответу: подпись ссылки
 * приводится к названию карточки уже в стриме, а пояснение пункта от чужой карточки и фраза с числом
 * без опоры убираются в последнем `text`. Событие `done` получает необязательные счётчики
 * `relabeled`, `dropped_descriptions`, `ungrounded_numbers`, `prompt_leaks` (вырезано эхо разметки подсказки) и флаг `fallback: true` — ответ пустой
 * (повтор вопроса, фраза без ссылки и признания): последний `text` пуст, экран показывает запасную
 * фразу и источники. Старый клиент новые поля не читает.
 *
 * Контекстный вход (#2897): необязательное `source {type: travel|quest, id}` — страница,
 * с которой открыт ассистент; на каждом ходу вопрос сначала читается как вопрос об этой
 * странице (режим страницы, ниже). Кривой `source` — 400 bad_request; материала нет в индексе
 * (опубликован после сборки) — ход идёт как обычный вопрос.
 *
 * Режим страницы (#3290): вопрос со страницы отвечается по её тексту. Карточка страницы несёт строку
 * фактов и лучшие под вопрос фрагменты (группа `page`) и одна идёт в подсказку; найденное общим
 * подбором уходит в событие `sources` группой `nearby` — экран показывает её как «Ещё по теме».
 * Ссылки ответа — только на страницу. Вопрос с местом, которого на странице нет, идёт общим подбором,
 * как обычный вопрос; карточка страницы остаётся в событии `sources` последней, группой `nearby`, и в
 * подсказку не попадает (первой карточкой модель называла её ответом на вопрос о другом месте).
 *
 * Условия вопроса (#3289): подбор отдаёт карточки расставленными цепочкой «место → условия →
 * превосходная степень» (`api/aiAssist/sourceSelection.ts`). Карточки, прошедшие отбор, уходят в
 * событие `sources` с `group: 'match'`, остальные — с `group: 'nearby'` и в подсказку не идут; если
 * отделять нечего, поля нет. Строка «Почему подходит» карточки подсказки и строка «материала о месте
 * нет» выключаются переменными окружения (`promptHints`).
 *
 * Контур оценки (#3286): при `AI_ASSIST_EVAL_TRACE=1` поток несёт перед `done` событие
 * `trace {prompt_sources, raw_text}` — карточки, ушедшие в подсказку модели, и её ответ до
 * стража ссылок. Клиент экрана чужие события пропускает; в образе прода переменной нет.
 *
 * Пустая подсказка (#3345): подбор нашёл карточки, но ни одна не прошла отбор по месту и условиям
 * вопроса. Модель не вызывается: поток `sources → text('') → done {status: done, fallback: true,
 * reason: no_material}`; вопрос пишется в журнал спроса (`no_sources`), дневной лимит списан. Причина
 * `no_material` отличает этот ход от запасного ответа стража (там модель ответила, страж ответ
 * отбраковал): экран показывает «на сайте пока нет материалов по этому вопросу» и найденное рядом.
 * Клиент, который причины не знает, видит прежний `fallback` и показывает запасную фразу стража.
 * Событие `trace` несёт пустые `prompt_sources` и `model_called: false`.
 *
 * Оценка ответа (#3296): ход, дошедший до ответа модели или справки, получает в событии `done` поле
 * `turn_id` — по нему экран шлёт голос в `POST /ai/feedback` — и строку в журнале спроса: язык, вопрос
 * (до 300 знаков), статус (`done`, `partial_no_material`, `fallback`, `help`), карточки подсказки, длина
 * ответа и счётчики стража. IP и текста ответа в журнале нет. Старый клиент поле не читает.
 *
 * Справка о сайте (#3293): вопрос о самом MeTravel («сколько стоит квест», «нужен ли интернет», «как
 * добавить статью») подбор отдаёт записями справки — карточками вида `help`, без статей и квестов.
 * По умолчанию ответ — текст первой записи дословно и ссылка на её страницу, модель не вызывается:
 * `sources → text → done {status: done}`; `trace` несёт карточку записи, `model_called: false` и
 * `help: true`. `AI_ASSIST_HELP_MODE=model` отдаёт запись модели карточкой подсказки с правилом справки
 * (`HELP_MODE_RULE_RU`) — для сравнения на стенде.
 *
 * Маршруты мира (#3357): на вопрос о пешем маршруте подбор отдаёт вторым ярусом до трёх карточек внешнего
 * индекса (`world`). Они уходят в то же событие `sources` после карточек сайта — вида `trail`, с
 * `group: 'world'` — и в подсказку модели не идут: блок «Ещё в мире» экран рисует по фактам карточки.
 * Сборка приложения, не знающая этого вида, такие карточки отбрасывает. Нет материалов сайта — ход
 * закрывается прежним статусом (`no_sources` либо `fallback` с `no_material`), а внешние карточки остаются в
 * `sources`. Внешний адрес в тексте модели остаётся только при совпадении с адресом внешней карточки этого
 * ответа; вырезанные внешние адреса считает `removed_world_links` события `done` (только ненулевой).
 * Событие `trace` контура оценки несёт `world` — карточки со строкой фактов; журнал хода — `world_ids`.
 *
 * Личный контекст (#3354): вошедший посетитель получает ответ с учётом своих статей, отметок, избранного и
 * поездок. Кто спрашивает, служба узнаёт только у API сайта по токену самого посетителя (`visitorProfile.ts`);
 * в теле запроса полей личности нет, и добавленные туда не читаются. Сводка идёт в подсказку строкой «О
 * посетителе» (не в режиме страницы и не в справке), вопрос о своём («из сохранённого», «мои планы») делает
 * сохранённые и запланированные материалы карточками, на «куда поехать» посещённое и свои статьи понижаются.
 * Посетителю уходит только признак: необязательное `profile: true` в событии `done` — служба учла сводку в
 * этом ходе; экран по нему показывает строку «Ассистент учитывает ваши статьи и сохранённое». Событие
 * `trace` контура оценки несёт `profile: true|false`. Ни токена, ни сводки нет в событиях потока, журнале
 * спроса и журнале службы. Сводку не собрать (нет токена, 401, ошибка, таймаут) — ход идёт как у гостя.
 * Лимиты по-прежнему считаются на IP. `AI_ASSIST_PROMPT_PROFILE=0` выключает всё перечисленное.
 */
import type http from 'node:http'

import { type Generator, isAiGeneratorError } from '../../api/aiAssist/generator.ts'
import { guardAnswer } from '../../api/aiAssist/answerGuard.ts'
import { questionLanguage } from '../../api/aiAssist/language.ts'
import { admitsNoMaterial } from '../../api/aiAssist/noMaterial.ts'
import { countKeptSourceLinks, guardStreamingText } from '../../api/aiAssist/linkGuard.ts'
import { AI_MAX_RECOMMENDATIONS, ASK_NO_MATERIAL_REASON } from '../../api/aiAssist/policy.ts'
import { buildAssistantMessages, MAX_HISTORY_ITEMS, type PromptHints, selectPromptSources, visitorBlockFor } from '../../api/aiAssist/prompt.ts'
import { withoutPlace } from '../../api/aiAssist/promptPlace.ts'
import { buildRetrievalQuery, resolveRetrievalAnchor } from '../../api/aiAssist/retrievalQuery.ts'
import { type AiSourceRef, leftPageSources, pageSources, parseSourceRef } from '../../api/aiAssist/sourceRef.ts'
import { classifyQuestion, judgeModelReply } from '../../api/aiAssist/topicGate.ts'
import { type AiWorldTrail, trailFactsLine } from '../../api/aiAssist/trailFacts.ts'
import type { AiHistoryItem, AiSource } from '../../api/aiAssist/types.ts'
import { type VisitorContext, visitorTitlesOutside } from '../../api/aiAssist/visitorContext.ts'
import type { DemandLog, TurnGuard, TurnStatus } from './demandLog.ts'
import type { TurnRegistry } from './feedback.ts'
import { helpPageTitle } from './helpPages.ts'
import type { AskLimits } from './limits.ts'
import { HttpError, parseLocale, parseQuery } from './params.ts'
import { BusyError, type SingleFlight } from './queue.ts'
import type { Locale } from './search.ts'

/** Период склейки фрагментов стрима в одно событие `text` — как на экране. */
export const STREAM_FLUSH_MS = 40
/** `Retry-After` для занятой или недоступной модели, с. */
export const GENERATOR_RETRY_AFTER_SEC = 30
const MAX_HISTORY_TEXT_LENGTH = 1200

export interface RetrievalResult {
  sources: AiSource[]
  /** Лексика бэкенда не ответила: подбор только векторный. */
  degraded: boolean
  /**
   * Карточка страницы-источника с фрагментами под вопрос (#3290) — ход идёт в режиме страницы. Нет:
   * страницы нет в индексе либо вопрос уводит с неё — общий подбор со страницей первой карточкой.
   */
  page?: AiSource | null
  /** Вопрос называет место, которого нет ни в одном найденном источнике (#3289). */
  noPlace?: boolean
  /** Вопрос о самом сайте (#3293): `sources` — записи справки, первая — ответ; материалов среди них нет. */
  help?: boolean
  /**
   * Маршруты мира (#3357) — второй ярус: до трёх карточек внешнего индекса на вопрос о пешем маршруте.
   * В подсказку модели не идут; в событии `sources` стоят после карточек сайта.
   */
  world?: AiWorldTrail[]
}

export interface RetrieveOptions {
  /**
   * Язык справочного ответа (#3369) — язык самого вопроса: запись справки отдаётся дословно, без модели, и
   * перевести её некому. Не задан — язык запроса `locale`.
   */
  helpLocale?: Locale
  /**
   * Сводка вошедшего посетителя (#3354): вопрос о своём берёт карточками его сохранённые и запланированные
   * материалы, на «куда поехать» посещённое и свои статьи понижаются. Нет — подбор как у гостя.
   */
  visitor?: VisitorContext | null
}

/** Режим контура оценки (#3286); адрес модели показывает `/ai/health` — приёмка сверяет, на какую модель смотрит служба. */
export interface EvalTrace {
  llmUrl: string | null
}

export interface AskDeps {
  /**
   * Подбор карточек по индексу; бросает `HttpError` (503 busy) при занятой модели эмбеддинга. С `page`
   * (#3290) тем же вектором запроса ищет ещё и внутри фрагментов этой страницы. Карточки приходят
   * расставленными под вопрос (#3289): порядок и группы `match` / `nearby` обработчик не меняет.
   */
  retrieve: (q: string, locale: Locale, page?: AiSourceRef | null, options?: RetrieveOptions) => Promise<RetrievalResult>
  /** Карточка страницы-источника (#2897) из индекса; `null` — такого материала в индексе нет. */
  lookupSource: (ref: AiSourceRef, locale: Locale) => AiSource | null
  /** `null` — `AI_LLM_URL` не задан: вопросы по теме получают 503 generator_unavailable. */
  generator: Generator | null
  /** Один ответ модели одновременно; ожидание дольше `queueTimeoutMs` → 429 busy. */
  llmQueue: SingleFlight
  queueTimeoutMs: number
  limits: AskLimits
  demandLog: DemandLog
  /** Брать IP из `X-Real-IP`/`X-Forwarded-For` (сервис за nginx), см. `clientIp`. */
  trustProxy: boolean
  /** `AI_ASSIST_EVAL_TRACE=1`: событие `trace` перед `done`. Без него события нет — так живёт прод. */
  evalTrace?: EvalTrace | null
  /** Новые строки подсказки (#3289); не задано — обе включены. */
  promptHints?: PromptHints
  /** Справка о сайте (#3293): `direct` (по умолчанию) — запись и ссылка без модели; `model` — через модель. */
  helpMode?: 'direct' | 'model'
  /** Адрес опубликованного файла слоя OpenStreetMap (ODbL) внешнего индекса (#3357); уходит в `sources` вместе с маршрутами мира. */
  worldLayerUrl?: string | null
  /**
   * Ходы, которые можно оценить (#3296): ход, дошедший до ответа, получает идентификатор в событии `done`
   * (`turn_id`) и строку в журнале. Не задано — идентификатора и строки хода нет (стенды без оценки).
   */
  turns?: TurnRegistry
  /**
   * Личный контекст (#3354): сводка посетителя этого запроса по его токену либо `null` — гость. Личность
   * определяется только здесь, по заголовкам запроса; тело запроса её не несёт. Не задано — служба личный
   * контекст не ведёт (`AI_ASSIST_PROMPT_PROFILE=0`, стенды и тесты без него).
   */
  visitor?: (request: Pick<http.IncomingMessage, 'headers'>) => Promise<VisitorContext | null>
  log: (line: string) => void
  now?: () => Date
}

/**
 * Текст ответа справки (#3293): записи дословно и ссылка на страницу сайта, к которой запись относится.
 * Две записи об одной странице дают одну ссылку — после второй. Подпись ссылки — название страницы из
 * навигации сайта на языке ответа (#3369, `helpPages.ts`); у страницы без названия — её адрес без протокола.
 */
export const helpAnswerText = (cards: ReadonlyArray<Pick<AiSource, 'snippet' | 'url'>>, locale: Locale): string =>
  cards
    .map((card, index) => {
      const last = !cards.slice(index + 1).some((next) => next.url === card.url)
      return `${card.snippet.trim()}${last ? `\n\n[${helpPageTitle(card.url, locale) ?? card.url.replace(/^https?:\/\//, '')}](${card.url})` : ''}`
    })
    .join('\n\n')

export type AskHandler = (request: http.IncomingMessage, response: http.ServerResponse, body: unknown) => Promise<void>

/**
 * IP посетителя: `X-Real-IP`, затем последний адрес `X-Forwarded-For`, иначе сокет.
 * nginx ставит `X-Real-IP $remote_addr` и дописывает адрес в конец `X-Forwarded-For`
 * (`$proxy_add_x_forwarded_for`); начало `X-Forwarded-For` присылает сам посетитель,
 * и по нему лимит и блок обходились бы сменой заголовка.
 */
export function clientIp(request: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const real = request.headers['x-real-ip']
    const realIp = (Array.isArray(real) ? real[0] : real)?.trim()
    if (realIp) return realIp
    const forwarded = request.headers['x-forwarded-for']
    const last = (Array.isArray(forwarded) ? forwarded.at(-1) : forwarded)?.split(',').at(-1)?.trim()
    if (last) return last
  }
  return request.socket?.remoteAddress || 'unknown'
}

function parseHistory(value: unknown): AiHistoryItem[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'bad_request', 'history: ожидался массив {role, text}')
  if (value.length > MAX_HISTORY_ITEMS) throw new HttpError(400, 'bad_request', `history: не длиннее ${MAX_HISTORY_ITEMS} сообщений`)
  return value.map((item) => {
    const role = (item as { role?: unknown })?.role
    const text = (item as { text?: unknown })?.text
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string') {
      throw new HttpError(400, 'bad_request', 'history: элемент — {role: user|assistant, text: string}')
    }
    if (text.length > MAX_HISTORY_TEXT_LENGTH) throw new HttpError(400, 'bad_request', `history: текст не длиннее ${MAX_HISTORY_TEXT_LENGTH} символов`)
    return { role, text }
  })
}

/** `source` тела: нет — `undefined`; не `{type: travel|quest, id: положительное целое}` — 400. */
function parseSource(value: unknown): AiSourceRef | undefined {
  if (value === undefined || value === null) return undefined
  // Только объект: строковую форму `travel:816` знает роут экрана, не тело запроса.
  const ref = typeof value === 'object' && !Array.isArray(value) ? parseSourceRef(value) : null
  if (!ref) throw new HttpError(400, 'bad_request', 'source: ожидалось {type: travel|quest, id: положительное целое}')
  return ref
}

interface Stream {
  event: (name: string, data: unknown) => void
  done: (data: Record<string, unknown>) => void
}

function openStream(response: http.ServerResponse): Stream {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    // nginx: SSE отдаётся по мере генерации, а не буфером в конце (#2457 ставит proxy_buffering off).
    'x-accel-buffering': 'no',
  })
  response.flushHeaders()
  const event = (name: string, data: unknown) => {
    if (response.writableEnded || response.destroyed) return
    response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  return {
    event,
    done(data) {
      event('done', data)
      response.end()
    },
  }
}

export function createAskHandler(deps: AskDeps): AskHandler {
  const { limits, demandLog, log } = deps
  const nowFn = deps.now ?? (() => new Date())

  const blockedError = (strikes: number, now: Date) =>
    new HttpError(429, 'offtopic_blocked', {
      detail: `вопросы не по теме: ${strikes} из ${limits.strikesToBlock} за день, ассистент закрыт до полуночи`,
      retryAfterSec: limits.retryAfterSeconds(now),
      extra: { retry_after_sec: limits.retryAfterSeconds(now), strikes, strikes_to_block: limits.strikesToBlock },
    })

  /**
   * Ход дошёл до ответа (#3296): идентификатор для оценки и строка журнала. Без реестра ходов — `{}`.
   * Журнал заодно чистится от записей старше срока хранения (не чаще раза в сутки).
   */
  const openTurn = async (
    ip: string,
    now: Date,
    entry: { q: string; locale: string; status: TurnStatus; sources: readonly AiSource[]; answerChars: number; guard?: TurnGuard; world?: readonly AiWorldTrail[] },
  ): Promise<{ turn_id?: string }> => {
    if (!deps.turns) return {}
    const turn = deps.turns.open(ip, now)
    await demandLog.appendTurn({
      turn,
      q: entry.q,
      locale: entry.locale,
      status: entry.status,
      source_ids: entry.sources.map((source) => `${source.type}:${source.source_id}`),
      answer_chars: entry.answerChars,
      guard: entry.guard ?? {},
      ...(entry.world?.length ? { world_ids: entry.world.map((trail) => trail.source_id) } : {}),
    })
    void demandLog.prune()
    return { turn_id: turn }
  }

  return async (request, response, body) => {
    const now = nowFn()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const question = parseQuery(input.q)
    const locale = parseLocale(input.locale)
    const history = parseHistory(input.history)
    const sourceRef = parseSource(input.source)
    const ip = clientIp(request, deps.trustProxy)

    // Блок держится на сервере: очистка хранилища клиента и прямой запрос его не снимают.
    const offTopic = await limits.offTopicState(ip, now)
    if (offTopic.blocked) throw blockedError(offTopic.strikes, now)

    // Чужая тема не тратит ни подбор, ни модель, ни дневной лимит; 3-я за день — журнал и блок.
    if (classifyQuestion(question).offTopic) {
      const next = await limits.registerOffTopicStrike(ip, now)
      if (next.blocked) {
        await demandLog.append({ q: question, locale, reason: 'offtopic_blocked' })
        throw blockedError(next.strikes, now)
      }
      const quota = await limits.quotaState(ip, now)
      const stream = openStream(response)
      stream.event('sources', { sources: [], degraded: false, remaining: quota.remaining })
      stream.done({ status: 'off_topic', reason: 'offtopic_warning', strikes: next.strikes, strikes_to_block: limits.strikesToBlock })
      return
    }

    const quota = await limits.consumeQuestion(ip, now)
    const refund = () => limits.refundQuestion(ip, now)
    if (quota.exceeded) {
      // Отклонённый вопрос не занимает место: иначе возврат параллельного вопроса после
      // такого отказа оставил бы счётчик на лимите, и посетитель потерял бы вопрос.
      await refund()
      throw new HttpError(429, 'limit', {
        detail: `дневной лимит ${limits.dailyLimit} вопросов исчерпан`,
        retryAfterSec: limits.retryAfterSeconds(now),
        extra: { retry_after_sec: limits.retryAfterSeconds(now), limit: limits.dailyLimit },
      })
    }

    // Личный контекст (#3354): только после фильтра тем и лимита — чужая тема и исчерпанный лимит к API сайта
    // не ходят. Сбой сводки — не сбой ответа: посетитель получает ход гостя.
    const visitor = deps.visitor ? await deps.visitor(request).catch(() => null) : null
    const profiled = visitor ? { profile: true } : {}
    const tracedProfile = deps.visitor ? { profile: visitor !== null } : {}
    // Карточка страницы-источника (#2897) — первой в контексте; до первого самостоятельного
    // вопроса её заголовок — опора уточнений («Что рядом?» ищется вместе с названием статьи).
    const pinned = sourceRef ? deps.lookupSource(sourceRef, locale) : null
    // Опора уточнений (#2719/#2884): «А какой подойдёт детям?» ищется вместе с последним
    // самостоятельным вопросом из истории; модель получает исходный вопрос и историю.
    const retrievalQuery = buildRetrievalQuery(question, resolveRetrievalAnchor(history) ?? pinned?.title ?? null)
    // Справка отвечает на языке вопроса (#3369): польский вопрос из русского интерфейса или без `locale`
    // получал русскую запись. Вопрос, который между языками не выбирает, читается на языке запроса.
    const helpLocale = questionLanguage(question, locale)
    let retrieved: RetrievalResult
    try {
      retrieved = await deps.retrieve(retrievalQuery, locale, pinned ? (sourceRef ?? null) : null, { helpLocale, ...(visitor ? { visitor } : {}) })
    } catch (error) {
      await refund()
      throw error
    }
    const { degraded } = retrieved
    // Режим страницы (#3290): страница — единственная карточка подсказки, остальное — «ещё по теме».
    const page = retrieved.page ?? null
    // Вопрос уводит со страницы («а что в Гданьске?»): обычный ход по общему подбору, карточка страницы —
    // в списке источников группой `nearby`, в подсказку не идёт.
    const left = pinned !== null && page === null
    const sources = page ? pageSources(page, retrieved.sources) : pinned ? leftPageSources(pinned, retrieved.sources) : retrieved.sources
    // Маршруты мира (#3357): второй ярус. В подсказку не идут; посетителю уходят в том же событии `sources`
    // после карточек сайта. Справка и режим страницы их не получают (подбор их не отдаёт).
    const world = retrieved.help === true || page ? [] : (retrieved.world ?? [])
    const listed = (): unknown[] => [...sources.map(withoutPlace), ...world]
    // Ссылка на файл слоя ODbL нужна только рядом с блоком «Ещё в мире».
    const layer = world.length && deps.worldLayerUrl ? { world_layer_url: deps.worldLayerUrl } : {}
    const tracedWorld = deps.evalTrace && world.length ? { world: world.map((trail) => ({ ...trail, facts: trailFactsLine(trail) })) } : {}
    if (!sources.length) {
      await demandLog.append({ q: question, locale, reason: 'no_sources' })
      const stream = openStream(response)
      // На сайте материала нет, а маршруты мира есть: статус прежний, блок «Ещё в мире» экран покажет под ним.
      stream.event('sources', { sources: listed(), degraded, remaining: quota.remaining, ...layer })
      if (deps.evalTrace && world.length) stream.event('trace', { prompt_sources: [], raw_text: '', model_called: false, ...tracedWorld, ...tracedProfile })
      stream.done({ status: 'no_sources', ...profiled })
      return
    }

    // Карточки подсказки — тем же отбором, что в сообщениях модели ниже.
    const promptSources = selectPromptSources(sources, undefined, null, true)
    // Справка о сайте (#3293): ответ — утверждённый текст записи и ссылка на её страницу, без модели. Текст
    // читает посетитель и утверждает владелец; модель его пересказывала с искажениями (замер 12.11.2026).
    if (retrieved.help === true && deps.helpMode !== 'model' && promptSources.length) {
      const stream = openStream(response)
      stream.event('sources', { sources: listed(), degraded, remaining: quota.remaining, ...layer })
      if (deps.evalTrace) stream.event('trace', { prompt_sources: promptSources.map(withoutPlace), raw_text: '', model_called: false, help: true, ...tracedProfile })
      const helpText = helpAnswerText(promptSources, helpLocale)
      stream.event('text', { text: helpText })
      const turn = await openTurn(ip, now, { q: question, locale: helpLocale, status: 'help', sources: promptSources, answerChars: helpText.length })
      stream.done({ status: 'done', removed_links: 0, remaining: quota.remaining, ...turn, ...profiled })
      return
    }
    // Подсказка пуста (#3345): подбор что-то нашёл, но отбор по месту и условиям вопроса не оставил ни одной
    // карточки («с собакой недалеко от Варшавы» — у места только детский квест). Отвечать модели не по чему:
    // на «Материалы сайта: ничего не найдено» она называла выдуманную статью (3 из 3 в приёмке 12.11.2026).
    // Модель не вызывается; ход закрывается пустым `text`, `fallback` и причиной `no_material` — экран
    // показывает «на сайте пока нет материалов по этому вопросу» и найденное рядом (клиент без знания
    // причины — запасную фразу стража). Вопрос идёт в журнал спроса.
    if (!promptSources.length) {
      await demandLog.append({ q: question, locale, reason: 'no_sources' })
      const stream = openStream(response)
      stream.event('sources', { sources: listed(), degraded, remaining: quota.remaining, ...layer })
      if (deps.evalTrace) stream.event('trace', { prompt_sources: [], raw_text: '', model_called: false, ...tracedWorld, ...tracedProfile })
      stream.event('text', { text: '' })
      stream.done({ status: 'done', removed_links: 0, fallback: true, reason: ASK_NO_MATERIAL_REASON, remaining: quota.remaining, ...profiled })
      return
    }

    const generator = deps.generator
    if (!generator) {
      await refund()
      await demandLog.append({ q: question, locale, reason: 'generator_unavailable' })
      throw new HttpError(503, 'generator_unavailable', { detail: 'AI_LLM_URL не задан', retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
    }

    // Карточки расставил подбор (#3315, #3289): место, условия и группы повторно не считаются.
    const messages = buildAssistantMessages({
      question,
      locale,
      sources,
      history,
      retrievalQuery: pinned ? null : retrievalQuery,
      arranged: true,
      noPlace: (!pinned || left) && retrieved.noPlace === true,
      hints: deps.promptHints,
      visitor,
      now,
    })
    // Строка «О посетителе» ушла модели — страж не пропустит в ответ материал из неё, которого нет среди карточек.
    const visitorTitles = visitorBlockFor(visitor, promptSources, now) ? visitorTitlesOutside(visitor, page ? promptSources : sources) : []
    // Контур оценки (#3286) видит их в событии `trace` — вместе со строкой «почему подходит».
    const tracedSources = deps.evalTrace
      ? promptSources.map((source) => ({ ...withoutPlace(source), ...(source.why && deps.promptHints?.whyFits !== false ? { why: source.why } : {}) }))
      : null
    // Ссылки ответа: в режиме страницы модель видела только страницу — адрес соседнего материала она
    // могла лишь выдумать; в обычном режиме годится любая карточка списка источников.
    const answerSources = page ? promptSources : sources
    const controller = new AbortController()
    // Посетитель закрыл вкладку или нажал «Остановить»: генерация прекращается.
    response.once('close', () => {
      if (!response.writableFinished) controller.abort()
    })
    // Соединение закрылось ещё во время подбора: `close` уже прошёл, модель не запускаем впустую.
    if (response.destroyed) controller.abort()

    let stream: Stream | null = null
    let pendingText = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const clearFlush = () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = null
    }
    // Источники уходят с первым токеном: до него отказ модели ещё может стать честным 503.
    const ensureStream = (): Stream => {
      if (!stream) {
        stream = openStream(response)
        stream.event('sources', { sources: listed(), degraded, remaining: quota.remaining, ...layer })
      }
      return stream
    }
    const flush = () => {
      flushTimer = null
      ensureStream().event('text', { text: guardStreamingText(pendingText, answerSources, world).text })
    }

    try {
      const result = await deps.llmQueue.run(deps.queueTimeoutMs, () =>
        generator.generate({
          messages,
          signal: controller.signal,
          maxRecommendations: AI_MAX_RECOMMENDATIONS,
          onDelta: (_delta, full) => {
            ensureStream()
            pendingText = full
            if (!flushTimer) flushTimer = setTimeout(flush, STREAM_FLUSH_MS)
          },
        }),
      )
      clearFlush()
      // Числа сверяются с карточками подсказки, ссылки — со всем списком источников (#3345, lv35).
      // Внешний адрес остаётся только из внешней карточки этого ответа (#3357); опорой чисел она не служит.
      const guarded = guardAnswer(result.text, answerSources, { question, retrievalQuery, promptSources, worldSources: world, visitorTitles })
      const open = ensureStream()
      // Сырой ответ — до стража ссылок; остановку генератора на цикле и четвёртой рекомендации он уже прошёл.
      if (tracedSources) open.event('trace', { prompt_sources: tracedSources, raw_text: result.text, ...tracedWorld, ...tracedProfile })
      const verdict = judgeModelReply(retrievalQuery, guarded.text, countKeptSourceLinks(guarded.text, answerSources))
      if (verdict === 'no_material') {
        // #3216: модель отказала вопросу с признаком поездки — «материала нет» и строка в журнале спроса.
        await demandLog.append({ q: question, locale, reason: 'no_sources' })
        open.done({ status: 'no_sources', ...profiled })
        return
      }
      if (verdict === 'off_topic') {
        // Второй рубеж: модель узнала чужую тему по правилу промпта. В счётчик не идёт — модель
        // ошибается и на вопросах о поездке (замер #2710), блок за её ошибку получил бы посетитель.
        open.done({ status: 'off_topic', reason: 'model_refusal', ...profiled })
        return
      }
      open.event('text', { text: guarded.fallback ? '' : guarded.text })
      // Ход дошёл до ответа (#3296): строка журнала и идентификатор для оценки. Признание «отдельного
      // материала нет» рядом с рекомендациями — частичный ответ: тема без своего материала.
      const turn = await openTurn(ip, now, {
        q: question,
        locale,
        status: guarded.fallback ? 'fallback' : admitsNoMaterial(guarded.text) ? 'partial_no_material' : 'done',
        sources: promptSources,
        answerChars: guarded.fallback ? 0 : guarded.text.length,
        guard: {
          removed_links: guarded.removed,
          relabeled: guarded.relabeled,
          dropped_descriptions: guarded.droppedDescriptions,
          ungrounded_numbers: guarded.ungroundedNumbers,
          prompt_leaks: guarded.promptLeaks,
          counter_questions: guarded.counterQuestions,
          stray_admissions: guarded.strayAdmissions,
        },
        world,
      })
      open.done({
        status: 'done',
        removed_links: guarded.removed,
        ...(guarded.relabeled ? { relabeled: guarded.relabeled } : {}),
        ...(guarded.droppedDescriptions ? { dropped_descriptions: guarded.droppedDescriptions } : {}),
        ...(guarded.ungroundedNumbers ? { ungrounded_numbers: guarded.ungroundedNumbers } : {}),
        ...(guarded.promptLeaks ? { prompt_leaks: guarded.promptLeaks } : {}),
        ...(guarded.removedWorld ? { removed_world_links: guarded.removedWorld } : {}),
        ...(guarded.fallback ? { fallback: true } : {}),
        usage: result.usage,
        remaining: quota.remaining,
        ...turn,
        ...profiled,
      })
    } catch (error) {
      clearFlush()
      // `stream` открывается внутри колбэка: TS сузил бы его до null, читаем явно.
      const opened = stream as Stream | null
      if (error instanceof BusyError) {
        await refund()
        throw new HttpError(429, 'busy', { detail: error.message, retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
      }
      if (isAiGeneratorError(error)) {
        if (error.kind === 'aborted') {
          // Соединение закрыл посетитель: отвечать некому. Вопрос возвращается только до первого
          // токена — иначе лимит обходится чтением `text` и обрывом до `done`.
          if (!opened) {
            await refund()
            response.destroy()
          }
          return
        }
        await refund()
        if (!opened) {
          if (error.kind === 'busy') {
            throw new HttpError(429, 'busy', { detail: error.message, retryAfterSec: error.retryAfterSec ?? GENERATOR_RETRY_AFTER_SEC })
          }
          await demandLog.append({ q: question, locale, reason: 'generator_unavailable' })
          throw new HttpError(503, 'generator_unavailable', { detail: error.message, retryAfterSec: GENERATOR_RETRY_AFTER_SEC })
        }
        await demandLog.append({ q: question, locale, reason: 'generator_unavailable' })
        opened.done({ status: 'unavailable', ...profiled })
        return
      }
      await refund()
      if (!opened) throw error
      log(`POST /ai/ask: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
      opened.done({ status: 'error', ...profiled })
    }
  }
}
