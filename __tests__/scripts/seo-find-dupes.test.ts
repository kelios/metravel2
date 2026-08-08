/**
 * Regression tests for scripts/seo-find-dupes.js
 *
 * The detector reported 43 of 306 articles as carrying duplicated text. Reading
 * the pairs one by one on 2026-08-08 showed every single one was a false alarm:
 *   - the schema.org FAQ block restates body facts on purpose (that is what
 *     FAQPage is for) and was being compared against the body;
 *   - route articles are built from template lines ("Пройдено 22 км (от A до B)",
 *     "По этой долине у нас уже есть отдельный маршрут: X") that share phrases by
 *     construction;
 *   - a lead and the story about the same place always share the place name, so
 *     "shared phrases OR overlap" fired on ordinary prose.
 * After tightening, the same corpus yields one finding — a genuinely repeated
 * sentence. These tests pin that behaviour.
 */

const {
  detect,
  stripFaqSection,
  PAIR_MIN_CHARS,
} = require('@/scripts/seo-find-dupes')

const para = (text: string) => `<p>${text}</p>`
const longText = (seed: string) => `${seed} ${'слово '.repeat(30)}`.trim()

describe('stripFaqSection', () => {
  it('removes the schema.org FAQ section', () => {
    const html = [
      para('Основной текст статьи.'),
      '<section class="seo-faq" data-faq="metravel-seo"><h2>Частые вопросы</h2>',
      para('Ответ, который повторяет факт из тела.'),
      '</section>',
      para('Хвост после FAQ.'),
    ].join('')

    const out = stripFaqSection(html)

    expect(out).toContain('Основной текст статьи.')
    expect(out).toContain('Хвост после FAQ.')
    expect(out).not.toContain('повторяет факт из тела')
  })

  it('removes the older plain FAQ — heading plus question paragraphs', () => {
    const html = [
      para('Основной текст статьи.'),
      '<h2>Частые вопросы: Витебск</h2>',
      para('<strong>Открыт ли дворец?</strong>С начала 2026 года дворец закрыт.'),
      '<h2>Что рядом</h2>',
      para('Соседний маршрут.'),
    ].join('')

    const out = stripFaqSection(html)

    expect(out).toContain('Основной текст статьи.')
    expect(out).toContain('Соседний маршрут.')
    expect(out).not.toContain('Открыт ли дворец')
  })

  it('leaves an article without FAQ untouched', () => {
    const html = para('Только текст.')
    expect(stripFaqSection(html)).toBe(html)
  })
})

describe('detect', () => {
  it('does not flag a FAQ answer that restates a body fact', () => {
    const fact =
      'С начала 2026 года дворец закрыт на масштабную реставрацию, экскурсии временно не проводятся, здание обнесено строительными лесами и подойти близко нельзя.'
    const html = [
      para(`Практика: ${fact}`),
      '<section data-faq="metravel-seo"><h2>Частые вопросы</h2>',
      para(`<strong>Открыт ли дворец?</strong>${fact}`),
      '</section>',
    ].join('')

    expect(detect({ description: html })).toEqual([])
  })

  it('does not flag short template lines that repeat by construction', () => {
    const html = [
      para('Пройдено 22 км (от Белого Прундника до Kościół pw. Świętego Jakuba, Więcławice Stare).'),
      para('Пройдено 20 км (от Kościół pw. Świętego Jakuba, Więcławice Stare до Golizny).'),
    ].join('')

    expect(html.length).toBeGreaterThan(0)
    expect(detect({ description: html })).toEqual([])
  })

  it('does not flag a lead and a story that merely share the place name', () => {
    const html = [
      para(longText('Жирмуны — деревня в Гродненской области Беларуси, где соседствуют костёл и усадьба.')),
      para(longText('В первый день путешествия мы отправились в Жирмуны смотреть руины дворцово-паркового ансамбля.')),
    ].join('')

    expect(detect({ description: html })).toEqual([])
  })

  it('still catches a literally repeated sentence', () => {
    const line = 'Билеты на паром мы покупали онлайн через сайт directferries.ru и распечатали заранее.'
    const html = [para(line), para(longText('Другой отрезок маршрута.')), para(line)].join('')

    const findings = detect({ description: html })

    expect(findings).toHaveLength(1)
    expect(findings[0].type).toBe('exact-dup')
  })

  it('still catches a genuinely restated paragraph in the body', () => {
    const base =
      'Ущелье открыли для туристов в 1893 году фотограф Бенедикт Лергетпорер и картограф Якоб Жумер: они пробили маршрут сквозь каньон и проложили более 500 метров деревянных мостков вдоль отвесных стен.'
    const restated =
      'Ущелье открыли для туристов в 1893 году фотограф Бенедикт Лергетпорер и картограф Якоб Жумер, они пробили маршрут сквозь каньон и проложили более 500 метров мостков вдоль отвесных стен ущелья.'
    const html = [para(base), para(longText('Промежуточный абзац про дорогу.')), para(restated)].join('')

    const findings = detect({ description: html })

    expect(findings.length).toBeGreaterThan(0)
    expect(['near-dup', 'body-repeat', 'double-lead']).toContain(findings[0].type)
  })

  it('pairs only paragraphs long enough to carry a thought', () => {
    expect(PAIR_MIN_CHARS).toBeGreaterThanOrEqual(120)
  })
})
