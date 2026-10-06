import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import {
  PDF_PRINT_HEADING_LEVELS,
  PDF_RICH_TEXT_SECTIONS,
  PDF_RICH_TEXT_SECTION_TITLE_LEVELS,
  resolveHeadingStyle,
  resolveSectionHeadingLevel,
  type PdfRichTextSection,
} from '@/services/pdf-export/themes/headingLevels'
import { PDF_THEMES, minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'

describe('BlockRenderer', () => {
  it('keeps blob URLs for image blocks', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderBlocks([
      { type: 'image', src: 'blob:local-image', alt: 'blob' } as any,
    ], 'description')

    expect(html).toContain('src="blob:local-image"')
  })

  it('keeps the heading hierarchy of the description instead of flattening it to h4', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderRichText(`
      <h2>Что находится внутри</h2>
      <h3>Замковая кухня</h3>
      <h2>Частые вопросы о замке Мальборк</h2>
      <details><summary><strong>Сколько времени нужно на осмотр?</strong></summary><p>Минимум четыре часа.</p></details>
    `, 'description')

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
    const html = renderer.renderBlocks([{ type: 'image', src: proxied } as any], 'description')

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
    ], 'description')

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
    ], 'description')

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
    ], 'description')

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
    `, 'description')

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
      '<p class="img-float-left figure-portrait"><img src="left.jpg" width="600" height="900"></p><p>Текст рядом.</p>', 'description'
    )

    expect(html).toContain('class="pdf-rich-image img-float-left"')
    expect(html).toContain('float: left')
    expect(html).not.toContain('class="pdf-rich-image img-float-right"')
  })

  // #1296, #2210, #2255: заголовок автора любого уровня h1–h6 в любом rich-text
  // блоке печатается мельче названия своего блока, тегом и стилем одной ступени
  // печатной шкалы, и не роняет сборку на стиле `undefined`.
  describe('уровни заголовков', () => {
    const themes = Object.entries(PDF_THEMES)
    const AUTHOR_LEVELS = [1, 2, 3, 4, 5, 6] as const
    const pt = (size: string) => {
      const match = size.match(/^(\d+(?:\.\d+)?)pt$/)
      if (!match) throw new Error(`Кегль не в pt: ${size}`)
      return Number(match[1])
    }
    const renderHeading = (
      renderer: BlockRenderer,
      section: PdfRichTextSection,
      level: (typeof AUTHOR_LEVELS)[number]
    ) => renderer.renderBlocks([{ type: 'heading', level, text: 'Заголовок' }], section)

    // Карта решения #2255 (docs/features/export.md → «Известные ловушки»).
    it('карта «уровень автора → печатный уровень» по блокам', () => {
      const map = Object.fromEntries(
        PDF_RICH_TEXT_SECTIONS.map((section) => [
          section,
          AUTHOR_LEVELS.map((level) => resolveSectionHeadingLevel(section, level)),
        ])
      )

      expect(map).toEqual({
        description: [3, 3, 4, 4, 4, 4],
        recommendation: [3, 3, 4, 4, 4, 4],
        plus: [5, 5, 6, 6, 6, 6],
        minus: [5, 5, 6, 6, 6, 6],
      })
    })

    it.each(themes)('тема %s: печатная шкала h1–h6 строго убывает по кеглю', (_name, theme) => {
      const sizes = PDF_PRINT_HEADING_LEVELS.map((level) => pt(resolveHeadingStyle(theme.typography, level).size))

      sizes.slice(1).forEach((size, index) => expect(size).toBeLessThan(sizes[index]))
    })

    it.each(themes)(
      'тема %s: заголовок автора в каждом блоке мельче названия блока, тег и стиль одной ступени',
      (_name, theme) => {
        const renderer = new BlockRenderer(theme)

        for (const section of PDF_RICH_TEXT_SECTIONS) {
          const titleSize = pt(theme.typography[`h${PDF_RICH_TEXT_SECTION_TITLE_LEVELS[section]}`].size)

          for (const authorLevel of AUTHOR_LEVELS) {
            const printed = resolveSectionHeadingLevel(section, authorLevel)
            const style = resolveHeadingStyle(theme.typography, printed)
            const html = renderHeading(renderer, section, authorLevel)

            expect(html).toMatch(new RegExp(`<h${printed} style="[^"]*">Заголовок</h${printed}>`))
            expect(html).toContain(`font-size: ${style.size};`)
            expect(html).toContain(`font-weight: ${style.weight};`)
            expect(html).toContain(`line-height: ${style.lineHeight};`)
            expect(html).toContain(`margin-bottom: ${style.marginBottom};`)
            expect(html).not.toContain('undefined')
            expect(pt(style.size)).toBeLessThan(titleSize)
          }
        }
      }
    )

    it('описание: понижение уровней прежнее, h5 и h6 печатаются как h4', () => {
      const renderer = new BlockRenderer(minimalTheme)
      const html = renderer.renderRichText(
        '<h1>Первый</h1><h2>Второй</h2><h3>Третий</h3><h4>Четвёртый</h4><h5>Пятый</h5><h6>Шестой</h6>',
        'description'
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
