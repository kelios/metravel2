import fs from 'fs'
import path from 'path'

import {
  buildQuestChunks,
  buildTravelChunks,
  chunkText,
  decodeEntities,
  htmlToText,
  isPublishedTravel,
  splitSentences,
  type RawQuest,
  type RawTravel,
} from '@/scripts/ai-index/chunk'

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'ai-index', 'raw')
const readTravel = (id: number): RawTravel =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'travels', `${id}.json`), 'utf8'))
const readQuest = (name: string): RawQuest =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'quests', `${name}.json`), 'utf8'))

describe('ai-index chunk: HTML → текст', () => {
  it('убирает теги, декодирует сущности и держит блоки на отдельных строках', () => {
    const html =
      '<h2>Заголовок</h2><p>Первый&nbsp;абзац &laquo;в кавычках&raquo; &amp; с <strong>жирным</strong>.</p>' +
      '<ul><li>пункт один</li><li>пункт&#160;два</li></ul><script>alert(1)</script><iframe src="x"></iframe>' +
      '<details><summary>Свернуть</summary><p>Скрытый текст</p></details><br>хвост'
    expect(htmlToText(html)).toBe(
      'Заголовок\nПервый абзац «в кавычках» & с жирным .\nпункт один\nпункт два\nСвернуть\nСкрытый текст\nхвост',
    )
  })

  it('пустой/отсутствующий HTML даёт пустую строку', () => {
    expect(htmlToText(null)).toBe('')
    expect(htmlToText('<p></p><div>  </div>')).toBe('')
  })

  it('decodeEntities понимает числовые и именованные сущности', () => {
    expect(decodeEntities('&#1057;&#x43F;&mdash;&hellip;&unknown;')).toBe('Сп—…&unknown;')
    expect(decodeEntities('a&#99999999;b&#x110000;')).toBe('a&#99999999;b&#x110000;')
  })
})

