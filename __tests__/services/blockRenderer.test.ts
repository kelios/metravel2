import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'

const theme = getThemeConfig('minimal')

describe('BlockRenderer', () => {
  it('escapes unsafe text but keeps provided HTML content', () => {
    const renderer = new BlockRenderer(theme)

    const escaped = renderer.renderBlock({
      type: 'paragraph',
      text: 'Hello <script>alert(1)</script>',
    })

    expect(escaped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')

    const withHtml = renderer.renderBlock({
      type: 'paragraph',
      text: 'Bold',
      html: '<strong>Bold</strong>',
    })

    expect(withHtml).toContain('<strong>Bold</strong>')
  })

  it('renders common structural blocks with theme styles', () => {
    const renderer = new BlockRenderer(theme)

    const html = renderer.renderBlocks([
      { type: 'heading', level: 3, text: 'Маршрут' } as any,
      { type: 'list', ordered: true, items: ['Пункт 1', 'Пункт 2'] } as any,
      { type: 'warning-block', content: 'Осторожно', title: 'Важно' } as any,
      { type: 'table', headers: ['Колонка'], rows: [['Значение']] } as any,
    ])

    expect(html).toContain('<h3')
    expect(html).toContain('<ol')
    expect(html).toContain('Осторожно')
    expect(html).toContain('<table')
  })

  it('renders media-oriented blocks and separators', () => {
    const renderer = new BlockRenderer(theme)

    const image = renderer.renderBlock({
      type: 'image',
      src: 'http://example.com/photo.png',
      alt: 'Картинка <danger>',
      caption: 'Описание',
      width: 200,
      height: 100,
    } as any)
    expect(image).toContain('images.weserv.nl')
    expect(image).toContain('&lt;danger&gt;')
    expect(image).toContain('Описание')
    expect(image).not.toContain('Изображение недоступно')
    expect(image).toContain("onerror=\"this.style.display='none';\"")
    expect(image).toContain('filter: blur(18px) saturate(1.06)')
    expect(image).toContain('object-fit: contain')

    const gallery = renderer.renderBlock({
      type: 'image-gallery',
      columns: 3,
      images: [{ src: 'a.jpg' }, { src: 'b.jpg' }],
    } as any)
    expect(gallery).toContain('grid-template-columns: repeat(3')
    expect(gallery).toContain('a.jpg')
    expect(gallery).toContain('filter: blur(18px) saturate(1.06)')

    const mixedGallery = renderer.renderBlock({
      type: 'image-gallery',
      layout: 'grid-mixed',
      columns: 2,
      images: [
        { src: 'wide-a.jpg', width: 1200, height: 700 },
        { src: 'tall.jpg', width: 700, height: 1200 },
        { src: 'wide-b.jpg', width: 1200, height: 700 },
      ],
    } as any)
    expect(mixedGallery).toContain('grid-template-columns: 0.92fr 1.08fr')
    expect(mixedGallery).toContain('min-height: 80mm')

    const quiltGallery = renderer.renderBlock({
      type: 'image-gallery',
      layout: 'grid-quilt',
      columns: 6,
      images: [
        { src: '1.jpg' },
        { src: '2.jpg' },
        { src: '3.jpg' },
        { src: '4.jpg' },
      ],
    } as any)
    expect(quiltGallery).toContain('grid-template-columns: repeat(6, 1fr)')
    expect(quiltGallery).toContain('grid-column: span 4')

    const separator = renderer.renderBlock({ type: 'separator' } as any)
    expect(separator).toContain('<hr')
  })

  it('renders single image layout variants for pdf-rich text media', () => {
    const renderer = new BlockRenderer(theme)

    const floated = renderer.renderBlock({
      type: 'image',
      src: 'https://example.com/portrait.jpg',
      layout: 'float-right',
    } as any)

    expect(floated).toContain('width: 56%')
    expect(floated).toContain('margin:')
    expect(floated).toContain('auto')
  })

  it('keeps short paragraph captions together with the following media block', () => {
    const renderer = new BlockRenderer(theme)

    const html = renderer.renderBlocks([
      { type: 'paragraph', text: 'Папин Др апрель 2019 год на реке Зеленуха' } as any,
      {
        type: 'image-gallery',
        layout: 'pair-balanced',
        columns: 2,
        images: [{ src: '1.jpg' }, { src: '2.jpg' }],
      } as any,
    ])

    expect(html).toContain('page-break-after: avoid; break-after: avoid-page;')
    expect(html).toContain('grid-template-columns: 1.02fr 0.98fr')
  })

  it('normalizes relative image URLs so they can be fetched in print/PDF context', () => {
    const renderer = new BlockRenderer(theme)

    const rootRelative = renderer.renderBlock({
      type: 'image',
      src: '/storage/photo.png',
    } as any)
    expect(rootRelative).toContain('images.weserv.nl')
    const expectedRoot = `${window.location.origin}/storage/photo.png`
    expect(rootRelative).toContain(encodeURIComponent(expectedRoot))

    const protocolRelative = renderer.renderBlock({
      type: 'image',
      src: '//cdn.example.com/photo.png',
    } as any)
    expect(protocolRelative).toContain('images.weserv.nl')
    expect(protocolRelative).toContain(encodeURIComponent('https://cdn.example.com/photo.png'))
  })
})
