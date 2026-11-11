/**
 * Проверки контура оценки ассистента (#2710): чистые функции без Playwright,
 * чтобы их покрывали unit-тесты, а прогон (`run.mjs`) только собирал наблюдения.
 *
 * Наблюдение хода — то, что видит посетитель (статус хода, текст ответа,
 * нажимаемые ссылки, карточки источников, подпись поля ввода), плюс перехваченный
 * запрос к модели: карточки промпта и сырой ответ до стража ссылок. По ним
 * считаются проверки, а каждый провал получает слой, где его чинить:
 * подбор / фильтр тем / промпт / страж / модель / инфраструктура.
 *
 * Слой стража содержания (#3291) считает показанный ответ тем же кодом, что и продукт
 * (`api/aiAssist/answerGuard.ts`), поэтому модуль грузит TypeScript. Команды `ai:assistant:*` и
 * дочерние прогоны `accept.mjs` подключают загрузчик `scripts/lib/ts-runtime.mjs` — он работает на
 * Node 20 и 22 без ручных флагов; прямой вызов `node …/run.mjs` требует того же `--import` либо Node
 * со встроенным снятием типов (22.18+). jest собирает модуль своим преобразованием.
 */

import { guardAnswer, leaksPrompt } from '../../api/aiAssist/answerGuard.ts'
import { isSameTitle } from '../../api/aiAssist/linkGuard.ts'

export const LAYERS = ['infra', 'retrieval', 'gate', 'prompt', 'guard', 'model']

export const LAYER_RU = {
  infra: 'инфраструктура',
  retrieval: 'подбор карточек',
  gate: 'фильтр тем',
  prompt: 'промпт',
  guard: 'страж ответа',
  model: 'модель',
}

/** Что ждём от хода. `any_on_topic` — вопрос по теме, «материала нет» тоже годится, отказ «не по теме» — нет. */
export const EXPECTS = ['answer', 'no_material', 'any_on_topic', 'refuse', 'refuse_block', 'blocked']

/** Предел длины ответа и число рекомендаций — те же, что в `buildSystemPrompt` (`api/aiAssist/prompt.ts`; тест сверяет со слепком). */
export const MAX_ANSWER_CHARS = 1200
export const MAX_RECOMMENDATIONS = 3
/**
 * Отказ «не по теме» — короткая фраза: полторы длины самого длинного эталона (`offtopic_reply` слепка
 * промпта, тест сверяет). Фраза отказа, за которой идёт ответ по существу чужой темы, отказом не считается.
 */
export const MAX_REFUSAL_CHARS = 210
/** Ход не дошёл до конца: ответа модели в нём нет, проверять нечего. */
const UNFINISHED_STATUSES = ['searching', 'streaming', 'aborted']