describe('ai-index chunk: предложения и окна', () => {
  it('делит по концам предложений только перед заглавной буквой или цифрой', () => {
    expect(splitSentences('Мы вышли в 7.30 утра. Дорога заняла 2 ч! А потом? Потом был дождь… И т.д. не делится')).toEqual([
      'Мы вышли в 7.30 утра.',
      'Дорога заняла 2 ч!',
      'А потом?',
      'Потом был дождь…',
      'И т.д. не делится',
    ])
  })

  it('окна не длиннее size, начинаются с границы предложения и перекрываются хвостом предыдущего', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Предложение номер ${i + 1} про дорогу и горы.`)
    const text = sentences.join(' ')
    const chunks = chunkText(text, { size: 200, overlap: 60 })
    expect(chunks.length).toBeGreaterThan(5)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200)
      expect(chunk.startsWith('Предложение номер')).toBe(true)
      expect(chunk.endsWith('.')).toBe(true)
    }
    for (let i = 1; i < chunks.length; i += 1) {
      const previous = chunks[i - 1]
      const current = chunks[i]
      // Перекрытие — самый длинный хвост предыдущего окна, с которого начинается текущее.
      let overlap = 0
      for (let length = Math.min(previous.length, current.length); length > 0; length -= 1) {
        if (previous.endsWith(current.slice(0, length))) {
          overlap = length
          break
        }
      }
      expect(overlap).toBeGreaterThanOrEqual(60)
      expect(overlap).toBeLessThanOrEqual(100)
      expect(current.slice(0, overlap)).toMatch(/^Предложение номер \d+ про дорогу и горы\.( Предложение номер \d+ про дорогу и горы\.)*$/)
    }
    // Все предложения попали хотя бы в одно окно.
    for (const sentence of sentences) expect(chunks.some((chunk) => chunk.includes(sentence))).toBe(true)
  })

  it('слишком длинное предложение режется по словам, короткий текст — одно окно', () => {
    const long = Array.from({ length: 120 }, (_, i) => `слово${i}`).join(' ')
    const chunks = chunkText(long, { size: 300, overlap: 50 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300)
      expect(chunk).not.toMatch(/^\s|\s$/)
    }
    expect(chunkText('Коротко. Ясно.', { size: 800, overlap: 100 })).toEqual(['Коротко. Ясно.'])
    // Хвост перекрытия не раздувает окно, если за ним идёт длинное предложение.
    const longSentence = `${'Длинное '.repeat(30).trim()}.`
    const withLong = chunkText(`Начало пути и первые впечатления. Короткое вступление про дорогу. ${longSentence}`, {
      size: 250,
      overlap: 60,
    })
    expect(withLong).toEqual(['Начало пути и первые впечатления. Короткое вступление про дорогу.', longSentence])
    expect(chunkText('')).toEqual([])
  })
})

describe('ai-index chunk: записи статьи', () => {
  it('статья даёт фрагменты с метаданными, URL и стабильными id', () => {
    const raw = readTravel(816)
    const first = buildTravelChunks(raw)
    const second = buildTravelChunks(raw)
    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(2)
    const record = first[0]
    expect(record).toMatchObject({
      type: 'travel',
      source_id: 816,
      url: `https://metravel.by/travels/${raw.slug}`,
      title: raw.title,
      country: 'Польша',
      locale: 'ru',
      month: [11, 12],
    })
    expect(record.id).toMatch(/^t816-ru-[0-9a-f]{16}$/)
    expect(record.lat).toBeCloseTo(51.11, 1)
    expect(record.lng).toBeCloseTo(17.03, 1)
    expect(record.tags).toEqual(['category:19', 'category:14'])
    expect(new Set(first.map((chunk) => chunk.id)).size).toBe(first.length)
    for (const chunk of first) {
      expect(chunk.text.length).toBeLessThanOrEqual(800)
      expect(chunk.text).not.toMatch(/<[a-z]+/)
    }
  })

  it('плюсы/минусы/рекомендации попадают в текст, а словарь категорий даёт имена тегов', () => {
    const raw = readTravel(791)
    const categoryNames = Object.fromEntries((raw.categories ?? []).map((id) => [String(id), `Категория ${id}`]))
    const chunks = buildTravelChunks(raw, { categoryNames })
    expect(chunks[0].tags).toEqual((raw.categories ?? []).map((id) => `Категория ${id}`))
    const joined = chunks.map((chunk) => chunk.text).join('\n')
    expect(joined).toContain('Плюсы:')
    expect(joined).toContain('Рекомендации:')
    for (const chunk of chunks) for (const tag of chunk.tags) expect(tag).not.toMatch(/^category:/)
  })

  it('фильтр публикации пропускает только publish && moderation', () => {
    const list = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'travels-list.json'), 'utf8')) as Array<{ id: number }>
    expect(list.filter(isPublishedTravel).map((item) => item.id)).toEqual([816, 791, 761])
    expect(isPublishedTravel({ publish: 1, moderation: true })).toBe(false)
    expect(isPublishedTravel({ publish: true })).toBe(false)
  })
})

describe('ai-index chunk: записи квеста', () => {
  it('квест в локали даёт локализованный URL, content_locale и теги', () => {
    const ru = buildQuestChunks(readQuest('1.ru'))
    const pl = buildQuestChunks(readQuest('1.pl'))
    expect(ru[0]).toMatchObject({
      type: 'quest',
      source_id: 1,
      locale: 'ru',
      url: 'https://metravel.by/quests/1/krakow-dragon',
      city: 'Краков',
      country: 'Польша',
      month: [],
    })
    expect(pl[0]).toMatchObject({ locale: 'pl', url: 'https://metravel.by/pl/quests/1/krakow-dragon' })
    expect(ru[0].id).toMatch(/^q1-ru-/)
    expect(pl[0].id).toMatch(/^q1-pl-/)
    expect(ru[0].tags).toEqual(expect.arrayContaining(['legend', 'history']))
    expect(ru[0].lat).toBeCloseTo(50.06, 1)
    const joined = ru.map((chunk) => chunk.text).join('\n')
    expect(joined).toContain('Флорианские ворота')
    expect(joined).not.toContain('<p>')
  })

  it('неизвестная локаль ведёт на RU-страницу, без city.id — на каталог /quests', () => {
    const raw = readQuest('2.ru')
    const de = buildQuestChunks({ ...raw, content_locale: 'de' })
    expect(de[0].url).toBe(`https://metravel.by/quests/${raw.city?.id}/${raw.quest_id}`)
    expect(de[0].locale).toBe('de')
    expect(buildQuestChunks({ ...raw, city: null })[0].url).toBe('https://metravel.by/quests')
  })
})
