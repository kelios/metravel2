import { Platform } from 'react-native'

import {
  DEFAULT_STICKY_HEADER_HEIGHT,
  isDocumentScrollContainer,
  resolveSectionScrollOffset,
  resolveStickyHeaderBottom,
} from '@/utils/sectionScrollOffset'

const mountHeader = (bottom: number) => {
  const header = document.createElement('div') as any
  header.setAttribute('data-testid', 'main-header')
  header.getBoundingClientRect = () => ({ top: bottom - 64, bottom, height: 64 } as any)
  document.body.appendChild(header)
  return header
}

const fakeContainer = (top: number) => {
  const el = document.createElement('div') as any
  el.getBoundingClientRect = () => ({ top, bottom: top + 400, height: 400 } as any)
  return el as HTMLElement
}

describe('sectionScrollOffset', () => {
  beforeEach(() => {
    Platform.OS = 'web' as any
    document.body.innerHTML = ''
  })

  describe('resolveStickyHeaderBottom', () => {
    it('measures the app header by its stable testID selector', () => {
      mountHeader(78)
      expect(resolveStickyHeaderBottom()).toBe(78)
    })

    it('falls back to the passed height when the header is not in the DOM', () => {
      expect(resolveStickyHeaderBottom(56)).toBe(56)
      expect(resolveStickyHeaderBottom()).toBe(DEFAULT_STICKY_HEADER_HEIGHT)
    })

    it('returns 0 when the header has scrolled above the viewport', () => {
      mountHeader(-20)
      expect(resolveStickyHeaderBottom()).toBe(0)
    })
  })

  describe('resolveSectionScrollOffset', () => {
    it('offsets by the full header height for document-level scrolling', () => {
      mountHeader(78)
      expect(resolveSectionScrollOffset(null)).toBe(78)
      expect(resolveSectionScrollOffset(document.scrollingElement)).toBe(78)
    })

    it('offsets only by the part of the container hidden behind the header', () => {
      mountHeader(78)
      expect(resolveSectionScrollOffset(fakeContainer(0))).toBe(78)
      expect(resolveSectionScrollOffset(fakeContainer(30))).toBe(48)
    })

    it('does not offset a container that already starts below the header (regression)', () => {
      // Раскладка travel-details на desktop: контейнер начинается ровно под
      // шапкой. Лишнее вычитание уводило секцию ниже «линии чтения» scrollspy.
      mountHeader(78)
      expect(resolveSectionScrollOffset(fakeContainer(78))).toBe(0)
      expect(resolveSectionScrollOffset(fakeContainer(140))).toBe(0)
    })
  })

  describe('isDocumentScrollContainer', () => {
    it('recognises document-level scroll roots', () => {
      expect(isDocumentScrollContainer(null)).toBe(true)
      expect(isDocumentScrollContainer(window)).toBe(true)
      expect(isDocumentScrollContainer(document.documentElement)).toBe(true)
      expect(isDocumentScrollContainer(document.body)).toBe(true)
    })

    it('treats a nested element as its own scroll container', () => {
      expect(isDocumentScrollContainer(fakeContainer(0))).toBe(false)
    })
  })
})
