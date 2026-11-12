/**
 * Путь службы `/ai/ask` в контуре оценки (#3286): то, что получит посетитель на проде.
 *
 * Вопрос уходит в службу metravel-assist клиентом экрана — `HttpAskClient` из
 * `api/aiAssist/askProvider.ts`: то же тело запроса, тот же разбор SSE и те же коды отказа. Фильтр
 * тем, подбор по индексу, подсказка, модель и страж работают на сервере без подмен. Сам экран в
 * таком прогоне не участвует: провайдер вшит в сборку Metro (`EXPO_PUBLIC_AI_ASSISTANT_PROVIDER`),
 * а второй Metro на машине контура не помещается в память. Состояния хода и история диалога
 * повторяют `askViaServer` и `buildHistoryFromTurns` экрана (`useAssistantChat.ts`), показанный
 * текст — разметку `AssistantAnswerText.tsx`; тесты сверяют их с экраном. Ход без текста модели экран
 * закрывает своей строкой: запасной фразой стража или «материала нет» при пустой подсказке
 * (`AssistantTurnCard.tsx`). В наблюдение идёт та же строка на локали хода (`loadShownTexts`) —
 * контур и судья видят то, что видит посетитель, а не пустой ответ.
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
  // Загрузчик `scripts/lib/ts-runtime.mjs` (#3291) уже снимает типы и находит соседей без расширения —
  // так путь службы идёт на Node 20 и 22.13; свой перехват нужен только Node со встроенным снятием типов.
  const hooked = globalThis[Symbol.for('metravel.tsRuntime')] === 'hooks'
  if (!hooked && (!process.features?.typescript || typeof nodeModule.registerHooks !== 'function')) {
    throw new Error(`путь службы: запускайте через npm run ai:assistant:eval (загрузчик scripts/lib/ts-runtime.mjs) либо Node ≥ 22.18 (сейчас ${process.versions.node})`)
  }
  if (!hooked && !resolveHookInstalled) {
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

/** Ключи `aiAssistStatic`, которыми экран закрывает ход без текста модели (`AssistantTurnCard.tsx`). */
export const SHOWN_TEXT_KEYS = { fallback: 'ask.fallbackAnswer', noMaterial: 'ask.noSources' }
/** Причина `done` у хода с пустой подсказкой — `ASK_NO_MATERIAL_REASON` (`api/aiAssist/policy.ts`). */
const NO_MATERIAL_REASON = 'no_material'

const shownTextsCache = new Map()

/** Строки экрана для хода без текста модели — из ресурсов интерфейса на локали хода. */
export async function loadShownTexts(locale) {
  if (!shownTextsCache.has(locale)) {
    const { aiAssistStaticResources: resources } = await import(`../../i18n/locales/${locale}/static/ai_assist_static.ts`)
    const texts = Object.fromEntries(Object.entries(SHOWN_TEXT_KEYS).map(([name, key]) => [name, resources[key]]))
    for (const [name, text] of Object.entries(texts)) if (typeof text !== 'string' || !text.trim()) throw new Error(`путь службы: в локали ${locale} нет строки ${SHOWN_TEXT_KEYS[name]}`)
    shownTextsCache.set(locale, texts)
  }
  return shownTextsCache.get(locale)
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
      // `model_called: false` (#3345) — подсказка пуста, служба ответила запасной фразой без вызова модели.
      // `help: true` (#3293) — ответ дала справка о сайте: запись и ссылка без модели.
      return { promptSources: Array.isArray(data.prompt_sources) ? data.prompt_sources : [], rawText: typeof data.raw_text === 'string' ? data.raw_text : '', modelCalled: data.model_called !== false, help: data.help === true }
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
// Группа `page` (#3290) нужна стражу ответа в `checks.mjs`: короткий ответ о странице там не пустой.
const toCards = (promptSources) =>
  promptSources.map((source, index) => ({ n: index + 1, type: source.type === 'quest' ? 'quest' : source.type === 'help' ? 'help' : 'travel', title: String(source.title ?? ''), url: String(source.url ?? ''), snippet: String(source.snippet ?? ''), ...(source.group === 'page' ? { group: 'page' } : {}) }))

/**
 * Диалог одного вопроса набора со службой. Возвращает функцию «задать вопрос → наблюдение хода» в
 * той же форме, что у прогона через экран (`askTurn` в `run.mjs`), чтобы проверки `checks.mjs`
 * считали слой провала одинаково. `shownTexts` — строки экрана для хода без текста модели
 * (`loadShownTexts(locale)`); без них такой ход — ошибка прогона, а не «пустой ответ».
 */
export function createAskSession({ createAskClient, askUrl, visitor, locale, source = null, fetchImpl = fetch, shownTexts = null }) {
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
      // Ход без текста модели экран закрывает своей строкой: «материала нет» при пустой подсказке (причина
      // `no_material`), иначе запасной фразой стража. В историю диалога такой ход не идёт — как на экране.
      const fallback = status === 'done' && result.done.fallback === true
      const noMaterial = fallback && result.done.reason === NO_MATERIAL_REASON
      if (fallback && !shownTexts) throw Object.assign(new Error('путь службы: ход закрыт строкой экрана, а строки не переданы (loadShownTexts)'), { setup: true })
      return {
        ...turn,
        status,
        ...(fallback ? { answerText: noMaterial ? shownTexts.noMaterial : shownTexts.fallback, linkLabels: [] } : renderShown(refused ? '' : result.text, sources)),
        sources: sources.map((item) => ({ type: item.type, id: item.source_id, title: item.title, ...(item.group ? { group: item.group } : {}) })),
        linksRemovedNotice: result.done.removedLinks > 0,
        // Запасной ответ стража (#3291) и пустая подсказка (#3345): текста модели нет, `answerText` — строка экрана.
        fallback: result.done.fallback === true,
        ...(noMaterial ? { noMaterial: true } : {}),
        // Нет события `trace` — модель не вызывалась (фильтр тем, пустой подбор) или служба без флага.
        modelCall: trace?.modelCalled ? { provider: 'ask', cards: toCards(trace.promptSources), text: trace.rawText, usage: result.done.usage, ms: Date.now() - startedAt } : null,
        // Пустая подсказка (#3345): карточки найдены, но ни одна не прошла отбор — модель не вызывалась намеренно.
        ...(trace && !trace.modelCalled && !trace.help ? { promptEmpty: true } : {}),
        // Справка о сайте (#3293): ответ — запись корпуса без модели; её карточки — в `helpCards`.
        ...(trace?.help && !trace.modelCalled ? { helpDirect: true, helpCards: toCards(trace.promptSources) } : {}),
      }
    } catch (error) {
      // Ошибка сборки прогона — не состояние хода: записать её «службой недоступна» значило бы скрыть.
      if (error?.setup) throw error
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
