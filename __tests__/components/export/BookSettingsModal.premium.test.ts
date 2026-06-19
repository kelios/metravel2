// __tests__/components/export/BookSettingsModal.premium.test.ts
// Премиум-гейт опций книги: кастом-обложка + журнальные раскладки (#298)

import {
  isPremiumCoverType,
  isPremiumGalleryLayout,
  isPremiumCaptionPosition,
  gallerySettingNeedsPremium,
} from '@/components/export/BookSettingsModal.premium'

describe('BookSettingsModal premium gate (#298)', () => {
  describe('cover type', () => {
    it('custom-обложка — премиум', () => {
      expect(isPremiumCoverType('custom')).toBe(true)
    })

    it('встроенные обложки — бесплатные', () => {
      expect(isPremiumCoverType('auto')).toBe(false)
      expect(isPremiumCoverType('first-photo')).toBe(false)
      expect(isPremiumCoverType('gradient')).toBe(false)
    })
  })

  describe('gallery layouts', () => {
    it('журнальные раскладки — премиум', () => {
      expect(isPremiumGalleryLayout('collage')).toBe(true)
      expect(isPremiumGalleryLayout('slideshow')).toBe(true)
    })

    it('базовые раскладки — бесплатные', () => {
      expect(isPremiumGalleryLayout('grid')).toBe(false)
      expect(isPremiumGalleryLayout('masonry')).toBe(false)
      expect(isPremiumGalleryLayout('polaroid')).toBe(false)
    })

    it('overlay-подпись — премиум, остальные — бесплатные', () => {
      expect(isPremiumCaptionPosition('overlay')).toBe(true)
      expect(isPremiumCaptionPosition('bottom')).toBe(false)
      expect(isPremiumCaptionPosition('top')).toBe(false)
      expect(isPremiumCaptionPosition('none')).toBe(false)
    })

    it('full-bleed фото-страница — НЕ премиум (базовая раскладка)', () => {
      expect(gallerySettingNeedsPremium({ photoPageLayout: 'full-bleed' })).toBe(false)
    })
  })

  describe('gallerySettingNeedsPremium', () => {
    it('true для любой премиум-правки галереи', () => {
      expect(gallerySettingNeedsPremium({ galleryLayout: 'collage' })).toBe(true)
      expect(gallerySettingNeedsPremium({ captionPosition: 'overlay' })).toBe(true)
    })

    it('false для бесплатных правок', () => {
      expect(gallerySettingNeedsPremium({ galleryLayout: 'grid' })).toBe(false)
      expect(gallerySettingNeedsPremium({ captionPosition: 'bottom' })).toBe(false)
      expect(gallerySettingNeedsPremium({ galleryColumns: 4, showCaptions: true })).toBe(false)
      expect(gallerySettingNeedsPremium({})).toBe(false)
    })
  })
})
