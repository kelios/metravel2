import { BlockRenderer } from '@/src/services/pdf-export/renderers/BlockRenderer'
import { minimalTheme } from '@/src/services/pdf-export/themes/PdfThemeConfig'

describe('BlockRenderer', () => {
  it('keeps blob URLs for image blocks', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const html = renderer.renderBlocks([
      { type: 'image', src: 'blob:local-image', alt: 'blob' } as any,
    ])

    expect(html).toContain('src="blob:local-image"')
  })

  it('does not double proxy weserv URLs', () => {
    const renderer = new BlockRenderer(minimalTheme)
    const proxied = 'https://images.weserv.nl/?url=example.com/photo.jpg&w=1600&fit=inside'
    const html = renderer.renderBlocks([{ type: 'image', src: proxied } as any])

    expect(html).toContain('images.weserv.nl/?url=example.com/photo.jpg')
  })
})
