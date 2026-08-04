import {
  annotateImageSizes,
  extractUnsizedImageSources,
} from '@/services/pdf-export/utils/descriptionImageSizes'
import { groupConsecutiveImages } from '@/utils/richTextImageLayout'

describe('descriptionImageSizes', () => {
  describe('extractUnsizedImageSources', () => {
    it('возвращает src картинок без объявленных размеров', () => {
      const html = '<p><img src="a.jpg"></p><p><img src="b.jpg" width="800" height="600"></p>'
      expect(extractUnsizedImageSources(html)).toEqual(['a.jpg'])
    })

    it('не дублирует один и тот же src', () => {
      const html = '<p><img src="a.jpg"></p><p><img src="a.jpg"></p>'
      expect(extractUnsizedImageSources(html)).toEqual(['a.jpg'])
    })

    it('половинчатые размеры считаются отсутствующими', () => {
      const html = '<p><img src="a.jpg" width="800"></p>'
      expect(extractUnsizedImageSources(html)).toEqual(['a.jpg'])
    })

    it('не падает на пустом описании', () => {
      expect(extractUnsizedImageSources('')).toEqual([])
      expect(extractUnsizedImageSources(null)).toEqual([])
    })
  })

  describe('annotateImageSizes', () => {
    it('проставляет размеры по замеренным пропорциям', () => {
      const html = '<p><img src="a.jpg"></p>'
      const result = annotateImageSizes(html, new Map([['a.jpg', 1.5]]))
      expect(result).toContain('width="1000"')
      expect(result).toContain('height="667"')
    })

    it('не трогает кадры с объявленными размерами', () => {
      const html = '<p><img src="a.jpg" width="300" height="200"></p>'
      expect(annotateImageSizes(html, new Map([['a.jpg', 1.5]]))).toBe(html)
    })

    it('оставляет незамеренные кадры без изменений', () => {
      const html = '<p><img src="a.jpg"><img src="b.jpg"></p>'
      const result = annotateImageSizes(html, new Map([['a.jpg', 1.5]]))
      expect(result).toContain('<img src="a.jpg" width="1000" height="667">')
      expect(result).toContain('<img src="b.jpg">')
    })

    it('пустая карта замеров ничего не меняет', () => {
      const html = '<p><img src="a.jpg"></p>'
      expect(annotateImageSizes(html, new Map())).toBe(html)
    })
  })

  // Ради этого замер и делается: без него ориентация кадров книге неизвестна и
  // портреты попадают в ландшафтные слоты.
  it('замеренные пропорции меняют выбор журнальной раскладки', () => {
    const html = '<p>Т</p><p><img src="a.jpg"></p><p><img src="b.jpg"></p><p>Т</p>'
    const portraits = new Map([
      ['a.jpg', 0.75],
      ['b.jpg', 0.75],
    ])

    expect(groupConsecutiveImages(html)).toContain('img-stack-landscape')
    expect(groupConsecutiveImages(annotateImageSizes(html, portraits))).toContain('img-pair-portraits')
  })
})
