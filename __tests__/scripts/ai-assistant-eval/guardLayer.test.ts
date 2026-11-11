import { aiAssistStaticResources as be } from '@/i18n/locales/be/static/ai_assist_static'
import { aiAssistStaticResources as en } from '@/i18n/locales/en/static/ai_assist_static'
import { aiAssistStaticResources as pl } from '@/i18n/locales/pl/static/ai_assist_static'
import { aiAssistStaticResources as ru } from '@/i18n/locales/ru/static/ai_assist_static'
import { aiAssistStaticResources as uk } from '@/i18n/locales/uk/static/ai_assist_static'

import { renderShown } from '../../../scripts/ai-assistant-eval/ask-path.mjs'
import { GUARD_CHECKS, evaluateTurn, findGuardDefects, isNoMaterial, primaryLayer } from '../../../scripts/ai-assistant-eval/checks.mjs'

// #3291: страж содержания ответа как слой контура оценки. Проверки считают ПОКАЗАННЫЙ ответ тем же
// `guardAnswer`, что экран и служба: дефект, который страж обязан убрать, в показанном тексте — провал стража.

type Card = { n: number; type: 'quest' | 'travel'; title: string; url: string; snippet: string }
const card = (n: number, type: Card['type'], title: string, slug: string, snippet: string): Card => ({
  n,
  type,
  title,
  url: `https://metravel.by/${type === 'quest' ? 'quests' : 'travels'}/${slug}`,
  snippet,
})

const cmok = card(1, 'quest', 'Квест по центру Минска: в поисках цмока', '4/minsk-cmok', 'Городской квест по городу Минск (Беларусь). Точек: 10. Длительность: 45 мин. Сложность: лёгкий')
const smolevud = card(2, 'travel', 'Смолевуд: натурная площадка Беларусьфильма под Минском', 'smolevud', 'Беларусь, Смолевичи. Дней: 1. Декорации городов и деревень…')
const kamenets = card(3, 'quest', 'Квест по Каменцу: Белая вежа и великаны', '83/kamenets-white-tower', 'Городской квест по городу Каменец (Беларусь). Точек: 9. Длительность: 100 мин. Сложность: лёгкий')
const river = card(4, 'travel', 'Маршрут вдоль рек Припять и Ипа к озеру Березица', 'marshrut-vdol-rek', 'Беларусь, Березица. Дней: 2. Сплав и стоянки на берегу…')
const CARDS = [cmok, smolevud, kamenets, river]

/** Наблюдение хода: показанный текст и нажимаемые ссылки — так, как их рисует экран из ответа после стража. */
const observe = (shownMarkdown: string, extra: Record<string, unknown> = {}) => ({
  turnCreated: true,
  status: 'done',
  ...renderShown(shownMarkdown, CARDS),
  sources: CARDS.map((item) => ({ type: item.type, id: String(item.n), title: item.title })),
  modelCall: { provider: 'ask', cards: CARDS, text: shownMarkdown, finishReason: 'stop', ms: 10 },
  ...extra,
})
const guardFailures = (question: string, shownMarkdown: string, expect = 'answer') =>
  evaluateTurn({ expect, lang: 'ru', question }, observe(shownMarkdown)).failures.filter((failure: { layer: string }) => failure.layer === 'guard')

