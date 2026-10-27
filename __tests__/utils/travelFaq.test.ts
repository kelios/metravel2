import { buildTravelFaqJsonLd, extractFaqEntries } from '@/utils/travelFaq'

describe('shared travel FAQ structured data', () => {
  it('extracts the editorial FAQ block and excludes unrelated details', () => {
    const html = '<details><summary>Navigation</summary><p>Hidden menu</p></details>' +
      '<section class="seo-faq"><details><summary>Как добраться?</summary><p>На <b>поезде</b>.</p></details></section>'
    expect(extractFaqEntries(html)).toEqual([{ question: 'Как добраться?', answer: 'На поезде.' }])
    expect(buildTravelFaqJsonLd(html)).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ name: 'Как добраться?', acceptedAnswer: { text: 'На поезде.' } }],
    })
  })

  it('omits empty/unmarked answers and supports legacy microdata', () => {
    expect(buildTravelFaqJsonLd('<details><summary>Menu</summary>Item</details>')).toBeNull()
    expect(extractFaqEntries('<details itemprop="mainEntity"><summary>Где?</summary><p>Здесь.</p></details>'))
      .toEqual([{ question: 'Где?', answer: 'Здесь.' }])
  })
})
