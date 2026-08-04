/**
 * Пустой слот вместо фото — второй, независимый дефект той же поломки.
 *
 * Когда прокси отвечал 400 на неподдержанную ступень (см.
 * `__tests__/utils/printImageWidth.test.ts`), разметка книги прятала `<img>` по
 * `onerror` и страница уходила в печать с дырой: в теле статьи — серая полоса под
 * заголовком, в карточке координат — плитка с alt-текстом «Точка N». Ширину чинит
 * контракт семейства, но любая будущая дыра (например 404 у класса `uploads/**`,
 * #1233) снова дала бы дыру, поэтому у печатной картинки есть вторая попытка —
 * тот же кадр без прокси-параметров.
 */
import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { buildPdfLocationCards } from '@/services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/locationCards'
import { getThemeConfig, minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig'
import { escapeHtml } from '@/services/pdf-export/utils/htmlUtils'

const theme = getThemeConfig('minimal')

const ADDRESS_IMAGE =
  'https://metravel.by/address-image/15057/conversions/4cd326b470a94f6690c7ead794bbf320.webp'

describe('картинка тела статьи в книге', () => {
  const renderer = new BlockRenderer(minimalTheme)

  it('просит ступень, которую семейство обслуживает', () => {
    const html = renderer.renderBlocks([{ type: 'image', src: ADDRESS_IMAGE } as any])
    expect(html).toContain('w=1200')
    expect(html).not.toContain('w=1600')
  })

  it('несёт запасной адрес и пробует его до того, как спрятать кадр', () => {
    const html = renderer.renderBlocks([{ type: 'image', src: ADDRESS_IMAGE } as any])
    expect(html).toContain('data-print-fallback=')
    expect(html).toContain('dataset.printFallback')
    // Запасной адрес — тот же кадр без параметров прокси.
    expect(html).toContain(`data-print-fallback="${escapeHtml(ADDRESS_IMAGE)}"`)
  })

  it('галерейная карточка получает ту же страховку', () => {
    const html = renderer.renderBlocks([
      {
        type: 'image-gallery',
        layout: 'row-2-landscape',
        columns: 2,
        images: [{ src: ADDRESS_IMAGE }, { src: ADDRESS_IMAGE }],
      } as any,
    ])
    expect(html.match(/data-print-fallback=/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('blob-кадру запасной адрес не нужен — он и есть локальный источник', () => {
    const html = renderer.renderBlocks([{ type: 'image', src: 'blob:local-image' } as any])
    expect(html).not.toContain('data-print-fallback=')
    expect(html).toContain("onerror=\"this.style.display='none';\"")
  })
})

describe('миниатюра точки в карточке координат', () => {
  const renderCard = (thumbnailUrl: string) =>
    buildPdfLocationCards({
      locations: [{ id: '1', address: 'Совейки, Барановичский район', coord: '52.9170, 26.4114', thumbnailUrl }],
      qrCodes: [],
      theme,
      showCoordinates: true,
      escapeHtml,
      getImageFilterStyle: () => '',
    })[0]

  it('пробует кадр без прокси-параметров вместо пустой плитки', () => {
    const card = renderCard(`${ADDRESS_IMAGE}?w=320&q=85&fit=contain`)
    expect(card).toContain(`data-print-fallback="${escapeHtml(ADDRESS_IMAGE)}"`)
    expect(card).toContain('dataset.printFallback')
  })

  it('без параметров в исходном адресе лишнего атрибута не появляется', () => {
    const card = renderCard(ADDRESS_IMAGE)
    expect(card).not.toContain('data-print-fallback=')
    expect(card).toContain("onerror=\"this.style.display='none';\"")
  })
})