describe('контур оценки: слой стража содержания (#3291)', () => {
  it('четыре проверки стража объявлены и считаются слоем guard', () => {
    expect(GUARD_CHECKS).toEqual(['label_mismatch', 'foreign_description', 'ungrounded_number', 'echo'])
  })

  it('label_mismatch: нажимаемая ссылка подписана не названием карточки (p14)', () => {
    const failures = guardFailures('Самый короткий квест в Минске', `Короткий маршрут — это [Минск в кадре: город, который играл Москву](${smolevud.url}).`)
    expect(failures).toEqual([{ check: 'label_mismatch', layer: 'guard', detail: expect.stringContaining('Минск в кадре') }])
  })

  it('foreign_description: пояснение пункта от соседней карточки (p18) и число не из своей карточки (p14)', () => {
    const river18 = guardFailures('Что делать в Беловежской пуще?', `Вот что есть:\n- [${kamenets.title}](${kamenets.url}) — квест с маршрутом вдоль Припяти и Ипы.`)
    expect(river18).toEqual([{ check: 'foreign_description', layer: 'guard', detail: expect.stringContaining('Маршрут вдоль рек Припять и Ипа') }])
    const numbers = guardFailures('Самый короткий квест в Минске', `Короткий маршрут — это [${smolevud.title}](${smolevud.url}): 9 точек, около 45 минут.`)
    expect(numbers.map((failure: { check: string }) => failure.check)).toEqual(['foreign_description'])
    expect(numbers[0].detail).toContain('9 точек')
  })

  it('ungrounded_number: время, которого нет ни в одной карточке и в вопросе (q24 приёмки v7)', () => {
    const failures = guardFailures('Во сколько начинать квест про цмока?', `Старт около 18:00, подробности — в [${cmok.title}](${cmok.url}).`)
    expect(failures).toEqual([{ check: 'ungrounded_number', layer: 'guard', detail: expect.stringContaining('18:00') }])
    // То же число из вопроса посетителя — его условие, а не выдумка.
    expect(guardFailures('Успею ли к 18:00 пройти квест про цмока?', `К 18:00 успеете: [${cmok.title}](${cmok.url}) — 45 мин.`)).toEqual([])
  })

  it('echo: показан повтор вопроса без ссылки и признания (p10)', () => {
    const question = 'Сколько стоит пройти квест?'
    const failures = guardFailures(question, `${question}\n\nОтвет: Цены в карточках — в отдельных пунктах.`, 'any_on_topic')
    expect(failures).toEqual([{ check: 'echo', layer: 'guard', detail: 'ответ повторяет вопрос посетителя' }])
  })

  it('ответ после стража проходит слой чисто; провал стража — основной слой раньше модели', () => {
    const clean = `В Минске есть:\n- [${cmok.title}](${cmok.url}) — городской квест: 10 точек, около 45 мин\n- [${smolevud.title}](${smolevud.url})`
    const question = 'Что посмотреть в Минске?'
    expect(guardFailures(question, clean)).toEqual([])
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question }, observe(clean)).pass).toBe(true)
    // Голый адрес карточки — ссылка без подписи, а не чужая подпись.
    expect(guardFailures(question, `Квест про цмока: 10 точек, около 45 мин. Подробности: ${cmok.url}`)).toEqual([])
    const broken = evaluateTurn({ expect: 'answer', lang: 'ru', question }, observe(`- [Минск в кадре](${smolevud.url}) — 9 точек`))
    expect(broken.pass).toBe(false)
    expect(primaryLayer(broken.failures)).toBe('guard')
  })

  it('без вопроса слой не считается (числа вопроса не отличить от выдуманных); уточнение берёт условия из прошлых вопросов', () => {
    const shown = `За 60 минут пройдёте [${cmok.title}](${cmok.url}).`
    expect(evaluateTurn({ expect: 'answer', lang: 'ru' }, observe(shown)).failures).toEqual([])
    expect(findGuardDefects({ question: 'А какой из них?' }, observe(shown)).map((defect: { check: string }) => defect.check)).toEqual(['ungrounded_number'])
    expect(findGuardDefects({ question: 'А какой из них?', earlier: 'Квест в Минске до часа' }, observe(shown))).toEqual([])
    expect(findGuardDefects({ question: 'Вопрос' }, observe(''))).toEqual([])
  })

  it('запасной ответ — честное «точного ответа нет»: путь службы отдаёт флаг, экран — фразу на пяти языках', () => {
    const fallback = observe('', { fallback: true })
    // На вопрос, где материала может не быть, запасной ответ проходит; на вопрос с ответом — модель не ответила.
    expect(evaluateTurn({ expect: 'no_material', lang: 'ru', question: 'Сколько стоит квест?' }, fallback).failures).toEqual([])
    expect(evaluateTurn({ expect: 'any_on_topic', lang: 'ru', question: 'Сколько стоит квест?' }, fallback).failures).toEqual([])
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Сколько стоит квест?' }, fallback).failures.map((failure: { check: string; layer: string }) => [failure.check, failure.layer])).toEqual([['no_links', 'model']])
    // Экран (путь llamacpp) рисует фразу текстом ответа: контур узнаёт в ней признание на каждой локали.
    for (const [lang, resources] of Object.entries({ ru, be, uk, pl, en })) {
      const phrase = resources['ask.fallbackAnswer']
      expect({ lang, admitted: isNoMaterial(phrase) }).toEqual({ lang, admitted: true })
      expect(evaluateTurn({ expect: 'no_material', lang, question: 'Сколько стоит квест?' }, observe(phrase)).failures).toEqual([])
    }
  })
})
