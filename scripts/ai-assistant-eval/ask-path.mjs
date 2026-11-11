/**
 * Путь службы `/ai/ask` в контуре оценки (#3286): то, что получит посетитель на проде.
 *
 * Вопрос уходит в службу metravel-assist клиентом экрана — `HttpAskClient` из
 * `api/aiAssist/askProvider.ts`: то же тело запроса, тот же разбор SSE и те же коды отказа. Фильтр
 * тем, подбор по индексу, подсказка, модель и страж работают на сервере без подмен. Сам экран в
 * таком прогоне не участвует: провайдер вшит в сборку Metro (`EXPO_PUBLIC_AI_ASSISTANT_PROVIDER`),
 * а второй Metro на машине контура не помещается в память. Состояния хода и история диалога
 * повторяют `askViaServer` и `buildHistoryFromTurns` экрана (`useAssistantChat.ts`), показанный
 * текст — разметку `AssistantAnswerText.tsx`; тесты сверяют их с экраном.
 *
 * Карточки подсказки и сырой ответ модели приходят событием `trace` — служба должна быть запущена
 * с `AI_ASSIST_EVAL_TRACE=1`. Каждый вопрос набора идёт со своего адреса посетителя (`X-Real-IP`,
 * как его ставит nginx): дневной лимит и блок «не по теме» одного вопроса не срезают остальные.
 */

import nodeModule from 'node:module'

import { normalizeUrl } from './checks.mjs'

/** Пар «вопрос — ответ» в истории, как `HISTORY_TURNS` экрана. */
export const HISTORY_TURNS = 3

const INLINE_RE = /\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>()[\]"'«»]+)/g
const BULLET_RE = /^\s*(?:[*\-•]|\d+[.)])\s+/
const HEADING_RE = /^\s*#{1,6}\s+/
const TRAILING_PUNCTUATION_RE = /[.,;:!?…»"')\]]+$/

let resolveHookInstalled = false

/**
 * Клиент экрана в Node. `askProvider.ts` — модуль экрана и подключает `./generator` без расширения;
 * Node такой адрес сам не находит, поэтому для модулей `api/aiAssist` он дополняется до `.ts`.
 */
export async function loadAskProvider() {
  if (!process.features?.typescript || typeof nodeModule.registerHooks !== 'function') {
    throw new Error(`путь службы: нужен Node ≥ 22.18 (сейчас ${process.versions.node}): PATH="/opt/homebrew/opt/node@22/bin:$PATH"`)
  }
  if (!resolveHookInstalled) {
    nodeModule.registerHooks({
      resolve(specifier, context, nextResolve) {
        try {
          return nextResolve(specifier, context)
        } catch (error) {
          const relative = /^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)
          if (!relative || !String(context.parentURL ?? '').includes('/api/aiAssist/')) throw error
          return nextResolve(`${specifier}.ts`, context)
        }
      },
    })
    resolveHookInstalled = true
  }
  return import('../../api/aiAssist/askProvider.ts')
}

/** Один и тот же сервер: `localhost` и `127.0.0.1` — один хост. */
export const sameServer = (left, right) => {
  const key = (value) => {
    const url = new URL(value)
    return `${url.hostname === 'localhost' ? '127.0.0.1' : url.hostname}:${url.port}`
  }
  try {
    return key(left) === key(right)
  } catch {
    return false
  }
}

/**
 * Служба готова к замеру: отдаёт событие `trace` и смотрит на ожидаемую модель. Без этой проверки
 * база и кандидат, перепутанные портами, дали бы таблицу сравнения модели с самой собой.
 */
export async function inspectAskService(askUrl, expectedModelUrl = null, fetchJson) {
  const health = await fetchJson(`${askUrl}/ai/health`).catch((error) => {
    throw new Error(`${askUrl}: служба metravel-assist не отвечает (${error?.cause?.code ?? error?.message ?? error})`)
  })
  if (!health.eval_trace) throw new Error(`${askUrl}: служба запущена без AI_ASSIST_EVAL_TRACE=1 — карточек подсказки и сырого ответа в потоке не будет`)
  if (!health.llm_url) throw new Error(`${askUrl}: у службы не задан AI_LLM_URL`)
  if (expectedModelUrl && !sameServer(health.llm_url, expectedModelUrl)) throw new Error(`${askUrl}: служба смотрит на модель ${health.llm_url}, ожидалась ${expectedModelUrl}`)
  return { url: askUrl, llmUrl: String(health.llm_url).replace(/\/+$/, ''), indexBuiltAt: health.index_built_at ?? null, indexCount: health.count ?? null }
}

