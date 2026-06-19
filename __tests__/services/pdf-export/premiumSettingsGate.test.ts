// __tests__/services/pdf-export/premiumSettingsGate.test.ts
// Авторитетный даунгрейд не-премиум настроек книги на этапе генерации (FE-8)

import {
  downgradeNonPremiumSettings,
  isPremiumGalleryLayout,
  isPremiumCaptionPosition,
  isPremiumCoverType,
} from '@/services/pdf-export/premiumSettingsGate'

describe('premiumSettingsGate', () => {
  describe('predicates', () => {
    it('премиум-раскладки галереи', () => {
      expect(isPremiumGalleryLayout('collage')).toBe(true)
      expect(isPremiumGalleryLayout('slideshow')).toBe(true)
      expect(isPremiumGalleryLayout('grid')).toBe(false)
      expect(isPremiumGalleryLayout('masonry')).toBe(false)
      expect(isPremiumGalleryLayout('polaroid')).toBe(false)
    })

    it('overlay-подпись — премиум', () => {
      expect(isPremiumCaptionPosition('overlay')).toBe(true)
      expect(isPremiumCaptionPosition('bottom')).toBe(false)
    })

    it('custom-обложка — премиум', () => {
      expect(isPremiumCoverType('custom')).toBe(true)
      expect(isPremiumCoverType('auto')).toBe(false)
    })
  })

  describe('downgradeNonPremiumSettings (!isPremium)', () => {
    it('даунгрейдит premium galleryLayout/captionPosition/coverType к free-дефолтам', () => {
      const input = {
        galleryLayout: 'slideshow' as const,
        captionPosition: 'overlay' as const,
        coverType: 'custom' as const,
        title: 'Книга',
      }
      const result = downgradeNonPremiumSettings(input, false)

      expect(result.galleryLayout).toBe('grid')
      expect(result.captionPosition).toBe('bottom')
      expect(result.coverType).toBe('auto')
      expect(result.title).toBe('Книга')
    })

    it('не трогает free-значения', () => {
      const input = {
        galleryLayout: 'masonry' as const,
        captionPosition: 'top' as const,
        coverType: 'gradient' as const,
      }
      const result = downgradeNonPremiumSettings(input, false)

      expect(result.galleryLayout).toBe('masonry')
      expect(result.captionPosition).toBe('top')
      expect(result.coverType).toBe('gradient')
    })

    it('не мутирует входной объект', () => {
      const input = { galleryLayout: 'collage' as const }
      const result = downgradeNonPremiumSettings(input, false)

      expect(input.galleryLayout).toBe('collage')
      expect(result).not.toBe(input)
      expect(result.galleryLayout).toBe('grid')
    })
  })

  describe('downgradeNonPremiumSettings (isPremium)', () => {
    it('возвращает settings без изменений при isPremium=true', () => {
      const input = {
        galleryLayout: 'slideshow' as const,
        captionPosition: 'overlay' as const,
        coverType: 'custom' as const,
      }
      const result = downgradeNonPremiumSettings(input, true)

      expect(result).toBe(input)
      expect(result.galleryLayout).toBe('slideshow')
      expect(result.captionPosition).toBe('overlay')
      expect(result.coverType).toBe('custom')
    })
  })
})
