// BOOK-Q6 — единый визуальный язык раскладки фото.
// Полноразмерная travel-фото-страница (hero / full-bleed) обязана использовать
// contain + shared-source blur-backdrop, НЕ cover. Покрывает матрицу ролей.

import { renderTravelPhotoPageMarkup } from '@/services/pdf-export/generators/v2/runtime/travelPhotoPage'
import { buildContainImageMarkup } from '@/services/pdf-export/generators/v2/runtime/pdfVisualHelpers'
import { buildPdfLocationCards } from '@/services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/locationCards'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
import { escapeHtml } from '@/services/pdf-export/utils/htmlUtils'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSettings } from '@/components/export/BookSettingsModal'

const theme = getThemeConfig('minimal')

const buildContainImage = (
  src: string,
  alt: string,
  height: string,
  opts?: { onerrorBg?: string; extraStyle?: string },
): string =>
  buildContainImageMarkup({
    src,
    alt,
    height,
    background: opts?.onerrorBg ?? theme.colors.surfaceAlt,
    extraStyle: opts?.extraStyle,
  })

const travel: TravelForBook = {
  id: 1,
  name: 'Озеро на рассвете',
  slug: 'lake',
  url: 'https://metravel.by/travels/lake',
  countryName: 'Беларусь',
  year: '2023',
  number_days: 1,
  travel_image_url: 'https://picsum.photos/seed/hero/1200/800',
  travel_image_thumb_url: 'https://picsum.photos/seed/hero/1200/800',
  gallery: [],
}

function render(layout: NonNullable<BookSettings['photoPageLayout']> | 'full-bleed'): string {
  return renderTravelPhotoPageMarkup({
    travel,
    pageNumber: 1,
    theme,
    layout,
    buildSafeImageUrl: (url) => url ?? undefined,
    escapeHtml,
    formatDays: () => '1 день',
    buildContainImage,
  })
}

describe('travelPhotoPage — матрица роль фото → fit (BOOK-Q6)', () => {
  const layouts: Array<NonNullable<BookSettings['photoPageLayout']> | 'full-bleed'> = [
    'full-bleed',
    'framed',
    'split',
  ]

  it.each(layouts)('hero layout "%s": contain (не cover) + blur-backdrop', (layout) => {
    const html = render(layout)

    // основное фото — contain
    expect(html).toContain('object-fit:contain')

    // shared-source blur-backdrop присутствует с первого кадра
    expect(html).toMatch(/filter:blur\(\d+px\)/)
    expect(html).toContain('aria-hidden="true"')

    // главное hero-фото НЕ режется cover'ом (object-position center на полноразмерном img)
    expect(html).not.toContain('object-fit: cover')
    expect(html).not.toContain('object-fit:cover;object-position')
  })

  it('full-bleed: scrim не затемняет центр кадра (узкая нижняя полоса)', () => {
    const html = render('full-bleed')
    // верхние ~62% кадра прозрачны, затемнение только в нижней зоне под подписью
    expect(html).toContain('rgba(15,23,42,0.0) 62%')
    // нет плотной центральной заливки старого образца
    expect(html).not.toContain('rgba(15,23,42,0.18) 100%),\n              linear-gradient')
  })

  it('utility-исключение: thumbnail точки маршрута (~80px) — cover допустим', () => {
    const cards = buildPdfLocationCards({
      locations: [
        {
          id: '1',
          address: 'Озеро Нарочь',
          coord: '54.86,26.73',
          thumbnailUrl: 'https://picsum.photos/seed/poi/200/200',
        },
      ],
      qrCodes: [],
      theme,
      showCoordinates: true,
      escapeHtml,
      getImageFilterStyle: () => '',
    })
    const html = cards.join('')
    expect(html).toContain('map-location-card')
    expect(html).toContain('object-fit: cover')
  })
})