/** Событие `trace` из тела SSE; клиент экрана его пропускает, поэтому оно читается отдельно. */
export function parseTrace(body) {
  for (const block of String(body ?? '').split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/)
    if (!lines.some((line) => line.trim() === 'event: trace')) continue
    try {
      const data = JSON.parse(lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n'))
      return { promptSources: Array.isArray(data.prompt_sources) ? data.prompt_sources : [], rawText: typeof data.raw_text === 'string' ? data.raw_text : '' }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Показанный ответ — как его рисует экран (`parseAnswer` в `AssistantAnswerText.tsx`): ссылка видна
 * подписью, жирный — текстом, пункт списка — «• ». Нажимаемые ссылки — только на карточки хода.
 */
export function renderShown(text, sources) {
  const cardUrls = new Set((sources ?? []).map((source) => normalizeUrl(source.url)))
  const linkLabels = []
  const lines = String(text ?? '').split('\n').map((rawLine) => {
    const line = rawLine.replace(BULLET_RE, '').replace(HEADING_RE, '')
    const shown = line.replace(INLINE_RE, (match, label, url, bold, bare) => {
      if (bold) return bold
      const target = url ?? bare.replace(TRAILING_PUNCTUATION_RE, '')
      const visible = label ?? target
      if (cardUrls.has(normalizeUrl(target))) linkLabels.push(visible.trim())
      return label ?? bare
    })
    return `${BULLET_RE.test(rawLine) ? '• ' : ''}${shown}`
  })
  return { answerText: lines.join('\n').trim(), linkLabels }
}

/** Карточки подсказки в той же форме, что разбор перехваченного запроса экрана (`parseCards`). */
const toCards = (promptSources) =>
  promptSources.map((source, index) => ({ n: index + 1, type: source.type === 'quest' ? 'quest' : 'travel', title: String(source.title ?? ''), url: String(source.url ?? ''), snippet: String(source.snippet ?? '') }))

/**
 * Диалог одного вопроса набора со службой. Возвращает функцию «задать вопрос → наблюдение хода» в
 * той же форме, что у прогона через экран (`askTurn` в `run.mjs`), чтобы проверки `checks.mjs`
 * считали слой провала одинаково.
 */
export function createAskSession({ createAskClient, askUrl, visitor, locale, source = null, fetchImpl = fetch }) {
  let trace = null
  const client = createAskClient(askUrl, {
    fetchImpl: async (url, init) => {
      const response = await fetchImpl(url, { ...init, headers: { ...init?.headers, 'X-Real-IP': visitor } })
      if (!response.ok) return response
      const body = await response.text()
      trace = parseTrace(body)
      // Тело уже прочитано: клиент разбирает его целиком, как на native, где `fetch` не стримит.
      return { ok: true, status: response.status, headers: response.headers, body: null, text: async () => body }
    },
  })
  const answered = []
  let blocked = false

  return async function ask(question) {
    // Экран с блоком поле не открывает: вопрос не уходит, хода нет.
    if (blocked) return { turnCreated: false, inputMissing: false, inputBlocked: true, blockedAfter: true, composerMeta: 'служба закрыла ассистента до полуночи (блок «не по теме»)' }
    const history = answered.slice(-HISTORY_TURNS).flatMap((turn) => [{ role: 'user', text: turn.question }, { role: 'assistant', text: turn.answer }])
    const turn = { turnCreated: true, inputMissing: false, inputBlocked: false, blockedAfter: false, composerMeta: '', notice: '', answerText: '', linkLabels: [], sources: [], linksRemovedNotice: false, modelCall: null, request: { history, source } }
    const startedAt = Date.now()
    trace = null
    try {
      const result = await client.ask({ question, locale, history, source })
      const { status } = result.done
      // Отказ экран показывает без текста и без источников, даже если модель успела что-то написать.
      const refused = status === 'off_topic' || status === 'no_sources'
      const sources = refused ? [] : result.sources
      if (status === 'done' && result.text.trim()) answered.push({ question, answer: result.text })
      return {
        ...turn,
        status,
        ...renderShown(refused ? '' : result.text, sources),
        sources: sources.map((item) => ({ type: item.type, id: item.source_id, title: item.title })),
        linksRemovedNotice: result.done.removedLinks > 0,
        // Нет события `trace` — модель не вызывалась (фильтр тем, пустой подбор) или служба без флага.
        modelCall: trace ? { provider: 'ask', cards: toCards(trace.promptSources), text: trace.rawText, usage: result.done.usage, ms: Date.now() - startedAt } : null,
      }
    } catch (error) {
      const kind = error?.name === 'AskError' ? error.kind : null
      const notice = String(error?.message ?? error)
      if (kind === 'offtopic_blocked') {
        blocked = true
        return { ...turn, status: 'off_topic', inputBlocked: true, blockedAfter: true, notice }
      }
      // Лимит службы экран показывает без хода; в прогоне это сбой стенда, а не отказ вопросу.
      return { ...turn, status: kind === 'busy' ? 'busy' : kind === 'limit' ? 'error' : 'unavailable', notice }
    }
  }
}
