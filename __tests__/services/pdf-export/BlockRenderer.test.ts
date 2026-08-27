import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'

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
})
