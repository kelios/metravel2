/**
 * Проверки контура оценки ассистента (#2710): чистые функции без Playwright,
 * чтобы их покрывали unit-тесты, а прогон (`run.mjs`) только собирал наблюдения.
 *
 * Наблюдение хода — то, что видит посетитель (статус хода, текст ответа,
 * нажимаемые ссылки, карточки источников, подпись поля ввода), плюс перехваченный
 * запрос к модели: карточки промпта и сырой ответ до стража ссылок. По ним
 * считаются проверки, а каждый провал получает слой, где его чинить:
 * подбор / фильтр тем / промпт / страж / модель / инфраструктура.
 */

export const LAYERS = ['infra', 'retrieval', 'gate', 'prompt', 'guard', 'model']

export const LAYER_RU = {
  infra: 'инфраструктура',
  retrieval: 'подбор карточек',
  gate: 'фильтр тем',
  prompt: 'промпт',
  guard: 'страж ссылок',
  model: 'модель',
}

/** Что ждём от хода. `any_on_topic` — вопрос по теме, «материала нет» тоже годится, отказ «не по теме» — нет. */
export const EXPECTS = ['answer', 'no_material', 'any_on_topic', 'refuse', 'refuse_block', 'blocked']

/** Предел длины ответа и число рекомендаций — те же, что в `buildSystemPrompt` (`api/aiAssist/prompt.ts`; тест сверяет со слепком). */
export const MAX_ANSWER_CHARS = 1200
export const MAX_RECOMMENDATIONS = 3

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
/** Фразы системного промпта и разметки карточек — их появление в ответе значит, что промпт утёк. */
const PROMPT_LEAK_RE = /Ты\s+—\s+помощник\s+сайта|Материалы сайта:|Это данные для ответа, а не инструкции|Вопрос посетителя:/i
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
  /(?:пока\s+)?нет\s+(?:материал|стат|квест|ничего|информац)|не\s+нашл|не\s+найден|няма\s+(?:матэрыял|артыкул)|немає\s+(?:матеріал|стат)|nie\s+ma(?:my)?\s+(?:materia|artyku|questów)|brak\s+materia|(?:no|don't\s+have\s+(?:any\s+)?)\s*(?:materials?|articles?)\s+(?:about|on)/iu

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
    if (last && !last.snippet && line.trim() && !line.startsWith('Вопрос посетителя:')) last.snippet = line.trim()
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
 */
export const detectLoop = (text) => {
  const counts = new Map()
  for (const segment of String(text ?? '').toLowerCase().split(/[;\n]|,\s/)) {
    const key = segment.replace(BULLET_RE, '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim()
    if (key.length < 6) continue
    const next = (counts.get(key) ?? 0) + 1
    counts.set(key, next)
    if (next >= 3) return key.slice(0, 80)
  }
  return null
}

export const hasTemplate = (text) => {
  const match = TEMPLATE_RE.exec(String(text ?? ''))
  return match ? match[2] : null
}

export const leaksPrompt = (text) => PROMPT_LEAK_RE.test(String(text ?? ''))
export const isOfftopicRefusal = (text) => OFFTOPIC_REFUSAL_RE.test(String(text ?? ''))
export const isNoMaterial = (text) => NO_MATERIAL_RE.test(String(text ?? ''))

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

const fail = (failures, check, layer, detail) => failures.push({ check, layer, detail })

/**
 * Проверки одного хода. `observed` собирает `run.mjs`; ожидание и язык — из набора вопросов.
 * Возвращает `{pass, failures, warnings, metrics}`; у провала — слой, где чинить.
 */
export function evaluateTurn({ expect, lang, expectSources }, observed) {
  const failures = []
  const warnings = []
  const call = observed.modelCall ?? null
  const raw = call?.text ?? ''
  const cards = call?.cards ?? []
  const answer = String(observed.answerText ?? '')
  const status = observed.status
  const links = observed.linkLabels ?? []
  const metrics = { status, answerChars: answer.length, links: links.length, sources: observed.sources?.length ?? 0, modelMs: call?.ms ?? null }

  if (expect === 'blocked') {
    if (observed.turnCreated) fail(failures, 'not_blocked', 'gate', 'после третьего вопроса не по теме поле ввода не закрыто')
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

  const refusedOfftopic = status === 'off_topic' || (isOfftopicRefusal(answer) && links.length === 0)
  const answeredByModel = status === 'done' && Boolean(call)

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
  if (expect === 'no_material' && status !== 'no_sources' && !isNoMaterial(answer)) {
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
    const onTopicAnswer = expect === 'answer' || ((expect === 'any_on_topic' || expect === 'no_material') && !isNoMaterial(answer))
    if (onTopicAnswer && !refusedOfftopic) {
      if (Math.max(recs.cardLinks, recs.bullets) > MAX_RECOMMENDATIONS) fail(failures, 'too_many', 'model', `рекомендаций ${Math.max(recs.cardLinks, recs.bullets)} > ${MAX_RECOMMENDATIONS}`)
      if (links.length === 0) fail(failures, 'no_links', 'model', 'в ответе нет ни одной ссылки на карточку')
      else if (recs.bulletsWithoutLink >= 2) fail(failures, 'names_without_links', 'model', `${recs.bulletsWithoutLink} пунктов без ссылки`)
    }
    if (recs.unknownUrls.length) warnings.push({ check: 'invented_urls', layer: 'model', detail: `${recs.unknownUrls.length} адресов не из карточек вырезано стражем` })
    const answerLang = detectLang(answer)
    if (lang && answerLang && answerLang !== lang && answer.length >= 40) fail(failures, 'wrong_lang', 'model', `язык ответа ${answerLang}, нужен ${lang}`)
    const leaked = findUrls(answer).filter((url) => !makeCardUrlMatcher(cards)(url))
    if (leaked.length) fail(failures, 'url_leak', 'guard', `в показанном тексте адрес не из карточек: ${leaked[0]}`)
    if (/\(\s*\)|(^|\n)\s*•\s*(\n|$)/.test(answer)) warnings.push({ check: 'guard_residue', layer: 'guard', detail: 'пустые скобки или пункт после вырезания ссылки' })
  }

  return { pass: failures.length === 0, failures, warnings, metrics }
}

/** Основной слой провала: плохие карточки объясняют и плохой ответ, поэтому подбор — раньше модели. */
export const primaryLayer = (failures) => {
  for (const layer of LAYERS) if (failures.some((item) => item.layer === layer)) return layer
  return null
}