const URL_RE = /\bhttps?:\/\/[^\s<>()[\]"'«»]+/gi
const BARE_SITE_RE = /(?<![\w/.])(?:www\.)?metravel\.by\/[^\s<>()[\]"'«»]*/gi
const TRAILING_PUNCTUATION_RE = /[.,;:!?…»"')\]]+$/
const CARD_HEAD_RE = /^\[(\d+)\]\s+(Статья|Квест)\s+«(.*)»\s+—\s+(\S+)\s*$/
const BULLET_RE = /^\s*(?:[*\-•]|\d+[.)])\s+/
/**
 * Шаблон карточки статьи из обучающего набора `site` (#2709, `sets/site.py`): «Страна: … / Когда: … /
 * Длительность: N дн. / Точки маршрута: …». «Длительность: 120 мин» и «Сложность:» из фрагмента квеста —
 * факты карточки, не шаблон, поэтому «Длительность» считается только в днях.
 */
const TEMPLATE_RE = /(^|\n)\s*(?:[*\-•]\s*)?(?:\*\*)?(Страна|Когда|Точки маршрута|Длительность(?=(?:\*\*)?\s*:\s*\d+\s*дн))(?:\*\*)?\s*:/i
/** Отказ «не по теме» — фраза из #2711 и её свободные пересказы на пяти языках. */
const OFFTOPIC_REFUSAL_RE = new RegExp(
  [
    'ассистент\\s+metravel\\.by\\s+по\\s+путешеств',
    'на\\s+другие\\s+темы\\s+не\\s+отвеча',
    'не\\s+по\\s+теме',
    'только\\s+(?:о|про|на\\s+вопросы\\s+о)\\s+путешеств',
    'не\\s+(?:могу|буду)\\s+(?:помочь|отвечать|ответить|выполнить)',
    'асістэнт\\s+metravel\\.by',
    'на\\s+іншыя\\s+тэмы',
    'асистент\\s+metravel\\.by',
    'на\\s+інші\\s+теми',
    'asystent\\s+metravel\\.by',
    'na\\s+inne\\s+tematy',
    'tylko\\s+o\\s+podróż',
    'metravel\\.by\\s+travel\\s+assistant',
    "(?:don't|do\\s+not|cannot|can't)\\s+answer\\s+(?:questions\\s+)?(?:on|about)\\s+other\\s+topics",
    "(?:cannot|can't)\\s+(?:fulfill|help\\s+with)\\s+(?:this|that|the|your)",
    'only\\s+(?:answer|help)\\s+(?:with\\s+)?(?:questions\\s+)?about\\s+travel',
  ].join('|'),
  'iu',
)
/** «На сайте такого нет» — честный отказ по теме. */
const NO_MATERIAL_RE =
  /(?:пока\s+)?нет\s+(?:материал|стат|квест|ничего|информац)|не\s+нашл|не\s+найден|няма\s+(?:матэрыял|артыкул)|немає\s+(?:матеріал|стат)|nie\s+ma(?:my)?\s+(?:materia|artyku|questów)|brak\s+materia|(?:no|don't\s+have\s+(?:any\s+)?)\s*(?:separate\s+|dedicated\s+)?(?:materials?|articles?|quests?)\s+(?:about|on|for)|no\s+(?:exact|precise|direct)\s+answer\s+in\s+the\s+(?:materials?|articles?|cards?|sources?)/iu
/**
 * Обратный порядок слов: «материала про Гданьск пока нет» — сам материал отсутствует, в пределах одной
 * фразы. Так же строятся учебные ответы на других языках (`rag_answers.py`: «Асобнага матэрыялу … няма»,
 * «Окремого матеріалу … немає», «Osobnego materiału … nie ma»); раньше шаблон знал только русский и
 * верный ответ на BE/UK/PL получал ложный `no_admission`.
 */
const NO_MATERIAL_REVERSE_RE =
  /(?<![\p{L}\p{N}])(?:материал|стат(?:ь|е)|квест|матэрыял|артыкул|квэст|матеріал|статт|materia[łl]|artyku[łl]|quest)\p{L}*\s+[^.!?;,\n]{0,120}?(?<!\p{L})(?:нет|не\s+найден\p{L}*|няма|немає|нема|nie\s+ma)(?!\p{L})/giu
const MATERIAL_AFFIRMED_RE = /(?<!\p{L})(?:есть|имеется|имеются|но|ёсць|але|є|jest|są|ale)(?!\p{L})/iu

export const normalizeUrl = (value) =>
  String(value ?? '')
    .trim()
    .replace(TRAILING_PUNCTUATION_RE, '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')

export const findUrls = (text) => {
  const value = String(text ?? '')
  return [...(value.match(URL_RE) ?? []), ...(value.match(BARE_SITE_RE) ?? [])].map((url) => url.replace(TRAILING_PUNCTUATION_RE, ''))
}

/** Карточки из сообщения посетителя (`formatSourcesBlock` в `prompt.ts`): `[n] Статья «title» — url` + строка фрагмента. */
export const parseCards = (userMessage) => {
  const cards = []
  for (const line of String(userMessage ?? '').split('\n')) {
    const head = CARD_HEAD_RE.exec(line.trim())
    if (head) {
      cards.push({ n: Number(head[1]), type: head[2] === 'Квест' ? 'quest' : 'travel', title: head[3], url: head[4], snippet: '' })
      continue
    }
    const last = cards[cards.length - 1]
    // Строки #3289 — «Почему подходит: …» в карточке и «О месте из вопроса…» перед вопросом — фрагментом не считаются.
    const text = line.trim()
    if (text.startsWith('Почему подходит:')) {
      if (last) last.why = text.slice('Почему подходит:'.length).trim()
      continue
    }
    if (last && !last.snippet && text && !text.startsWith('Вопрос посетителя:') && !text.startsWith('О месте из вопроса')) last.snippet = text
  }
  return cards
}

/** Тело SSE `/v1/chat/completions` → текст, причина остановки и счётчики токенов. */
export const parseSse = (body) => {
  let text = ''
  let finishReason = null
  let usage = null
  for (const line of String(body ?? '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const event = JSON.parse(payload)
      const choice = event.choices?.[0]
      if (choice?.delta?.content) text += choice.delta.content
      if (choice?.message?.content) text += choice.message.content
      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (event.usage) usage = event.usage
    } catch {
      // Битая строка стрима не роняет разбор: проверки увидят обрезанный текст.
    }
  }
  return { text, finishReason, usage }
}

/**
 * Зацикливание: один и тот же пункт (≥ 6 знаков) повторяется три раза и больше —
 * «Ratusz; Ratusz; Ratusz…» (#2709). Возвращает повторяющийся пункт или `null`.
 *
 * Повтор — это цикл, только если пункт идёт три раза подряд либо повторяется вместе со
 * следующим за ним (круг «A, B, C, A, B, C…»). Одинаковый факт у трёх разных пунктов —
 * «близько 120 хв» у трёх квестов одной длительности (#2751, UK ln03 09.11.2026) — не цикл:
 * между повторами стоят разные пункты.
 */
export const detectLoop = (text) => {
  const keys = []
  for (const segment of String(text ?? '').toLowerCase().split(/[;\n]|,\s/)) {
    const key = segment.replace(BULLET_RE, '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim()
    if (key.length >= 6) keys.push(key)
  }
  const seenAt = new Map()
  for (const [index, key] of keys.entries()) {
    const at = seenAt.get(key) ?? []
    at.push(index)
    seenAt.set(key, at)
    if (at.length < 3) continue
    const [first, second] = at.slice(-3)
    const inRow = second - first === 1 && index - second === 1
    // The last segment may be cut by the token limit: there a prefix of the next circle item counts.
    const after = keys[index + 1]
    const continues = after === undefined || after === keys[first + 1] || (index + 2 === keys.length && keys[first + 1].startsWith(after))
    const circle = second - first > 1 && keys[first + 1] === keys[second + 1] && continues
    if (inRow || circle) return key.slice(0, 80)
  }
  return null
}

export const hasTemplate = (text) => {
  const match = TEMPLATE_RE.exec(String(text ?? ''))
  return match ? match[2] : null
}

/**
 * Фразы системного промпта и разметки карточек в ответе — промпт утёк. Детектор общий со стражем содержания
 * (`leaksPrompt` в `api/aiAssist/answerGuard.ts`): заголовок «Материалы сайта:» на пяти локалях, строка
 * вопроса, номер карточки в квадратных скобках.
 */
export { leaksPrompt }
export const isOfftopicRefusal = (text) => OFFTOPIC_REFUSAL_RE.test(String(text ?? ''))
export const isNoMaterial = (text) => {
  const value = String(text ?? '')
  return NO_MATERIAL_RE.test(value) || [...value.matchAll(NO_MATERIAL_REVERSE_RE)].some((match) => !MATERIAL_AFFIRMED_RE.test(match[0]))
}

/**
 * Рекомендации в сыром ответе: сколько разных карточек названо адресом, сколько
 * пунктов списка и сколько пунктов без ссылки на карточку («названия без ссылок»).
 */
export const makeCardUrlMatcher = (cards) => {
  const cardKeys = new Set(cards.map((card) => normalizeUrl(card.url)))
  const cardPaths = new Set(cards.map((card) => normalizeUrl(card.url).replace(/^[^/]+/, '')))
  return (url) => {
    const key = normalizeUrl(url)
    return cardKeys.has(key) || cardPaths.has(key)
  }
}

/**
 * Рекомендации в показанном ответе (#3216): ссылки на карточки, которые видит посетитель, и
 * пункты списка. Генератор закрывает стрим на рекомендации сверх лимита, поэтому сырой ответ
 * модели (`countRecommendations`) и показанный текст считаются отдельно.
 */
export const countShownRecommendations = (answer, linkLabels) => {
  let bullets = 0
  for (const line of String(answer ?? '').split('\n')) {
    if (BULLET_RE.test(line) && line.replace(BULLET_RE, '').trim().length >= 4) bullets += 1
  }
  return Math.max(new Set((linkLabels ?? []).map((label) => String(label ?? '').trim()).filter(Boolean)).size, bullets)
}

export const countRecommendations = (raw, cards) => {
  const isCardUrl = makeCardUrlMatcher(cards)
  const mentioned = new Set()
  for (const url of findUrls(raw)) if (isCardUrl(url)) mentioned.add(normalizeUrl(url).replace(/^[^/]+/, ''))
  let bullets = 0
  let bulletsWithoutLink = 0
  for (const line of String(raw ?? '').split('\n')) {
    if (!BULLET_RE.test(line)) continue
    const body = line.replace(BULLET_RE, '').trim()
    if (body.length < 4 || hasTemplate(`\n${body}`)) continue
    bullets += 1
    if (!findUrls(body).some(isCardUrl)) bulletsWithoutLink += 1
  }
  const unknownUrls = findUrls(raw).filter((url) => !isCardUrl(url))
  return { cardLinks: mentioned.size, bullets, bulletsWithoutLink, unknownUrls }
}

const POLISH = 'ąćęłńśźżó'
const CYRILLIC_NEVER = { ru: 'іўїєґ', be: 'ищъїєґ', uk: 'ыэёъў' }
const PL_RE = /sz|cz|rz|dz|ie|ow|ych|\b(?:i|w|z|na|nie|jest|się|do)\b/g
const EN_RE = /th|wh|sh|ea|ou|ing\b|\b(?:a|an|the|and|of|to|is|in|for)\b/g

/** Язык по буквам — та же логика, что `detect_lang` в `scripts/ai-train/eval.py`. */
export const detectLang = (text) => {
  const value = String(text ?? '').replace(URL_RE, ' ').toLowerCase()
  const letters = value.match(/\p{L}/gu) ?? []
  const cyr = letters.filter((ch) => (ch >= 'а' && ch <= 'я') || 'ёіўїєґ'.includes(ch)).join('')
  const lat = letters.filter((ch) => (ch >= 'a' && ch <= 'z') || POLISH.includes(ch)).join('')
  if (!cyr && !lat) return null
  if (lat.length > cyr.length) {
    const words = (value.match(/[a-ząćęłńśźżó]+/g) ?? []).join(' ')
    const pl = 3 * [...lat].filter((ch) => POLISH.includes(ch)).length + (words.match(PL_RE) ?? []).length
    const en = (words.match(EN_RE) ?? []).length
    return pl > en ? 'pl' : 'en'
  }
  let best = null
  for (const [lang, never] of Object.entries(CYRILLIC_NEVER)) {
    const bad = [...never].reduce((sum, ch) => sum + cyr.split(ch).length - 1, 0)
    if (best === null || bad < best.bad) best = { lang, bad }
  }
  return best.lang
}

/** Нужные карточки: `{pattern, min, type}` — сколько источников хода подходят по названию. */
export const checkSources = (sources, expectSources) => {
  if (!expectSources) return null
  const re = new RegExp(expectSources.pattern, 'iu')
  const matched = sources.filter((source) => re.test(source.title) && (!expectSources.type || source.type === expectSources.type))
  const min = expectSources.min ?? 1
  return { ok: matched.length >= min, matched: matched.length, min }
}

/**
 * Названа карточка не того места (#3267). `expect_sources.pattern` задаёт место вопроса; если в
 * подсказке были карточки этого места, а модель дала ссылку на карточку, которая под него не
 * подходит ни названием, ни фрагментом, ни адресом, — это выбор модели, а не подбора: квест Бреста
 * в ответе про Краков (UK ln03, v4, 10.11.2026) автопроверки пропускали, находил только судья.
 * Когда карточек места в подсказке нет вовсе, виноват подбор — это `irrelevant_sources`.
 */
export const findOffPlaceCards = (raw, cards, expectSources) => {
  const split = splitPlaceCards(cards, expectSources)
  if (!split?.own.length) return []
  const pathOf = (url) => normalizeUrl(url).replace(/^[^/]+/, '')
  const named = new Set(findUrls(raw).map(pathOf))
  return split.foreign.filter((card) => named.has(pathOf(card.url)))
}

/**
 * Карточки подсказки по месту вопроса (`expect_sources.pattern`): свои — подходят названием,
 * фрагментом или адресом, остальные — чужие. Без ожидания места и без карточек — `null`.
 */
export function splitPlaceCards(cards, expectSources) {
  if (!expectSources?.pattern || !cards?.length) return null
  const place = new RegExp(expectSources.pattern, 'iu')
  const fits = (card) => place.test(`${card.title ?? ''} ${card.snippet ?? ''} ${card.url ?? ''}`)
  return { own: cards.filter(fits), foreign: cards.filter((card) => !fits(card)) }
}

const fail = (failures, check, layer, detail) => failures.push({ check, layer, detail })

/** Проверки стража содержания (#3291): то, что он обязан был исправить до показа. */
export const GUARD_CHECKS = ['label_mismatch', 'foreign_description', 'ungrounded_number', 'echo']

/**
 * Слой стража содержания (#3291) по ПОКАЗАННОМУ ответу — тем же `guardAnswer`, что у экрана и службы:
 *   - `label_mismatch` — нажимаемая ссылка подписана не названием карточки;
 *   - `foreign_description` — пояснение пункта от соседней карточки или с числом не из своей;
 *   - `ungrounded_number` — число с единицей, которого нет ни в одной карточке и в вопросе;
 *   - `echo` — ответ без содержания: повтор вопроса или фраза без ссылки и признания.
 * Показанный текст ссылок не несёт, поэтому подпись, равная названию карточки, снова становится
 * ссылкой на неё: так страж видит, чьё пояснение стоит рядом. `earlier` — прошлые вопросы диалога:
 * уточнение повторяет их условия («не дольше 90 минут»).
 */
export const findGuardDefects = ({ question, earlier = '' }, observed) => {
  const answer = String(observed.answerText ?? '')
  const cards = observed.modelCall?.cards ?? []
  if (!answer.trim() || !cards.length) return []
  const defects = []
  const labels = [...new Set((observed.linkLabels ?? []).map((label) => String(label ?? '').trim()).filter(Boolean))]
  const cardOf = (label) => cards.find((card) => isSameTitle(label, card.title))
  // Голый адрес карточки экран показывает самим адресом: это ссылка без подписи, а не чужая подпись.
  const isCardUrl = makeCardUrlMatcher(cards)
  const strangers = labels.filter((label) => !cardOf(label) && !isCardUrl(label))
  if (strangers.length) defects.push({ check: 'label_mismatch', detail: `подпись ссылки не равна названию карточки: «${strangers[0].slice(0, 80)}»` })

  // Длинные подписи раньше коротких: «Квест по Гродно» не должен разорвать «Квест по Гродно: две звезды».
  // Метка замены — символ из области частного использования: в ответах модели его нет.
  const tokens = []
  let markdown = answer
  for (const label of labels.filter(cardOf).sort((a, b) => b.length - a.length)) {
    const card = cardOf(label)
    markdown = markdown.split(label).join(`${tokens.length}`)
    tokens.push(`[${card.title.replace(/[[\]]/g, ' ')}](${card.url})`)
  }
  markdown = markdown.replace(/(\d+)/g, (_match, index) => tokens[Number(index)]).replace(/^• /gm, '- ')
  const sources = cards.map((card) => ({ type: card.type, source_id: '', title: card.title, url: card.url, path: '', snippet: card.snippet ?? '', score: 0, ...(card.group ? { group: card.group } : {}) }))
  const guarded = guardAnswer(markdown, sources, { question, retrievalQuery: earlier })
  const seen = new Set(defects.map((item) => item.check))
  for (const finding of guarded.findings) {
    // Утечку разметки показанного ответа ловит своя проверка `prompt_leak` — тем же детектором.
    if (finding.check === 'label_mismatch' || finding.check === 'prompt_leak' || seen.has(finding.check)) continue
    seen.add(finding.check)
    defects.push(finding)
  }
  return defects
}

/**
 * Проверки одного хода. `observed` собирает `run.mjs`; ожидание и язык — из набора вопросов.
 * Возвращает `{pass, failures, warnings, metrics}`; у провала — слой, где чинить. `question` (и
 * `earlier` — прошлые вопросы диалога) включает слой стража содержания (#3291); без вопроса он не
 * считается: числа из вопроса нельзя было бы отличить от выдуманных.
 */
export function evaluateTurn({ expect, lang, expectSources, question, earlier }, observed) {
  const failures = []
  const warnings = []
  const call = observed.modelCall ?? null
  const raw = call?.text ?? ''
  const cards = call?.cards ?? []
  const answer = String(observed.answerText ?? '')
  const status = observed.status
  const links = observed.linkLabels ?? []
  const metrics = { status, answerChars: answer.length, links: links.length, sources: observed.sources?.length ?? 0, modelMs: call?.ms ?? null }
  // Состав подсказки по месту вопроса (#3315): отчёт считает ходы, где рядом с карточками места стоят чужие.
  const placeCards = splitPlaceCards(cards, expectSources)
  if (placeCards) Object.assign(metrics, { placeCards: placeCards.own.length, foreignCards: placeCards.foreign.length })

  if (expect === 'blocked') {
    // Экран без поля ввода (упал, не догрузился) — не блокировка посетителя.
    if (observed.inputMissing) fail(failures, 'no_input', 'infra', 'на экране нет поля ввода')
    else if (observed.turnCreated) fail(failures, 'not_blocked', 'gate', 'после третьего вопроса не по теме поле ввода не закрыто')
    return { pass: failures.length === 0, failures, warnings, metrics }
  }
  if (!observed.turnCreated) {
    fail(failures, 'no_turn', expect === 'answer' || expect === 'any_on_topic' ? 'gate' : 'infra', observed.composerMeta || 'вопрос не принят')
    return { pass: false, failures, warnings, metrics }
  }
  if (['unavailable', 'busy', 'error'].includes(status)) {
    fail(failures, 'unavailable', 'infra', `статус хода ${status}${call?.error ? `: ${call.error}` : ''}`)
    return { pass: false, failures, warnings, metrics }
  }

  // Незавершённый ход и «готовый» ответ без перехваченного вызова модели раньше проходили все модельные
  // проверки пустыми (ревью #3267): такой ход ничего не говорит о модели и идёт в слой инфраструктуры.
  if (UNFINISHED_STATUSES.includes(status)) {
    fail(failures, 'not_finished', 'infra', `ход не завершён: статус ${status}`)
    return { pass: false, failures, warnings, metrics }
  }
  if (status === 'done' && !call) {
    fail(failures, 'no_model_call', 'infra', 'ответ показан, но запрос к модели не перехвачен')
    return { pass: false, failures, warnings, metrics }
  }

  const refusedOfftopic = status === 'off_topic' || (isOfftopicRefusal(answer) && links.length === 0 && answer.length <= MAX_REFUSAL_CHARS)
  const answeredByModel = status === 'done' && Boolean(call)
  metrics.answeredByModel = answeredByModel

  if (expect === 'refuse' || expect === 'refuse_block') {
    if (!refusedOfftopic) {
      fail(failures, 'not_refused', 'gate', status === 'no_sources' ? 'отказ «материала нет» вместо «не по теме»' : 'вопрос не по теме получил ответ')
      if (answeredByModel) fail(failures, 'model_not_refused', 'model', 'модель ответила на вопрос не по теме')
    }
    if (expect === 'refuse_block' && !observed.blockedAfter) fail(failures, 'not_blocked', 'gate', 'после третьего вопроса не по теме поле ввода не закрыто')
  } else if (refusedOfftopic) {
    fail(failures, 'false_offtopic', status === 'off_topic' ? 'gate' : 'model', 'вопрос по теме получил отказ «не по теме»')
  }

  const sourcesCheck = checkSources(observed.sources ?? [], expectSources)
  if (sourcesCheck) metrics.relevantSources = sourcesCheck.matched
  if (expect === 'answer') {
    if (status === 'no_sources') fail(failures, 'no_sources', 'retrieval', 'подбор не нашёл карточек')
    else if (sourcesCheck && !sourcesCheck.ok) fail(failures, 'irrelevant_sources', 'retrieval', `подходящих карточек ${sourcesCheck.matched} из ${sourcesCheck.min} нужных`)
  }
  // Запасной ответ стража (#3291) — честное «точного ответа в материалах нет»: экран показывает его
  // фразой, путь службы — флагом `fallback` при пустом тексте.
  const admitted = observed.fallback === true || isNoMaterial(answer)
  if (expect === 'no_material' && status !== 'no_sources' && !admitted) {
    fail(failures, 'no_admission', answeredByModel ? 'model' : 'retrieval', 'нет признания «на сайте такого нет»')
  }

  if (answeredByModel) {
    const loop = detectLoop(raw)
    if (loop) fail(failures, 'loop', 'model', `повтор пункта: «${loop}»`)
    if (call.finishReason === 'length') fail(failures, 'truncated', 'model', 'ответ оборван по max_tokens')
    const template = hasTemplate(raw)
    if (template) fail(failures, 'template', 'model', `шаблон карточки статьи: «${template}:»`)
    if (leaksPrompt(answer)) fail(failures, 'prompt_leak', 'prompt', 'в ответе текст системного промпта или разметка карточек')
    if (answer.length > MAX_ANSWER_CHARS) fail(failures, 'too_long', 'model', `${answer.length} знаков > ${MAX_ANSWER_CHARS}`)
    const recs = countRecommendations(raw, cards)
    Object.assign(metrics, { cardLinks: recs.cardLinks, bullets: recs.bullets, unknownUrls: recs.unknownUrls.length })
    const onTopicAnswer = expect === 'answer' || ((expect === 'any_on_topic' || expect === 'no_material') && !admitted)
    if (onTopicAnswer && !refusedOfftopic) {
      // Рекомендация — карточка: пункты-советы к одной статье без своих ссылок списком рекомендаций не считаются.
      const recommended = Math.max(recs.cardLinks, recs.bullets - recs.bulletsWithoutLink)
      if (recommended > MAX_RECOMMENDATIONS) fail(failures, 'too_many', 'model', `рекомендаций ${recommended} > ${MAX_RECOMMENDATIONS}`)
      // Слой модели выше считает сырой ответ; здесь — то, что дошло до посетителя после остановки генератора (#3216).
      const shown = countShownRecommendations(answer, links)
      metrics.shownRecommendations = shown
      if (shown > MAX_RECOMMENDATIONS) fail(failures, 'too_many_shown', 'guard', `в показанном ответе рекомендаций ${shown} > ${MAX_RECOMMENDATIONS}`)
      // Режим страницы (#3290): в подсказке одна карточка — страница, на которой посетитель уже стоит;
      // ответ по ней без ссылки верен («В карточке указано 13 точек, около 180 мин.») — это предупреждение.
      const pageMode = cards.length === 1 && cards[0].group === 'page'
      if (links.length === 0 && pageMode) warnings.push({ check: 'no_links', layer: 'model', detail: 'ответ по странице без ссылки на неё' })
      else if (links.length === 0) fail(failures, 'no_links', 'model', 'в ответе нет ни одной ссылки на карточку')
      else if (recs.bulletsWithoutLink >= 2) fail(failures, 'names_without_links', 'model', `${recs.bulletsWithoutLink} пунктов без ссылки`)
      const offPlace = findOffPlaceCards(raw, cards, expectSources)
      metrics.offPlaceCards = offPlace.length
      if (offPlace.length) fail(failures, 'off_place_card', 'model', `названа карточка не того места: «${offPlace[0].title}»`)
    }
    if (recs.unknownUrls.length) warnings.push({ check: 'invented_urls', layer: 'model', detail: `${recs.unknownUrls.length} адресов не из карточек вырезано стражем` })
    // Язык — по собственным словам ответа: название карточки стоит как в каталоге, а детские квесты и
    // часть статей не переведены, поэтому короткий верный ответ с русским названием читался как русский.
    const prose = links.reduce((text, label) => (label ? text.split(label).join(' ') : text), answer)
    const answerLang = detectLang(prose)
    if (lang && answerLang && answerLang !== lang && prose.trim().length >= 40) fail(failures, 'wrong_lang', 'model', `язык ответа ${answerLang}, нужен ${lang}`)
    const leaked = findUrls(answer).filter((url) => !makeCardUrlMatcher(cards)(url))
    if (leaked.length) fail(failures, 'url_leak', 'guard', `в показанном тексте адрес не из карточек: ${leaked[0]}`)
    if (/\(\s*\)|(^|\n)\s*•\s*(\n|$)/.test(answer)) warnings.push({ check: 'guard_residue', layer: 'guard', detail: 'пустые скобки или пункт после вырезания ссылки' })
    // Страж содержания (#3291): в показанном ответе не должно остаться того, что он обязан убрать.
    if (typeof question === 'string' && question.trim()) {
      for (const defect of findGuardDefects({ question, earlier }, observed)) fail(failures, defect.check, 'guard', defect.detail)
    }
  }

  return { pass: failures.length === 0, failures, warnings, metrics }
}

/** Основной слой провала: плохие карточки объясняют и плохой ответ, поэтому подбор — раньше модели. */
export const primaryLayer = (failures) => {
  for (const layer of LAYERS) if (failures.some((item) => item.layer === layer)) return layer
  return null
}
