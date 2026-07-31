jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

// #1188: редакторская разметка кладёт <img> прямо между заголовками, без абзаца.
// Такая картинка не попадала в `.rich-image-frame`, а значит оставалась без блюр-подложки:
// на проде 2026-07-31 из 37 картинок тела статьи во фрейме было 0, и поля вокруг кадра
// других пропорций оставались пустыми белыми.
describe('rich-image-frame covers root-level images', () => {
  const SRC = 'https://metravel.by/gallery/3514/conversions/photo-detail_hd.jpg'

  const framesOf = (html: string) => html.match(/rich-image-frame/g)?.length ?? 0

  it('wraps a bare <img> between headings into a blur frame', () => {
    const out = prepareStableContentHtml(
      `<h3>Ружаны</h3><img src="${SRC}" /><p>Дворец Сапег.</p>`
    )

    expect(framesOf(out)).toBe(1)
    expect(out).toMatch(/<p[^>]*class="rich-image-frame"[^>]*>\s*<img\b/i)
    expect(out).toContain('--travel-rich-image-aspect:800/450')
    // Соседний текст и его порядок не меняются.
    expect(out).toContain('<h3>Ружаны</h3>')
    expect(out).toContain('Дворец Сапег.')
    expect(out.indexOf('<h3>')).toBeLessThan(out.indexOf('rich-image-frame'))
  })

  it('wraps every root-level image on a photo-heavy description', () => {
    const out = prepareStableContentHtml(
      [1, 2, 3].map((i) => `<h3>Точка ${i}</h3><img src="${SRC}?i=${i}" />`).join('')
    )

    expect(framesOf(out)).toBe(3)
    expect(out.match(/<img\b/g)?.length).toBe(3)
  })

  it('marks the reserved 16:9 slot as a fallback, but keeps declared sizes untouched', () => {
    const withoutSize = prepareStableContentHtml(`<p><img src="${SRC}" /></p>`)
    expect(withoutSize).toContain('width="800" height="450"')
    expect(withoutSize).toContain('data-aspect-fallback="1"')

    const withSize = prepareStableContentHtml(`<p><img src="${SRC}" width="1200" height="1200" /></p>`)
    expect(withSize).toContain('width="1200" height="1200"')
    expect(withSize).not.toContain('data-aspect-fallback')
  })

  it('does not double-wrap an image that already sits in a paragraph', () => {
    const out = prepareStableContentHtml(`<p><img src="${SRC}" /></p>`)

    expect(framesOf(out)).toBe(1)
    expect(out).not.toMatch(/<p[^>]*>\s*<p\b/i)
  })

  it('leaves images nested inside other containers untouched', () => {
    const out = prepareStableContentHtml(
      `<blockquote><span><img src="${SRC}" /></span></blockquote>`
    )

    expect(framesOf(out)).toBe(0)
    expect(out).toContain('<blockquote>')
  })
})
