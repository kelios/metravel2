import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'
import { buildPdfHtmlDocument } from '@/services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument'

const text = 'Рассказ о поездке сохраняет достаточно подробностей, чтобы несколько строк могли обтекать фотографию.'
const paragraph = `<p><a href="https://example.org/route">${text}</a></p>`
const photo = (side: string, shape: string): string => shape === 'figure'
  ? `<figure class="img-float-${side}"><img src="https://example.org/photo.jpg" width="600" height="900" alt="Портрет"><figcaption>Подпись</figcaption></figure>`
  : `<p class="img-float-${side}"><img src="https://example.org/photo.jpg" width="600" height="900" alt="Портрет"></p>`

describe('book render-only photo/text flow', () => {
  it.each(['left', 'right'].flatMap((side) => ['p', 'figure'].map((shape) => [side, shape])))('%s/%s: wraps preceding text, preserving source and semantic heading', (side, shape) => {
    const source = `<h2>Раздел</h2>${paragraph}${photo(side, shape)}<h2>Следующий раздел</h2>`
    const html = new BlockRenderer(minimalTheme).renderRichText(source, 'description')
    const body = new DOMParser().parseFromString(html, 'text/html').body
    const pair = body.querySelector('.pdf-photo-text-flow')!
    expect(pair).not.toBeNull()
    expect(pair.children[0].tagName).toBe('FIGURE')
    expect(pair.children[1].tagName).toBe('P')
    expect(pair.querySelector('figure')?.getAttribute('data-layout')).toBe(`float-${side}`)
    expect(pair.querySelector('a')?.getAttribute('href')).toBe('https://example.org/route')
    expect(pair.querySelector('p')?.textContent).toBe(text)
    expect(pair.querySelector('img:not([aria-hidden])')?.getAttribute('alt')).toBe('Портрет')
    expect(body.querySelectorAll('figure')).toHaveLength(1)
    expect(body.querySelectorAll('a')).toHaveLength(1)
    expect(pair.nextElementSibling?.textContent).toBe('Следующий раздел')
    if (shape === 'figure') expect(pair.querySelector('figcaption')?.textContent).toBe('Подпись')
    expect(source).toBe(`<h2>Раздел</h2>${paragraph}${photo(side, shape)}<h2>Следующий раздел</h2>`)
  })

  it('keeps long paragraph text fragmentable and the complete image with its following text', () => {
    const source = `<p>${text.repeat(150)}</p>${photo('right', 'p')}`
    const html = new BlockRenderer(minimalTheme).renderRichText(source, 'description')
    const pair = new DOMParser().parseFromString(html, 'text/html').querySelector('.pdf-photo-text-flow')!
    expect(pair.querySelector('p')?.textContent).toBe(text.repeat(150))
    expect(pair.querySelector('p')?.getAttribute('style')).toContain('break-inside: auto;')
    expect(pair.querySelector('figure')?.getAttribute('style')).toContain('break-after: avoid-page;')
    expect(pair.querySelector('img:not([aria-hidden])')?.getAttribute('style')).toContain('object-fit: contain;')
    expect(pair.getAttribute('style')).toContain('break-inside: auto;')
    expect(pair.getAttribute('style')).not.toMatch(/break-inside:\s*avoid/)
    expect(pair.getAttribute('style')).not.toContain('overflow: hidden')
  })

  it('does not alter existing forward ownership or steal text in interleaved source', () => {
    const html = new BlockRenderer(minimalTheme).renderRichText(
      `${paragraph}${photo('left', 'p')}${paragraph}${photo('right', 'p')}<h2>Конец</h2>`, 'description'
    )
    const body = new DOMParser().parseFromString(html, 'text/html').body
    expect(body.querySelector('.pdf-photo-text-flow')).toBeNull()
    expect(Array.from(body.children).map((element) => element.tagName)).toEqual(['P', 'FIGURE', 'P', 'FIGURE', 'H3'])
    expect(body.querySelectorAll('a')).toHaveLength(2)
  })

  it('retains the next semantic section clearing and image fallback pipeline', () => {
    const addressImage = 'https://metravel.by/address-image/15057/conversions/4cd326b470a94f6690c7ead794bbf320.webp'
    const firstPartyPhoto = photo('right', 'p').replace('https://example.org/photo.jpg', addressImage)
    const rendered = new BlockRenderer(minimalTheme).renderRichText(`${paragraph}${firstPartyPhoto}<h2>Конец</h2>`, 'description')
    const document = buildPdfHtmlDocument({ pages: [rendered], theme: minimalTheme, settings: { title: 'Book' } as never, escapeHtml: String })
    expect(document).toMatch(/\.travel-content-page \.description-block > h2,[\s\S]*?clear: both;/)
    expect(document).toContain('data-print-fallback=')
    expect(document).toContain('onerror=')
  })
})
