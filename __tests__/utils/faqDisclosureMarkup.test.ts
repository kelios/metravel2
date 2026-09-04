import {
  FAQ_SECTION_OPEN_TAG,
  countFaqDisclosureBlocks,
  countFaqSectionWrappers,
  extractFaqMarkup,
  losesFaqMarkup,
  restoreFaqMarkupIfLost,
} from '@/utils/faqDisclosureMarkup'

const FAQ_SECTION = (inner: string) =>
  `<section class="seo-faq" data-faq="metravel-seo" itemscope itemtype="https://schema.org/FAQPage">${inner}</section>`

const QA = '<details><summary>Q</summary><p>A</p></details>'

describe('countFaqDisclosureBlocks', () => {
  it('считает пары details/summary', () => {
    expect(countFaqDisclosureBlocks(QA + QA)).toBe(2)
  })

  it('не считает атрибуты и регистр помехой', () => {
    const html = '<DETAILS itemprop="mainEntity" open><Summary itemprop="name">Q</Summary></DETAILS>'
    expect(countFaqDisclosureBlocks(html)).toBe(1)
  })

  // Вопрос без `<summary>` не попадает в FAQPage (`extractFaqEntries` пропускает
  // такой блок), поэтому и потерей его исчезновение считаться не должно: иначе
  // гейт записи блокировал бы сохранение из-за разметки, которая всё равно
  // ничего не даёт выдаче.
  it('берёт минимум, а не число одних только details', () => {
    expect(countFaqDisclosureBlocks('<details><p>без summary</p></details>')).toBe(0)
    expect(countFaqDisclosureBlocks(QA + '<details></details>')).toBe(1)
  })

  it('на пустом и отсутствующем значении даёт ноль', () => {
    expect(countFaqDisclosureBlocks('')).toBe(0)
    expect(countFaqDisclosureBlocks(null)).toBe(0)
    expect(countFaqDisclosureBlocks(undefined)).toBe(0)
    expect(countFaqDisclosureBlocks('<p>обычный текст</p>')).toBe(0)
  })
})

describe('countFaqSectionWrappers', () => {
  it('считает секцию и по class, и по data-faq', () => {
    expect(countFaqSectionWrappers(FAQ_SECTION(QA))).toBe(1)
    expect(countFaqSectionWrappers('<section data-faq="metravel-seo">x</section>')).toBe(1)
    expect(countFaqSectionWrappers('<section class="hero seo-faq wide">x</section>')).toBe(1)
  })

  it('не считает посторонние секции', () => {
    expect(countFaqSectionWrappers('<section class="gallery">x</section>')).toBe(0)
    expect(countFaqSectionWrappers('<p>текст</p>')).toBe(0)
  })

  // Определение секции живёт в генераторе — он единственный решает, что уйдёт в
  // FAQPage. Копия в приложении существует только потому, что генератор
  // CJS-скрипт сборки и в бандл не импортируется; разъехаться копиям нельзя.
  it('совпадает с определением генератора', () => {
    const generator = require('../../scripts/generate-seo-pages')
    expect(FAQ_SECTION_OPEN_TAG).toBe(generator.FAQ_SECTION_OPEN_TAG)
  })
})

describe('losesFaqMarkup', () => {
  it('видит потерю пар details/summary', () => {
    expect(losesFaqMarkup(FAQ_SECTION(QA), FAQ_SECTION('<strong>Q</strong><p>A</p>'))).toBe(true)
  })

  // Ровно та дыра, из-за которой счёта одних `<details>` мало: микроразметку
  // `itemprop="mainEntity"` санитайзер снимает всегда, поэтому без обёртки
  // генератор перестаёт узнавать в блоке FAQ — при неизменном числе пар.
  it('видит потерю секции-обёртки при уцелевших details', () => {
    expect(losesFaqMarkup(FAQ_SECTION(QA), QA)).toBe(true)
  })

  it('молчит, когда разметка на месте', () => {
    expect(losesFaqMarkup(FAQ_SECTION(QA), FAQ_SECTION(QA))).toBe(false)
    expect(losesFaqMarkup('<p>текст</p>', '<p>текст</p>')).toBe(false)
  })

  it('молчит, когда разметки не было вовсе', () => {
    expect(losesFaqMarkup('<p>было</p>', '<p>стало</p>')).toBe(false)
  })
})

describe('restoreFaqMarkupIfLost', () => {
  it('возвращает FAQ-секцию, если Quill схлопнул details в плоский текст', () => {
    const source = `<p>Лид статьи</p>${FAQ_SECTION(QA)}`
    const fromQuill = '<p>Лид статьи</p><p>Q</p><p>A</p>'
    const restored = restoreFaqMarkupIfLost(source, fromQuill)
    expect(losesFaqMarkup(source, restored)).toBe(false)
    expect(extractFaqMarkup(restored)).toContain('<details>')
    expect(restored).toContain('Лид статьи')
  })

  it('не дублирует блок, если разметка на месте', () => {
    const source = `<p>Лид</p>${FAQ_SECTION(QA)}`
    expect(restoreFaqMarkupIfLost(source, source)).toBe(source)
  })
})
