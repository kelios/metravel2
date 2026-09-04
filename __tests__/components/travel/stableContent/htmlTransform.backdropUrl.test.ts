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

// A CSS background URL bypasses <img loading="lazy"> and eagerly downloads deep photos.
// The frame keeps its geometry in the HTML; the web effect adds the blur source after load.
describe('rich-image-frame markup preserves native image lazy loading', () => {
  const S3 =
    'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1607344305DSC01553.JPG'

  it('keeps the foreground source without an eager background source', () => {
    const out = prepareStableContentHtml(`<p><img src="${S3}" /></p>`)
    const imgSrc = out.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1] ?? ''
    // #1176: ключ нашего legacy-бакета переводится на первопартийный resize route.
    // Проверяемое здесь свойство от этого не зависит: фон не должен появляться в
    // разметке, иначе он ломает нативный lazy.
    // #1753: параметра формата в URL нет — в proxy-contract v16 явный `f=jpeg`
    // объявлен у `legacy_upload` как `unsupported_format` и отвечает 400.
    expect(imgSrc).toBe(
      'https://metravel.by/media-resize/uploads/1607344305DSC01553.JPG?w=800&amp;q=80&amp;fit=contain',
    )
    expect(imgSrc).not.toContain('metravelprod.s3')
    expect(imgSrc).not.toContain('images.weserv.nl')
    expect(out).toContain('loading="lazy"')
    expect(out).toContain('--travel-rich-image-aspect:800/450')
    expect(out).not.toContain('--travel-rich-image:url')
  })
})
