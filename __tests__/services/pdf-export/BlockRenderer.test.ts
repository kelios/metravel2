import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { PDF_THEME_HEADING_LEVELS } from '@/services/pdf-export/themes/headingLevels'
import { PDF_THEMES, minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'

describe('BlockRenderer', () => {
  it('keeps blob URLs for image blocks', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderBlocks([
      { type: 'image', src: 'blob:local-image', alt: 'blob' } as any,
    ])

    expect(html).toContain('src="blob:local-image"')
  })

  it('keeps the heading hierarchy of the description instead of flattening it to h4', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderRichText(`
      <h2>Что находится внутри</h2>
      <h3>Замковая кухня</h3>
      <h2>Частые вопросы о замке Мальборк</h2>
      <details><summary><strong>Сколько времени нужно на осмотр?</strong></summary><p>Минимум четыре часа.</p></details>
    `)

    // Разделы статьи (h2) — крупнее подразделов и вопросов FAQ, но мельче секций книги (h2 темы).
    expect(html).toMatch(/<h3[^>]*>Что находится внутри<\/h3>/)
    expect(html).toMatch(/<h3[^>]*>Частые вопросы о замке Мальборк<\/h3>/)
    expect(html).toMatch(/<h4[^>]*>Замковая кухня<\/h4>/)
    expect(html).toMatch(/<h4[^>]*>Сколько времени нужно на осмотр\?<\/h4>/)
    expect(html).not.toContain('<h5')
  })

  it('does not double proxy weserv URLs', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const proxied = 'https://images.weserv.nl/?url=example.com/photo.jpg&w=1600&fit=inside'
    const html = renderer.renderBlocks([{ type: 'image', src: proxied } as any])

    expect(html).toContain('images.weserv.nl/?url=example.com/photo.jpg')
  })

  it('renders editorial mixed pair layout for print', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderBlocks([
      {
        type: 'image-gallery',
        layout: 'pair-mixed',
        columns: 2,
        images: [
          { src: 'wide.jpg', width: 1200, height: 700 },
          { src: 'tall.jpg', width: 700, height: 1200 },
        ],
      } as any,
    ])

    expect(html).toContain('grid-template-columns: 0.92fr 1.08fr')
    expect(html).toContain('transform: translateY(2mm)')
    expect(html).toContain('transform: translateY(-2mm)')
  })

  it('renders editorial grid layouts with dominant spans for print', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderBlocks([
      {
        type: 'image-gallery',
        layout: 'editorial-grid',
        columns: 3,
        images: [
          { src: '1.jpg', width: 1200, height: 700 },
          { src: '2.jpg', width: 900, height: 700 },
          { src: '3.jpg', width: 900, height: 700 },
        ],
      } as any,
      {
        type: 'image-gallery',
        layout: 'quilt-4',
        columns: 6,
        images: [
          { src: '4.jpg', width: 1200, height: 700 },
          { src: '5.jpg', width: 900, height: 700 },
          { src: '6.jpg', width: 900, height: 700 },
          { src: '7.jpg', width: 1200, height: 700 },
        ],
      } as any,
    ])

    expect(html).toContain('grid-template-columns: repeat(3, 1fr)')
    expect(html).toContain('grid-column: span 2')
    expect(html).toContain('grid-column: span 4')
    expect(html).toContain('filter: blur(18px) saturate(1.06)')
  })

  it('keeps five-image editorial groups on the same pdf page without splitting them apart', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderBlocks([
      {
        type: 'image-gallery',
        layout: 'editorial-grid',
        columns: 3,
        images: [
          { src: '1.jpg', width: 1200, height: 700 },
          { src: '2.jpg', width: 700, height: 1100 },
          { src: '3.jpg', width: 900, height: 700 },
          { src: '4.jpg', width: 900, height: 700 },
          { src: '5.jpg', width: 900, height: 700 },
        ],
      } as any,
    ])

    expect(html).toContain('grid-template-columns: repeat(3, 1fr)')
    expect(html).toContain('page-break-inside: avoid;')
    expect(html).toContain('break-inside: avoid;')
    expect((html.match(/padding: 2.5mm/g) || []).length).toBe(5)
  })

  it('renders one float figure with preserved dimensions, alt and escaped caption', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderRichText(`
      <p>Вступление.</p>
      <figure class="img-float-right figure-portrait">
        <img src="portrait.jpg" alt="Фото &quot;справа&quot;" width="640" height="960" />
        <figcaption>Подпись &lt;важная&gt;</figcaption>
      </figure>
      <p>Этот абзац должен обтекать фотографию.</p>
    `)

    expect((html.match(/<figure/g) || []).length).toBe(1)
    expect(html).toContain('class="pdf-rich-image img-float-right"')
    expect(html).toContain('data-layout="float-right"')
    expect(html).toContain('data-width="640"')
    expect(html).toContain('data-height="960"')
    expect(html).toContain('width="640"')
    expect(html).toContain('height="960"')
    expect(html).toContain('max-height: 220mm')
    expect(html).toContain('alt="Фото &quot;справа&quot;"')
    expect(html).toContain('Подпись &lt;важная&gt;')
    expect(html).not.toContain('<важная>')
  })

  it('keeps an explicitly assigned left float while rebuilding rich-text image layout', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderRichText(
      '<p class="img-float-left figure-portrait"><img src="left.jpg" width="600" height="900"></p><p>Текст рядом.</p>'
    )

    expect(html).toContain('class="pdf-rich-image img-float-left"')
    expect(html).toContain('float: left')
    expect(html).not.toContain('class="pdf-rich-image img-float-right"')
  })

  // #2210: разметка описаний допускает h1–h6, темы описывают стиль только части
  // уровней. Заголовок без своего стиля печатается самым мелким описанным — и
  // тегом, и стилем, — а не роняет сборку книги на `undefined`.
  describe('уровни заголовков', () => {
    const themes = Object.entries(PDF_THEMES)
    const renderHeading = (renderer: BlockRenderer, level: 1 | 2 | 3 | 4 | 5 | 6) =>
      renderer.renderBlocks([{ type: 'heading', level, text: 'Заголовок' }])

    it.each(themes)('тема %s: h1–h4 печатаются своим тегом и своим стилем', (_name, theme) => {
      const renderer = new BlockRenderer(theme)

      for (const level of PDF_THEME_HEADING_LEVELS) {
        const style = theme.typography[`h${level}` as const]
        const html = renderHeading(renderer, level)

        expect(html).toMatch(new RegExp(`<h${level} style="[^"]*">Заголовок</h${level}>`))
        expect(html).toContain(`font-size: ${style.size};`)
        expect(html).toContain(`font-weight: ${style.weight};`)
        expect(html).toContain(`line-height: ${style.lineHeight};`)
        expect(html).toContain(`margin-bottom: ${style.marginBottom};`)
      }
    })

    it.each(themes)('тема %s: h5 и h6 печатаются тегом и стилем h4', (_name, theme) => {
      const renderer = new BlockRenderer(theme)
      const asFourth = renderHeading(renderer, 4)

      expect(renderHeading(renderer, 5)).toBe(asFourth)
      expect(renderHeading(renderer, 6)).toBe(asFourth)
    })

    it('описание: понижение уровней прежнее, h5 и h6 печатаются как h4', () => {
      const renderer = new BlockRenderer(minimalTheme)
      const html = renderer.renderRichText(
        '<h1>Первый</h1><h2>Второй</h2><h3>Третий</h3><h4>Четвёртый</h4><h5>Пятый</h5><h6>Шестой</h6>'
      )

      expect(html).toMatch(/<h3[^>]*>Первый<\/h3>/)
      expect(html).toMatch(/<h3[^>]*>Второй<\/h3>/)
      expect(html).toMatch(/<h4[^>]*>Третий<\/h4>/)
      expect(html).toMatch(/<h4[^>]*>Четвёртый<\/h4>/)
      expect(html).toMatch(/<h4[^>]*>Пятый<\/h4>/)
      expect(html).toMatch(/<h4[^>]*>Шестой<\/h4>/)
      expect(html).not.toMatch(/<h[1256]/)
    })
  })
})
