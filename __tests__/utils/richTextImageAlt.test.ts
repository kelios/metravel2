import { ensureRichTextImageAlt } from '@/utils/richTextImageAlt'
import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

// #3237: подпись фото в статье — это `alt` картинки из редактора. Нет подписи —
// `alt=""` (явный пустой атрибут), текст вместо подписи не выдумывается.
const altOf = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return Array.from(host.querySelectorAll('img')).map((img) => img.getAttribute('alt'))
}

// Разметка тела статьи «Тиволи» с прода: картинки без `alt`, одна с подписью автора.
const ARTICLE = [
  '<p class="img-float-right figure-portrait"><img loading="lazy" src="https://metravel.by/travel-description-image/ba11.JPG.webp"></p>',
  '<div class="img-pair-balanced"><p><img loading="lazy" src="https://metravel.by/travel-description-image/32eb.JPG.webp"></p>',
  '<p><img loading="lazy" src="https://metravel.by/travel-description-image/3601.JPG.webp" alt="  "></p></div>',
  '<p><img src="https://metravel.by/travel-description-image/abcd.webp" alt="Руины костёла в Смолянах"></p>',
].join('')

describe('article image alt (server HTML)', () => {
  it('gives every image an alt: the author caption or an empty one', () => {
    expect(altOf(ensureRichTextImageAlt(ARTICLE))).toEqual(['', '', '', 'Руины костёла в Смолянах'])
  })

  it('leaves markup without images and with complete alts untouched', () => {
    const plain = '<p>Текст</p>'
    expect(ensureRichTextImageAlt(plain)).toBe(plain)
    const captioned = '<p><img src="https://metravel.by/a.webp" alt="Фото"></p>'
    expect(ensureRichTextImageAlt(captioned)).toBe(captioned)
  })
})

describe('article image alt (hydrated rich text)', () => {
  it('uses the same contract and no longer invents «Изображение маршрута N»', () => {
    const alts = altOf(prepareStableContentHtml(ARTICLE, { serverSanitized: true }))
    expect(alts).toEqual(['', '', '', 'Руины костёла в Смолянах'])
    expect(alts.join(' ')).not.toMatch(/маршрута/)
  })
})
