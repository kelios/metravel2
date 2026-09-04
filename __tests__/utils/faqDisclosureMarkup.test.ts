import { countFaqDisclosureBlocks } from '@/utils/faqDisclosureMarkup'

describe('countFaqDisclosureBlocks', () => {
  it('считает пары details/summary', () => {
    const html =
      '<details><summary>Q1</summary><p>A1</p></details>' +
      '<details><summary>Q2</summary><p>A2</p></details>'
    expect(countFaqDisclosureBlocks(html)).toBe(2)
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
    expect(countFaqDisclosureBlocks('<details><summary>Q</summary></details><details></details>')).toBe(1)
  })

  it('на пустом и отсутствующем значении даёт ноль', () => {
    expect(countFaqDisclosureBlocks('')).toBe(0)
    expect(countFaqDisclosureBlocks(null)).toBe(0)
    expect(countFaqDisclosureBlocks(undefined)).toBe(0)
    expect(countFaqDisclosureBlocks('<p>обычный текст</p>')).toBe(0)
  })
})
