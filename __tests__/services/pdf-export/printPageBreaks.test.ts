// __tests__/services/pdf-export/printPageBreaks.test.ts
// #303 BOOK-Q5: разрывы страниц и обрезка контента при печати.
// 1) высокие/портретные фото на контент-страницах не кропаются (contain, без cover
//    и без overflow:hidden на фигурах);
// 2) смысловые блоки (plus/minus/recommendation, info-блоки, пункты списков)
//    получают break-inside: avoid, но контейнеры остаются разрываемыми, чтобы не
//    плодить пустые страницы.

import { buildPdfHtmlDocument } from '@/services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument'
import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { PDF_THEMES, minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'

function renderDocumentCss(): string {
  return buildPdfHtmlDocument({
    pages: ['<section class="pdf-page travel-content-page"></section>'],
    settings: { title: 'Test' } as never,
    theme: PDF_THEMES.light,
    isPremium: true,
    escapeHtml: (v) => String(v ?? ''),
  })
}

/** Возвращает тело CSS-правила по селектору (между `{` и `}`). */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS-правило не найдено: ${selector}`)
  return match[1]
}

describe('#303 BOOK-Q5: контент-фото печатается contain, без cover-кропа', () => {
  const html = renderDocumentCss()

  it('строчные ряды/сетки фото описания используют object-fit: contain, не cover', () => {
    expect(ruleBody(html, '.img-row-2 img')).toContain('object-fit: contain')
    expect(ruleBody(html, '.img-grid img')).toContain('object-fit: contain')
    expect(ruleBody(html, '.img-row-2 img')).not.toContain('object-fit: cover')
    expect(ruleBody(html, '.img-grid img')).not.toContain('object-fit: cover')
  })

  it('контент-фото масштабируется под печатную высоту и не кропается object-fit: cover', () => {
    const body = ruleBody(html, '.travel-content-page img')
    expect(body).toContain('object-fit: contain')
    expect(body).toContain('max-height: calc(297mm - 12mm)')
    expect(body).not.toContain('object-fit: cover')
  })

  it('фигуры контент-страницы не обрезают высокое фото через overflow: hidden', () => {
    const re =
      /\.travel-content-page figure,[\s\S]*?\.travel-content-page \.img-float-left\s*\{([^}]*)\}/
    const match = html.match(re)
    expect(match).toBeTruthy()
    const body = match?.[1] ?? ''
    expect(body).not.toContain('overflow: hidden')
    expect(body).toContain('max-height: calc(297mm - 12mm)')
  })
})

describe('#303 BOOK-Q5: смысловые блоки не рвутся уродливо, но контейнеры разрываемы', () => {
  const renderer = new BlockRenderer(minimalTheme)

  it('info/warning/tip/danger-блок получает break-inside: avoid', () => {
    const html = renderer.renderBlocks([
      { type: 'tip-block', title: 'Совет', content: 'Берите термос' } as never,
    ])
    expect(html).toContain('break-inside: avoid')
    expect(html).toContain('page-break-inside: avoid')
  })

  it('пункты списка (plus/minus) атомарны: break-inside: avoid на каждом li', () => {
    const html = renderer.renderBlocks([
      { type: 'list', ordered: false, items: ['Тихо', 'Красиво', 'Бесплатно'] } as never,
    ])
    const liAvoid = (html.match(/break-inside: avoid/g) || []).length
    expect(liAvoid).toBeGreaterThanOrEqual(3)
  })

  it('сам список остаётся разрываемым (break-inside: auto), чтобы длинный список не плодил пустые страницы', () => {
    const html = renderer.renderBlocks([
      { type: 'list', ordered: false, items: ['a', 'b'] } as never,
    ])
    expect(html).toMatch(/<ul[\s\S]*?break-inside: auto/)
    expect(html).toMatch(/<ul[\s\S]*?page-break-inside: auto/)
  })
})
