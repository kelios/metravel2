import { RuntimeGalleryRenderer } from '@/services/pdf-export/generators/v2/runtime/renderers/GalleryPageRenderer'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'

const URL1 = 'https://metravel.by/gallery/photo-1.jpg'
const URL2 = 'https://metravel.by/gallery/photo-2.jpg'

function makeRenderer(aspects?: Record<string, number>, settings?: any) {
  const renderer = new RuntimeGalleryRenderer({ theme: getThemeConfig('minimal'), settings })
  if (aspects) renderer.setImageAspects(new Map(Object.entries(aspects)))
  return renderer
}

function renderPage(renderer: RuntimeGalleryRenderer, gallery: Array<{ url: string; caption?: string }>) {
  const pages = renderer.renderPages({ id: 1, name: 'Trip', gallery } as any, 5)
  expect(pages.length).toBeGreaterThan(0)
  return pages[0]
}

describe('RuntimeGalleryRenderer', () => {
  it('строит бокс фото по замеренному aspect-ratio (без фиксированной высоты-letterbox)', () => {
    const renderer = makeRenderer({ [URL1]: 2 })
    const page = renderPage(renderer, [{ url: URL1 }])

    const width = parseFloat(page.match(/width: (\d+\.\d{2})mm; flex: 0 0 auto/)![1])
    const height = parseFloat(page.match(/height: (\d+\.\d{2})mm;/)![1])
    expect(width / height).toBeCloseTo(2, 1)
  })

  it('два landscape-фото раскладывает в два ряда во всю ширину, а не в узкие колонки', () => {
    const renderer = makeRenderer({ [URL1]: 1.5, [URL2]: 1.5 })
    const page = renderPage(renderer, [{ url: URL1 }, { url: URL2 }])

    const rowCount = (page.match(/gallery-justified-row/g) || []).length
    expect(rowCount).toBe(2)
    // высота ряда крупная (страница делится между двумя рядами), не 51мм узкой колонки
    const heights = [...page.matchAll(/height: (\d+\.\d{2})mm;/g)].map((m) => parseFloat(m[1]))
    expect(Math.max(...heights)).toBeGreaterThan(70)
  })

  it('два portrait-фото ставит рядом в один ряд', () => {
    const renderer = makeRenderer({ [URL1]: 0.66, [URL2]: 0.66 })
    const page = renderPage(renderer, [{ url: URL1 }, { url: URL2 }])

    const rowCount = (page.match(/gallery-justified-row/g) || []).length
    expect(rowCount).toBe(1)
  })

  it('выводит подпись под фото (экранированную), без подписи figcaption нет', () => {
    const renderer = makeRenderer({ [URL1]: 1.5, [URL2]: 1.5 })
    const page = renderPage(renderer, [{ url: URL1, caption: 'Закат & <море>' }, { url: URL2 }])

    expect(page).toContain('Закат &amp; &lt;море&gt;')
    expect((page.match(/<figcaption/g) || []).length).toBe(1)
  })

  it('не выводит подписи при showCaptions: false', () => {
    const renderer = makeRenderer({ [URL1]: 1.5 }, { showCaptions: false })
    const page = renderPage(renderer, [{ url: URL1, caption: 'Подпись' }])

    expect(page).not.toContain('<figcaption')
    expect(page).not.toContain('Подпись')
  })

  it('без замеренных пропорций рендерит contain-фото с shared-source blur-фоном', () => {
    const renderer = makeRenderer()
    const page = renderPage(renderer, [{ url: URL1 }])

    expect(page).toContain('object-fit: contain')
    expect(page).toContain('blur(28px)')
  })

  it('polaroid-пресет показывает реальную подпись вместо «Фото N»', () => {
    const renderer = makeRenderer(undefined, { galleryLayout: 'polaroid' })
    const page = renderPage(renderer, [{ url: URL1, caption: 'Нормандия' }])

    expect(page).toContain('Нормандия')
  })
})
