/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

import { buildHelpChunks, HELP_ANSWER_TAG, HELP_DIR, HELP_LOCALES, type HelpCorpus, type HelpEntry, helpDraftsEnabled, localizedHelp, readHelpCorpus, validateHelpCorpus } from '@/scripts/ai-index/help'
import { countSources } from '@/scripts/ai-index/format'

// #3293: справка о сайте — третий тип источника индекса. Тексты ответов читает посетитель, поэтому в
// индекс идут только записи, утверждённые владельцем; у каждой — страница сайта и документ-источник.
const ROOT = process.cwd()
const corpus = readHelpCorpus()

/** Роут экрана для пути страницы: файл в `app/` или `app/(tabs)/`, в том числе `.web`/`.native` и `index`. */
const routeExists = (url: string): boolean => {
  const name = url.replace(/^\//, '')
  return ['app', 'app/(tabs)'].some((base) =>
    ['.tsx', '.web.tsx', '.native.tsx', '/index.tsx', '/index.web.tsx', '/index.native.tsx'].some((suffix) => fs.existsSync(path.join(ROOT, base, `${name}${suffix}`))),
  )
}

describe('справочный корпус ассистента (#3293)', () => {
  it('формат: 25–45 записей, у каждой номер, вопросы, ответ, страница сайта и документ-источник; ошибок нет', () => {
    expect(validateHelpCorpus(corpus)).toEqual([])
    expect(corpus.entries.length).toBeGreaterThanOrEqual(25)
    // Постановка просила 25–40; 41-я — «Нужно ли приложение, чтобы пройти квест?» по замеру r2 (lv42).
    expect(corpus.entries.length).toBeLessThanOrEqual(45)
    expect(corpus.entries.map((entry) => entry.num)).toEqual(corpus.entries.map((_, index) => index + 1))
    // Темы из постановки: цена и регистрация, квесты, приложения, избранное и план, статьи, карта, языки, обратная связь.
    const topics = new Set(corpus.entries.map((entry) => entry.topic))
    for (const topic of ['цена и регистрация', 'квесты', 'приложения', 'избранное и план поездки', 'статьи и модерация', 'карта и фильтры', 'языки', 'обратная связь']) {
      expect({ topic, present: topics.has(topic) }).toEqual({ topic, present: true })
    }
    for (const entry of corpus.entries) {
      expect({ id: entry.id, short: entry.answer.length <= 320 }).toEqual({ id: entry.id, short: true })
      expect({ id: entry.id, questions: entry.questions.length >= 3 }).toEqual({ id: entry.id, questions: true })
    }
  })

  it('у каждой записи страница — существующий роут приложения, документ-источник — файл репозитория', () => {
    for (const entry of corpus.entries) {
      expect({ id: entry.id, url: entry.url, route: routeExists(entry.url) }).toEqual({ id: entry.id, url: entry.url, route: true })
      const [file] = entry.source_doc.split('#')
      expect({ id: entry.id, file, exists: fs.existsSync(path.join(ROOT, file)) }).toEqual({ id: entry.id, file, exists: true })
    }
  })

  it('переводы BE/UK/PL/EN полны: у каждой записи свой перевод с тем же числом формулировок; без перевода — русский', () => {
    for (const locale of HELP_LOCALES.filter((item) => item !== 'ru')) {
      const items = corpus.translations[locale]
      expect({ locale, file: fs.existsSync(path.join(HELP_DIR, `help.${locale}.json`)), count: items?.size }).toEqual({ locale, file: true, count: corpus.entries.length })
      for (const entry of corpus.entries) {
        const text = localizedHelp(corpus, entry, locale)
        expect({ locale, id: entry.id, fallback: text.fallback, questions: text.questions.length }).toEqual({ locale, id: entry.id, fallback: false, questions: entry.questions.length })
      }
    }
    // Запись без перевода отдаётся на русском и своего фрагмента на этой локали не получает.
    const partial: HelpCorpus = { entries: corpus.entries.slice(0, 2).map((entry) => ({ ...entry, approved: true, needs_owner: false, owner_question: null })), translations: { pl: new Map([[corpus.entries[0].id, corpus.translations.pl!.get(corpus.entries[0].id)!]]) } }
    expect(localizedHelp(partial, partial.entries[1], 'pl')).toMatchObject({ fallback: true, answer: partial.entries[1].answer })
    const chunks = buildHelpChunks(partial)
    expect([...new Set(chunks.map((chunk) => `${chunk.source_id}:${chunk.locale}`))].sort()).toEqual(['1:pl', '1:ru', '2:ru'])
  })

  it('в индекс идут только утверждённые записи; запись с неподтверждённым фактом утвердить нельзя; черновики — только выключателем стенда', () => {
    // Сейчас владелец тексты не утвердил: по умолчанию справки в индексе нет.
    expect(corpus.entries.filter((entry) => entry.approved)).toEqual([])
    expect(buildHelpChunks(corpus)).toEqual([])
    const needOwner = corpus.entries.filter((entry) => entry.needs_owner)
    expect(needOwner.map((entry) => entry.id)).toEqual(['help-price-site', 'help-how-to-register', 'help-quest-offline', 'help-app-exists', 'help-article-moderation-time', 'help-article-language'])
    expect(needOwner.every((entry) => Boolean(entry.owner_question))).toBe(true)
    const approved = (entry: HelpEntry): HelpEntry => ({ ...entry, approved: true })
    expect(validateHelpCorpus({ ...corpus, entries: corpus.entries.map(approved) })).toEqual(needOwner.map((entry) => `help.ru.json ${entry.id}: утверждена запись с неподтверждённым фактом (needs_owner)`))
    expect(() => buildHelpChunks({ ...corpus, entries: corpus.entries.map(approved) })).toThrow('needs_owner')
    // Утверждена одна запись — в индекс идёт она одна, на всех пяти языках.
    const one = buildHelpChunks({ ...corpus, entries: corpus.entries.map((entry) => (entry.id === 'help-price-quests' ? approved(entry) : entry)) })
    expect(new Set(one.map((chunk) => chunk.source_id))).toEqual(new Set([1]))
    expect(new Set(one.map((chunk) => chunk.locale))).toEqual(new Set(HELP_LOCALES))
    expect(helpDraftsEnabled({})).toBe(false)
    expect(helpDraftsEnabled({ AI_INDEX_HELP_DRAFTS: '1' })).toBe(true)
    expect(helpDraftsEnabled({ AI_INDEX_HELP_DRAFTS: 'true' })).toBe(false)
  })

  it('фрагменты записи на одном языке — формулировки вопроса и ответ: вид help, страница сайта, ответ дословно', () => {
    const chunks = buildHelpChunks(corpus, { drafts: true })
    const questions = corpus.entries.reduce((sum, entry) => sum + HELP_LOCALES.reduce((count, locale) => count + localizedHelp(corpus, entry, locale).questions.length, 0), 0)
    const isAnswer = (chunk: { tags: string[] }) => chunk.tags.includes(HELP_ANSWER_TAG)
    expect(chunks.filter((chunk) => !isAnswer(chunk))).toHaveLength(questions)
    // Фрагмент ответа — один на запись и язык: по нему служба доранжирует записи (замер r2: lv41, lv90, lv91).
    expect(chunks.filter(isAnswer)).toHaveLength(corpus.entries.length * HELP_LOCALES.length)
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length)
    expect(countSources(chunks)).toEqual({ travel: 0, quest: 0, help: corpus.entries.length })
    const pl = chunks.find((chunk) => chunk.tags[0] === 'help-quest-offline' && chunk.locale === 'pl')!
    expect(pl).toMatchObject({ type: 'help', url: 'https://metravel.by/quests', city: null, country: null, lat: null, lng: null, cover: null, title: 'Czy podczas questu potrzebny jest internet?' })
    expect(pl.answer).toBe(corpus.translations.pl!.get('help-quest-offline')!.answer)
    expect(pl.text).toBe(`${pl.title}\n${pl.answer}`)
    expect(pl.id).toMatch(/^h13-pl-[0-9a-f]{16}$/)
    expect(pl.tags).toEqual(['help-quest-offline', 'квесты'])
    const plAnswer = chunks.find((chunk) => chunk.tags[0] === 'help-quest-offline' && chunk.locale === 'pl' && isAnswer(chunk))!
    expect(plAnswer).toMatchObject({ type: 'help', source_id: 13, url: pl.url, title: corpus.translations.pl!.get('help-quest-offline')!.questions[0], answer: pl.answer, text: pl.answer, tags: ['help-quest-offline', 'квесты', HELP_ANSWER_TAG] })
    // Запись «Нужно ли приложение, чтобы пройти квест?» (lv42) есть на всех пяти языках и не утверждена.
    const appNeeded = corpus.entries.find((entry) => entry.id === 'help-quest-app-needed')!
    expect(appNeeded).toMatchObject({ approved: false, needs_owner: false, topic: 'квесты', url: '/quests' })
    for (const locale of HELP_LOCALES) expect(localizedHelp(corpus, appNeeded, locale).answer).not.toBe(locale === 'ru' ? '' : appNeeded.answer)
    // Индекс без справки считает источники как раньше — поля `help` в манифесте нет.
    expect(countSources([{ type: 'travel', source_id: 1 }, { type: 'quest', source_id: 1 }])).toEqual({ travel: 1, quest: 1 })
  })

  it('ошибки корпуса называются: повтор номера, страница не путём, перевод записи, которой нет', () => {
    const [first, second] = corpus.entries
    expect(validateHelpCorpus({ entries: [first, { ...second, num: first.num, url: 'https://metravel.by/quests' }], translations: { en: new Map([['help-unknown', { id: 'help-unknown', questions: ['Q?'], answer: 'A' }]]) } })).toEqual([
      `help.ru.json ${second.id}: повтор num ${first.num}`,
      `help.ru.json ${second.id}: url — путь страницы сайта от корня`,
      'help.en.json help-unknown: записи нет в help.ru.json',
    ])
  })
})
