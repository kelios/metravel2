import { BlockRenderer } from '@/src/services/pdf-export/renderers/BlockRenderer'
import { getThemeConfig } from '@/src/services/pdf-export/themes/PdfThemeConfig'

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

    const gallery = renderer.renderBlock({
      type: 'image-gallery',
      columns: 3,
      images: [{ src: 'a.jpg' }, { src: 'b.jpg' }],
    } as any)
    expect(gallery).toContain('grid-template-columns: repeat(3')
    expect(gallery).toContain('a.jpg')

    const separator = renderer.renderBlock({ type: 'separator' } as any)
    expect(separator).toContain('<hr')
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
