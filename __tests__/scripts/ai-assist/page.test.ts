import { bestPageRows, focusFragment, joinPageFragments, pageRows } from '@/scripts/ai-assist/page'
import { writeIndex } from '@/scripts/ai-index/format'

import { makeTempDir } from '../cli-test-utils'
import { DIM, fixtureChunks, loadFixtureIndex, MODEL, type Spec } from './fixture'

// #3290: режим страницы — поиск внутри фрагментов источника и окно текста под вопрос.

const PAGE: Spec[] = [
  { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'рождественские ярмарки краков вроцлав гданьск', city: 'Краков' },
  { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'сколько дней занимает поездка на ярмарки', city: 'Краков' },
  { type: 'travel', sourceId: 700, title: 'Сосед', text: 'сколько дней занимает поездка', city: 'Люксембург' },
  { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'что взять с собой термос обувь', city: 'Краков' },
  { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'глинтвейн пряники игрушки', city: 'Краков' },
  { type: 'quest', sourceId: 1, locale: 'ru', title: 'Квест по Гродно', text: 'квест гродно замок', city: 'Гродно' },
  { type: 'quest', sourceId: 1, locale: 'pl', title: 'Quest po Grodnie', text: 'quest grodno zamek', city: 'Grodno' },
  { type: 'quest', sourceId: 1, locale: 'pl', title: 'Quest po Grodnie', text: 'kościół farny zadanie', city: 'Grodno' },
]

/** Вектор строки `row` — её орт: балл строки под запрос равен координате запроса с её номером. */
const oneHot = (row: number): Float32Array => Float32Array.from({ length: DIM }, (_, i) => (i === row ? 1 : 0))

describe('metravel-assist: режим страницы (#3290)', () => {
  const distDir = makeTempDir('ai-assist-page-')
  const chunks = fixtureChunks(PAGE)
  writeIndex(distDir, { model: MODEL, dim: DIM, chunks, vectors: chunks.map((_, row) => oneHot(row)) })
  const index = loadFixtureIndex(distDir)

  it('строки страницы — на локали запроса; источника на ней нет — строки его первой локали; чужого источника нет', () => {
    expect(pageRows(index, 'travel:816', 'ru')).toEqual([0, 1, 3, 4])
    expect(pageRows(index, 'travel:816', 'pl')).toEqual([0, 1, 3, 4])
    expect(pageRows(index, 'quest:1', 'pl')).toEqual([6, 7])
    expect(pageRows(index, 'quest:1', 'en')).toEqual([5])
    expect(pageRows(index, 'travel:999', 'ru')).toEqual([])
  })

  it('лучшие под вопрос фрагменты берутся только из строк страницы и идут в порядке её текста', () => {
    const rows = pageRows(index, 'travel:816', 'ru')
    // Ближе всех к запросу сосед (строка 2), затем строки страницы 3, 1, 4 и 0.
    const vector = Float32Array.from([0.1, 0.6, 0.9, 0.7, 0.2, 0, 0, 0])
    expect(bestPageRows(index, rows, vector, 2)).toEqual([1, 3])
    expect(bestPageRows(index, rows, vector, 3)).toEqual([1, 3, 4])
    // Сосед в выбор не попадает при любом числе фрагментов: ищем внутри страницы.
    expect(bestPageRows(index, rows, vector, 10)).toEqual(rows)
    expect(bestPageRows(index, rows, vector, 0)).toEqual([])
  })

  it('окно фрагмента начинается с предложения со словами вопроса и не длиннее предела', () => {
    const text = [
      'Мы приехали поздно вечером и сразу пошли на рынок.',
      'Огни горели до полуночи.',
      'С собой стоит взять термос, тёплую обувь и наличные злотые.',
      'Парковка у старого города платная.',
      'Назад возвращались поездом.',
    ].join(' ')
    const window = focusFragment(text, 'Что взять с собой на ярмарки?', 110)
    expect(window.startsWith('… С собой стоит взять термос')).toBe(true)
    expect(window).toContain('Парковка у старого города платная.')
    expect(window.endsWith(' …')).toBe(true)
    expect(window.replace(/^… | …$/g, '').length).toBeLessThanOrEqual(110)
    // Слов вопроса во фрагменте нет — окно с его начала; короткий фрагмент идёт целиком.
    expect(focusFragment(text, 'zamek kraków', 80).startsWith('Мы приехали поздно вечером')).toBe(true)
    expect(focusFragment('Короткий   текст.', 'вопрос', 400)).toBe('Короткий текст.')
    // Окно дошло до конца фрагмента — многоточия в конце нет.
    expect(focusFragment(text, 'Как возвращались назад поездом?', 60)).toBe('… Назад возвращались поездом.')
    // Одно предложение длиннее окна режется по слову.
    const long = `Вступление. ${'очень длинное предложение про парковку '.repeat(8)}.`
    const cut = focusFragment(long, 'парковка', 60)
    expect(cut.startsWith('… очень длинное предложение')).toBe(true)
    expect(cut.length).toBeLessThanOrEqual(64)
  })

  it('фрагменты склеиваются одной строкой карточки с границами «…»', () => {
    expect(joinPageFragments(['Начало статьи. …', '… середина, где ответ. …', '', '… конец.'])).toBe('Начало статьи. … середина, где ответ. … конец.')
    expect(joinPageFragments([])).toBe('')
  })
})
